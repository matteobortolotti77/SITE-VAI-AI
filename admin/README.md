# Admin — Volta à Ilha

SPA estática de gestão. Zero build — HTML/CSS/JS vanilla servido via **Cloudflare Pages**.

## Hospedagem

Cloudflare Pages auto-deploy via GitHub (`main` branch). Qualquer push em `admin/` propaga em ~30s.

URL produção: `https://voltaailha.com.br/admin/`

## Configuração

`admin/config.json` (commitado, valores públicos por design Supabase):

```json
{
  "supabaseUrl": "https://<project>.supabase.co",
  "supabaseAnonKey": "<anon-key>",
  "apiBase": "https://api.voltaailha.com.br/v1"
}
```

Em dev local (`localhost`), `admin.js` sobrepõe `apiBase` para `http://localhost:3000/v1` automaticamente.

Se precisar recriar o arquivo: copie `config.example.json` e preencha com os valores do projeto Supabase.

## Build

Nenhum. Servir `admin/index.html` diretamente.

## Acesso

Login via Supabase Auth (email + senha). Criar usuário admin no dashboard Supabase → Authentication → Users.
