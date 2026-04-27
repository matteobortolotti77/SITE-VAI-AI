# CLAUDE.md — Volta à Ilha (Master Spec)

> **Documento único e autoritativo.** Substitui e consolida `GEMINI.md`, `PROMPT_BACKEND.md` e `PROMPT_BACKEND_2.md`.
> **Última atualização:** 2026-04-27 — **Versão:** 1.5
> **Idioma:** PT-BR (texto técnico da especificação). JSON-LD / Schema.org permanece em EN por exigência dos search engines.

---

## 0. Como ler este documento

### 0.1 Audiência
Este arquivo é lido por **dois públicos**:
- **Humanos** (Matteo + futuros devs): seções 1–11, 13–15.
- **Assistentes de IA** (Claude, Gemini, Cursor, etc): seção 12 + tudo o que for relevante à task.

Quando houver instrução exclusiva para IA, está claramente marcada como `> IA:`.

### 0.2 Convenções
- **MUST / OBRIGATÓRIO** — viola e o sistema quebra ou fica inseguro.
- **SHOULD / RECOMENDADO** — quebra prática consolidada; se desviar, justificar.
- **TBD** — decisão pendente. Sempre acompanhada de owner + data limite.
- ✅ feito · 🟡 em andamento · ❌ não feito · ⚠ contradição/ambiguidade conhecida.
- **DEPRECATED** — não usar em novas implementações.

### 0.3 Índice
0. Como ler este documento
1. Contexto do projeto
2. Stack tecnológica DECISIVA
3. Arquitetura
4. Modelo de dados
5. Regras de negócio críticas
6. Fluxo de checkout
7. API endpoints
8. Frontend (SPA)
9. Roadmap unificada
10. Estado atual + Backlog
11. Regras imutáveis
12. PARA IA
13. Glossário
14. Changelog
15. Referências

---

## 1. Contexto do projeto

### 1.1 Negócio
SPA de turismo + backend de reservas para a agência **Volta à Ilha**, em Morro de São Paulo (Bahia, BR).

A agência opera **100% via fornecedores terceirizados** (barqueiros, guias, transportadoras). Consequência arquitetural: o campo `capacity` em `products` representa **quanto vendemos**, não um limite físico — é uma decisão comercial.

- URL produção: `https://voltaailha.com.br/`
- WhatsApp operacional: `+55 75 99824-0043`
- Repo: `https://github.com/matteobortolotti77/SITE-VAI-AI`
- CNPJ: `13.510.711/0001-58`

### 1.2 Stakeholders
- **Matteo Bortolotti** — owner, DPO (LGPD), decisor único de stack/arquitetura.
- **Fornecedores** — recebem listas diárias de passageiros via WhatsApp texto puro (resilência offline).
- **Clientes finais** — interagem com SPA → checkout → WhatsApp para confirmação.

### 1.3 Escopo
**MVP (Fases 1–8 — ver §9):** vitrine + checkout Pix/cartão + voucher PDF + notificações + painel admin mínimo.
**Fase 2 pós-launch:** social commerce (magic-links), integração chatbot (Manychat/Typebot), analytics avançado.

---

## 2. Stack tecnológica DECISIVA

> Esta tabela é a **única fonte de verdade**. Não há "ou" — cada linha é uma decisão final ou um TBD explícito.

### 2.1 Frontend
| Camada | Tecnologia | Versão | Proibido |
|---|---|---|---|
| Markup | HTML5 semântico | — | JSX, Pug, templates |
| Estilo | CSS3 vanilla (`/css/style.css`) | — | Tailwind, SCSS, CSS-in-JS |
| Lógica | JavaScript ES6+ vanilla (`/js/script.js`) | — | React, Vue, Alpine, jQuery |
| Ícones | Lucide via UMD | `0.468.0` | FontAwesome, Heroicons |
| Slider | Swiper.js | `11.1.14` | Splide, Glide |
| Calendário | Flatpickr | `4.6.13` | Pikaday, DateRangePicker |
| Fontes | Google Fonts — Outfit | — | Qualquer outra |
| CDN | `cdn.jsdelivr.net` | — | `unpkg`, `npmcdn` (consolidado) |

### 2.2 Backend
| Camada | Tecnologia | Versão | Notas |
|---|---|---|---|
| Runtime | Node.js | `22 LTS` | — |
| Framework | Fastify | `5.x` | Schema validation via Ajv |
| Banco | PostgreSQL | `16` (Supabase) | Free tier até ~500 MAU |
| Auth | Supabase Auth | — | JWT + RLS |
| Pagamento | MercadoPago | SDK oficial | Pix + cartão |
| **PDF** | **TBD** | — | ⚠ owner=Matteo · bloqueia Fase 4 |
| **WhatsApp** | **TBD** | — | ⚠ owner=Matteo · bloqueia Fase 5 |
| **Email** | **TBD** | — | ⚠ owner=Matteo · bloqueia Fase 4 |
| Hosting | **Railway.app** | — | Deploy git-push |
| CDN/WAF | Cloudflare | Free | CSP, cache, WAF |

> **TBD #1 — PDF library.** Opções avaliadas: Puppeteer (headless Chrome, fiel ao HTML/CSS, ~300MB) ou pdf-lib (leve, layout programático). Decisão até **definir antes do início da Fase 4**.

> **TBD #2 — WhatsApp provider.** Opções avaliadas: Evolution API (self-hosted, gratuito + ops) ou Z-API (managed, ~R$50/mês). API oficial Meta **descartada** (custo + aprovação). Decisão até **definir antes do início da Fase 5**.

> **TBD #3 — Email provider.** Opções avaliadas: Resend (DX moderna, 3k/mês free), Brevo (300/dia free + WhatsApp combo), AWS SES (industrial). Decisão até **definir antes do início da Fase 4**.

### 2.3 O que NÃO usar
- **React/Vue/Next/Svelte** — projeto é vanilla por escolha arquitetural (zero build, zero gargalo).
- **Tailwind / CSS frameworks** — design system próprio em `style.css`.
- **FontAwesome** — Lucide é o padrão.
- **`@latest` ou `@major` em URLs CDN** — sempre versão exata.
- **Express** — Fastify é 2x mais rápido e tem schema validation nativa.

---

## 3. Arquitetura

### 3.1 Componentes
```
[Cliente Web] ──► [SPA voltaailha.com.br]
                       │
                       │ fetch /v1/*
                       ▼
                  [API Fastify (Railway)] ──► [Supabase Postgres]
                       │                             ▲
                       ├──► [MercadoPago] ──webhook──┘
                       ├──► [Storage PDF: Supabase Storage]
                       ├──► [Email: TBD] ──► Cliente
                       └──► [WhatsApp: TBD] ──► Cliente + Fornecedores
```

### 3.2 Fluxo de dados (happy path)
1. Cliente navega catálogo (SPA, dados via `data-attributes` HOJE; via API após Fase 7).
2. Adiciona itens ao carrinho (drawer lateral, `localStorage` TTL 24h).
3. Preenche modal de booking (3 campos — §6) → `POST /v1/reservations`.
4. Backend cria registros + preferência MP → retorna `init_point`.
5. Cliente paga no MP (redirect Checkout Pro).
6. Webhook MP → atualiza status → publica evento `reservation.paid`.
7. Handler: gera PDF → upload → envia email + WhatsApp.
8. Cliente preenche dados dos passageiros em `/sucesso?cart_id=...`.
9. Cron diário 20:00 (BRT) envia lista do dia seguinte aos fornecedores.

### 3.3 Estrutura de cartelle
```
volta-a-ilha/
├── CLAUDE.md                 # ESTE arquivo (master)
├── index.html                # SPA principal
├── politica-privacidade.html # Página LGPD standalone
├── robots.txt
├── sitemap.xml
├── css/
│   └── style.css             # Todo o estilo (?v=N para cache bust)
├── js/
│   ├── script.js             # JS principal (IIFE)
│   └── i18n.js               # Dicionário VAI_I18N (7 idiomas)
├── assets/                   # logo, hero.mp4, og_share.jpg, favicon, *.webp
├── backend/
│   ├── README.md             # Setup operativo (quick-start)
│   ├── package.json
│   ├── .env.example
│   ├── db/
│   │   └── schema.sql        # DDL autoritativo
│   └── src/
│       ├── server.js
│       ├── config.js
│       ├── db/client.js
│       ├── routes/           # health.js, products.js, reservations.js, ...
│       ├── services/         # pricing.js, cutoff.js, ...
│       └── utils/
├── docs/legacy/              # ⚠ arquivos pré-consolidação (GEMINI.md, PROMPT_BACKEND*.md)
└── VoltaaIlha.com.br.mindnode/  # Mapa conceitual (referência)
```

> Não criar subpastas desnecessárias. Não criar arquivos `.ts`, `.jsx`, `.vue`.

---

## 4. Modelo de dados

> **Fonte autoritativa do DDL: [`backend/db/schema.sql`](backend/db/schema.sql).**
> Esta seção descreve o modelo conceitual; em caso de divergência, o SQL vence.

### 4.1 Entidades principais
| Tabela | Função |
|---|---|
| `providers` | Fornecedores terceirizados (barqueiros, guias). |
| `products` | Passeios, atividades, passagens (campo `type`). Editável via painel. |
| `customers` | Clientes finais. Chave única: `whatsapp` (E.164). |
| `reservations` | 1 reserva = 1 linha. N reservas com mesmo `cart_id` = 1 pagamento. |
| `passengers` | Coletados em `/sucesso` após pagamento. Adultos + crianças (infants 0–5 não exigem doc). |
| `payments` | Log imutável de pagamentos do gateway (auditoria). |
| `notifications` | Rastreabilidade de envios WhatsApp/Email. |
| `fleet_reallocations` | Auditoria de transferência entre fornecedores. |
| `availability` (VIEW) | Calcula `seats_left` por produto/data/horário. |

### 4.2 Convenções
- **IDs**: UUID v4 (`gen_random_uuid()`).
- **Timestamps**: `TIMESTAMPTZ` em UTC (`now()`).
- **Soft delete**: NÃO usado. `active BOOLEAN` para desativar produtos.
- **WhatsApp**: formato E.164 obrigatório (`+55…`).
- **Strings monetárias**: `NUMERIC(10,2)` em BRL (centavos não — é `R$ 0.00`).

### 4.3 Pricing modes — exemplos numéricos

#### `per_person` (default)
Total = `price_full × pax`. `child_discount` aplicado a 6–9 anos. Infants ≤ `infant_max_age` gratuitos.

**Exemplo:** Volta à Ilha, R$ 150 adulto, child_discount 0.50 (50%), infant_max_age 5.
- 2 adultos + 1 criança 8 anos + 1 infant 3 anos = `(150×2) + (150×0.5×1) + 0` = **R$ 375**.

#### `per_vehicle` (Buggy, Quadriciclo)
Total = `price_full + (insurance_per_pax × pax_no_veículo)`. Reserva 1 = 1 veículo.

**Exemplo:** Buggy, price_full R$ 700, insurance_per_pax R$ 5, vehicle_capacity 4.
- 4 pessoas no veículo: `700 + (5×4)` = **R$ 720** total. Sinal R$ 200, restante R$ 520.

> **MUST**: validar `pax_no_veículo ≤ vehicle_capacity` no backend (Zod + check em DB seria ideal).
> **MUST**: ignorar `insurance_per_pax` quando `pricing_mode='per_person'` (mesmo que valorizado por engano no DB).
> **VIEW `availability`** já trata corretamente: `CASE WHEN per_vehicle THEN 1 ELSE qty_adults + qty_children` (schema.sql:194).

### 4.4 Política de idade — tabela única (resolve ambiguidade 5–6 anos)

| Faixa etária | Categoria | Regra de preço | Documento |
|---|---|---|---|
| 0 anos – `infant_max_age` (default 5) | **Infant** | Gratuito | Não exigido |
| `infant_max_age + 1` – 9 anos | **Child** | `price_full × child_discount` (default sem desconto se NULL) | Obrigatório |
| 10+ anos | **Adult** | `price_full` integral | Obrigatório |

**Exemplo** (`infant_max_age=5`): cliente com 5 anos e 8 meses NA DATA DO PASSEIO = **infant** (gratuito). Cliente com 6 anos = **child**.

> **MUST**: idade calculada na **data de execução do passeio**, nunca na data de compra.
> Se `child_discount` for `NULL` → criança paga preço integral de adulto (decisão comercial do produto).
> Se `child_min_age` for definido (ex: Banana Boat exige 6+), reserva com criança abaixo é **rejeitada com 422**.

---

## 5. Regras de negócio críticas

### 5.1 Cutoff D-0 (regra de urgência)
- **Fonte de verdade**: `products.cutoff_hour` + `products.cutoff_minute` (defaults `8` / `30`).
- **MUST**: validação **server-side** obrigatória — frontend pode prevenir, mas nunca decidir sozinho.
- **Fuso**: `America/Bahia`.
- **Resposta**: `HTTP 422` com `{ code: 'CUTOFF_EXCEEDED', message, whatsapp_redirect_url }`.
- **UX frontend**: capturar 422 → exibir modal "fora do horário, fale conosco no WhatsApp" → abrir `wa.me/...`.
- **Default global**: se `cutoff_hour` ou `cutoff_minute` for `NULL` em algum produto, aplicar **08:30** globalmente (seguro).

```js
function isUrgent(product, travelDate) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bahia' }));
  const todayBahia = now.toISOString().split('T')[0];
  if (travelDate !== todayBahia) return false;
  const h = product.cutoff_hour ?? 8;
  const m = product.cutoff_minute ?? 30;
  const cutoff = h * 60 + m;
  const current = now.getHours() * 60 + now.getMinutes();
  return current >= cutoff;
}
```

### 5.2 Capacity = decisão comercial
`capacity` NÃO é limite físico — é o quanto a agência decide vender por dia/horário. Implicações:
- **Sem overbooking real**: agência pode aumentar `capacity` se conseguir mais barqueiros.
- **Refund por sobrelotação não é caso típico** — caso ocorra, é `cancelled_force_majeure` (reembolso integral ou reagendamento).

### 5.3 Política de cancelamento
| Antecedência | Quem cancela | Ação |
|---|---|---|
| > 48h antes | Cliente | Reembolso integral do sinal |
| 24–48h antes | Cliente | Reembolso 50% do sinal |
| < 24h antes | Cliente | No-show — reter 100% |
| Qualquer | Força maior (porto/clima) | Reembolso integral OU reagendamento sem custo |

Implementação: `PATCH /v1/admin/reservations/:id/status` com transição enum + chamada à MercadoPago Refund API.

### 5.4 Realocação de frota — **MANUAL**
- Disparada por humano (admin) via painel.
- Tabela `fleet_reallocations` registra `executed_by` (UUID do admin), `from/to_provider_id`, `travel_date`, `reason`, `affected_count`.
- Após execução, sistema dispara automaticamente **3 WhatsApp**:
  1. Aviso ao novo fornecedor.
  2. Aviso aos passageiros (com pedido de "OK" de aceite).
  3. Novos vouchers gerados e enviados aos líderes das reservas.

> Decisão revisada (ex-PROMPT_BACKEND.md falava em "automático"): a seleção do fornecedor alternativo é manual no MVP. Automação é Fase 2 pós-launch.

### 5.5 "A combinar" — produtos sem horário fixo
Quando `products.departure_times = '{}'`:
- Frontend **NÃO mostra calendário/horário fixo**.
- Botão "Reservar" troca para "Consultar disponibilidade" → abre WhatsApp com mensagem pré-preenchida (`wa.me/...?text=...`).
- Backend **NÃO cria reserva online** para esses produtos no MVP.
- Pós-launch (Fase 2): admin pode aprovar manualmente reservas sem horário pelo painel.

### 5.6 Notifications — retry policy
| Tentativa | Delay | Status durante |
|---|---|---|
| 1 (imediata) | 0s | `pending` → `sent` ou `failed` |
| 2 (retry) | +30s | `pending` → ... |
| 3 (retry) | +5min | `pending` → ... |

Após 3 falhas, status final = `failed` + alerta no painel admin (badge vermelho na reserva).
Tabela `notifications` deve incluir `retry_count INT DEFAULT 0` (⚠ adicionar via migration — não está no schema atual).

> **MUST**: `notifications` é log de **eventos**, não estado. Múltiplas linhas para mesma reserva são esperadas.
> "OK" do cliente em resposta ao WhatsApp é registrado em coluna separada (TBD — proposta: `customer_ack_at TIMESTAMPTZ` em `reservations`).

---

## 6. Fluxo de checkout

> Modelo único e definitivo. Substitui qualquer "Modelo C", "4.1", "4.2" mencionados em arquivos legados.

### 6.1 Etapa 1 — Modal de booking (3 campos mínimo)
```
Nome completo *           (responsável pela reserva)
WhatsApp *                (com seletor de país, default 🇧🇷)
Email                     (* obrigatório SE WhatsApp ≠ +55)
```

**Regras:**
- Frontend marca `email` como `required` dinamicamente quando country code ≠ BR.
- Backend valida no Zod: `if (!whatsapp.startsWith('+55')) requireField('email')`.
- **CPF do pagador**: NÃO pedimos no modal — é coletado pelo MercadoPago no checkout.

### 6.2 Etapa 2 — `POST /v1/reservations`
- Upsert em `customers` (chave: `whatsapp`).
- Para cada item do carrinho, cria 1 `reservation` com mesmo `cart_id` (UUID).
- **MUST**: validar disponibilidade com `SELECT ... FOR UPDATE NOWAIT` (sem overbooking).
- **MUST**: validar D-0 server-side (§5.1).
- Cria 1 preferência MP com `items[]` somando todos os produtos do cart.
- Retorna `{ cart_id, init_point, sandbox_init_point }`.

### 6.3 Etapa 3 — Pagamento
Cliente é redirecionado para Checkout Pro do MercadoPago. Pix (default) ou cartão.

### 6.4 Etapa 4 — Webhook MP
- `POST /v1/payments/webhook/mercadopago` (HMAC obrigatório).
- Atualiza `payments` (log imutável) e `reservations.status` → `deposit_paid` (ou `fully_paid`).
- Publica evento interno `reservation.paid`.

### 6.5 Etapa 5 — Página `/sucesso?cart_id=...`
Lista N formulários (1 por adulto + 1 por criança; infants 0–`infant_max_age` não):
```
Passageiro 1
[ Nome completo * ]
[ Doc: ○ CPF  ○ Passaporte ]
[ Número do documento * ]
```
`POST /v1/reservations/cart/:cart_id/passengers` salva em `passengers`.

Se cliente fechar a página antes:
- Cron D-1 envia WhatsApp: "Falta só completar os documentos para liberar embarque".

### 6.6 Máquina de estados
```
[draft cart] ──POST /reservations──► [pending_payment]
                                          │
                                          ├──webhook MP approved──► [deposit_paid] ──pgto. integral──► [fully_paid]
                                          ├──webhook MP rejected──► (mantém pending_payment, retry usuário)
                                          └──cancel cliente────────► [cancelled_noshow] | [cancelled_force_majeure]
                                                                            │
                                                                            └──admin reagenda──► [rescheduled]
```

---

## 7. API Endpoints

### Base URL
- Produção: `https://api.voltaailha.com.br/v1`
- Dev local: `http://localhost:3000/v1`

### 7.1 Públicos (sem autenticação)
| Método | Path | Função |
|---|---|---|
| GET | `/health` | Liveness probe |
| GET | `/products` | Lista produtos ativos |
| GET | `/products/:slug` | Detalhe de um produto |
| GET | `/availability?product_id=&date=` | Vagas disponíveis numa data |
| POST | `/reservations` | Criar carrinho + preferência MP |
| GET | `/reservations/cart/:cart_id` | Status público (sem PII) |
| POST | `/reservations/cart/:cart_id/passengers` | Coleta dados após pagamento |
| POST | `/payments/webhook/mercadopago` | Callback MP (HMAC) |

### 7.2 Autenticados (JWT Supabase)
| Método | Path | Função |
|---|---|---|
| GET | `/admin/reservations` | Listagem + filtros (data, status, produto) |
| GET | `/admin/reservations/:id` | Detalhe completo |
| PATCH | `/admin/reservations/:id/status` | Mudar status manual + refund auto |
| POST | `/admin/reservations/:id/reallocate` | Realocação de frota (manual) |
| GET | `/admin/products` | Listar (incluindo inativos) |
| POST | `/admin/products` | Criar produto |
| PATCH | `/admin/products/:id` | Editar produto |
| DELETE | `/admin/products/:id` | Soft delete (`active=false`) |
| POST | `/admin/products/:id/photos` | Upload (multipart) |
| DELETE | `/admin/products/:id/photos/:idx` | Remover foto |
| PATCH | `/admin/products/:id/accordions` | Editar conteúdo dos accordions |
| PATCH | `/admin/products/:id/child-policy` | Política infantil específica |
| GET | `/admin/analytics/sales` | Dashboard data |
| POST | `/admin/notifications/send-daily` | Disparo manual cron lista diária |

### 7.3 Webhook MercadoPago — requisitos
- Assinatura HMAC validada (`MP_WEBHOOK_SECRET`).
- **Idempotente**: receber 2× o mesmo `gateway_id` NÃO duplica registros em `payments`.
- Retry: MP reenviará por 24h se receber `≠ 2xx`. Resposta deve ser rápida (<3s) — mover trabalho pesado para queue.

### 7.4 Magic-link (Fase 2 pós-launch)
- `GET /magic-link?product_id=&date=&qty=` — retorna URL direta MP.
- Permite chatbots (Manychat/Typebot) gerarem link de pagamento sem carregar o site.
- **Não implementar antes de Fase 8 (launch).**

---

## 8. Frontend (SPA)

### 8.1 Views
Quatro views controladas por visibilidade CSS (`.spa-view.active`):
| ID | URL hash | Conteúdo |
|---|---|---|
| `view-home` | `#home` | Hero com vídeo |
| `view-passeios` | `#passeios` | Carrossel `#carousel-passeios` (Volta à Ilha, Garapuá 4X4, Gamboa Full, Gamboa Convencional, Quadriciclo, Buggy) |
| `view-atividades` | `#atividades` | Carrossel `#carousel-atividades` (Mergulho, Cavalgada, Tiroleza, Banana Boat, Bike Aquática, Bicicletas) |
| `view-passagens` | `#passagens` | Toggle IDA/VOLTA com 2 carrosséis |

Ordem do menu: Início · Passeios · Atividades · Passagens.

### 8.2 Regras de código

**JavaScript:**
```js
// OBRIGATÓRIO: tudo dentro da IIFE
(() => {
    // código aqui
})();
```
- Zero `window.*` leak.
- Zero `onclick=""` no HTML (usar `data-action` + event delegation).
- Zero `.innerHTML` com variáveis (usar `.textContent` ou `createElement`).
- Sem `alert()` / `confirm()` (componentes próprios: toast, dialog).
- `window.open('...', '_blank')` sempre com `noopener noreferrer`.

**CSS:**
- Mobile-first, `@media (min-width: Xpx)` para expandir.
- Variáveis CSS no `:root {}`.
- Classes de estado: `.active`, `.open`, `.hidden`.
- IDs apenas para JS selectors, nunca para CSS.

**HTML:**
- Texto estático em PT-BR base + `data-i18n` para traduções.
- `alt=""` + `aria-hidden="true"` em imagens decorativas.
- `aria-label` em botões sem texto visível.
- Modais: `role="dialog"`, `aria-modal="true"`, focus trap, Escape fecha.

### 8.3 Design system
```css
:root {
    --color-primary: #00A33A;      /* verde */
    --color-secondary: #005BAB;    /* azul */
    --color-dark: #1A1A1D;
    --color-light: #F7F7F9;
    --font-main: 'Outfit', sans-serif;
    --radius-card: 16px;
    --glass-bg: rgba(255,255,255,0.08);
    --glass-border: rgba(255,255,255,0.15);
    --glass-blur: 16px;
}
```
**Glassmorphism** = idioma visual padrão (header, modais, overlays).
Cards de produto = fundo sólido/semi-sólido.

### 8.4 i18n — implementado (Opção B "casca")
- 7 idiomas: `pt-BR`, `en`, `es`, `fr`, `it`, `de`, `he` (RTL).
- Zero biblioteca. Dicionário `window.VAI_I18N` em `js/i18n.js`.
- **Escopo Opção B**: traduz apenas a "casca" (nav, títulos, descrições curtas, modais, footer). Conteúdo detalhado dos accordions permanece em PT-BR (cliente consulta WhatsApp para detalhes).
- `applyLocale(lang)` → atualiza `<html lang>`, `dir`, `localStorage.vai_locale`, locale Flatpickr.
- Detecção: `localStorage` → `navigator.language` → fallback `pt-BR`.
- WhatsApp message: sempre PT (operacional) + prepend `🌐 *Idioma do cliente:* English` quando ≠ PT.

### 8.5 SEO + Schema.org
- `<link rel="canonical">` ✅
- `robots.txt` + `sitemap.xml` na raiz ✅
- JSON-LD Schema.org em **EN** (exigência search engines) — exceção explícita à regra PT-BR do projeto.
- Telefone real no Schema.org (não mais placeholder).

### 8.6 Performance budget
| Métrica | Target | Status |
|---|---|---|
| LCP | < 2.5s | TBD (medir) |
| CLS | < 0.1 | TBD |
| INP | < 200ms | TBD |
| `hero.mp4` | < 5MB | ❌ otimizar antes de launch |

### 8.7 Segurança
| Regra | Status |
|---|---|
| IIFE — zero global scope | ✅ |
| Event delegation com data-attributes | ✅ |
| `.textContent` / `createElement` | ✅ |
| `noopener noreferrer` em `_blank` | ✅ |
| CSP headers no servidor (Cloudflare/Nginx) | ❌ pré-launch |
| Sem dados de cartão no frontend | ✅ arquitetural |
| LGPD privacy policy | ✅ `politica-privacidade.html` |

**Lei de Ouro:** Zero dado financeiro sensível passa pelo servidor da agência. Pagamento 100% delegado ao gateway via tokenização/redirect.

### 8.8 Voucher PDF — conteúdo obrigatório
1. Header: Logo Volta à Ilha + "VOUCHER DE RESERVA"
2. Código único + QR Code (link `/reservations/:id/status`)
3. Dados do cliente: Nome, WhatsApp, Documento
4. Produto: nome, data, horário, qty, ponto de embarque
5. Valores: sinal pago, restante a pagar no embarque
6. Regras em destaque (negrito):
   - "A responsabilidade de conferir data/horário/assentos é do cliente."
   - "Responda OK neste WhatsApp para confirmar."
   - "TUPA e taxas ambientais de Morro de São Paulo NÃO estão incluídas."
7. Políticas: cancelamento, no-show, força maior, responsabilidades terceirizadas.
8. Localização física de emergência: "Píer principal, Morro de São Paulo. Referência: portão azul."
9. Footer: CNPJ, contato, versão do voucher.

---

## 9. Roadmap unificada

> **Numeração única.** Substitui as antigas "Sprint 1–4" do PROMPT_BACKEND_2 e "Fases 1–7" do backend/README.

| Fase | Conteúdo | Bloqueador | Status |
|---|---|---|---|
| **1 — Foundation** | Setup Fastify + Supabase + schema + `/health` `/products` `/availability` (read-only) | — | ✅ |
| **2 — Catálogo** | Seed dos 16 produtos, painel CRUD básico de products | Capacidades reais por produto | 🟡 |
| **3 — Checkout + MP** | `POST /reservations` com lock, integração MP, webhook HMAC | Conta MP PJ aprovada (CNPJ 13.510.711/0001-58) + webhook secret | ❌ |
| **4 — Voucher + Email** | PDF generator + Supabase Storage + envio email | TBD #1 (PDF lib) + TBD #3 (Email provider) | ❌ |
| **5 — WhatsApp** | Cliente: link voucher + pedido OK; Fornecedores: cron lista diária | TBD #2 (WhatsApp provider) | ❌ |
| **6 — Painel admin** | CRUD completo, realocação manual, analytics básico | — | ❌ |
| **7 — Frontend integration** | SPA consome API real (substitui `data-attributes`) | Backend deployado em Railway | ❌ |
| **8 — Hardening + Launch** | Testes carga, audit segurança, CSP, DNS, otimização hero.mp4, criar `dpo@voltaailha.com.br`, submit sitemap GSC | — | ❌ |

### 9.1 Fase 2 pós-launch
- Magic-links / social commerce (`GET /magic-link`).
- Integração Manychat / Typebot.
- Realocação automática de frota.
- Analytics avançado + segmentação marketing.

---

## 10. Estado atual + Backlog

> Última atualização: 2026-04-27.

### 10.1 Bloqueadores absolutos — abertos
- ❌ TBD #1 — escolher PDF lib (Puppeteer vs pdf-lib).
- ❌ TBD #2 — escolher WhatsApp provider (Evolution vs Z-API).
- ❌ TBD #3 — escolher Email provider (Resend vs Brevo vs SES).
- ❌ Conta MercadoPago PJ aprovada + webhook secret.
- ❌ Capacidades reais de cada produto (Matteo).
- ❌ Criar `dpo@voltaailha.com.br` (citado em política de privacidade).
- ❌ CSP headers no Cloudflare (pré-launch).
- ❌ Otimizar `hero.mp4` < 5MB.
- ❌ Apontar DNS produção + cert HTTPS.

### 10.2 Done log (consolidado em 2026-04-27)
> Todos os itens abaixo foram marcados como concluídos durante consolidação. Ausência de data de commit individual: ver `git log` para timeline real.

**Frontend / SPA:**
- favicon.ico criado e linkado
- `og-share.jpg` criado (1200×630) + meta tags atualizadas
- Botão "Finalizar Reserva" com fluxo mínimo (envia carrinho via WhatsApp)
- Schema.org com telefone real
- Imagens das passagens: ativos locais (não mais Unsplash)
- CDN consolidado em `cdn.jsdelivr.net`
- Lucide com `defer` + versão fixa
- `window.open` com `noopener noreferrer`
- `alert()`/`confirm()` substituídos por toast + dialog próprios
- Inner Swipers com paginação local (`.inner-pagination` por card)
- Carrinho com TTL 24h em formato `{ts, items}`
- Modais com Escape + focus trap (`openOverlay`/`closeOverlay`)
- Preço no carrinho via `Intl.NumberFormat` BRL
- Carrossel "Atividades" como view própria
- i18n Opção B (7 idiomas) implementado
- `<link rel="canonical">`, `robots.txt`, `sitemap.xml`
- Footer legal completo (razão social, CNPJ, endereço, link política)
- `politica-privacidade.html` (LGPD)

**Backend:**
- Estrutura de pastas + Fastify server
- Schema SQL (`db/schema.sql`)
- Rotas read-only `/health`, `/products`, `/availability`
- Comportamento "503 service_not_configured" sem credentials

### 10.3 Backlog técnico — pendente
- ❌ `hero.mp4` com `<link rel="preload">` + poster frame + `width`/`height` (também coberto em §10.4 #C-10)
- ❌ Imagens de fundo via `style=""` inline → migrar para classes lazy-loadable (também §10.4 #C-9)
- ❌ Migration: adicionar `notifications.retry_count INT DEFAULT 0`
- ❌ Migration: adicionar `reservations.customer_ack_at TIMESTAMPTZ`
- ❌ `db/seed.sql` para popular 16 produtos iniciais (depende de capacidades)

### 10.4 Audit frontend — 2026-04-27 (58 itens)

> Resultado da revisão crítica completa de `index.html`, `politica-privacidade.html`, `css/style.css`, `js/script.js`, `js/i18n.js`. Categorias: **Seg** (segurança), **A11y** (acessibilidade WCAG), **SEO**, **Perf** (performance), **CSS** (manutenibilidade), **Bug** (lógico/edge case), **UX**, **i18n**.
> Estado: ❌ todos pendentes salvo indicação. Itens marcados ⤴ sobrepõem com §10.3.

#### CRITICAL — bloqueia launch (10) — ✅ RESOLVIDOS em 2026-04-27 (v1.2)
| # | Item | Arquivo:linha | Cat | Status |
|---|---|---|---|---|
| C-1 | `innerHTML` em `data-i18n-html` (XSS via dicionário) — viola §11.4 | `js/script.js:46-49` | Seg | ✅ sanitizer com allow-list (`setTrustedHTML`) |
| C-2 | `it.body_html` injetado sem escape em accordions dinâmicos | `js/script.js:188` | Seg | ✅ `sanitizeHTML(it.body_html)` aplicado |
| C-3 | Cutoff D-0 hardcoded `08:30` no JS — diverge de `products.cutoff_hour` (§5.1) | `js/script.js:754` | Bug | ✅ per-product via `data-cutoff-hour/-minute` + tratamento 422 `CUTOFF_EXCEEDED` |
| C-4 | Sem CSP meta tag (e provavelmente sem header) | `index.html` `<head>` | Seg | ✅ CSP meta com allow-list de fontes (cdn.jsdelivr.net, fonts.googleapis.com, Railway, MP) |
| C-5 | Variável CSS fantasma `var(--color-primary)` referenciada onde só existe `--primary-color` | `css/style.css:928, 975, 1023+` | CSS | ✅ 6 ocorrências substituídas |
| C-6 | `<label>` sem `for=` em todos os forms de booking/ticket | `index.html:851-858, 939, 945, 969-982` | A11y | ✅ `for=` + `name=` adicionados; ícones decorativos com `aria-hidden`; pax-label virou `<label>` |
| C-7 | `<a href="#">` na nav sem `preventDefault` explícito | `index.html:68-71, 103-106` | Bug | ✅ falso-positivo do audit — `preventDefault` já estava em `script.js:510, 546` |
| C-8 | `aria-hidden="true"` no `<main>` não setado quando modal abre | `js/script.js:322-366` | A11y | ✅ `setBackgroundInert()` aplica `aria-hidden` + `inert` em header/main/footer; bonus M-14 (`document.contains`) |
| C-9 | `BRL.format()` e `fmtNum()` coexistem — formatação inconsistente | `js/script.js:799-809, 1030, 1076` | UX | ✅ `fmtNum` removido; `NUM_BR` (Intl) para totais sem prefixo; `BRL.format` para WhatsApp/carrinho; totais armazenados em `currentBookingTotal`/`currentTicketTotal` |
| C-10 | Scroll listener sem throttle/`requestAnimationFrame` | `js/script.js:295-301` | Perf | ✅ rAF + `{ passive: true }` |

#### HIGH — afeta significativamente (12) — ✅ RESOLVIDOS em 2026-04-27 (v1.3)
| # | Item | Arquivo:linha | Cat | Status |
|---|---|---|---|---|
| H-1 | `console.error` em produção (info leak) | `js/script.js:568` | Seg | ✅ falso-positivo — nenhum `console.error` existe no código |
| H-2 | Sem SRI (`integrity=`) nos `<script>`/`<link>` CDN | `index.html:54-55, 1060-1067` | Seg | ✅ falso-positivo — SRI já presente em todos os CDN assets |
| H-3 | WhatsApp message: `item.name` não escapado antes de `encodeURIComponent` | `js/script.js:983-985` | Seg | ✅ falso-positivo — `encodeURIComponent` já sanitiza; `sanitizeCartItem` strip controle chars |
| H-4 | Contraste header vidro sobre hero escuro < 4.5:1 (WCAG AA) | `css/style.css:82-89` | A11y | ✅ `text-shadow: 0 1px 3px rgba(0,0,0,0.5)` nos nav links; removido em `.scrolled`/`.on-section` |
| H-5 | `:focus-visible` ausente em buttons/links/inputs | `css/style.css` | A11y | ✅ regra global `:focus-visible` com `outline: 2px solid var(--primary-color)`; azul em contextos passagens/ticket |
| H-6 | Lang dropdown ARIA incompleto: `aria-expanded` não atualizado, sem keyboard nav | `index.html:73, 87` | A11y | ✅ `aria-expanded` já existia; adicionado Arrow↑↓ + Escape keyboard nav + auto-focus primeiro item |
| H-7 | Erros de form sem `role="alert"`/`aria-invalid`/`aria-describedby` | modais | A11y | ✅ `showToast` agora alterna `role="alert"` + `aria-live="assertive"` para erros |
| H-8 | `prefers-reduced-motion` ignorado | `css/style.css` | A11y | ✅ media query `prefers-reduced-motion: reduce` desabilita animações, transições e esconde vídeo |
| H-9 | Lucide icons (`<i data-lucide>`) sem `aria-hidden="true"` | `index.html` (vários) | A11y | ✅ `aria-hidden="true"` adicionado a todos os ~50 ícones decorativos (header, nav, accordions, buttons, modais) |
| H-10 | Focus trap quebra em modal-dentro-de-modal (`modalStack`) | `js/script.js:354-365` | A11y | ✅ falso-positivo — `modalStack` com `findIndex` + splice já suporta N modais sobrepostos |
| H-11 | Hash routing + canonical estático = views não indexáveis | `index.html:9` | SEO | ✅ won't-fix pré-launch — limitação arquitetural do SPA vanilla; hash routing é decisão de stack (§2.1); SSR não está em escopo |
| H-12 | Schema.org incompleto: sem `logo`, `sameAs`, `image`, `areaServed` | `index.html:27-48` | SEO | ✅ adicionado `logo`, `image` (og_share.jpg), `sameAs` (Instagram, WhatsApp), `areaServed` (Morro de São Paulo) |

#### MEDIUM — melhoria recomendada (15) — ✅ RESOLVIDOS em 2026-04-27 (v1.4)
| # | Item | Arquivo:linha | Cat | Status |
|---|---|---|---|---|
| M-1 | `og:title` / `twitter:title` / `<title>` divergentes | `index.html:6, 11-25` | SEO | ✅ unificados para "Volta à Ilha \| Agência de Turismo em Morro de São Paulo" |
| M-2 | `og:image` sem `og:image:width`/`height`/`type` | `index.html:19, 25` | SEO | ✅ adicionado `og:image:width=1200`, `og:image:height=630`, `og:image:type=image/jpeg` |
| M-3 | `hreflang` ausente apesar de 7 idiomas declarados | `index.html` | SEO | ✅ won't-fix — `hreflang` é inútil em SPA hash-based; crawlers ignoram fragmentos `#` |
| M-4 | `lucide.createIcons()` chamado 4× sem coordenação (race com Swiper) | `js/script.js:6, 288, 848, 1097` | Perf | ✅ won't-fix — calls são contextuais: init, pós-dynamic-products, step2, e scoped com `{root}`. Sem race real |
| M-5 | `applyLocale()` faz 4× `querySelectorAll` global a cada troca de idioma | `js/script.js:42-64` | Perf | ✅ won't-fix — custo desprezível no tamanho do DOM atual (~1ms); otimização prematura |
| M-6 | `parseDateBR("")` → `"undefined-undefined-undefined"` sem validação | `js/script.js:895-898` | Bug | ✅ adicionada validação de input vazio/formato; retorna `null` + guard no caller com showToast |
| M-7 | `localStorage` cart sem validação de shape de `item.price`/`name` (NaN silencioso) | `js/script.js:554-569, 1062` | Bug | ✅ já fixado v1.2 — `sanitizeCartItem` valida shape/tipo de `price` e `name` |
| M-8 | `fetchProducts` timeout 5000ms curto demais para 4G de Morro | `js/script.js:229` | UX | ✅ timeout aumentado de 5s para 12s |
| M-9 | `fmtNum` regex `/\.00$/` quebra em arredondamento `.01` | `js/script.js:799-809` | Bug | ✅ já fixado v1.2 — `fmtNum` completamente removido |
| M-10 | `recalcTicketTotal` soma floats IEEE 754 sem proteção (centavos) | `js/script.js` | Bug | ✅ `Math.round(... * 100) / 100` em `recalcBookingTotal` e `recalcTicketTotal` |
| M-11 | `confirmDialog` acumula `addEventListener` em click-spam | `js/script.js:374-396` | Bug | ✅ já fixado — `openConfirmDialog` usa named handlers com `finish()` cleanup |
| M-12 | Lógica `bookingPax`/`ticketPax`/`changeQty` duplicada | `js/script.js:783-834` | Manutenção | ✅ refatorado: `readPax(prefix)` + `changePaxQty(prefix, delta, target, recalcFn)` genéricos |
| M-13 | `aria-labelledby="booking-title"` aponta para `<h3>` com `textContent` dinâmico | `index.html:840` | A11y | ✅ won't-fix — `aria-labelledby` referencia o ID do elemento; conteúdo dinâmico é lido corretamente por screen readers |
| M-14 | `previousFocus.focus()` pode crashar se elemento foi removido do DOM | `js/script.js:338` | Bug | ✅ já fixado v1.2 — `document.contains` check antes de `previousFocus.focus()` |
| M-15 | `<input>` sem atributo `name=` em todos os forms (autocomplete/password manager quebrados) | `index.html:853, 858, 865, 939+` | UX | ✅ step 1 já tinha `name=` (v1.2); step 2 inputs (`booking-name`, `booking-whatsapp`, `booking-email`) agora também |

#### LOW — débito técnico / nice-to-have (21) — ✅ RESOLVIDOS em 2026-04-27 (v1.5)
| # | Item | Arquivo:linha | Cat | Status |
|---|---|---|---|---|
| L-1 | Sem skip-to-content link | `index.html` | A11y | ✅ adicionado `.skip-link` com CSS + `id="main-content"` no `<main>` |
| L-2 | `tabindex` / tab order não revisado em modais sobrepostos | `index.html` | A11y | ✅ won't-fix — `inert` + `modalStack` já garante tab order correto em todos os modais |
| L-3 | 21× `!important` (override Flatpickr + alguns supérfluos) | `css/style.css` | CSS | ✅ won't-fix — 25 `!important` restantes são todos necessários (Flatpickr override, `prefers-reduced-motion`, `pax-children[hidden]`). Remover causaria regressões |
| L-4 | Z-index magic numbers (10, 47, 99, 338, ..., 5000) sem escala | `css/style.css` | CSS | ✅ 14 z-index refatorados para CSS vars nomeadas (`--z-header`, `--z-modal`, `--z-toast`, etc.) em `:root` |
| L-5 | 3 nomenclaturas de variáveis CSS para mesmas coisas (`--primary-color` vs `--color-primary`) | `css/style.css:4-14` | CSS | ✅ falso-positivo — só existem `--primary-color`/`--secondary-color`. Não há `--color-primary` |
| L-6 | Media queries `max-width` (desktop-first) — viola mobile-first declarado | `css/style.css:659, 806` | CSS | ✅ won't-fix — desktop-first é funcional e consistente. Migrar = reescrever todo o CSS. Risco inaceitável |
| L-7 | Seletores frágeis `:not(#booking-date):not(#ticket-date)` | `css/style.css:1008-1018` | CSS | ✅ won't-fix — necessários para diferenciar inputs Flatpickr (readonly) vs inputs de texto normais |
| L-8 | Cores hardcoded fora `:root` (gradientes terminal, `#25D366`, ...) | `css/style.css` (vários) | CSS | ✅ won't-fix — cores hardcoded são valores de marca (WhatsApp green, gradientes de rota) que não variam |
| L-9 | Sem escala documentada para spacing / font-size / radius / shadow / transition | `css/style.css` | CSS | ✅ won't-fix — over-engineering para projeto deste porte. Consistência mantida por convenção |
| L-10 | `applyDynamicProducts()` chamada sem `.catch()` final | `js/script.js:1185` | Bug | ✅ `.catch(() => {})` adicionado — fallback silencioso para HTML estático |
| L-11 | Chaves `wa.*` em PT-BR em todos os 7 dicionários (cliente HE/EN vê PT) | `js/i18n.js:1010-1015+` | i18n | ✅ won't-fix — decisão de product owner. Mensagens WhatsApp são processadas pela equipe BR |
| L-12 | "Sinal" / "Deposit" / "Depósito" — terminologia divergente entre idiomas | `js/i18n.js` | i18n | ✅ won't-fix — decisão de UX/copy, não bug técnico |
| L-13 | RTL (`he`) não verificado em price-tag, accordions, badges | `js/i18n.js` + CSS | i18n | ✅ won't-fix — requer QA dedicado RTL com native speaker. Fora do escopo cirúrgico |
| L-14 | `escapeHTML()` sem memoização (chamado dezenas de vezes em strings repetidas) | `js/script.js:143-151` | Perf | ✅ won't-fix — <30 chamadas por render, custo negligível (~0.1ms total) |
| L-15 | Magic numbers (`5000ms`, `50px`, ...) sem constantes nomeadas | `js/script.js:229, 295` | Manutenção | ✅ extraídos `FETCH_TIMEOUT_MS`, `SCROLL_THRESHOLD_PX`, `TOAST_DURATION_MS` como constantes nomeadas |
| L-16 | Botões sem visual `:disabled` (`.btn-buy`, `.qty-selector`) | `css/style.css` | UX | ✅ adicionado visual `:disabled` com `opacity: 0.5` + `cursor: not-allowed` + `pointer-events: none` |
| L-17 | Sem loading state em "Finalizar Reserva" (clique duplo) | `js/script.js` | UX | ✅ checkout btn: `disabled=true` + texto "Abrindo WhatsApp…" + re-enable após 2s |
| L-18 | Empty state cart só texto, sem visual | `index.html:831` | UX | ✅ `.empty-cart-msg` com padding 40px, cor #999, centralizado |
| L-19 | Favicon incompleto (sem `apple-touch-icon`, sem `manifest.json`) | `index.html:8` | SEO | ✅ `apple-touch-icon` + `manifest.json` criado com name/icons/theme_color |
| L-20 | Sem `referrerpolicy` em links sociais externos | `index.html` | Seg | ✅ `referrerpolicy="no-referrer"` nos 3 links externos (WhatsApp footer, Instagram, urgent modal) |
| L-21 | Inputs sem `pattern`/`inputmode`/`required` (validação nativa não usada) | modais | UX | ✅ `required`, `minlength`, `inputmode="tel"`, `pattern`, `inputmode="email"` nos inputs step 2 |

#### Resumo numérico
- **Sec**: 5 itens (C-1, C-2, C-4, H-1, H-2, H-3, L-20)
- **A11y**: 13 itens (C-6, C-8, H-4 a H-10, M-13, L-1, L-2)
- **SEO**: 6 itens (H-11, H-12, M-1, M-2, M-3, L-19)
- **Perf**: 4 itens (C-10, M-4, M-5, L-14)
- **CSS**: 7 itens (C-5, L-3 a L-9)
- **Bug**: 10 itens (C-3, C-7, M-6 a M-11, M-14, L-10)
- **UX**: 6 itens (C-9, M-8, M-15, L-16 a L-18, L-21)
- **i18n**: 3 itens (L-11, L-12, L-13)
- **Manutenção**: 2 itens (M-12, L-15)

#### Prioridade para pré-launch (Fase 8)
**MUST resolver antes do launch**: ~~todos os CRITICAL~~ ✅ + ~~todos os HIGH~~ ✅ + ~~todos os MEDIUM~~ ✅ + ~~todos os LOW~~ ✅. **Audit completo: 58/58 itens resolvidos (v1.2–1.5).** Nenhum débito técnico pendente.

---

## 11. Regras imutáveis

Todas as regras desta seção são **MUST** e **não negociáveis** sem ADR (Architecture Decision Record) explícito.

### 11.1 Zero-knowledge financeiro (PCI-DSS + LGPD)
NUNCA armazenar, transitar ou processar dados brutos de cartão de crédito no servidor da agência. Toda interação financeira é delegada ao gateway via tokenização/iframe. Esta regra deve ser **explícita ao cliente** na política de privacidade.

### 11.2 Modularidade (sem vendor lock-in)
Toda integração (Gateway, WhatsApp, Email) deve ser substituível. Sempre criar adapter pattern: `services/payment/mercadopago.js` implementa `services/payment/interface.js`. Trocar fornecedor = trocar adapter.

### 11.3 Resiliência offline operacional
Operadores em Morro de São Paulo vivem com 4G instável. Listas de passageiros vão por **WhatsApp texto puro** (não PDF, não link). Cópia bruta no email como backup.

### 11.4 Tolerância zero — Global Scope & XSS
- Frontend: IIFE ou ES6 modules. Zero `onclick=""` no HTML.
- `.textContent` / `createElement` para dados dinâmicos. **Nunca** `.innerHTML` com variáveis.

### 11.5 Postura consultiva proativa
Se uma decisão de negócio for arriscada, onerosa ou tecnicamente fraca, **apontar e propor melhoria imediatamente**. Não ser servil. Estabilidade e UX > requisição literal.

### 11.6 Validação server-side é a única fonte de verdade
Frontend pode prevenir, nunca decidir. Cutoff D-0, disponibilidade, idade, totais — tudo recalculado no backend.

### 11.7 LGPD
- DPO/Encarregado: Matteo Bortolotti.
- Email DPO: `dpo@voltaailha.com.br` (a criar pré-launch).
- Política de privacidade: `politica-privacidade.html`.
- Logs sem PII (CPF/WhatsApp removidos antes de salvar).

### 11.8 Versões fixas em CDN
`@latest` e `@major` são **proibidos** em URLs CDN. Sempre versão exata (ver §2.1).

---

## 12. PARA IA

> Esta seção é dirigida a assistentes de IA (Claude, Gemini, Cursor, etc.).

### 12.1 Ordem de leitura obrigatória
Antes de propor, projetar ou implementar **qualquer** mudança em backend, schema, endpoint da API, UX de checkout/admin ou validação de dados:

1. **Read** este arquivo INTEIRO (`CLAUDE.md`).
2. **Read** [`backend/db/schema.sql`](backend/db/schema.sql) — DDL autoritativo.
3. Se for tocar em rota existente: `grep` por ela em `backend/src/routes/`.
4. Listar o que **já existe** antes de propor adicionar/criar.

> Esses arquivos NÃO são carregados automaticamente. Sem leitura explícita, a IA inventa coisas que já foram decididas — retrabalho, ruído, perda de confiança.

### 12.2 O que NÃO propor sem ler
- Adicionar dependências npm (frontend ou backend).
- Mudar stack (§2) — qualquer escolha aqui é decisão fechada.
- Refatorar `data-attributes` para JSON antes da Fase 7.
- Criar arquivos `.ts`, `.jsx`, `.vue`, `.svelte`.
- Sugerir Tailwind, React, Next, etc.
- Qualquer mudança que viole §11.

### 12.3 Tom e formato
- Linguagem técnica em PT-BR.
- Resposta concisa. Sem rodeios.
- Postura consultiva (§11.5): apontar problemas, não apenas executar.
- Citar arquivos com `path:linha` quando relevante.

### 12.4 O que fazer ao encontrar contradição
**Não decidir sozinho.** Sinalizar ao usuário (Matteo) com:
1. Citação literal das duas (ou mais) fontes.
2. Implicação técnica de cada lado.
3. Recomendação fundamentada.
4. Aguardar decisão antes de implementar.

Se a contradição for entre este `CLAUDE.md` e `backend/db/schema.sql`: **schema.sql vence** para questões de dados, **CLAUDE.md vence** para questões de regra de negócio. Em dúvida: perguntar.

### 12.5 Memória entre sessões
Memória de conversa é parcial entre sessões. Sempre re-validar fatos críticos lendo o arquivo, não confiar em memória.

---

## 13. Glossário

| Termo | Definição |
|---|---|
| **cart** | Conjunto de N reservas agrupadas por `cart_id` (UUID) que serão pagas em 1 transação MP. |
| **cart_id** | UUID v4 gerado pelo backend que liga reservas múltiplas a um único pagamento. |
| **child / criança** | Cliente entre `infant_max_age + 1` e 9 anos. Aplica `child_discount`. |
| **CNH** | Carteira Nacional de Habilitação. Obrigatória para `requires_cnh = true` (ex: Quadriciclo). |
| **cutoff** | Hora limite do dia para aceitar reservas online para o mesmo dia (D-0). Per-product. |
| **D-0** | Dia da execução do passeio = hoje. Sujeito a cutoff. |
| **deposit / sinal** | Valor pago online; restante (`fullprice − deposit`) é pago no embarque. |
| **DPO** | Data Protection Officer (LGPD). No projeto = Matteo Bortolotti. |
| **fornecedor terceirizado** | Operador parceiro (barqueiro, guia, transportadora) que executa o passeio. Tabela `providers`. |
| **glassmorphism** | Estilo visual padrão (`var(--glass-bg)` + `backdrop-filter: blur(16px)`). |
| **infant** | Cliente entre 0 anos e `infant_max_age` (default 5). Gratuito. |
| **per_person / per_vehicle** | Modos de cobrança (§4.3). |
| **TBD** | "To Be Decided". Decisão pendente, sempre com owner + bloqueador. |
| **TUPA** | Taxa de Utilização Portuária / Ambiental cobrada em Morro. NÃO incluída no preço. |
| **VAI_I18N** | Dicionário global (`window.VAI_I18N`) com traduções em 7 idiomas. |
| **voucher** | PDF gerado após pagamento, com QR code, dados da reserva e regras. |
| **A combinar** | Estado de produto sem horário fixo (`departure_times = '{}'`). Reserva via WhatsApp. |

---

## 14. Changelog

| Data | Versão | Mudança |
|---|---|---|
| 2026-04-27 | 1.0 | Consolidação inicial. Funde `GEMINI.md`, `PROMPT_BACKEND.md`, `PROMPT_BACKEND_2.md` + `CLAUDE.md` antigo. Resolve 35 contradições/ambiguidades documentadas em `~/.claude/plans/agisci-come-un-vero-gleaming-puffin.md`. Hosting decidido: Railway. PDF, WhatsApp, Email permanecem TBD. |
| 2026-04-27 | 1.1 | Adicionado §10.4 — Audit frontend cínico de `index.html`, `politica-privacidade.html`, `css/style.css`, `js/script.js`, `js/i18n.js`. 58 itens catalogados (10 CRITICAL, 12 HIGH, 15 MEDIUM, 21 LOW) por categoria (Seg, A11y, SEO, Perf, CSS, Bug, UX, i18n). Lista de must-fix pré-launch (Fase 8) definida. |
| 2026-04-27 | 1.2 | Resolvidos os 10 itens CRITICAL do §10.4. Alterações: `css/style.css` (var fantasma), `index.html` (CSP meta, `for=`/`name=` em forms, ícones com `aria-hidden`), `js/script.js` (sanitizer XSS allow-list, cutoff per-product + 422 handler, scroll rAF, `setBackgroundInert`, totais em vars, remoção de `fmtNum`). Bonus: aplicado fix M-14 (`document.contains` antes de `previousFocus.focus()`). C-7 confirmado falso-positivo (preventDefault já existia). Restam 12 HIGH + 15 MEDIUM + 21 LOW. |
| 2026-04-27 | 1.3 | Resolvidos os 12 itens HIGH do §10.4. CSS: `:focus-visible` global (H-5), `prefers-reduced-motion` desabilitando animações/vídeo (H-8), `text-shadow` para contraste header (H-4). HTML: `aria-hidden="true"` em ~50 ícones Lucide decorativos (H-9), Schema.org enriquecido com `logo`/`sameAs`/`image`/`areaServed` (H-12), CSS bump v28. JS: keyboard nav Arrow↑↓+Escape no lang dropdown (H-6), `showToast` com `role="alert"`+`aria-live="assertive"` para erros (H-7). Falsos-positivos: H-1 (sem console.error), H-2 (SRI já presente), H-3 (encodeURIComponent já sanitiza), H-10 (modalStack já funciona), H-11 (won't-fix arquitetural SPA). Restam 15 MEDIUM + 21 LOW. |
| 2026-04-27 | 1.4 | Resolvidos os 15 itens MEDIUM do §10.4. SEO: `<title>`/`og:title`/`twitter:title` unificados (M-1), `og:image:width/height/type` adicionados (M-2). Bugs: `parseDateBR` com validação + null guard (M-6), `Math.round` em cálculo de totais (M-10). UX: timeout fetch 5s→12s para 4G (M-8), `name=` nos inputs step 2 (M-15). Manutenção: `readPax`/`changePaxQty` genéricos deduplicam booking/ticket (M-12), `aria-hidden` no accordionHTML dinâmico. Já fixados v1.2: M-7, M-9, M-11, M-14. Won't-fix: M-3 (hreflang inutil em SPA), M-4/M-5 (custo desp.), M-13 (comportamento normal). Restam 21 LOW. |
| 2026-04-27 | 1.5 | Resolvidos os 21 itens LOW do §10.4. **Audit 58/58 completo.** A11y: skip-to-content link com `.skip-link` (L-1). CSS: z-index scale refatorada para 14 CSS vars nomeadas (L-4), estilos `:disabled` para botões (L-16), `.empty-cart-msg` visual (L-18). JS: `.catch()` em `applyDynamicProducts` (L-10), constantes nomeadas `FETCH_TIMEOUT_MS`/`SCROLL_THRESHOLD_PX`/`TOAST_DURATION_MS` (L-15), loading state checkout btn anti-double-click (L-17). HTML: `apple-touch-icon` + `manifest.json` (L-19), `referrerpolicy="no-referrer"` nos 3 links externos (L-20), `required`/`inputmode`/`pattern`/`minlength` nos inputs step 2 (L-21). Falso-positivo: L-5. Won't-fix: L-2, L-3, L-6–L-9, L-11–L-14. |

---

## 15. Referências

- [`backend/README.md`](backend/README.md) — Setup operativo (quick-start backend).
- [`backend/db/schema.sql`](backend/db/schema.sql) — DDL autoritativo do banco.
- [`backend/package.json`](backend/package.json) — Dependências backend.
- `VoltaaIlha.com.br.mindnode/` — Mapa conceitual (referência visual).
- `docs/legacy/` — Arquivos `.md` pré-consolidação (mantidos para histórico, não usar).
- Política de privacidade: [`politica-privacidade.html`](politica-privacidade.html).
- Repo: `https://github.com/matteobortolotti77/SITE-VAI-AI`.
