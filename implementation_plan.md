# Painel de Gestão — Volta à Ilha

## Contexto

O site público está operacional. O painel admin é a **Fase 6** do roadmap (CLAUDE.md §9). Precisamos de um painel para gerenciar reservas, produtos e ter visão geral do negócio — funcional, seguro, rápido.

---

## Decisões Técnicas

| Decisão | Escolha | Razão |
|---|---|---|
| **Frontend** | Vanilla HTML/CSS/JS (SPA) | CLAUDE.md §2.3 proíbe React/Vue/etc. Mesma stack do site principal |
| **Auth** | Supabase Auth (email+senha) | CLAUDE.md §2.1 — JWT nativo, RLS no banco |
| **Backend** | Novas rotas Fastify `/admin/*` | Mesmo server.js, mesmo deploy Railway |
| **Hosting painel** | `admin/` no mesmo repo, Cloudflare Pages | Zero custo, DNS já configurado |
| **Libs novas** | Nenhuma | Supabase JS SDK já incluso no backend, CDN no frontend |

---

## Estrutura de Arquivos

```
volta-a-ilha/
├── admin/                          # [NOVO] SPA do painel admin
│   ├── index.html                  # Login + Shell SPA (sidebar + content)
│   ├── css/
│   │   └── admin.css               # Design system do painel (dark sidebar, cards, tabelas)
│   └── js/
│       └── admin.js                # Auth + routing + API calls + rendering
│
├── backend/src/
│   ├── middleware/
│   │   └── auth.js                 # [NOVO] Middleware JWT Supabase → fastify preHandler
│   └── routes/
│       └── admin.js                # [NOVO] Todas as rotas /admin/* (§7.2 do CLAUDE.md)
```

---

## Fases de Implementação

### Fase 1 — Fundação (Auth + Scaffold)

#### 1.1 Criar admin user no Supabase

> [!IMPORTANT]
> Matteo precisa criar manualmente um user no **Supabase Dashboard → Authentication → Users → Add User**:
> - Email: `admin@voltaailha.com.br`
> - Senha: escolhida por Matteo
> - Role metadata: `{"role": "admin"}` no campo `user_metadata`

#### 1.2 Backend: Middleware JWT

```
backend/src/middleware/auth.js
```

- Extrai token do header `Authorization: Bearer <token>`
- Verifica JWT usando `SUPABASE_URL` + `SUPABASE_ANON_KEY` (Supabase `auth.getUser()`)
- Verifica `user_metadata.role === 'admin'`
- Rejeita com 401/403 se inválido
- Injeta `request.adminUser` com `{ id, email, role }`

#### 1.3 Backend: Scaffold rotas admin

```
backend/src/routes/admin.js
```

- Registra o middleware auth como `preHandler` no plugin
- Implementa todas as rotas do §7.2 do CLAUDE.md (listadas abaixo)
- Registrado em `server.js` com `prefix: '/v1'`

#### 1.4 Frontend: Login + Shell SPA

```
admin/index.html
admin/css/admin.css
admin/js/admin.js
```

- **Tela de login**: email + senha → `supabase.auth.signInWithPassword()`
- **Shell após login**: sidebar fixa (esquerda) + área de conteúdo
- **Routing por hash**: `#dashboard`, `#reservas`, `#produtos`, `#config`
- **Session**: Supabase client-side SDK gerencia refresh tokens automaticamente
- **Logout**: `supabase.auth.signOut()` + redirect para login

---

### Fase 2 — Reservas (Core Operacional)

A tela mais importante — o que o admin usa diariamente.

#### 2.1 Listagem de Reservas

**Rota**: `GET /admin/reservations`

**Query params**:
- `date` — filtro por travel_date (default: hoje)
- `status` — filtro por status (multi-select)
- `product_id` — filtro por produto
- `page` / `limit` — paginação (default 50)

**Response**: Array de reservas com JOINs em `customers` e `products` (nome, whatsapp, produto, data, status, valor).

**Frontend**:
- Tabela responsiva com colunas: Cliente | WhatsApp | Passeio | Data | Horário | Pax | Sinal | Status
- Filtros: date picker, dropdown status, dropdown produto
- Badge colorido por status (`deposit_paid` = verde, `pending_payment` = amarelo, `cancelled*` = vermelho)
- Click na linha → abre detalhe

#### 2.2 Detalhe de Reserva

**Rota**: `GET /admin/reservations/:id`

**Response**: Reserva completa + customer + product + passengers + payments + notifications.

**Frontend**:
- Card com todos os dados
- Timeline de eventos (criação → pagamento → voucher → WhatsApp)
- Lista de passageiros (se preenchidos)
- Botões de ação: **Confirmar** | **Cancelar** | **Reembolsar**

#### 2.3 Mudar Status

**Rota**: `PATCH /admin/reservations/:id/status`

**Body**: `{ status, reason?, refund_type? }`

**Lógica backend**:
- Valida transição de estado permitida (máquina de estados §6.6)
- Se `cancelled_*` + refund → chama MercadoPago Refund API
- Atualiza `reservations.status` + `updated_at`
- Log em `notifications` se disparo de WhatsApp/email

**Transições permitidas**:
```
pending_payment → cancelled_noshow
pending_payment → cancelled_force_majeure
deposit_paid → fully_paid
deposit_paid → cancelled_noshow (refund parcial/total via §5.3)
deposit_paid → cancelled_force_majeure (refund total)
deposit_paid → rescheduled
```

---

### Fase 3 — Produtos (CRUD)

#### 3.1 Listagem

**Rota**: `GET /admin/products`

Retorna **todos** os produtos (incluindo `active=false`).

**Frontend**: Cards ou tabela com: Nome | Tipo | Preço | Capacidade | Status (ativo/inativo) | Ações

#### 3.2 Editar Produto

**Rota**: `PATCH /admin/products/:id`

**Campos editáveis**:
- `name`, `description`
- `price_full`, `price_deposit`
- `capacity`, `departure_times`
- `cutoff_hour`, `cutoff_minute`
- `child_discount`, `infant_max_age`, `child_min_age`
- `active` (ativar/desativar)
- `sort_order`

**Frontend**: Formulário com os campos acima, botão Salvar.

#### 3.3 Criar Produto

**Rota**: `POST /admin/products`

Mesmo formulário da edição, com campos obrigatórios: `name`, `slug`, `type`, `price_full`, `capacity`.

#### 3.4 Desativar Produto

**Rota**: `DELETE /admin/products/:id`

Soft delete: `UPDATE products SET active = false WHERE id = $1`

---

### Fase 4 — Dashboard + Analytics

#### 4.1 Dashboard (tela inicial)

**Rota**: `GET /admin/analytics/sales`

**Query**: `?from=YYYY-MM-DD&to=YYYY-MM-DD` (default: últimos 30 dias)

**Response backend** (1 query SQL otimizada):
```json
{
  "today": {
    "reservations_count": 12,
    "revenue_deposit": 1850.00,
    "pending_count": 3
  },
  "period": {
    "total_revenue": 28500.00,
    "total_reservations": 156,
    "by_status": { "deposit_paid": 120, "pending_payment": 15, ... },
    "by_product": [ { "name": "Volta à Ilha", "count": 45, "revenue": 6750.00 }, ... ],
    "daily": [ { "date": "2026-05-01", "revenue": 950, "count": 8 }, ... ]
  }
}
```

**Frontend**:
- 4 KPI cards no topo: Receita Hoje | Reservas Hoje | Pendentes | Receita Mês
- Tabela top produtos do período
- Reservas do dia com status badges

#### 4.2 Notificação Manual

**Rota**: `POST /admin/notifications/send-daily`

- Gera lista de passageiros do dia seguinte (agrupado por produto/horário)
- Envia via Z-API WhatsApp para cada fornecedor da `providers`
- Retorna resumo: `{ sent: 3, failed: 0, passengers_total: 28 }`

---

## Design do Painel

### Layout
```
┌─────────────────────────────────────────────┐
│  🌴 Volta à Ilha    [Admin]     [Sair]      │  ← Header
├──────────┬──────────────────────────────────┤
│          │                                  │
│ Dashboard│   Conteúdo da página ativa       │
│ Reservas │                                  │
│ Produtos │   (tabela / formulário / cards)  │
│ Config   │                                  │
│          │                                  │
│          │                                  │
└──────────┴──────────────────────────────────┘
     Sidebar              Main Content
```

### Estética
- **Sidebar**: dark (`#1a1a2e`) com ícones Lucide
- **Main**: fundo `#f5f6fa`, cards brancos com `border-radius: 12px`, sombra suave
- **Tipografia**: Inter (Google Fonts), mesma do site principal
- **Cores de status**: verde (`deposit_paid`), amarelo (`pending`), vermelho (`cancelled`), azul (`rescheduled`)
- **Mobile**: sidebar vira hamburger menu, tabelas viram cards empilhados
- **Zero framework CSS**: tudo em `admin.css`, variáveis CSS compartilhadas

---

## Verificação

### Testes funcionais
1. Login com credenciais corretas → acessa painel
2. Login com credenciais erradas → erro claro
3. Token expirado → redirect para login
4. Listar reservas com filtros → dados corretos
5. Mudar status de reserva → atualiza no banco
6. Criar/editar produto → persiste no banco
7. Dashboard KPIs → números batem com os dados

### Segurança
- JWT validado server-side em todas as rotas `/admin/*`
- RLS no Supabase impede acesso direto ao banco sem service_role
- CORS restrito às origens conhecidas
- Sem `innerHTML` no frontend admin (mesma regra §11.4)

---

## Open Questions

> [!IMPORTANT]
> **1. Admin user**: Matteo, você já tem um user criado no Supabase Auth? Ou preciso te guiar para criar?

> [!IMPORTANT]
> **2. Subdomínio**: Preferência é `admin.voltaailha.com.br` ou `voltaailha.com.br/admin/`? O segundo é mais simples (mesmo deploy Cloudflare).

> [!IMPORTANT]
> **3. Prioridade**: Quer que eu implemente tudo de uma vez (Fases 1→4 sequenciais) ou prefere entregar por módulos (auth+reservas primeiro, produtos e dashboard depois)?

---

## Estimativa

| Fase | Complexidade | Peso |
|---|---|---|
| 1 — Auth + Scaffold | Média | ███░░ |
| 2 — Reservas | Alta | █████ |
| 3 — Produtos | Média | ███░░ |
| 4 — Dashboard | Média | ███░░ |

Total: ~4 sessões de trabalho focado, começando por **Fase 1 + 2** (o que você precisa para operar no dia-a-dia).
