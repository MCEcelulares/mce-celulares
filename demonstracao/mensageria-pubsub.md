# Demonstração: mensageria com Redis Pub/Sub

Mostra **publicar, consumir e comprovar pelos logs** a circulação de `pedido.criado` (Vendas → Notificação) e `pagamento.confirmado` (Pagamento → Notificação). Contrato dos eventos no [ADR-008](../documentacao-arquiteturial/ADRs/ADR-008-contrato-eventos-assincronos.md), seção "Atualização (2026-11-22)".

Comandos para um terminal bash (Git Bash no Windows), na raiz do repositório. As saídas abaixo foram obtidas numa execução real; ids e horários mudam a cada execução.

## 0. Pré-requisitos

- Ambiente no ar: `docker compose up -d --build`, com `GATEWAY_PAGAMENTO=simulado` no `pagamento-service/.env`.
- Um servidor SMTP para a Notificação. Em desenvolvimento, o [Mailpit](https://mailpit.axllent.org/) do compose (coletor local, nenhum e-mail sai de verdade):

```bash
docker compose --profile dev up -d
# no notificacao-service/.env:  SMTP_HOST=mailpit  SMTP_PORT=1025   (depois: docker compose up -d --force-recreate notificacao)
```

  Caixa de entrada: http://127.0.0.1:8025.
- O envio de e-mails tem intervalo (`EMAIL_INTERVALO_MS`), então o segundo e-mail pode levar alguns segundos.

## 1. Assinar os canais (terminal A)

```bash
docker exec redis redis-cli SUBSCRIBE pedido.criado pagamento.confirmado
```

Deixe aberto: ele imprime toda mensagem que passar pelos dois canais.

## 2. Disparar o fluxo (terminal B)

```bash
node demonstracao/fluxo-pedido.js
```

```
POST /vendas/pedidos -> 201, pedido #76
POST /pagamento/pagamentos -> 201, status APROVADO
ID_PEDIDO=76
ID_CORRELACAO=demo-1763843000000
```

## 3. As mensagens no Redis (terminal A)

```
message
pedido.criado
{"id":"09c8dfef-…","tipo":"pedido.criado","versao":1,"origem":"vendas-service","ocorridoEm":"2026-11-22T20:33:14.614Z","dados":{"idPedido":75,"status":"AGUARDANDO_PAGAMENTO","valorTotal":100,"cliente":{"nome":"…","email":"…"}}}
message
pagamento.confirmado
{"id":"68352249-…","tipo":"pagamento.confirmado","versao":1,"origem":"pagamento-service","ocorridoEm":"…","dados":{"idPedido":75,"valor":100,"metodoPagamento":"PIX","cliente":{"nome":"…","email":"…"}}}
```

O envelope segue o ADR-008 (`id`, `tipo`, `versao`, `origem`, `ocorridoEm`, `dados`). Não há CPF nem telefone.

## 4. A circulação nos logs (os três serviços)

```bash
for s in vendas pagamento notificacao; do
  echo "=== $s"
  docker logs $s --since 2m 2>&1 | grep -E "evento publicado|evento recebido|e-mail enviado"
done
```

**Saída (reformatada, campos principais):**

| Serviço | `msg` | Campos |
|---|---|---|
| vendas | `evento publicado` | `idEvento: 8e75b0ea-…`, `tipo: pedido.criado`, `idPedido: 76`, `receptores: 1` |
| notificacao | `evento recebido` | `idEvento: 8e75b0ea-…`, `canal: pedido.criado`, `origem: vendas-service`, `idPedido: 76` |
| notificacao | `e-mail enviado` | `idPedido: 76`, `tipo: PEDIDO_CRIADO`, `rodadas: 1` (mesmo `idCorrelacao: 8e75b0ea-…`) |
| pagamento | `evento publicado` | `idEvento: 71b632f2-…`, `tipo: pagamento.confirmado`, `idPedido: 76`, `receptores: 1` |
| notificacao | `evento recebido` | `idEvento: 71b632f2-…`, `canal: pagamento.confirmado`, `origem: pagamento-service` |
| notificacao | `e-mail enviado` | `tipo: PAGAMENTO_CONFIRMADO`, `rodadas: 1` (mesmo `idCorrelacao: 71b632f2-…`) |

- `receptores: 1` é o retorno do `PUBLISH`: um assinante recebeu a mensagem.
- Na execução de teste, o evento foi publicado às 20:43:20.075, recebido às 20:43:20.077 e o e-mail saiu às 20:43:20.187.

## 5. Seguir um evento pelo `idEvento`

```bash
docker logs notificacao 2>&1 | grep "<idEvento copiado do passo 4>"
docker logs vendas      2>&1 | grep "<idEvento copiado do passo 4>"
```

O `idEvento` (publicação) é igual ao `idCorrelacao` das linhas do consumidor: as duas pontas do evento ficam ligadas pelo mesmo id. O comando `bash scripts/seguir-id.sh <idEvento>` faz essa busca nos 5 serviços de uma vez, e ainda mostra o `idCorrelacaoOrigem` (a requisição HTTP que gerou o evento); veja [rastreio-de-fluxo.md](rastreio-de-fluxo.md).

## 6. O efeito: e-mails e registro no banco

```bash
# e-mails no Mailpit (substitua 76 pelo ID_PEDIDO)
curl -s "http://127.0.0.1:8025/api/v1/search?query=%2376"

# registro de cada notificação (UNIQUE por pedido e tipo)
docker exec notificacao_db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e \
  "select id_pedido,tipo,status,tentativas from notificacao_log where id_pedido=76" "$MYSQL_DATABASE"'
```

Esperado: 2 e-mails ("Recebemos o seu pedido #76" e "Pagamento confirmado — pedido #76") e 2 linhas `ENVIADO` (`PEDIDO_CRIADO` e `PAGAMENTO_CONFIRMADO`).

## 7. Casos de borda

Publicando direto no Redis (substitua o `idPedido` por um pedido que já tenha e-mail enviado):

```bash
T=$(date -u +%FT%TZ)
EV='{"id":"11111111-2222-4333-8444-555555555555","tipo":"pedido.criado","versao":1,"origem":"demo","ocorridoEm":"'$T'","dados":{"idPedido":76,"status":"AGUARDANDO_PAGAMENTO","valorTotal":100,"cliente":{"nome":"Cliente demo","email":"demo@mce.test"}}}'

docker exec redis redis-cli PUBLISH pedido.criado "$EV"                        # evento repetido
docker exec redis redis-cli PUBLISH pedido.criado '{nao-e-json'                # JSON inválido
docker exec redis redis-cli PUBLISH pedido.criado "${EV/\"versao\":1/\"versao\":2}"   # versão não suportada
docker exec redis redis-cli PUBLISH canal.sem.ouvinte x                        # (integer) 0: ninguém ouve

docker logs notificacao --since 1m 2>&1 | grep -E "evento|notificação"
```

| Publicação | Resultado do `PUBLISH` | Log da Notificação |
|---|---|---|
| Evento repetido (mesmo pedido e tipo) | `1` | `evento recebido` e depois `notificação já registrada, evento ignorado` (nenhum e-mail novo) |
| JSON inválido | `1` | `evento descartado`, `motivo: JSON inválido` (nível `warn`) |
| `versao: 2` | `1` | `evento descartado`, `motivo: versão 2 não suportada` |
| Canal sem assinante | `0` | nada (ninguém escuta) |

## 8. Limitação do Pub/Sub: assinante fora do ar

O Redis Pub/Sub **não guarda mensagens** (ADR-008). Com a Notificação parada, o evento se perde, e o log do publicador mostra isso:

```bash
docker stop notificacao
node demonstracao/fluxo-pedido.js
docker logs vendas --since 1m 2>&1 | grep "evento publicado"      # "receptores":0
docker start notificacao
```

O pedido e o pagamento seguem normais (201 e `APROVADO`), mas não há e-mail para aquele pedido: aceito no MVP, e é justamente o que `receptores: 0` permite detectar nos logs.

## 9. Prova automatizada

Os testes de cada serviço cobrem publicação, log e consumo (não precisam de banco; rodam com mocks):

```bash
# em cada serviço (vendas-service, pagamento-service, notificacao-service)
npm ci && npx tsc --noEmit && npx jest --runInBand
```

Resultado obtido: Vendas 153, Pagamento 103 e Notificação 56 testes passando.

## Registro da evidência

| Passo | Esperado | Obtido (cole a saída ou um print) |
|---|---|---|
| 3. `SUBSCRIBE` | 2 mensagens com o envelope do ADR-008 | |
| 4. Logs | `evento publicado` → `evento recebido` → `e-mail enviado`, nos dois eventos | |
| 5. Correlação | mesmo id nas duas pontas | |
| 6. E-mails e banco | 2 e-mails, 2 linhas `ENVIADO` | |
| 7. Casos de borda | repetido ignorado, inválido e v2 descartados | |
| 8. Assinante fora do ar | `receptores: 0` | |
