# CLAUDE.md — Volta à Ilha: Guia Definitivo de Desenvolvimento

> Leia este arquivo **inteiro** antes de tocar em qualquer código.
> Ele substitui e expande o GEMINI.md anterior.

---

## 1. O QUE É ESTE PROJETO

SPA de turismo para a agência **Volta à Ilha** em Morro de São Paulo, Bahia.
Fluxo principal: vitrine de produtos → reserva/consulta → WhatsApp/pagamento.

- URL produção: `https://voltaailha.com.br/`
- WhatsApp operacional: `+55 75 99824-0043`
- Repo: `https://github.com/matteobortolotti77/SITE-VAI-AI`

---

## 2. STACK — SEM EXCEÇÕES

| Camada | Tecnologia | Proibido |
|--------|-----------|---------|
| Markup | HTML5 semântico | JSX, Pug, templates |
| Estilo | CSS3 vanilla (`/css/style.css`) | Tailwind, SCSS, CSS-in-JS |
| Lógica | JavaScript ES6+ vanilla (`/js/script.js`) | React, Vue, Alpine, jQuery |
| Ícones | Lucide (via script) | FontAwesome, Heroicons |
| Slider | Swiper.js v11 | Splide, Glide, outros |
| Calendário | Flatpickr | Pikaday, DateRangePicker |
| Fontes | Google Fonts — Outfit | Qualquer outra |

**Não adicionar dependências sem aprovação explícita.**

---

## 3. ESTRUTURA DE ARQUIVOS

```
volta-a-ilha/
├── index.html              # Único ponto de entrada — toda a SPA
├── css/
│   └── style.css           # TODO o estilo. ?v=N para cache bust manual
├── js/
│   ├── script.js           # TODO o JS principal dentro de IIFE
│   └── i18n.js             # Dicionário VAI_I18N (7 idiomas, casca apenas)
├── assets/
│   ├── logo.png
│   ├── Logo FX.png         # Marca d'água
│   ├── hero.mp4
│   ├── og_share.jpg        # 1200×630 — OG image
│   ├── favicon.ico
│   └── volta_a_ilha_*.webp
├── robots.txt
├── sitemap.xml
├── CLAUDE.md               # Este arquivo
├── GEMINI.md               # Legado — mantido para histórico
├── PROMPT_BACKEND.md       # Legado
└── PROMPT_BACKEND_2.md     # Spec técnica atualizada
```

Não criar subpastas desnecessárias. Não criar arquivos `.ts`, `.jsx`, `.vue`.

---

## 4. ARQUITETURA SPA

### Views
Quatro views controladas por visibilidade CSS (`.spa-view.active`):

| ID | URL hash | Conteúdo |
|----|----------|---------|
| `view-home` | `#home` | Hero com vídeo |
| `view-passeios` | `#passeios` | Carrossel `#carousel-passeios` (Volta à Ilha, Garapuá 4X4, Gamboa Full, Gamboa Convencional, Quadriciclo, Buggy) |
| `view-atividades` | `#atividades` | Carrossel `#carousel-atividades` (Mergulho, Cavalgada, Tiroleza, Banana Boat, Bike Aquática, Bicicletas) |
| `view-passagens` | `#passagens` | Toggle IDA/VOLTA com 2 carrosséis |

Ordem do menu: Início · Passeios · Atividades · Passagens.

### Fluxo de dados dos produtos
Atualmente os dados estão nos `data-attributes` dos botões. **Não refatorar para JSON/API ainda** — isso vem no backend. Manter o padrão existente.

```html
<button data-action="book" 
        data-product="Nome" 
        data-price="100"       <!-- sinal ou preço único -->
        data-fullprice="350"   <!-- preço total (omitir se não há sinal) -->
        data-times="09:30,14:00">
```

---

## 5. REGRAS DE CÓDIGO

### JavaScript
```js
// OBRIGATÓRIO: tudo dentro da IIFE
(() => {
    // código aqui
})();
```

- **Zero `window.*` leak** — nada fora da IIFE
- **Zero `onclick=""` no HTML** — usar `data-action` + event delegation
- **Zero `.innerHTML` com variáveis** — usar `.textContent` ou `createElement`
- **Sem `alert()` ou `confirm()`** — criar componentes de UI próprios (toast, dialog)
- **`window.open('...', '_blank')` sempre com `noopener noreferrer`**

### CSS
- Mobile-first: regras base para mobile, `@media (min-width: Xpx)` para expand
- Variáveis CSS no `:root {}` para cores e espaçamentos reutilizáveis
- Classes de estado: `.active`, `.open`, `.hidden`
- Sem IDs no CSS (IDs são apenas para JS selectors)

### HTML
- Todo texto estático em PT-BR (i18n vem depois com atributos `data-i18n`)
- `alt=""` + `aria-hidden="true"` em imagens decorativas
- `aria-label` obrigatório em botões sem texto visível
- Modais precisam: role="dialog", aria-modal="true", focus trap, Escape fecha

---

## 6. DESIGN SYSTEM

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

**Glassmorphism** é o idioma visual padrão para header, modais e overlays.
Componentes de produto (cards) usam fundo sólido/semi-sólido.

---

## 7. MULTI-IDIOMA (i18n) — IMPLEMENTADO (Opção B "casca")

Zero biblioteca. Todo o JS no `js/i18n.js` + helpers em `script.js`.

**Escopo (Opção B):** apenas a "casca" da SPA é traduzida — nav, títulos de seção, nomes/descrições curtas de produtos, headers de accordion, botões, modais, toast, dialog, footer. Conteúdo detalhado dos accordions (bullets, listas de horários, política infantil) **permanece em PT-BR**. Cliente que precisa de detalhes finais consulta WhatsApp.

**Arquitetura:**
1. Texto estático no HTML: `data-i18n="chave"` (textContent), `data-i18n-html="chave"` (innerHTML, p/ markup), `data-i18n-aria="chave"` (aria-label), `data-i18n-placeholder="chave"`.
2. Dicionário `window.VAI_I18N` em `js/i18n.js` — 7 idiomas, ~145 chaves cada.
3. `applyLocale(lang)` em `script.js`: itera os atributos, substitui `<html lang>` e `dir`, persiste `localStorage.vai_locale`, atualiza locale do Flatpickr, dispara `updateRouteMeta()`.
4. `t(key)` retorna a string traduzida (fallback PT-BR).
5. `detectLocale()` lê `localStorage` → `navigator.language` → fallback PT-BR.
6. Seletor: botão `.lang-btn` no header (globe + código), dropdown com 7 opções.

**Idiomas:** `pt-BR`, `en`, `es`, `fr`, `it`, `de`, `he` (RTL — overrides em `[dir="rtl"]`).

**WhatsApp message:** sempre em PT (operacional). Quando locale ≠ PT, prepend de `🌐 *Idioma do cliente:* English` para a equipe responder no idioma certo.

**Onde adicionar uma chave nova:**
1. `data-i18n="ns.chave"` no HTML
2. Adicionar a chave nos 7 dicionários em `js/i18n.js`
3. Se for string usada via JS, chamar `t('ns.chave')`

---

## 8. REGRAS DE NEGÓCIO CRÍTICAS

### Regra D-0 (Urgência)
Compras online bloqueadas se a data selecionada for hoje E o horário atual (fuso `America/Bahia`) for ≥ 08:30.  
Resultado: modal de urgência → WhatsApp.  
Esta validação **deve ser replicada no backend** — nunca depender só do frontend.

### Sinal (Depósito)
- Produtos com sinal: `data-price` = valor do sinal, `data-fullprice` = valor total
- Carrinho acumula apenas o sinal; restante é pago no embarque
- Exibir sempre: "Sinal: R$ X | Pagar no embarque: R$ Y"

### Passagens
- Sempre via WhatsApp (modal ticket → gera link `wa.me`)
- **Não adicionar ao carrinho** — fluxo é consultivo

### Gratuidades (backend futuro)
- Idade calculada na **data de execução do passeio**, não na data de compra
- Bebês (0-2): gratuidade total
- Crianças (3-11): 50% em passeios (verificar por produto)
- Idosos (60+): verificar disponibilidade por fornecedor

---

## 9. PROBLEMAS CONHECIDOS (Backlog Técnico)

> Ordenados por prioridade. Resolver antes de publicar em produção.

### Bloqueadores absolutos
- [x] Favicon ausente → toda aba mostra 404 e ícone genérico
- [x] `og-share.jpg` inexistente → compartilhamentos no WhatsApp/Insta ficam sem imagem
- [x] Botão "Finalizar Reserva" sem funcionalidade → envia resumo do carrinho pelo WhatsApp
- [x] Schema.org com telefone placeholder (`+5575999999999`)

### Alta prioridade
- [x] Imagens das passagens são URLs do Unsplash → substituídas por ativos locais
- [x] `npmcdn.com` para Flatpickr locale → consolidado em `cdn.jsdelivr.net`
- [x] Lucide carregado em `<head>` sem `defer` → todos os scripts agora com `defer`
- [x] `window.open()` sem `noopener` → todas as chamadas usam `noopener,noreferrer`
- [x] `alert()` / `confirm()` no script → substituídos por toast e dialog próprios

### Média prioridade
- [x] Inner Swipers: cada card resolve seu `.inner-pagination` localmente via `el.querySelector` → paginação funcional em todos os cards
- [x] Carrinho com TTL de 24h → formato `{ts, items}`, descarta entrada >24h ou em formato antigo
- [x] Modais sem focus trap e sem Escape key handler → `openOverlay`/`closeOverlay` com stack + Escape global + Tab cycling
- [x] Preço no carrinho sem formatação BRL correta (hardcoded `,00`) → usa `Intl.NumberFormat` BRL
- [x] Carrossel "Atividades" existe como view própria
- [x] i18n implementado (Opção B "casca"): 7 idiomas (PT-BR, EN, ES, FR, IT, DE, HE com RTL), detecção automática, persistência em `localStorage.vai_locale`

### Baixa prioridade / pré-launch
- [x] `canonical` tag — presente no `<head>`
- [x] `robots.txt` na raiz
- [x] `sitemap.xml` na raiz
- [ ] Footer legal completo (CNPJ, endereço, política de privacidade) — atual é minimalista (logo + WhatsApp + Instagram + copyright)
- [ ] Vídeo hero sem `<link rel="preload">` e sem poster frame
- [ ] Imagens de fundo via `style=""` inline não são lazy-loadable

---

## 10. SEGURANÇA

| Regra | Status |
|-------|--------|
| IIFE — zero global scope | ✅ |
| Event delegation com data-attributes | ✅ |
| `.textContent` / `createElement` (sem innerHTML+variável) | ✅ |
| `noopener noreferrer` em target=_blank | ✅ |
| CSP headers | ❌ (configurar no servidor) |
| Sem dados de cartão no frontend | ✅ (arquitetural) |
| PCI-DSS: gateway via iframe/token | Futuro (backend) |
| LGPD: privacy policy | ❌ Faltando |

**Lei de Ouro:** Nenhum dado financeiro sensível passa pelo servidor da agência. O processamento de pagamento é 100% delegado ao gateway (MercadoPago/Stripe) via tokenização ou redirect.

---

## 11. DEPENDÊNCIAS EXTERNAS — VERSÕES FIXAS

```html
<!-- CSS no <head> -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11.1.14/swiper-bundle.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.css">

<!-- JS antes de </body> -->
<script src="https://cdn.jsdelivr.net/npm/swiper@11.1.14/swiper-bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/flatpickr@4.6.13"></script>
<script src="https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/l10n/pt.js"></script>
<script src="https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js" defer></script>
<script src="./js/script.js"></script>
```

> **Fixar versões** nos CDN URLs. `@latest` e `@11` são time bombs — quebram quando o CDN faz update.

---

## 12. COMO TRABALHAR COM ESTE CODEBASE

### Para adicionar um produto (passeio)
1. Copiar um `<div class="swiper-slide product-card">` existente
2. Substituir: imagem de fundo (arquivo local em `/assets/`), título, preços, horários, conteúdo dos accordions
3. No botão: atualizar `data-product`, `data-price`, `data-times`, `data-fullprice`
4. Não criar novos IDs desnecessários

### Para adicionar um produto (passagem)
1. Copiar slide do carrossel IDA ou VOLTA
2. Adicionar ao carrossel correto (`carousel-ida` ou `carousel-volta`)
3. Chamar `swiperIda.update()` ou `swiperVolta.update()` se adicionado via JS

### Para modificar estilos
1. Identificar o componente no `style.css`
2. Modificar dentro do bloco correto (não duplicar regras)
3. Incrementar `?v=N` no `<link>` do CSS no `index.html`

### Para adicionar lógica JS
1. Dentro da IIFE, na seção numerada correta (1-6)
2. Event handlers via delegation em `document.addEventListener('click', ...)`
3. Novos `data-action` valores devem ser documentados aqui no CLAUDE.md

---

## 13. CHECKLIST PRÉ-PUBLICAÇÃO

```
ASSETS
[x] favicon.ico criado e linkado no <head>
[x] og-share.jpg criado (1200×630px) e URL atualizada nas meta tags
[x] Todas imagens de placeholder (Unsplash) substituídas por ativos próprios
[ ] hero.mp4 otimizado (max 5MB para mobile)

SEO/META
[x] Schema.org telefone real
[x] <link rel="canonical"> adicionado
[x] robots.txt na raiz
[x] sitemap.xml na raiz

SEGURANÇA
[x] rel="noopener noreferrer" em todos target="_blank"
[ ] CSP configurado no servidor (Nginx/Cloudflare)
[x] Lucide com versão fixa e defer

UX
[x] alert() e confirm() removidos e substituídos
[x] Modais com Escape key handler
[x] Modais com focus trap
[x] Carrinho com TTL de 24h no localStorage

FUNCIONALIDADES
[x] Carrossel "Atividades" implementado
[x] "Finalizar Reserva" com fluxo mínimo (envia carrinho via WhatsApp)
[ ] Footer com CNPJ, endereço, política de privacidade

MULTI-IDIOMA
[x] data-i18n attributes adicionados (Opção B — casca)
[x] Seletor de idioma no header (PT/EN/ES/FR/IT/DE/HE)
```
