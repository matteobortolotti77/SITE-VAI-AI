# Volta à Ilha — Backend

API de reservas, pagamentos e vouchers.
Stack: **Node.js 22 + Fastify 5 + Supabase (Postgres) + MercadoPago**.

---

## 0. Estado atual

✅ Estrutura de pastas
✅ Schema SQL (`db/schema.sql`)
✅ Fastify server com `/health`, `/products`, `/availability`
⏳ Aguardando: credentials Supabase + MercadoPago + capacidades dos produtos

Sem credentials, o servidor sobe normalmente mas todas as rotas (exceto `/health`) retornam **503 service_not_configured**. Isso é proposital — evita acidentalmente apontar para banco errado.

---

## 1. Setup (ordem obrigatória)

### 1.1 Instalar Node 22
```bash
brew install node@22
node --version  # deve dizer v22.x.x
```

### 1.2 Instalar dependências
```bash
cd backend
npm install
```

### 1.3 Criar projeto Supabase
1. https://supabase.com → Login com GitHub → **New project**
2. Nome: `volta-a-ilha` · Region: `South America (São Paulo)` · Password: anote num gerenciador
3. Aguarde ~2 min até "Project is ready"
4. **Project Settings → API** → copie:
   - **Project URL** (`https://XXX.supabase.co`)
   - **anon public** key (publica)
   - **service_role** key (SECRETA — não compartilhe)

### 1.4 Rodar o schema
1. Supabase → **SQL Editor** → **New query**
2. Cole o conteúdo inteiro de [`db/schema.sql`](./db/schema.sql)
3. Clique **RUN** — deve dizer "Success"
4. Verifique em **Table Editor**: devem aparecer 6 tabelas (providers, products, customers, reservations, payments, notifications) e 1 view (availability)

### 1.5 Criar conta MercadoPago PJ
1. https://www.mercadopago.com.br/developers → cadastro com CNPJ 13.510.711/0001-58
2. Aguarde aprovação (1-2 dias úteis)
3. Após aprovado: **Suas integrações → Criar aplicação** → escolha "Pagamentos online"
4. **Credenciais** → copie **Access Token de TESTE** (`TEST-...`)
5. Configure webhook (será detalhado quando integrarmos)

### 1.6 Configurar `.env`
```bash
cp .env.example .env
# Edite .env e cole os valores reais
```

### 1.7 Subir servidor em dev
```bash
npm run dev
```

Saída esperada:
```
Server listening at http://0.0.0.0:3000
```

Testar:
```bash
curl http://localhost:3000/v1/health
# → { "ok": true, "ready": true, ... }

curl http://localhost:3000/v1/products
# → { "products": [...] }  (vazio até popular)
```

---

## 2. Popular produtos iniciais

Após o schema rodar e antes de qualquer reserva, vamos inserir os 16 produtos atuais (passeios + atividades + passagens). Isso será feito via script `db/seed.sql` — **será criado quando você passar as capacidades**.

---

## 3. Estrutura de pastas

```
backend/
├── package.json
├── .env.example          # template — copie p/ .env
├── .env                  # NUNCA committar (no .gitignore)
├── README.md             # este arquivo
├── db/
│   └── schema.sql        # rodar no Supabase SQL Editor
└── src/
    ├── server.js         # entry point
    ├── config.js         # carrega .env
    ├── db/
    │   └── client.js     # Supabase client (service_role)
    ├── routes/
    │   ├── health.js     # GET /v1/health
    │   └── products.js   # GET /v1/products, /:slug, /availability
    ├── services/         # (futuro) lógica de negócio
    └── utils/            # (futuro) helpers
```

---

## 4. Próximas fases (ordem)

| Fase | O que entra | Bloqueador |
|------|-------------|-----------|
| **1 ✅** | Estrutura, schema, /products read-only | Nada — está aqui |
| **2** | Seed inicial dos 16 produtos | Capacidades reais |
| **3** | POST /reservations + integração MercadoPago | Conta MP aprovada |
| **4** | Webhook de pagamento + atualização de status | MP webhook secret |
| **5** | Geração de voucher PDF + envio (email) | Resend.com account |
| **6** | Painel admin (CRUD completo) | — |
| **7** | Migrar frontend para consumir API | Backend deployado |

---

## 5. Deploy (futuro — não fazer ainda)

Plano: **Railway.app** (~R$ 50/mês, deploy direto do GitHub).

```bash
# Variáveis a configurar no Railway:
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
MP_ACCESS_TOKEN=APP_USR-...   # produção
MP_WEBHOOK_SECRET=...
CORS_ORIGIN=https://voltaailha.com.br
NODE_ENV=production
PORT=3000
```

---

## 6. Decisões pendentes (lembrar Matteo)

- [ ] Criar conta MercadoPago PJ (CNPJ 13.510.711/0001-58)
- [ ] Criar projeto Supabase + rodar `schema.sql`
- [ ] Definir capacidade de cada produto (passou amanhã)
- [ ] Criar `dpo@voltaailha.com.br` antes do launch (LGPD — já citado em politica-privacidade.html)
