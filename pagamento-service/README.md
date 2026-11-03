# Pagamento — roteiro de teste com o Mercado Pago

O serviço usa o **Checkout Pro**: `POST /pagamentos` cria uma preferência e devolve `url_pagamento`; o cliente paga na
página do Mercado Pago e a confirmação chega pelo webhook (ou por `POST /pagamentos/{idPedido}/sincronizar`).
A arquitetura está no [ADR-011](../documentacao-arquiteturial/ADRs/ADR-011-pagamento-mercado-pago-webhook.md).

> Este roteiro foi montado a partir da documentação oficial do Mercado Pago. A integração real só pôde ser exercitada
> com respostas simuladas nos testes automatizados; **a primeira compra de teste de verdade é o seu teste de aceitação**.

## 0. Sem conta do Mercado Pago (desenvolvimento)
Deixe `GATEWAY_PAGAMENTO=simulado` no `.env`: o pagamento é aprovado na hora, sem cobrar nada. O log avisa isso ao subir.
É o modo usado pela suíte `e2e/`.

## 1. Credenciais de teste
1. Em [Mercado Pago Developers](https://www.mercadopago.com.br/developers), crie uma **aplicação** (Checkout Pro).
2. Em **Suas integrações > Contas de teste**, crie **duas contas de teste: um vendedor e um comprador**
   ([documentação](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/accounts)).
3. Use o **Access Token** da conta de teste do **vendedor**. Nunca misture credenciais de contas diferentes.

## 2. Configurar e conferir o token
No `pagamento-service/.env`:
```env
GATEWAY_PAGAMENTO=mercadopago
MERCADOPAGO_ACCESS_TOKEN=<Access Token do vendedor de teste>
```
Confira sem cobrar nada (cria uma preferência de R$ 1,00 e faz uma busca):
```bash
cd pagamento-service
npm run mp:verificar
```
Ele mostra o link de pagamento e diz o que fazer se o token for recusado (HTTP 401/403). Depois recrie o container:
```bash
docker compose up -d --force-recreate pagamento
```

## 3. Webhook (opcional em desenvolvimento)
O Mercado Pago precisa de uma URL pública. Com um túnel, por exemplo `ngrok http 8080`:
```env
PUBLIC_BASE_URL=https://<seu-subdominio>.ngrok-free.app/pagamento
```
(o prefixo `/pagamento` é o do gateway; o serviço acrescenta `/pagamentos/webhook`). Recrie o container de novo.

**Sem webhook** o fluxo funciona do mesmo jeito: depois de pagar, chame
`POST /pagamento/pagamentos/{idPedido}/sincronizar` e o serviço consulta o Mercado Pago na hora.

`FRONTEND_URL` é opcional (para onde o cliente volta depois de pagar). Se o Mercado Pago recusar a preferência por causa
das URLs de retorno em ambiente local, deixe-o vazio.

## 4. Fazer uma compra de teste
1. Pelo gateway, crie um pedido (carrinho → `POST /vendas/pedidos`) e chame
   `POST /pagamento/pagamentos` com `{ "idPedido": …, "metodoPagamento": "CARTAO", "valor": <valor_total> }`.
2. Abra `url_pagamento` numa **janela anônima** e entre com o **usuário de teste comprador**. Se pedir código por e-mail, use o
   de 6 dígitos que aparece em *Suas integrações > sua aplicação > Contas de teste*.
3. Pague com um cartão de teste (a documentação atual traz a lista; os dados abaixo valem à data deste roteiro):
   - Mastercard `5480 8328 0103 3311`, validade `11/30`, CVV `123`.
   - **O resultado depende do nome do titular:** `APRO` = aprovado, `OTHE` = erro geral, `CONT` = pendente,
     `FUND` = saldo insuficiente, `CALL` = precisa autorização. Para `APRO`/`OTHE` use o CPF `12345678909`.
   - [Lista completa](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/integration-test/test-purchases)
     (confira lá se os números mudaram).
4. Resultado esperado: com o webhook ligado, o pedido vira **PAGO** sozinho; sem ele, chame `/sincronizar`.
   Depois confira `GET /pagamento/pagamentos/{idPedido}` (`APROVADO`) e o e-mail de pagamento confirmado no Notificação.

## 5. Comportamentos que valem saber
- O link de pagamento **expira junto com o pedido** (`PEDIDO_EXPIRA_MINUTOS` do Vendas, padrão 30 min). Depois disso o
  Vendas cancela o pedido e devolve o estoque.
- Pagamento recusado: pode tentar de novo com `POST /pagamentos` (cria um link novo).
- O webhook **não é confiável por si só**: o serviço só usa o id do pagamento e consulta a API do Mercado Pago. Só confirma se
  estiver `approved` e com o valor igual ao do pedido.
- Pagamento aprovado para um pedido que o Vendas já cancelou **não é reembolsado automaticamente**: aparece no log
  (`pagamento aprovado para pedido que não aceita pagamento`) e na métrica `pagamento_pedido_nao_pagavel`; o reembolso é manual.

## Variáveis deste serviço
| Variável | Para quê |
|---|---|
| `GATEWAY_PAGAMENTO` | `mercadopago` (padrão) ou `simulado` |
| `MERCADOPAGO_ACCESS_TOKEN` | Access Token do vendedor (teste ou produção) |
| `PUBLIC_BASE_URL` | URL pública do serviço, onde chega o webhook |
| `FRONTEND_URL` | URL do front, para o retorno depois do pagamento (opcional) |
| `VENDAS_SERVICE_URL`, `VENDAS_SERVICE_TOKEN` | Como falar com o Vendas (token = `SERVICE_TOKEN` do Vendas) |
