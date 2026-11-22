# Demonstração: SLOs medidos e resiliência em ação

Mede os SLOs de [quality-scenarios-slo.md](../qualidade-observabilidade/quality-scenarios-slo.md) e prova duas estratégias de resiliência: o **circuit breaker** e o **reenvio automático de e-mail**. As outras duas estão em roteiros próprios: a degradação com Redis fora do ar em [cache-redis.md](cache-redis.md) (seção 7) e o isolamento de falha no gateway em [gateway-nginx.md](gateway-nginx.md) (seção 6).

Comandos para um terminal bash (Git Bash no Windows), na raiz do repositório. As saídas são de uma execução real; tempos e ids mudam a cada execução.

## 0. Pré-requisitos

- Ambiente no ar com o Mailpit: `docker compose --profile dev up -d --build` (veja o [README](../README.md)).
- `METRICS_TOKEN` preenchido nos `.env` dos serviços (o mesmo valor; instruções na tabela do README). Sem ele `/metrics` responde 404 e o `medir-slos.js` avisa qual serviço está sem token.
- `GATEWAY_PAGAMENTO=simulado` no `pagamento-service/.env` e SMTP apontando para o Mailpit (`SMTP_HOST=mailpit`, `SMTP_PORT=1025`, `EMAIL_INTERVALO_MS=0`).
- Só para a carga de 20 pedidos: o limite padrão de criação de pedido é 20 por 15 minutos por IP (resposta 429 depois disso, outra estratégia de resiliência). Em desenvolvimento, suba o limite no `vendas-service/.env` (`RATE_LIMIT_PEDIDO_MAX=200`) e recrie o serviço: `docker compose up -d --force-recreate vendas`.
- Os contadores dos serviços valem desde que o container subiu, e o log do Nginx guarda 24 h; falhas de testes anteriores continuam aparecendo. Para uma medição "limpa", sem recriar nada, grave uma linha de base antes (`node scripts/medir-slos.js --zerar`, seção 1).

## 1. Gerar carga e medir os SLOs

```bash
node demonstracao/gerar-carga.js        # 20 pedidos (5 pagos) e 300 leituras do catálogo
node scripts/medir-slos.js
```

```
leituras: 300/300 com 200 em 1.2 s
pedidos: 20/20 criados, 5/5 pagos

SLO  Medição                      Meta      Medido    Amostras  Situação
1    GET /produtos (2xx), p95     < 300 ms  10 ms          120  OK
2    POST /pedidos (2xx), p95     < 1,5 s   100 ms          20  OK
3    POST /pedidos sem 5xx        ≥ 99 %    100.00 %        20  OK
4    e-mail: evento → envio, p95  < 10 s    475 ms          25  OK
5    gateway sem 5xx (log, 24h)   ≥ 99 %    99.39 %       1314  OK
```

O script lê `/metrics` dos serviços pelo gateway, calcula o p95 a partir dos buckets do histograma e o percentual sem 5xx dos contadores, e lê o log do Nginx para o SLO 5. Sai com código `1` se algum SLO estiver violado.

**Medir só um trecho (linha de base).** Sem isso o script mostra tudo desde que os containers subiram, inclusive falhas de testes anteriores. Para medir só o que vem a seguir:

```bash
node scripts/medir-slos.js --zerar      # grava a linha de base (.slo-baseline.json, ignorado pelo git)
node demonstracao/gerar-carga.js
node scripts/medir-slos.js
node scripts/medir-slos.js --limpar     # volta a medir o acumulado
```

```
SLO  Medição                                       Meta      Medido    Amostras  Situação
1    GET /produtos (2xx), p95                      < 300 ms  10 ms          120  OK
2    POST /pedidos (2xx), p95                      < 1,5 s   97 ms           20  OK
3    POST /pedidos sem 5xx                         ≥ 99 %    100.00 %        20  OK
4    e-mail: evento → envio, p95                   < 10 s    475 ms          25  OK
5    gateway sem 5xx (log, desde a linha de base)  ≥ 99 %    100.00 %       352  OK

Linha de base de 2026-11-22T22:17:10.004Z: só entra o que veio depois dela, nos serviços e no log do Nginx (--limpar remove).
```

Logo depois do `--zerar`, sem tráfego novo, todos os SLOs aparecem como `SEM DADOS`; as amostras (120 leituras e 20 pedidos) são exatamente as da carga. Os mesmos testes, sem linha de base, ainda mostravam o SLO 3 em 85,96 % (`VIOLADO`) por causa da queda provocada na seção 2.

**Conferência manual de um número** (SLO 2): `curl -s -H "Authorization: Bearer $METRICS_TOKEN" localhost:8080/vendas/metrics | grep 'duracao_segundos_bucket.*POST.*/pedidos.*201'` mostra os buckets acumulados `le=0.05 → 5`, `le=0.1 → 19`, `le=0.3 → 20`. O p95 de 20 amostras é a 19ª, que cai no bucket de 0,1 s: 100 ms.

## 2. Circuit breaker (e retry e timeout)

```bash
node demonstracao/demo-circuit-breaker.js
```

O script cria um cliente com o carrinho cheio, para o Catálogo (`docker stop catalogo`), tenta fechar o pedido 8 vezes, religa o Catálogo (`docker start catalogo`), espera o `CIRCUIT_RESET_MS` e tenta de novo. Ele sempre religa o Catálogo no fim.

```
[antes ] circuito_aberto=0  circuito_recusou_chamada=0  circuito_fechado=0

> docker stop catalogo
tentativa 1: HTTP 503 em 9178 ms  (Catálogo indisponível no momento)
tentativa 2: HTTP 503 em 8159 ms  (Catálogo indisponível no momento)
tentativa 3: HTTP 503 em 9181 ms  (Catálogo indisponível no momento)
tentativa 4: HTTP 503 em 8150 ms  (Catálogo indisponível no momento)
tentativa 5: HTTP 503 em 8138 ms  (Catálogo indisponível no momento)
tentativa 6: HTTP 503 em   45 ms  (Catálogo indisponível no momento)
tentativa 7: HTTP 503 em   17 ms  (Catálogo indisponível no momento)
tentativa 8: HTTP 503 em   19 ms  (Catálogo indisponível no momento)
[aberto] circuito_aberto=1  circuito_recusou_chamada=3  circuito_fechado=0

> docker start catalogo
Catálogo de volta. Aguardando 10 s (CIRCUIT_RESET_MS) para o circuito testar de novo...
tentativa após religar: HTTP 201 em 114 ms  (pedido #146)
[final ] circuito_aberto=1  circuito_recusou_chamada=3  circuito_fechado=1
```

**O que isso mostra**
- **Retry e timeout:** as 5 primeiras tentativas levam 8 a 9 s cada (a consulta ao Catálogo é repetida uma vez, depois do backoff, e o nome do container parado demora a falhar), até serem contadas como 5 falhas seguidas.
- **Circuito aberto:** a partir da 6ª tentativa a resposta é imediata (17 a 45 ms) e a métrica `circuito_recusou_chamada` sobe: o Vendas nem tenta a rede.
- **Recuperação sozinha:** passados 10 s com o Catálogo de volta, uma chamada de teste passa (meio-aberto), o circuito fecha (`circuito_fechado=1`) e o pedido é criado. Nenhum reinício foi necessário.

**Efeito nos SLOs** (a seguir, sem recriar os serviços):

```bash
node scripts/medir-slos.js
```

```
3    POST /pedidos sem 5xx        ≥ 99 %    72.41 %         29  VIOLADO
5    gateway sem 5xx (log, 24h)   ≥ 99 %    98.80 %       1331  VIOLADO
```

O SLO 3 enxerga as 8 respostas 503 (21 × 201 e 8 × 503). Dá para conferir: `curl -s -H "Authorization: Bearer $METRICS_TOKEN" localhost:8080/vendas/metrics | grep '^http_requisicoes_total.*POST.*pedidos'`. A indisponibilidade de uma dependência consome o orçamento de erro, e o SLO mostra isso.

## 3. Reenvio automático de e-mail

```bash
node demonstracao/demo-reenvio-email.js        # leva cerca de 3 minutos
```

O script para o Mailpit (`docker stop mailpit`), cria um pedido, espera o registro ir a `FALHA`, religa o Mailpit e acompanha a tabela `notificacao_log` até o reenvio automático.

```
> docker stop mailpit
POST /vendas/pedidos -> 201, pedido #105 (o pedido não depende do e-mail)
[0.3 min] notificacao_log: FALHA | 1 | Connection timeout

> docker start mailpit
Aguardando a rotina de reenvio (espera de 2 min + verificação a cada 60 s)...
[0.3 min] notificacao_log: FALHA | 1 | Connection timeout
[2.7 min] notificacao_log: ENVIADO | 2 | -

logs da Notificação sobre o pedido:
  21:42:34 falha ao enviar e-mail, tentando novamente [tentativa=1]
  21:42:39 falha ao enviar e-mail, tentando novamente [tentativa=2]
  21:42:45 falha ao enviar e-mail [idPedido=105 rodadas=1]
  21:45:07 e-mail enviado [idPedido=105 rodadas=2]
  21:45:07 notificações reenviadas [reenviadas=1]
```

**O que isso mostra:** o pedido não depende do e-mail (201 mesmo com o SMTP fora); a primeira rodada tenta 3 vezes com pausa crescente e termina em `FALHA` (`rodadas=1`); a rotina de reenvio (a cada 60 s, depois de uma espera de 2 min na primeira rodada) entrega o e-mail sozinha assim que o SMTP volta (`rodadas=2`, `ENVIADO`). Se o SMTP não voltasse, a espera dobraria a cada rodada (2, 4, 8... até 60 min) até `NOTIFICACAO_REENVIO_MAX_TENTATIVAS` (5).

## 4. Outras estratégias, onde estão provadas

| Estratégia | Roteiro ou teste |
|---|---|
| Degradação com Redis fora do ar | [cache-redis.md](cache-redis.md), seção 7 |
| Isolamento de falha no gateway | [gateway-nginx.md](gateway-nginx.md), seção 6 (`scripts/verificar-gateway.sh --isolamento`) |
| Idempotência de evento e de e-mail | [mensageria-pubsub.md](mensageria-pubsub.md), seção 7 |
| Rate limit (429) | testes dos serviços; na carga acima, a 21ª criação de pedido em 15 min com o limite padrão responde `429 Muitos pedidos criados a partir deste IP` |
| Expiração e recuperação de pedido, reserva idempotente | `node e2e/executar.js vendas` |
| Rollback de versão | [ADR-014](../documentacao-arquiteturial/ADRs/ADR-014-cd-com-rollback-por-tag.md) e o [runbook](../operacao/runbook-incidentes.md) |

## Registro da evidência

| Passo | Esperado | Obtido (cole a saída ou um print) |
|---|---|---|
| 1. Carga e SLOs | 5 SLOs `OK` | |
| 2. Circuit breaker | `circuito_aberto=1`, `recusou_chamada≥1`, `fechado=1`; pedido 201 no fim | |
| 2. SLOs depois da queda | SLO 3 `VIOLADO` (503 contadas) | |
| 3. Reenvio de e-mail | `FALHA` → `ENVIADO` com 2 rodadas | |
