# Painel de Gestão — Instruções de Execução

---

## Pré-requisitos (ação manual — Matteo)

- [ ] **Criar admin user no Supabase**
  1. Abrir [app.supabase.com](https://app.supabase.com) → seu projeto
  2. **Authentication → Users → Add User → Create New User**
  3. Email: `admin@voltaailha.com.br` (ou o que preferir)
  4. Senha: uma senha forte à sua escolha
  5. Em **User Metadata** (JSON), colar: `{"role": "admin"}`
  6. Clicar **Create User**
  7. ✅ Anotar o email e senha — será o login do painel

> [!NOTE]
> Isso cria um user **apenas no Supabase Auth** (JWT), totalmente separado do acesso ao dashboard do Supabase. O painel só aceita users com `role: admin` no metadata.

- [ ] **Confirmar variáveis na Railway**
  - `SUPABASE_URL` ✅ (já existe)
  - `SUPABASE_ANON_KEY` ✅ (já existe)
  - `SUPABASE_SERVICE_ROLE_KEY` ✅ (já existe)
  - Nenhuma nova variável necessária

---

## Fase 1 — Auth + Scaffold

### 1.1 Backend: Middleware de autenticação

- [ ] Criar `backend/src/middleware/auth.js`
  - Função `verifyAdmin` — Fastify `preHandler`
  - Extrai `Authorization: Bearer <token>` do header
  - Chama Supabase `auth.getUser(token)` para validar o JWT
  - Verifica `user.user_metadata.role === 'admin'`
  - 401 se token ausente/inválido; 403 se role ≠ admin
  - Injeta `request.adminUser = { id, email }` para uso nas rotas

### 1.2 Backend: Scaffold de rotas admin

- [ ] Criar `backend/src/routes/admin.js`
  - Registra `verifyAdmin` como `preHandler` do plugin inteiro
  - Implementa inicialmente apenas `GET /admin/ping` → `{ ok: true, admin: request.adminUser.email }`
  - Serve como smoke test da auth

- [ ] Atualizar `backend/src/server.js`
  - Importar e registrar `adminRoutes` com `prefix: '/v1'`

- [ ] Testar localmente
  - `POST /v1/admin/ping` sem token → 401
  - `POST /v1/admin/ping` com token válido de admin → 200

### 1.3 Frontend: Login + Shell SPA

- [ ] Criar `admin/index.html`
  - Meta tags, charset, viewport
  - Carrega Supabase JS via CDN (versão exata `2.45.4`)
  - Carrega Lucide icons via CDN (mesma versão do site)
  - Carrega `admin.css` e `admin.js`
  - Estrutura: `<div id="login-screen">` + `<div id="app-shell" hidden>`

- [ ] Criar `admin/css/admin.css`
  - CSS variables (cores, fontes, espaçamentos)
  - Login centralizado (card glassmorphism)
  - Shell: sidebar fixa esquerda (240px) + main com padding
  - Tabela responsiva, cards KPI, badges de status
  - Mobile: sidebar colapsa em hamburger
  - Dark sidebar (`#1a1a2e`), main claro (`#f5f6fa`)

- [ ] Criar `admin/js/admin.js`
  - IIFE (mesma convenção do site principal)
  - Inicializa Supabase client com `SUPABASE_URL` + `SUPABASE_ANON_KEY` (hardcoded — são públicas)
  - **Login**: `supabase.auth.signInWithPassword({ email, password })`
  - **Session check**: `supabase.auth.getSession()` no load
  - **Auth state listener**: `supabase.auth.onAuthStateChange()` para auto-redirect
  - **Logout**: `supabase.auth.signOut()`
  - **Router**: hash-based (`#dashboard`, `#reservas`, `#produtos`)
  - **API helper**: `async function api(path, options)` que injeta `Authorization: Bearer <token>` em todas as chamadas

- [ ] Testar login no browser
  - Acessar `voltaailha.com.br/admin/`
  - Login com credenciais do pré-requisito
  - Deve ver shell com sidebar

---

## Fase 2 — Reservas

### 2.1 Backend: Listar reservas

- [ ] `GET /admin/reservations` em `admin.js`
  - Query params: `date`, `status`, `product_id`, `page`, `limit`
  - JOIN com `customers` (name, whatsapp) e `products` (name, slug)
  - Ordenar por `travel_date DESC, created_at DESC`
  - Retorna: `{ data: [...], total, page, limit }`

### 2.2 Backend: Detalhe de reserva

- [ ] `GET /admin/reservations/:id` em `admin.js`
  - Reserva completa + customer + product
  - Sub-queries: `passengers` da reserva, `payments` da reserva, `notifications` da reserva
  - Retorna objeto com tudo junto

### 2.3 Backend: Mudar status

- [ ] `PATCH /admin/reservations/:id/status` em `admin.js`
  - Body: `{ status, reason }`
  - Validar transição permitida (mapa de transições hardcoded)
  - Se cancelamento com refund: chamar MP Refund API (`POST /v1/payments/:id/refunds`)
  - Atualizar `reservations.status` + `reservations.notes` (append reason)
  - Retorna reserva atualizada

### 2.4 Frontend: Tela de reservas

- [ ] View `#reservas` no `admin.js`
  - Filtros no topo: date picker nativo, select status, select produto
  - Tabela com colunas: Cliente | WhatsApp | Passeio | Data | Hora | Pax | Sinal | Status
  - Badges de status com cores:
    - `pending_payment` → amarelo
    - `deposit_paid` → verde
    - `fully_paid` → verde escuro
    - `cancelled_*` → vermelho
    - `rescheduled` → azul
  - Click em linha → expande/abre detalhe inline ou modal
  - Botões de ação no detalhe: Confirmar Pagamento | Cancelar | Reembolsar

- [ ] Testar com dados reais do Supabase

---

## Fase 3 — Produtos

### 3.1 Backend: Listar todos os produtos

- [ ] `GET /admin/products` em `admin.js`
  - Retorna TODOS (incluindo `active=false`)
  - Ordenar por `sort_order ASC, name ASC`

### 3.2 Backend: Criar produto

- [ ] `POST /admin/products` em `admin.js`
  - Campos obrigatórios: `name`, `slug`, `type`, `price_full`, `capacity`
  - Validação Zod no body
  - Slug auto-gerado se não fornecido (de `name`)
  - Retorna produto criado

### 3.3 Backend: Editar produto

- [ ] `PATCH /admin/products/:id` em `admin.js`
  - Aceita qualquer subconjunto dos campos editáveis
  - Campos de política infantil incluídos:
    - `child_discount` — percentual (0.00 a 1.00) ou NULL (sem desconto)
    - `infant_max_age` — idade máxima para gratuidade (default 5)
    - `child_min_age` — idade mínima para participar (NULL = qualquer)
  - Validação Zod parcial
  - Retorna produto atualizado

### 3.4 Backend: Desativar produto

- [ ] `DELETE /admin/products/:id` em `admin.js`
  - Soft delete: `UPDATE products SET active = false`
  - Retorna `{ ok: true }`

### 3.5 Frontend: Tela de produtos

- [ ] View `#produtos` no `admin.js`
  - Lista: cards ou tabela com Nome | Tipo | Preço | Sinal | Capacidade | Status
  - Toggle ativo/inativo inline (switch visual)
  - Botão "Editar" → formulário modal/inline com todos os campos:
    - Gerais: nome, slug, tipo, descrição
    - Preço: `price_full`, `price_deposit`, `pricing_mode`
    - Capacidade: `capacity`, `departure_times` (input CSV)
    - Cutoff: `cutoff_hour`, `cutoff_minute`
    - **Política infantil**: `child_discount`, `infant_max_age`, `child_min_age`
    - Per-vehicle (se aplicável): `vehicle_capacity`, `insurance_per_pax`
  - Botão "Novo Produto" → mesmo formulário em modo criação

- [ ] Testar criar, editar e desativar produto

---

## Fase 4 — Dashboard + Notificações

### 4.1 Backend: Analytics

- [ ] `GET /admin/analytics/sales` em `admin.js`
  - Query: `?from=YYYY-MM-DD&to=YYYY-MM-DD` (default últimos 30d)
  - 1 query SQL com CTEs:
    - KPIs de hoje (count, revenue, pending)
    - Totais do período
    - Breakdown por status
    - Ranking de produtos
  - Retorna JSON estruturado

### 4.2 Backend: Enviar lista diária

- [ ] `POST /admin/notifications/send-daily` em `admin.js`
  - Busca reservas de amanhã com status `deposit_paid` ou `fully_paid`
  - Agrupa por produto → provider
  - Para cada provider: monta mensagem texto com lista de passageiros
  - Envia via Z-API (service `whatsapp.js` existente)
  - Insere logs em `notifications`
  - Retorna `{ sent, failed, total_passengers }`

### 4.3 Frontend: Dashboard

- [ ] View `#dashboard` (tela inicial após login)
  - 4 cards KPI no topo:
    - 💰 Receita Hoje
    - 📋 Reservas Hoje
    - ⏳ Pendentes
    - 📊 Receita do Mês
  - Tabela: reservas do dia (com status badges)
  - Botão "Enviar Lista Diária" → confirma → chama API → mostra resultado

---

## Deploy

- [ ] **Git push** → Cloudflare Pages auto-deploy (pasta `admin/` serve automaticamente em `/admin/`)
- [ ] **Railway** → auto-deploy do backend (mesma pipeline)
- [ ] Testar acesso em `voltaailha.com.br/admin/`
- [ ] Testar login e navegação completa

---

## Ordem de execução recomendada

```
Pré-requisitos (Matteo — 5 min)
    ↓
Fase 1.1 → 1.2 → 1.3 (auth funcional)
    ↓
Fase 2.1 → 2.2 → 2.3 → 2.4 (reservas operacionais)
    ↓
Fase 3.1 → 3.2 → 3.3 → 3.4 → 3.5 (produtos com política infantil)
    ↓
Fase 4.1 → 4.2 → 4.3 (dashboard + notificações)
    ↓
Deploy + teste final
```

> [!TIP]
> Após Fase 2, o painel já é **operacionalmente útil** — você consegue ver e gerenciar reservas. Fases 3 e 4 adicionam conveniência mas não são bloqueadores para o lançamento.
