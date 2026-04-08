# Regras e Contexto do Projeto (GEMINI)

Este arquivo serve como **contexto e manual de regras** para futuros assistentes de IA (como eu, Gemini) não perderem o escopo da aplicação ao te auxiliar com código.

## 🎯 Sobre o Projeto
O projeto é um sistema de agendamento e vitrine (SPA - Single Page Application) criado para a agência de turismo **Volta à Ilha** em Morro de São Paulo. O foco é performance, design responsivo com apelo visual premium e alta taxa de conversão (agendamentos e direções pro WhatsApp).

## 💻 Tech Stack, Bibliotecas e Futuro
*   **Apenas Javascript Vanilla, HTML5 e CSS3**. NÃO sugerir ou implementar frameworks/bibliotecas complexas como React, Vue, Next.js, Svelte.
*   **Sem Tailwind CSS**. Todo o design deve ser mantido utilizando CSS puro (Vanilla), armazenado na pasta `/css/`.
*   **Abordagem Leve e Standard:** Sempre opte pela solução nativa ou pela biblioteca mais enxuta possível. O roadmap futuro envolve integração com **Banco de Dados**, **Check-out de Vendas livre**, **geração de Vouchers em PDF** e **automações via E-mail/WhatsApp** para clientes e fornecedores. O front-end deve permanecer super dinâmico e sem gargalos de terceiros para não conflitar com este ecossistema.
*   O projeto funciona como uma SPA controlada manualmente através do `index.html` e `/js/script.js`, ocultando e exibindo `section`s.

## 📁 Estrutura de Arquivos e Diretórios
*   Siga a abordagem mais standard e simples possível. Evite aninhamentos complexos e super-engenharia.
*   Mantenha os ativos separados (ex: `assets`, `css`, `js`) priorizando a facilidade de navegação quando conectarmos as rotas de backend (PDFs, scripts de API).

## 🎨 Guias de Estilo (Estágio de Desenvolvimento)
*   *As regras estritas sobre Cores/Identidade Visual serão definidas após a finalização da lógica base de Passeios e Passagens.*
*   **Prototipação atual:** Foque em um design *premium* contendo o efeito *glassmorphism*, mas mantenha as cores neutras/provisórias até a aprovação da lógica de navegação.
*   **Mobile-First:** Todo CSS deve sempre focar primeiramente no mobile e usar media-queries para expandir em resoluções maiores.
*   **Componentes Autorizados:**
    *   **Lucide Icons** via script (NÃO use FontAwesome).
    *   **Swiper.js** para modais, sliders e exibição de fotos encadeadas.
    *   **Flatpickr** para o controle de datas interativo no agendamento.

## 🧠 Lógica de Negócios / Componentes Cruciais
1.  **Agendamentos Unificados:** Sempre que construir uma chamada de compra, interligue com o modal de agendamento padrão que possui Data, Horário e Quantidade.
2.  **Urgência (Regra do dia atual):** Sempre mantenha ativa a lógica que impede reservas on-line imediatas para a data de *hoje*, redirecionando o fluxo automaticamente para contato manual no WhatsApp.
3.  **Drawer/Carrinho:** Ações de adicionar itens ("Mergulho", "Passeio Volta à Ilha") não recarregam a página, elas preenchem o modal lateral do carrinho, calculando somente o "Sinal/Entrada" quando especificado.

---
*Para o assistente*: Ao abrir o repositório, sempre leia estas regras para entender a linha criativa e as limitações do código antes de implementar novas features.
