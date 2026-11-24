# ADR-011: Pagamento via Checkout Pro do Mercado Pago, com webhook não confiável e confirmação idempotente

**Status:** Aceito (validado no sandbox do Mercado Pago em 24/11/2026, sem webhook; ver a atualização desta data)

## Contexto
O RF41 exige integrar com o Mercado Pago e o RF42, gerar uma preferência de pagamento com os itens do pedido. O Mercado Pago confirma o pagamento de forma **assíncrona** (o cliente paga na página dele). Confirmar um pedido como pago é uma ação financeira: não pode ser forjada por quem conhece a URL do webhook, nem executada duas vezes, nem aceitar valor diferente do pedido.

## Decisão
1. **Checkout Pro:** `POST /pagamentos` cria uma preferência (itens do pedido, `external_reference` = id do pedido, `notification_url`, `back_urls`) e devolve `url_pagamento`. O pagamento fica `PENDENTE`.
2. **Conferências antes de cobrar:** o usuário é o dono do pedido; o pedido está `AGUARDANDO_PAGAMENTO` (consultado no Vendas); o `valor` enviado é igual ao `valor_total` do pedido (senão 422). Repetir a chamada devolve o mesmo link enquanto ele estiver em aberto; depois de `RECUSADO` pode-se tentar de novo.
3. **Webhook público e não confiável** (`POST /pagamentos/webhook`): o conteúdo é ignorado, **exceto o id do pagamento**. O serviço consulta `GET /v1/payments/{id}` na API do Mercado Pago com o token próprio e só confirma se `status = approved` **e** `transaction_amount` for igual ao valor registrado. `rejected`/`cancelled` marcam `RECUSADO` (se ainda `PENDENTE`).
4. **Confirmação idempotente:** (a) `PATCH` do pedido para `PAGO` no Vendas, que é a fonte da verdade e aceita repetir o mesmo status; (b) o pagamento é "reivindicado" como `APROVADO` por um `UPDATE` condicional (`status <> 'APROVADO'`); (c) **só quem reivindica publica** `pagamento.confirmado` (ADR-008). Webhooks repetidos ou simultâneos não geram eventos duplicados.
5. **E-mail do cliente para o evento:** a resposta do `PATCH` de status do Vendas devolve o cliente (nome e e-mail). Isso resolve a pendência do ADR-008 sobre o Pagamento não guardar e-mail.
6. **Gateway é uma interface** (`GATEWAY_PAGAMENTO`): o padrão é `mercadopago`, e **sem `MERCADOPAGO_ACCESS_TOKEN` o serviço responde 503**; o gateway `simulado` (aprova na hora, sem cobrar) só existe se pedido explicitamente e avisa no log ao subir. Serve ao desenvolvimento e aos testes.
7. **Respostas do webhook:** 200 quando processou ou não há o que fazer (outro tipo de notificação, pagamento desconhecido, **valor divergente**, **pedido que não aceita mais pagamento**, como um pedido cancelado — esses casos geram log e métrica para tratamento manual); 5xx quando Vendas ou Mercado Pago estão fora do ar, para o Mercado Pago repetir a notificação.

## Consequências
- **Positivas:** ninguém consegue marcar um pedido como pago apenas chamando o webhook; repetições são seguras; o valor cobrado é sempre conferido; trocar de gateway exige só uma nova implementação da interface.
- **Negativas:**
  - ~~A integração real não foi testada com credenciais~~ — **validada no sandbox em 24/11/2026** (criação, pagamento e confirmação por `sincronizar`). **Segue sem exercitar** o webhook de verdade, que exige uma URL pública (`PUBLIC_BASE_URL`, por exemplo com um túnel).
  - A assinatura `x-signature` do webhook **não foi implementada** (a documentação consultada não detalhava o formato); a reconsulta à API cobre o risco de forjar o conteúdo, mas não o de disparar consultas à toa.
  - Pagamento aprovado para um pedido que o Vendas não aceita mais (ex.: cancelado) **exige reembolso manual**; não há rotina para isso.
  - Pedido sem pagamento expira e libera o estoque (ADR-009); um pagamento aprovado depois disso, apesar do prazo do link, ainda exigiria reembolso manual.
  - A operação depende de uma URL pública para o webhook, que não existe em ambiente local.

## Alternativas consideradas
- **Checkout Transparente / API de pagamentos (cartão tokenizado no front):** mais controle de experiência, mas leva a tokenização de cartão ao front e amplia o escopo de segurança. Descartada para o MVP.
- **Confiar no corpo do webhook:** qualquer pessoa poderia forjar um "approved". Descartada.
- **Confirmar no retorno do navegador (`back_urls`):** o cliente controla essa navegação. Descartada.
- **Simular o pagamento por padrão quando faltar credencial:** aprovaria pedidos sem cobrar por engano. Descartada.

## Atualização (2026-10-29)
- **Sincronização como plano B do webhook:** `POST /pagamentos/{idPedido}/sincronizar` busca no Mercado Pago os pagamentos com `external_reference` igual ao id do pedido (`GET /v1/payments/search`) e aplica **a mesma regra de decisão do webhook** (confirmar se aprovado com o valor igual; `RECUSADO` se todos foram recusados ou cancelados; nada nos demais casos). Serve quando o webhook se perde, atrasa ou não tem URL pública (ambiente local), e para o front chamar ao voltar da página de pagamento. É permitido ao dono do pagamento ou a quem tem `pedidos:listar-todos`, e tem limite de requisições.
- **Link com prazo:** a preferência é criada com `expires` e `expiration_date_from/to`, usando o `expira_em` informado pelo Vendas (ADR-009), para o link deixar de valer quando o pedido seria cancelado por falta de pagamento.
- **Roteiro de teste e verificação do token:** `pagamento-service/README.md` descreve contas de teste (vendedor e comprador), cartões de teste (o resultado depende do nome do titular) e o uso de um túnel para o webhook; `npm run mp:verificar` cria uma preferência de R$ 1,00 (sem cobrança) e testa a busca, para confirmar que o token funciona antes da primeira compra. A página oficial de compra de teste do Checkout Pro não manda usar `sandbox_init_point`, então o serviço usa o `init_point` da preferência (e só cai para o de sandbox se o outro não vier).
- **Ainda não exercitado com credenciais reais.** Os formatos usados foram conferidos na documentação oficial e cobertos por testes com respostas simuladas.

## Atualização (2026-11-05) — reembolso pendente, id do gateway e listagem
- **Pagamento aprovado depois do cancelamento (ex.: o pedido expirou):** o pagamento passa a `REEMBOLSAR` (antes só havia um log de erro), para o operador devolver o dinheiro no Mercado Pago. O reembolso em si continua manual. A troca é condicional (`status != 'APROVADO'`), então um pagamento já aprovado nunca é sobrescrito.
- **`id_pagamento_gateway`:** o id do pagamento no Mercado Pago é gravado ao confirmar e ao marcar `REEMBOLSAR`, para localizar a transação ao reembolsar.
- **Listagem para o operador:** `GET /pagamentos` (permissão `pedidos:listar-todos`), com filtro por `status` e paginação. Mostra o `id_pagamento_gateway` e nunca o link de pagamento.
- **Limite do teste ponta a ponta:** o `REEMBOLSAR` só nasce de um pagamento aprovado no Mercado Pago real; com o gateway simulado ele é coberto apenas pelos testes unitários.

## Atualização (2026-11-24) — validação no sandbox, tela de retorno e escopo de desenvolvimento
**Escopo:** o projeto segue como **versão de desenvolvimento e testes**, sem hospedagem. Tudo o que depende de URL pública
(webhook e volta automática à loja) é opcional e não foi exercitado.

**Validação real (sandbox, vendedor e comprador de teste):** o serviço criou a preferência, o pagamento com o cartão `APRO`
foi aprovado e `POST /pagamentos/{idPedido}/sincronizar` confirmou o pagamento e levou o pedido a `PAGO`. Sem webhook, o pedido
ficou `AGUARDANDO_PAGAMENTO` até a sincronização, como previsto. Detalhes e erros comuns: `pagamento-service/README.md`, seção 6.

**O que a validação mudou:**
- **`auto_return` só com URL pública em `https`.** Com `FRONTEND_URL` em `localhost` o Mercado Pago respondia 400
  (`invalid_auto_return`) e nenhum pagamento era criado. O serviço agora envia `auto_return` só para `https` que não seja
  `localhost`, `127.*`, `[::1]` ou `*.local`.
- **`back_urls` de `localhost` são aceitas e descartadas** pelo Mercado Pago (a preferência volta com `back_urls` vazias).
  Em desenvolvimento **não há volta automática à loja**; o cliente volta pela própria loja.
- **Motivo da recusa no log:** quando o Mercado Pago recusa a preferência, o log registra o `motivo` devolvido (antes só havia o 502).
- **Resposta da confirmação:** `sincronizar` passa a devolver `data_pagamento` já preenchida (o banco já gravava; só a resposta
  imediata saía vazia).

**Tela de retorno do front (`/checkout/retorno/:id`) e a alternativa descartada "confirmar no retorno do navegador":**
a decisão continua valendo. A página **não usa a URL como prova**: `status`/`payment_id` só escolhem um texto. Quem confirma é o
back-end, com `sincronizar`, que consulta o Mercado Pago. A navegação de retorno funciona apenas como **gatilho** da conferência.
Respostas `PENDENTE` (Pix, boleto) fazem o front acompanhar **o pedido** (`GET /vendas/pedidos/{id}`, o webhook o atualiza) por até
2 minutos, e **não** repetir `sincronizar`: ele consulta o Mercado Pago e divide com "Pagar agora" o limite de requisições de
pagamento.

**Mercado Pago em nova aba:** "Pagar agora" abre o Checkout Pro em uma aba nova (`_blank`, sem `opener`) e a aba da loja vai para o
pedido, onde o cliente confere o resultado (**Já paguei**) quando não há webhook nem volta automática. Se o navegador bloquear o
pop-up, o fluxo cai para a mesma aba. O front só abre links `https` devolvidos pelo serviço.

**Continua pendente:** o webhook de verdade (exige URL pública), a volta automática com `https` público, a assinatura `x-signature` e o
reembolso (manual).
