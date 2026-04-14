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
   - O PDF deve conter a identidade da "Volta à Ilha", informações do cliente, descritivo do passeio, data, hora, orientações de embarque, um código verificador/QR Code, além de todas as regras de passeio, políticas de cancelamento, responsabilidades (deixando de forma clara as responsabilidades terceirizadas) e uma cláusula explícita declarando sem sombra de dúvidas que a utilização do presente voucher implica na aceitação de todas as condições.

4. **Automações de Notificação (E-mail e WhatsApp):**
   - **Para o Cliente:** Disparar notificação de confirmação de compra enviando o Voucher em PDF anexo e instruções de check-in (via E-mail e via API oficial do WhatsApp - ou provedores como Twilio/Z-API/Evolution API).
   - **Para os Fornecedores:** Notificar os prestadores do serviço confirmando que houve uma nova alocação/reserva em sua agenda. Isso inclui quantidade de pessoas e horários, permitindo a gestão operacional por parte deles via WhatsApp.

5. **Regras de Negócio Importantes:**
   - **Regra de Urgência (Bloqueio D-0 e Horário de Corte):** A API deve validar a disponibilidade de recebimento de pagamentos on-line automatizados considerando que cada serviço possuirá o seu próprio horário limite (corte) para fechamento das vendas automáticas. Quando a requisição ultrapassar esse limite de urgência, o backend deve bloquear a transação automática e retornar um fluxo que indique o prosseguimento manual via WhatsApp (essa lógica precisa ser consolidada no back validando o fuso horário e o limite de cada produto para evitar overbooking de última hora).

6. **Análise de Dados e Inteligência de Mercado (Marketing):**
   - O banco de dados deve ser arquitetado de forma consistente para permitir a fácil filtragem e extração de dados de clientes e histórico de vendas.
   - O objetivo é conseguir exportar esses dados (ex: planilhas, dashboards) para gerar estatísticas (quais os passeios mais vendidos, sazonalidades) e traçar o perfil exato do público-alvo, possibilitando a criação de campanhas de marketing altamente direcionadas e sugestões automáticas de re-targeting para clientes antigos.

## 📋 Entregas Esperadas

Nesta primeira fase, solicito que você gere:
1. **Modelagem de Dados (MER/Esquema):** Apresente as tabelas/coleções necessárias e seus relacionamentos principais.
2. **Sugestão de Stack Tecnológico de Backend:** Qual linguagem (Ex: Node.js, Python/FastAPI), qual banco de dados (Ex: PostgreSQL, MongoDB) e que serviços usar para PDF/WhatsApp. Justifique considerando redução de custos em nuvem e alta performance.
3. **Plano de Implementação de API / Endpoints:** Liste os endpoints (Rotas REST) principais que a SPA em Javascript puro precisará consumir (ex: `POST /api/checkout`, `GET /api/availability`).
4. **Arquitetura de Eventos (Fluxo Pós-Pagamento):** Um passo a passo ou diagrama em texto de como gerenciar a fila (ex: Cliente paga -> Confirmação -> PDF -> Envio de Whats/Email).

Por favor, comece fornecendo o planejamento detalhado para que possamos validar antes de programar as as rotas!
