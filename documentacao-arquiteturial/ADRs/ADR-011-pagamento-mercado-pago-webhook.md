# ADR-011: Pagamento via Checkout Pro do Mercado Pago, com webhook não confiável e confirmação idempotente

**Status:** Aceito (integração real ainda não validada com credenciais; ver Consequências)

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
  - **A integração real não foi testada com credenciais** do Mercado Pago (só com respostas simuladas); falta criar a conta de teste, informar o token e expor o webhook publicamente (`PUBLIC_BASE_URL`, por exemplo com um túnel).
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
