> ⚠ **DEPRECATED — 2026-04-27**
> Este arquivo foi superseduto por [`CLAUDE.md`](../../CLAUDE.md) (master) e por `PROMPT_BACKEND_2.md` (que por sua vez também foi consolidado no master).
> Mantido apenas para histórico. **Não usar como referência em novas implementações.**

---

# Prompt para Implementação de Banco de Dados e Backend

**Utilize o texto abaixo como prompt (instrução) para a IA ou desenvolvedor que for planejar e implementar o backend do seu sistema.**

---

**Atue como um Engenheiro de Software Sênior e Arquiteto de Software.**

## 🎯 Objetivo
Você deve projetar e implementar a arquitetura de backend e o banco de dados para a agência de turismo **Volta à Ilha** localizada em Morro de São Paulo. O sistema deve gerenciar agendamentos/reservas, processar check-outs de vendas, gerar vouchers em PDF e realizar automações de comunicação via E-mail e WhatsApp para clientes e fornecedores de serviços.

## 🧠 Contexto do Projeto
- O frontend já está parcialmente desenvolvido. É uma **Single Page Application (SPA) responsiva construída puramente com HTML5, CSS3 (Vanilla, sem Tailwind) e JavaScript puro (sem frameworks)**, projetada para ser leve, super dinâmica e com um visual *premium* (glassmorphism).
- O backend deve expor uma **API RESTful leve e rápida** para comunicar-se fluidamente com essa SPA sem recarregar páginas e sem introduzir "gargalos" que atrapalhem a experiência do usuário.
- O sistema lida com vendas de **Passeios** (Ex: Volta a Ilha, quadriciclo, Buggy, Garapuá, Gamboa Full, Gamboa Convencional) e **Passagens/Transfers** (Ex: semi terrestre de várias empresas diferentes separados para ida e volta, marítimas de várias empresas diferentes separados para ida e volta e podendo implementar mais meios. Possivelmente no futuro podendo conectar aos sistemas de vendas dessas empresas para poder automatizar o máximo possível essa área de vendas sem dever ser pelo whatsapp).
- O frontend gerencia um "carrinho" de compras lateral (drawer) que calcula valores (incluindo regras de "Sinal" ou pagamento parcial).

## 🛠️ Requisitos Funcionais do Backend (Core)

1. **Gestão de Banco de Dados (Reservas e Produtos):**
   - Criar o esquema de banco de dados (Relacional ou NoSQL) para lidar com no mínimo os seguintes domínios:
     - **Clientes** (Nome, E-mail, Telefone com contato de WhatsApp - pelo menos um funcionante que será a referência de contato sobre a reserva, só CPF e a opção passaporte para estrangeiro).
     - **Fornecedores/Parceiros** (Barqueiros, guias, transportadoras, com seus respectivos contatos de E-mail/WhatsApp).
     - **Produtos** (Passeios e Transfers, contendo valores totais, valor do 'sinal' exigido, limites de capacidade, etc.).
     - **Reservas/Agendamentos** (Relacionando Cliente, Produto, Data, Horário, Quantidades de adultos/crianças - considerando as especificações de cada empresa sobre gratuidades ou eventuais descontos para idosos e outras eventuais categorias também, Status de pagamento, e Valor pago vs Valor Pendente).

2. **Integração com Check-out de Vendas (Gateway de Pagamento):**
   - Receber dados do frontend sobre o carrinho.
   - Gerar intenção de pagamento / links ou processamento de **Pix e Cartão de Crédito** (prever uma arquitetura flexível para suporte a múltiplos gateways de pagamento isolados por serviço ou Gateway com _Split de Pagamento_ para distribuir os valores automaticamente a cada fornecedor caso haja mix de serviços no carrinho).
   - Atualizar automaticamente o status da Reserva/Agendamento mediante os webhooks/callbacks do gateway (Ex: MercadoPago, Stripe, ou aspag).

3. **Geração de Vouchers em PDF:**
   - Após o status da reserva constar como "Pago" ou "Sinal Pago", o sistema deve gerar automaticamente um PDF personalizado.
   - O PDF deve conter a identidade da "Volta à Ilha", informações do cliente, descritivo do passeio, data, hora, orientações de embarque, **localização de ponto de encontro físico obrigatório em caso de queda global de comunicação na Ilha**, um código verificador/QR Code, além de todas as regras de passeio, políticas de cancelamento, responsabilidades (deixando de forma clara as responsabilidades terceirizadas) e uma cláusula explícita declarando sem sombra de dúvidas que a utilização do presente voucher implica na aceitação de todas as condições.
   - **Regra de Conferência:** O documento (Voucher) e a mensagem de envio devem explicitar graficamente que **a responsabilidade por conferir os dados agendados (data, assentos, horários) é inteiramente do cliente final**, e que o mesmo deverá enviar um "OK" (feedback positivo) em resposta no WhatsApp para validar a exatidão das informações.

4. **Automações de Notificação (E-mail e WhatsApp):**
   - **Para o Cliente:** Disparar notificação de confirmação de compra enviando o Voucher em PDF anexo e instruções de check-in (via E-mail e via API oficial do WhatsApp - ou provedores como Twilio/Z-API/Evolution API). A mensagem via WhatsApp deve conter um call-to-action pedindo para o cliente revisar o PDF e responder confirmando se os dados estão corretos.
   - **Para os Fornecedores (Resiliência Offline):** O sistema não deve exigir que barqueiros e guias efetuem "logins" para baixar ou ler arquivos pesados para visualizar a lista de passageiros no dia seguinte, prevendo falha no 4G de Morro de São Paulo. O Backend deve enviar todas as manhãs/noites de forma ativa (Pushed) **a lista de passageiros condensada apenas em texto puro e formatado pelo WhatsApp (e cópia bruta no e-mail)** solicitando que o fornecedor envie um emoji/letra atestando que *"Recebeu a lista"*.

5. **Regras de Negócio Importantes e Proteções Jurídicas:**
   - **Regra de Urgência (Bloqueio D-0 e Horário de Corte):** A API deve validar a disponibilidade de recebimento de pagamentos on-line automatizados considerando que cada serviço possuirá o seu próprio horário limite (corte) para fechamento das vendas automáticas. Quando a requisição ultrapassar esse limite de urgência, o backend deve bloquear a transação automática e retornar um fluxo que indique o prosseguimento manual via WhatsApp (essa lógica precisa ser consolidada no back validando o fuso horário).
   - **Política de No-Show vs Força Maior:** O status de cancelamento das faturas deve distinguir obrigatoriamente se foi um "No-Show" do cliente final (retendo 100% da multa do sinal pago) ou um cancelamento por "Força Maior / Paralisação Portuária" (que engatilha automaticamente opções de estorno integral ou reagendamento sem custos, de forma documentada aos clientes).
   - **Gratuidades e Regra da 'Idade no Embarque':** Se o desconto no assento depender da idade (filhos, bebês de colo, idosos), o backend jamais medirá as idades no dia da compra, e sim medindo pela **data final da execução do passeio**.
   - **Realocação Inteligente de Frota (Falha Isolda do Fornecedor):** Se uma única lancha avariar e não for interrupção global climática, o Painel Administrativo deve prover um mecanismo para pausar apenas esse fornecedor. O Backend deve ter o engajamento automático de conseguir transferir a fila afetada de passageiros para o Fornecedor Alternativo da mesma atividade. Essa ação técnica na UI deve disparar instantaneamente 3 avisos automáticos via WhatsApp: (1) Avisar o novo fornecedor, (2) Avisar os passageiros da alteração técnica do veículo e (3) Gerar automaticamente novos vouchers para as lideranças das reservas impactadas e exigir resposta de ACEITE ("OK").
   - **Disclaimer de Taxas Governamentais Múltiplos (Ex: TUPA):** Nos relatórios automáticos, faturas e em letras maiúsculas dentro dos PDFs, a base informará impreterivelmente de forma legal a não-cobertura do pacote contra taxas municipais e turismo ambientais flutuantes cobradas em Morro de São Paulo ou nas ilhas visitadas pelo passeio.

6. **Análise de Dados e Inteligência de Mercado (Marketing):**
   - O banco de dados deve ser arquitetado de forma consistente para permitir a fácil filtragem e extração de dados de clientes e histórico de vendas.
   - O objetivo é conseguir exportar esses dados (ex: planilhas, dashboards) para gerar estatísticas (quais os passeios mais vendidos, sazonalidades) e traçar o perfil exato do público-alvo, possibilitando a criação de campanhas de marketing altamente direcionadas e sugestões automáticas de re-targeting para clientes antigos.

7. **Painel Administrativo (Backoffice / Dashboard):**
   - O backend deve prover rotas restritas e autenticadas para alimentar um painel de gestão visual.
   - **Funcionalidades operacionais:** Interface amigável e à prova de leigos para visualizar reservas, adicionar/editar/excluir serviços (passeios e transfers), gerenciar estoques de assentos/vagas por dia e horário, atualizar preços dinamicamente e definir restrições.
   - **Gestão de Usuários:** Controle de acesso para os funcionários da agência (ex: Admin, Operacional, Motoristas/Guias), facilitando o controle diário sem nunca precisar mexer em código-fonte.

8. **Motor de Social Commerce e Headless Checkout:**
   - Para suportar campanhas virais no TikTok e automações de Instagram Direct, a API deve ser capaz de gerar e validar **Checkout Links (Links Mágicos/Deep Linking)**. Isso permite que um cliente clique na Bio ou receba uma mensagem no WhatsApp e caia *diretamente* na tela do Gateway de Pagamento, processando o desconto e acudindo as vagas no Banco de Dados sem precisar carregar o site completo (`index.html`).
   - O Backend deve possuir **Rotas API REST exclusivas para Chatbots Integradores** (ex: Manychat, Z-API, Typebot) permitindo consultar agenda, bloquear assentos e retornar Pix de pagamento 100% de forma autônoma pelos robôs conversacionais.

## 📋 Entregas Esperadas

Nesta primeira fase, solicito que você gere:
1. **Modelagem de Dados (MER/Esquema):** Apresente as tabelas/coleções necessárias e seus relacionamentos principais.
2. **Sugestão de Stack Tecnológico de Backend:** Qual linguagem (Ex: Node.js, Python/FastAPI), qual banco de dados (Ex: PostgreSQL, MongoDB) e que serviços usar para PDF/WhatsApp. Justifique considerando redução de custos em nuvem e alta performance.
3. **Plano de Implementação de API / Endpoints:** Liste os endpoints (Rotas REST) principais que a SPA em Javascript puro precisará consumir (ex: `POST /api/checkout`, `GET /api/availability`).
4. **Arquitetura de Eventos (Fluxo Pós-Pagamento):** Um passo a passo ou diagrama em texto de como gerenciar a fila (ex: Cliente paga -> Confirmação -> PDF -> Envio de Whats/Email).

Por favor, comece fornecendo o planejamento detalhado para que possamos validar antes de programar as as rotas!
