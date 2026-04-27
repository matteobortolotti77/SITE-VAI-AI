# Volta à Ilha — Backend (Quick-start)

API de reservas, pagamentos e vouchers.
Stack: **Node.js 22 + Fastify 5 + Supabase (Postgres) + MercadoPago**.

> 📘 **Especificação completa, regras de negócio, roadmap e decisões pendentes** vivem em [`../CLAUDE.md`](../CLAUDE.md) (master).
> Este arquivo cobre **apenas o setup operativo local** do backend.

---

## Estado atual

✅ Estrutura de pastas
✅ Schema SQL (`db/schema.sql`)
✅ Fastify server com `/health`, `/products`, `/availability`
⏳ Aguardando: credentials Supabase + MercadoPago + capacidades dos produtos

Sem credentials, o servidor sobe normalmente mas todas as rotas (exceto `/health`) retornam **503 service_not_configured**. Isso é proposital — evita acidentalmente apontar para banco errado.

---

## Setup (ordem obrigatória)

### 1. Instalar Node 22
```bash
brew install node@22
node --version  # deve dizer v22.x.x
```

### 2. Instalar dependências
```bash
cd backend
npm install
```

### 3. Criar projeto Supabase
1. https://supabase.com → Login com GitHub → **New project**
2. Nome: `volta-a-ilha` · Region: `South America (São Paulo)` · Password: anote num gerenciador
3. Aguarde ~2 min até "Project is ready"
4. **Project Settings → API** → copie:
   - **Project URL** (`https://XXX.supabase.co`)
   - **anon public** key (publica)
   - **service_role** key (SECRETA — não compartilhe)

### 4. Rodar o schema
1. Supabase → **SQL Editor** → **New query**
2. Cole o conteúdo inteiro de [`db/schema.sql`](./db/schema.sql)
3. Clique **RUN** — deve dizer "Success"
4. Verifique em **Table Editor**: devem aparecer 8 tabelas (providers, products, customers, reservations, passengers, payments, notifications, fleet_reallocations) e 1 view (availability)

### 5. Criar conta MercadoPago PJ
1. https://www.mercadopago.com.br/developers → cadastro com CNPJ `13.510.711/0001-58`
2. Aguarde aprovação (1–2 dias úteis)
3. Após aprovado: **Suas integrações → Criar aplicação** → escolha "Pagamentos online"
4. **Credenciais** → copie **Access Token de TESTE** (`TEST-...`)
5. Configure webhook (será detalhado na Fase 3 — ver `CLAUDE.md` §9)

### 6. Configurar `.env`
```bash
cp .env.example .env
# Edite .env e cole os valores reais
```

### 7. Subir servidor em dev
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

## Estrutura de pastas

```
backend/
├── package.json
├── .env.example          # template — copie p/ .env
├── .env                  # NUNCA committar (no .gitignore)
├── README.md             # este arquivo (setup)
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
    ├── services/         # pricing.js, cutoff.js, ...
    └── utils/
```

---

## Próximos passos

Roadmap, bloqueadores e TBDs estão centralizados em [`../CLAUDE.md`](../CLAUDE.md):
- Fases de implementação: `CLAUDE.md` §9
- Estado atual + backlog: `CLAUDE.md` §10
- Decisões pendentes (PDF lib, WhatsApp provider, Email provider): `CLAUDE.md` §2.2 + §10.1
- Variáveis de ambiente para deploy Railway: ver `.env.example` + `CLAUDE.md` §2.2
