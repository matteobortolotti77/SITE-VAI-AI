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

## 🛡️ Leis de Imutabilidade do Projeto (Diretrizes Arquiteturais)
*   **Lei de Proteção Financeira e Ética de Dados (Zero-Knowledge):** **NUNCA** armazene, transacione ou transite dados brutos de cartão de crédito no banco de dados da própria agência. Toda e qualquer interação financeira deve ser delegada obrigatoriamente (via tokenização e iframes seguros) ao Gateway de Pagamentos parceiro, garantindo obediência estrita ao PCI-DSS e a LGPD. Esta regra geral deve ser honrada em todos os projetos de e-commerce gerenciados e deve constar **explícita e claramente em tela ao cliente** (Políticas de Privacidade) assegurando que a Agência "Volta à Ilha" não guarda seu cartão de crédito.
*   **Modularidade e Portas Abertas (Arquitetura Ágil):** Todo o desenvolvimento (tanto de UI, quanto de Servidor ou Integrações com Gateways) deve prever substituições futuras. Não crie travamentos (*vendor lock-in*). Sempre crie os serviços de modo que se amanhã precisarmos trocar o Gateway de D+30 para um D+2, ou a API de WhatsApp mudar, a estrutura geral permaneça inatingível.
*   **Resiliência Offline (Operacional):** Em cenários de operações remotas (ex: ilhas sem sinal 4G), os provedores dos serviços não devem depender de acessos e logins em nuvem. A comunicação dos dados brutos processados pelo painel precisa ser enviada **pushed** (assincronamente via textos de WhatsApp) para o celular offline dos provedores antes do passeio, evitando falhas de comunicação no cais.
*   **Tolerância Zero - Global Scope & XSS (Estabilidade):** O Frontend não pode, sob nenhuma circunstância, utilizar atributos intrusivos acoplados no HTML (ex: `onclick="..."`), e não pode vazar variáveis ou funções sob o objeto global `window`. O uso de IIFEs ou Módulos ES6 com Data Elements é uma exigência. Além disso, injeções diretas usando `.innerHTML` combinadas com variáveis mutáveis são bloqueadas por padrão arquitetural de segurança, devendo-se utilizar `.textContent` ou `document.createElement()` para formatar dados advindos de Memória, APIs e Bancos.

---
*Para o assistente*: Ao abrir o repositório, sempre leia estas regras para entender a linha criativa e as limitações do código antes de implementar novas features.
