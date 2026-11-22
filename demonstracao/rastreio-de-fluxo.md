# Demonstração: seguir um fluxo entre serviços pelos logs

Mostra que **um único id** liga todas as linhas de log de uma compra, passando por Identidade, Catálogo, Vendas, Pagamento e Notificação, inclusive pelos eventos Pub/Sub até o e-mail. Convenções no [guia de boas práticas](../documentacao-arquiteturial/boas-praticas.md), seção 5; contrato do evento no [ADR-008](../documentacao-arquiteturial/ADRs/ADR-008-contrato-eventos-assincronos.md).

Comandos para um terminal bash (Git Bash no Windows), na raiz do repositório, com o ambiente no ar (`docker compose --profile dev up -d`), `GATEWAY_PAGAMENTO=simulado` e o SMTP configurado (veja [mensageria-pubsub.md](mensageria-pubsub.md), seção 0). As saídas são de uma execução real; ids e horários mudam a cada execução.

## 1. Disparar uma compra com um id conhecido

```bash
ID_CORRELACAO=minha-compra-1 node demonstracao/fluxo-pedido.js
```

```
POST /vendas/pedidos -> 201, pedido #82
POST /pagamento/pagamentos -> 201, status APROVADO
ID_PEDIDO=82
ID_CORRELACAO=minha-compra-1
```

O script envia `x-correlation-id: minha-compra-1` nas duas chamadas (criar o pedido e pagar). Sem `ID_CORRELACAO`, ele gera um id e o imprime.

## 2. Seguir o id nos logs dos 5 serviços

```bash
bash scripts/seguir-id.sh minha-compra-1 5m      # 5m = janela de logs a consultar
```

```
21:22:11.299  identidade  info  GET /usuarios/110 -> 200
21:22:11.309  identidade  info  GET /usuarios/110/enderecos/95 -> 200
21:22:11.313  catalogo    info  GET /produtos/215 -> 200
21:22:11.339  catalogo    info  estoque reservado
21:22:11.339  catalogo    info  POST /interno/reservas -> 201
21:22:11.350  vendas      info  evento publicado  [idPedido=82 tipo=pedido.criado receptores=1 idEvento=f525762c-…]
21:22:11.351  notificacao info  evento recebido  [idPedido=82 canal=pedido.criado idEvento=f525762c-… idCorrelacaoOrigem=minha-compra-1]
21:22:11.356  vendas      info  POST /pedidos -> 201
21:22:11.407  vendas      info  GET /pedidos/82 -> 200
21:22:11.427  notificacao info  e-mail enviado  [idPedido=82 tipo=PEDIDO_CRIADO]
21:22:11.467  vendas      info  PATCH /pedidos/82/status -> 200
21:22:11.480  pagamento   info  evento publicado  [idPedido=82 tipo=pagamento.confirmado receptores=1 idEvento=13a29a8a-…]
21:22:11.481  pagamento   info  POST /pagamentos -> 201
21:22:11.481  notificacao info  evento recebido  [idPedido=82 canal=pagamento.confirmado idEvento=13a29a8a-… idCorrelacaoOrigem=minha-compra-1]
21:22:11.552  notificacao info  e-mail enviado  [idPedido=82 tipo=PAGAMENTO_CONFIRMADO]
```

**O que isso mostra:**
- **Entre serviços (HTTP):** Vendas chamou Identidade (usuário e endereço) e Catálogo (produto e reserva); Pagamento chamou Vendas (`GET /pedidos/82` e `PATCH .../status`). Todas as linhas carregam o mesmo `x-correlation-id`.
- **Pelos eventos:** a linha `evento publicado` registra o `idEvento`; a Notificação (que usa o `idEvento` como correlação própria) registra em `evento recebido` o `idCorrelacaoOrigem`, o id da requisição que originou o evento. O script segue essa ligação sozinho e inclui `e-mail enviado`.

## 3. Conferir o id na resposta HTTP

```bash
curl -s -D - -o /dev/null http://localhost:8080/catalogo/produtos?limite=1 -H 'x-correlation-id: teste-resposta' | grep -i x-correlation-id
# x-correlation-id: teste-resposta
```

Sem o cabeçalho de entrada, o serviço gera um UUID e o devolve no mesmo cabeçalho. Em caso de erro, é esse valor que se passa a `seguir-id.sh`.

## 4. Seguir um erro

```bash
curl -s -i -X POST http://localhost:8080/vendas/pedidos -H 'Content-Type: application/json' -d '{}' | grep -iE "^HTTP|x-correlation-id"
# HTTP/1.1 401 Unauthorized
# x-correlation-id: <id gerado>
bash scripts/seguir-id.sh <id gerado> 5m
```

Mostra a linha de erro (nível `WARN`) do serviço que respondeu. Num erro dentro de um fluxo maior, as linhas dos serviços anteriores mostram até onde a compra chegou.

## 5. Verificação automatizada

Os testes dos clients HTTP garantem a propagação (e que o Mercado Pago, sistema externo, não recebe o id interno), e os dos eventos garantem `idCorrelacao` no envelope e `idCorrelacaoOrigem` no log:

```bash
# em cada serviço (vendas-service, pagamento-service, notificacao-service)
npm ci && npx tsc --noEmit && npx jest --runInBand
```

Resultado obtido: Vendas 156, Pagamento 106 e Notificação 58 testes passando.

## Registro da evidência

| Passo | Esperado | Obtido (cole a saída ou um print) |
|---|---|---|
| 1. Fluxo | pedido 201 e pagamento `APROVADO` | |
| 2. `seguir-id.sh` | linhas de Identidade, Catálogo, Vendas, Pagamento e Notificação com o mesmo id | |
| 3. Cabeçalho | `x-correlation-id` devolvido | |
| 4. Erro | linha `WARN` com o id da resposta | |
