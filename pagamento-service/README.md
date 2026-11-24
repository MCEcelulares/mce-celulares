# Pagamento — roteiro de teste com o Mercado Pago

O serviço usa o **Checkout Pro**: `POST /pagamentos` cria uma preferência e devolve `url_pagamento`; o cliente paga na
página do Mercado Pago e a confirmação chega pelo webhook (ou por `POST /pagamentos/{idPedido}/sincronizar`).
A arquitetura está no [ADR-011](../documentacao-arquiteturial/ADRs/ADR-011-pagamento-mercado-pago-webhook.md).

> Este roteiro foi montado a partir da documentação oficial do Mercado Pago e **validado no sandbox em 24/11/2026**
> (vendedor e comprador de teste, cartão `APRO`; resultado e armadilhas na [seção 6](#6-resultado-da-validação-no-sandbox-24112026)).
> O projeto é uma **versão de desenvolvimento e testes**: não há hospedagem, tudo roda em `localhost`. O que depende de
> uma URL pública (webhook e volta automática à loja) está descrito como opcional.

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

### `FRONTEND_URL` e a volta à loja (leia: é o ponto que mais confunde em `localhost`)
`FRONTEND_URL` é a origem do front (ex.: `http://localhost:4000`). O serviço monta `{FRONTEND_URL}/checkout/retorno/{idPedido}`
e o envia ao Mercado Pago como `back_urls`. O que o Mercado Pago faz com isso **depende de a URL ser pública**:

| `FRONTEND_URL` | `back_urls` | `auto_return` | Resultado |
|---|---|---|---|
| `https://loja.exemplo.com` (pública) | enviadas e **guardadas** | enviado (`approved`) | o cliente volta sozinho depois de aprovar |
| `http://localhost:4000` | enviadas, mas o Mercado Pago **descarta** (a preferência fica com `back_urls` vazias) | **não enviado** | não há volta automática; o cliente volta pela loja e usa **Já paguei** |
| vazio | não enviadas | não enviado | idem |

Por que o `auto_return` não vai com `localhost`: o Mercado Pago responde **400 `invalid_auto_return`** e o pagamento nem é
criado (era o bug que dava 502 em desenvolvimento; corrigido na MCE-159). O serviço só manda `auto_return` para URL `https`
que não seja `localhost`, `127.*`, `[::1]` nem `*.local`.

**Para testar a volta automática** seria preciso um túnel `https` para o front (ex.: `ngrok http 4000`) em `FRONTEND_URL`,
liberar esse host no Vite (`server.allowedHosts`) e no CORS do gateway. **Esse caminho não foi exercitado aqui**; em
desenvolvimento o fluxo é completo sem ele (seção 4).

## 4. Fazer uma compra de teste
**Pelo front (o caminho de quem usa a loja):**
1. Com o front em `http://localhost:4000`, entre, monte o carrinho, finalize o pedido e, em **Pagamento**, clique em
   **Pagar agora**. O Mercado Pago abre em uma **nova aba** e a aba da loja vai para o pedido.
2. Na aba do Mercado Pago (de preferência numa **janela anônima**, sem nenhuma sessão do Mercado Pago/Livre), entre com o
   **usuário de teste comprador** e pague (passo 3 abaixo).
3. Volte à aba da loja, no pedido, e clique em **Já paguei**. A tela de confirmação chama `sincronizar`: o serviço
   pergunta ao Mercado Pago, confirma, e o pedido vira **PAGO**. (Com webhook ligado ou com volta automática, isso acontece
   sem o clique.)

**Só pela API:**
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

## 6. Resultado da validação no sandbox (24/11/2026)
Exercitado com o Mercado Pago de verdade (vendedor e comprador de teste), pelo front e pela API:

| Etapa | Resultado |
|---|---|
| Token | `mp:verificar` OK: o token é de um **usuário de teste** (`GET /users/me` devolve `tags: ["test_user"]`) |
| Criar o pagamento pelo serviço (`POST /pagamentos`) | 201 com `url_pagamento` do Checkout Pro (depois da correção do `auto_return`) |
| Itens e `external_reference` | a preferência no Mercado Pago traz os itens do pedido e `external_reference` = id do pedido |
| Pagar com cartão `APRO` (comprador de teste) | aprovado |
| Sem webhook, antes de `sincronizar` | pedido segue `AGUARDANDO_PAGAMENTO` (o serviço não tem como saber) |
| `POST /pagamentos/{idPedido}/sincronizar` | pagamento `APROVADO` e pedido `PAGO` |
| Volta automática à loja | **não ocorre em `localhost`** (ver a tabela da seção 3) |

**Não exercitado ainda:** o webhook de verdade (exige URL pública) e a volta automática com `https` público.

### Erros comuns
- **"Uma das partes com as quais você está tentando efetuar o pagamento é de teste."** Vendedor e comprador precisam ser
  **os dois** contas de teste. Costuma ser o comprador: entrou-se com a conta real (ou havia sessão real aberta). Use uma
  **janela anônima** e o **comprador de teste**; não use a conta pessoal.
- **502 "O Mercado Pago recusou a criação do pagamento".** O log (`Mercado Pago recusou a preferência de pagamento`) agora traz
  o `motivo` devolvido pelo Mercado Pago. O caso que aconteceu foi `invalid_auto_return` (ver seção 3).
- **Pedido continua `AGUARDANDO_PAGAMENTO` depois de pagar.** Sem webhook é o esperado: use **Já paguei** (ou
  `POST /pagamento/pagamentos/{idPedido}/sincronizar`).
- **429 "Muitas tentativas de pagamento".** O limite (`RATE_LIMIT_PAGAMENTO_MAX`, 30 por 15 min por IP) é compartilhado
  entre "Pagar agora" e `sincronizar`. Em desenvolvimento pode ser aumentado no `.env`.

## Variáveis deste serviço
| Variável | Para quê |
|---|---|
| `GATEWAY_PAGAMENTO` | `mercadopago` (padrão) ou `simulado` |
| `MERCADOPAGO_ACCESS_TOKEN` | Access Token do vendedor (teste ou produção) |
| `PUBLIC_BASE_URL` | URL pública do serviço, onde chega o webhook |
| `FRONTEND_URL` | Origem do front (ex.: `http://localhost:4000`). Só é guardada pelo Mercado Pago se for `https` público; em `localhost` não há volta automática (seção 3) |
| `VENDAS_SERVICE_URL`, `VENDAS_SERVICE_TOKEN` | Como falar com o Vendas (token = `SERVICE_TOKEN` do Vendas) |
