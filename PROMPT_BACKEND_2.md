# PROMPT_BACKEND_2.md — Especificação Técnica de Backend

> Versão 2 — Revisão crítica e pragmática.
> Supera o PROMPT_BACKEND.md original em precisão, escolhas tecnológicas e sequência de implementação.

---

## CONTEXTO EXECUTIVO

**Projeto:** Volta à Ilha — Agência de Turismo, Morro de São Paulo, BA  
**Frontend:** SPA vanilla (HTML/CSS/JS), sem framework, sem build tool  
**Objetivo imediato:** Transformar a vitrine atual em um sistema funcional de vendas com:
- Checkout com pagamento real (Pix + cartão)
- Gestão de vagas/disponibilidade
- Emissão automática de vouchers
- Notificações (cliente + operadores)
- **Painel administrativo completo** (Matteo confirmou em 2026-04-23 que precisa criar/editar TUDO pelo painel: accordions, fotos, horários, valores, política infantil específica por produto, etc — sem editar HTML manualmente)

**Restrição financeira assumida:** Startup de turismo regional. Custo mensal de infra deve ficar abaixo de R$ 300/mês até atingir escala.

---

## STACK RECOMENDADA

### Por que essa stack?

```
Backend:     Node.js 22 LTS + Fastify 5
Banco:       PostgreSQL 16 (Supabase free tier → upgrade quando necessário)
Authn:       Supabase Auth (JWT, row-level security built-in)
Pagamento:   MercadoPago (melhor cobertura Pix no Brasil, SDK maduro)
PDF:         Puppeteer (headless Chrome) ou @pdf-lib/pdf-lib (mais leve)
WhatsApp:    Evolution API (self-hosted) ou Z-API (managed, ~R$ 50/mês)
Email:       Resend.com (free 3000 emails/mês, API simples)
Hosting:     Railway.app ou Render.com (~R$ 50-100/mês para backend)
CDN/Proxy:   Cloudflare (free — CSP, WAF, cache de assets)
```

**Por que Fastify e não Express?**  
2x mais rápido em throughput, schema validation nativa (Ajv), plugin system mais seguro. Para uma API de reservas de turismo com picos sazonais, isso importa.

**Por que MercadoPago e não Stripe?**  
Pix nativo, D+2 para PJ brasileiro, melhor taxa de aprovação de cartões emitidos no Brasil, dashboard em português.

**Por que Supabase e não RDS/self-hosted Postgres?**  
Auth, Row Level Security e Realtime prontos. Free tier aguenta até ~500 MAU perfeitamente. Migração para RDS é trivial quando necessário.

---

## MODOS DE PRICING

A agência opera **100% via fornecedores terceirizados** — `capacity` representa quanto vendemos, não limite físico. Existem dois modos de cobrança:

### `per_person` (default)
Cliente reserva por pessoa. Total = `price_full × pax`. Aplica `child_discount` para 6-9 anos e gratuidade para infants ≤ `infant_max_age`.

### `per_vehicle` (Buggy, Quadriciclo)
Cliente reserva o **veículo inteiro**, não vagas dentro dele. Total = `price_full + (insurance_per_pax × pax_no_veículo)`. Validações:
- `pax_no_veículo` não pode exceder `vehicle_capacity`
- `qty_adults + qty_children` no payload representa pessoas no veículo (para cálculo de seguro)
- `availability` conta 1 reserva = 1 veículo (não a soma de pax)
- Quadriciclo exige CNH (`requires_cnh = true`) — frontend deve mostrar aviso

Exemplo Buggy:
- 4 pessoas no veículo: R$ 700 + (R$ 5 × 4) = **R$ 720 total**, sinal R$ 200, restante R$ 520

---

## MODELO DE DADOS

```sql
-- Categorias de produto
CREATE TYPE product_type AS ENUM ('passeio', 'atividade', 'passagem_ida', 'passagem_volta');

-- Fornecedores/Parceiros
CREATE TABLE providers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    whatsapp    TEXT NOT NULL,  -- formato E.164: +5575XXXXXXXXX
    email       TEXT,
    active      BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Produtos
CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id     UUID REFERENCES providers(id),
    type            product_type NOT NULL,
    name            TEXT NOT NULL,            -- pt-BR (texto-base p/ traduções)
    description     TEXT,
    price_full        NUMERIC(10,2) NOT NULL,
    price_deposit     NUMERIC(10,2),           -- NULL = paga tudo online
    pricing_mode      TEXT NOT NULL DEFAULT 'per_person'
                      CHECK (pricing_mode IN ('per_person', 'per_vehicle')),
    vehicle_capacity  SMALLINT,                -- só para per_vehicle (Buggy=4, Quadriciclo=2)
    insurance_per_pax NUMERIC(10,2),           -- ex: R$ 5 para Buggy/Quadriciclo
    capacity          SMALLINT NOT NULL,        -- vagas (per_person) OU veículos (per_vehicle) por horário/dia
    departure_times   TEXT[] NOT NULL,          -- ex: {'09:30','14:00'}
    cutoff_hour       SMALLINT DEFAULT 8,       -- hora de corte D-0
    cutoff_minute     SMALLINT DEFAULT 30,
    -- Política infantil ESPECÍFICA deste produto (pode variar)
    child_min_age   SMALLINT,                 -- ex: 6 (Banana Boat); NULL = aceita qualquer idade
    child_discount  NUMERIC(4,2),             -- ex: 0.50 (50% off); NULL = sem desconto
    infant_max_age  SMALLINT DEFAULT 5,       -- até essa idade é gratuito
    requires_cnh    BOOLEAN DEFAULT false,    -- ex: Quadriciclo
    -- Accordions/conteúdo editável via painel
    accordion_data  JSONB DEFAULT '[]'::jsonb,  -- [{title, body_html}, ...] em pt-BR
    -- Mídia
    photos          TEXT[] DEFAULT '{}',      -- URLs (Supabase Storage)
    bg_gradient     TEXT,                     -- ex: 'ticket-card-img--catamaran'; alternativa a photos
    -- Traduções (override opcional do auto-tradutor)
    translations    JSONB DEFAULT '{}'::jsonb,  -- {en: {name, description}, es: {...}}
    active          BOOLEAN DEFAULT true,
    sort_order      SMALLINT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Disponibilidade por data/horário (calculada, não tabela estática)
-- Usamos uma VIEW materializada gerada sob demanda

-- Clientes
CREATE TABLE customers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    email       TEXT,                         -- opcional, WhatsApp é obrigatório
    whatsapp    TEXT NOT NULL,                -- E.164
    doc_type    TEXT CHECK (doc_type IN ('cpf', 'passport')) DEFAULT 'cpf',
    doc_number  TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Reservas
CREATE TYPE reservation_status AS ENUM (
    'pending_payment',
    'deposit_paid',
    'fully_paid',
    'cancelled_noshow',
    'cancelled_force_majeure',
    'rescheduled'
);

CREATE TABLE reservations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id         UUID NOT NULL REFERENCES customers(id),
    product_id          UUID NOT NULL REFERENCES products(id),
    travel_date         DATE NOT NULL,
    departure_time      TEXT NOT NULL,
    qty_adults          SMALLINT NOT NULL DEFAULT 1,
    qty_children        SMALLINT NOT NULL DEFAULT 0,  -- 3-11 anos
    qty_infants         SMALLINT NOT NULL DEFAULT 0,  -- 0-2 anos (gratuito)
    qty_seniors         SMALLINT NOT NULL DEFAULT 0,  -- 60+ (verificar por produto)
    amount_deposit      NUMERIC(10,2) NOT NULL,
    amount_remaining    NUMERIC(10,2) NOT NULL,
    amount_total        NUMERIC(10,2) NOT NULL,
    status              reservation_status DEFAULT 'pending_payment',
    gateway             TEXT,                          -- 'mercadopago'
    gateway_payment_id  TEXT,                          -- ID externo do gateway
    voucher_url         TEXT,                          -- URL do PDF gerado
    notes               TEXT,                          -- notas internas
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Índices críticos para performance
CREATE INDEX idx_reservations_travel_date ON reservations(travel_date);
CREATE INDEX idx_reservations_product_date ON reservations(product_id, travel_date);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_customers_whatsapp ON customers(whatsapp);

-- Pagamentos (log imutável)
CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id  UUID NOT NULL REFERENCES reservations(id),
    gateway         TEXT NOT NULL,
    gateway_id      TEXT NOT NULL,          -- ID do gateway
    type            TEXT NOT NULL,          -- 'deposit' | 'full' | 'refund'
    amount          NUMERIC(10,2) NOT NULL,
    method          TEXT,                   -- 'pix' | 'credit_card'
    status          TEXT NOT NULL,          -- 'approved' | 'pending' | 'rejected' | 'refunded'
    gateway_payload JSONB,                  -- payload raw do webhook (auditoria)
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Notificações (rastreabilidade)
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id  UUID REFERENCES reservations(id),
    recipient_type  TEXT CHECK (recipient_type IN ('customer', 'provider', 'admin')),
    channel         TEXT CHECK (channel IN ('whatsapp', 'email')),
    status          TEXT CHECK (status IN ('sent', 'failed', 'pending')),
    message_preview TEXT,
    sent_at         TIMESTAMPTZ,
    error           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Auditoria de realocações de frota
CREATE TABLE fleet_reallocations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_provider_id    UUID REFERENCES providers(id),
    to_provider_id      UUID REFERENCES providers(id),
    travel_date         DATE NOT NULL,
    reason              TEXT,
    affected_count      SMALLINT,
    executed_by         UUID,               -- user_id do admin
    created_at          TIMESTAMPTZ DEFAULT now()
);
```

---

## API ENDPOINTS

### Base URL: `https://api.voltaailha.com.br/v1`

### Públicos (sem autenticação)

```
GET  /products                          → lista todos produtos ativos
GET  /products/:id                      → detalhe de um produto
GET  /availability?product_id=&date=    → vagas disponíveis numa data
POST /reservations                      → criar reserva + iniciar pagamento
POST /payments/webhook/mercadopago      → callback do gateway (HMAC validado)
GET  /reservations/:id/status           → status público por ID (sem dados sensíveis)
```

### Autenticados (JWT via Supabase Auth)

```
GET  /admin/reservations                → listagem com filtros (data, status, produto)
GET  /admin/reservations/:id            → detalhe completo
PATCH /admin/reservations/:id/status   → mudar status manualmente
POST /admin/reservations/:id/reallocate → realocação de frota
GET  /admin/products                    → CRUD de produtos
POST /admin/products
PATCH /admin/products/:id
DELETE /admin/products/:id
POST /admin/products/:id/photos         → upload de fotos (multipart)
DELETE /admin/products/:id/photos/:idx  → remover foto
PATCH /admin/products/:id/accordions    → editar conteúdo dos accordions
PATCH /admin/products/:id/child-policy  → política infantil específica deste produto
GET  /admin/analytics/sales             → dados para dashboard
GET  /admin/notifications/send-daily    → disparo manual da lista diária
```

---

## FLUXO PÓS-PAGAMENTO (Event-Driven)

```
1. Cliente confirma no frontend → POST /reservations
   ├── Validação: disponibilidade de vagas (SELECT COUNT com lock)
   ├── Criação do registro com status 'pending_payment'
   └── Geração do link de pagamento (MercadoPago preference)
   
2. Cliente paga no gateway
   └── MercadoPago dispara webhook → POST /payments/webhook/mercadopago
       ├── Validação HMAC da assinatura
       ├── Atualiza payments (log imutável)
       ├── Atualiza reservations.status → 'deposit_paid'
       └── Publica evento interno: reservation.paid

3. Event handler: reservation.paid
   ├── Gera PDF do voucher (Puppeteer)
   ├── Faz upload do PDF (Supabase Storage ou S3)
   ├── Atualiza reservations.voucher_url
   ├── Envia email ao cliente (Resend) com PDF anexo
   ├── Envia WhatsApp ao cliente com link do PDF + pedido de confirmação "OK"
   └── Registra em notifications

4. Cron diário 20:00 (horário Bahia):
   └── Para cada produto com reservas no dia seguinte:
       ├── Agrega lista de passageiros por fornecedor/horário
       ├── Formata mensagem texto puro (sem PDF)
       └── Envia WhatsApp ao fornecedor via Evolution API
           + registra em notifications
           + aguarda resposta "OK" (não bloqueante)
```

---

## REGRAS DE NEGÓCIO CRÍTICAS

### Disponibilidade com Lock (sem overbooking)

```sql
-- Usar dentro de transação com NOWAIT
SELECT COUNT(*)
FROM reservations
WHERE product_id = $1
  AND travel_date = $2
  AND departure_time = $3
  AND status NOT IN ('cancelled_noshow', 'cancelled_force_majeure')
FOR UPDATE NOWAIT;

-- Se COUNT >= product.capacity → retornar 409 Conflict
```

### Validação de Corte D-0 (sempre no servidor)

```js
// Nunca confiar no frontend para essa validação
function isUrgent(product, travelDate) {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bahia' }));
    const todayBahia = now.toISOString().split('T')[0]; // YYYY-MM-DD
    if (travelDate !== todayBahia) return false;
    
    const cutoff = product.cutoff_hour * 60 + product.cutoff_minute;
    const current = now.getHours() * 60 + now.getMinutes();
    return current >= cutoff;
}
// Se urgente → 422 com code: 'CUTOFF_EXCEEDED', redirecionar para WhatsApp
```

### Cálculo de Idade na Data de Execução

```js
function getAgeAtExecution(birthDate, travelDate) {
    const birth = new Date(birthDate);
    const travel = new Date(travelDate);
    let age = travel.getFullYear() - birth.getFullYear();
    const m = travel.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && travel.getDate() < birth.getDate())) age--;
    return age;
}
// Aplicar APENAS na data do passeio, nunca na data da compra
```

### Política de Cancelamento

| Antecedência | Tipo | Ação |
|-------------|------|------|
| > 48h antes | Cliente cancela | Reembolso integral do sinal |
| 24-48h antes | Cliente cancela | Reembolso de 50% do sinal |
| < 24h antes | Cliente cancela | No-Show — reter 100% |
| Qualquer hora | Força Maior (porto/clima) | Reembolso integral OU reagendamento grátis |

Implementar via PATCH `/admin/reservations/:id/status` com enum + lógica de reembolso automático via MercadoPago Refund API.

---

## VOUCHER PDF — CONTEÚDO OBRIGATÓRIO

```
1. Header: Logo Volta à Ilha + "VOUCHER DE RESERVA"
2. Código único + QR Code (link para /reservations/:id/status)
3. Dados do cliente: Nome, WhatsApp, Documento
4. Produto: nome, data, horário, quantidade, ponto de embarque
5. Valores: sinal pago, restante a pagar no embarque
6. Regras em destaque (negrito):
   ├── "A responsabilidade de conferir data/horário/assentos é do cliente."
   ├── "Responda OK neste WhatsApp para confirmar que os dados estão corretos."
   └── "TUPA e taxas ambientais de Morro de São Paulo NÃO estão incluídas."
7. Políticas: cancelamento, no-show, força maior, responsabilidades terceirizadas
8. Localização física de emergência: "Píer principal, Morro de São Paulo. Referência: portão azul."
9. Footer: CNPJ, contato, versão do voucher
```

---

## PAINEL ADMINISTRATIVO (MVP)

**Não construir um frontend separado no MVP.** Usar Supabase Studio + interface mínima.

MVP real (vanilla HTML/JS, mesma stack do site):
- `/admin` → protegido por Supabase Auth
- Tabela de reservas do dia com filtro de data
- Botão "Marcar como Pago" (atualiza status manual)
- Botão "Enviar Lista para Operador" (disparo manual do cron)
- Botão de Realocação de Frota
- CRUD de produtos/preços (formulário simples)

**Não começar o painel antes do fluxo de pagamento estar 100% funcional.**

---

## SOCIAL COMMERCE / CHATBOT (Fase 2 — pós-launch)

```
GET /magic-link?product_id=&date=&qty=  → gera preference no MP e retorna URL direta
```

Este endpoint permite que um bot do Manychat/Typebot gere um link de pagamento sem carregar o site.

Integração com Typebot:
1. Bot coleta: produto, data, quantidade, nome, WhatsApp
2. Chama `POST /reservations` com os dados
3. Recebe preference_id do MP
4. Responde ao cliente com link de pagamento direto

---

## SEQUÊNCIA DE IMPLEMENTAÇÃO

```
Sprint 1 (semana 1-2): Base
  ✓ Setup Fastify + PostgreSQL (Supabase)
  ✓ Models: products, customers, reservations
  ✓ GET /products + GET /availability
  ✓ Deploy inicial no Railway

Sprint 2 (semana 3-4): Pagamento
  ✓ POST /reservations (com lock de vagas)
  ✓ Integração MercadoPago (Pix + cartão)
  ✓ POST /payments/webhook (validação HMAC)
  ✓ Atualização de status pós-pagamento

Sprint 3 (semana 5-6): Comunicação
  ✓ Geração de PDF (Puppeteer headless)
  ✓ Upload Supabase Storage
  ✓ Email via Resend
  ✓ WhatsApp via Z-API ou Evolution API
  ✓ Cron de lista diária para operadores

Sprint 4 (semana 7-8): Admin + Polimento
  ✓ Painel admin mínimo
  ✓ CRUD de produtos
  ✓ Realocação de frota
  ✓ Analytics básico
  ✓ Testes de carga + auditoria de segurança
```

---

## SEGURANÇA — NÃO NEGOCIÁVEL

1. **Nenhum dado de cartão transita pelo servidor da agência** — sempre via MercadoPago iframe/SDK
2. **Webhook validado com HMAC** — rejeitar qualquer request sem assinatura válida
3. **Rate limiting** — Fastify Rate Limit: 100 req/min por IP para endpoints públicos
4. **SQL via parâmetros** — zero concatenação de strings em queries
5. **JWT com expiração curta** — 1h access token, refresh token via Supabase
6. **Logs sem PII** — remover CPF/WhatsApp dos logs de aplicação
7. **CORS restrito** — apenas `voltaailha.com.br` na whitelist
8. **Variáveis de ambiente** — nenhuma credencial em código. `.env` no Railway

---

## ESTIMATIVA DE CUSTO MENSAL (MVP)

| Serviço | Plano | Custo (BRL) |
|---------|-------|-------------|
| Railway (backend) | Starter | ~R$ 25 |
| Supabase | Free tier | R$ 0 |
| Resend (email) | Free (3k/mês) | R$ 0 |
| Z-API (WhatsApp) | Básico | ~R$ 50 |
| Cloudflare | Free | R$ 0 |
| MercadoPago | % por transação | ~2.99% |
| **Total fixo** | | **~R$ 75/mês** |

Escala para ~R$ 300/mês apenas quando passar de 500 transações mensais.

---

## OBSERVAÇÕES FINAIS

1. **Não subestimar a resilência offline** — operadores em Morro vivem sem 4G. A lista de passageiros via WhatsApp texto puro é mais importante que qualquer dashboard bonito.

2. **O fluxo de WhatsApp "OK" de confirmação não é opcional** — é a principal proteção jurídica da agência contra disputas de data/hora/quantidade.

3. **Começar com Pix.** Taxa de aprovação de Pix no Brasil é >98%. Cartão de crédito vem depois.

4. **O painel admin não precisa ser bonito** — precisa ser à prova de leigo. Priorizar clareza sobre estética.

5. **Testar o fluxo de Força Maior antes do primeiro verão** — é quando vai acontecer.
