# Atributos de Qualidade, Resiliência e Observabilidade

Este documento define o que o sistema promete (SLOs), como isso é medido (SLIs), o que o protege de falhas (resiliência) e o que é coletado para enxergar o comportamento (observabilidade). Os números abaixo foram medidos no ambiente real com `scripts/medir-slos.js` (roteiro em [demonstracao/resiliencia-e-slos.md](../demonstracao/resiliencia-e-slos.md)).

## 1. Quality Scenarios (SLOs e SLIs)

**Definições usadas nos SLIs**
- **Sucesso = resposta que não é 5xx.** Respostas 4xx (401, 404, 409 "estoque insuficiente", 422...) são o sistema funcionando e não consomem o orçamento de erro.
- **Latência** é medida só nas respostas 2xx, em percentil 95 (p95), a partir do histograma `http_requisicao_duracao_segundos` de cada serviço (buckets: 10, 50, 100, 300, 500 ms e 1, 1,5, 2, 5 s).
- **Orçamento de erro:** 99% de sucesso em 24 h permite 1 falha a cada 100 requisições, ou cerca de 14 minutos de indisponibilidade total por dia.

| # | Cenário | Estímulo | SLI (o que medir e de onde) | SLO (meta) |
|---|---|---|---|---|
| 1 | Listagem de produtos | Cliente abre a tela de produtos | p95 de `GET /produtos` com resposta 2xx: `http_requisicao_duracao_segundos{metodo="GET",rota="/produtos"}` no Catálogo | p95 < 300 ms (com cache hit) |
| 2 | Criação de pedido | Cliente finaliza a compra | p95 de `POST /pedidos` com resposta 2xx: `http_requisicao_duracao_segundos{metodo="POST",rota="/pedidos"}` no Vendas (inclui as chamadas síncronas a Identidade e Catálogo) | p95 < 1,5 s |
| 3 | Disponibilidade do checkout | Cliente tenta finalizar pedido | % de `POST /pedidos` sem 5xx: `http_requisicoes_total{metodo="POST",rota="/pedidos"}` no Vendas | ≥ 99% em janela de 24 h |
| 4 | Entrega de e-mail | Pedido criado ou pago | p95 do tempo entre o evento publicado e o e-mail enviado: `notificacao_entrega_segundos` | p95 < 10 s |
| 5 | Disponibilidade do gateway | Qualquer requisição do cliente | % de respostas sem 5xx no log de acesso do Nginx (o Nginx não expõe métricas), sem contar `/metrics` e as sondas `/health` | ≥ 99% em janela de 24 h |

### Medição

```bash
node scripts/medir-slos.js            # acumulado desde que os containers subiram; log do Nginx das últimas 24 h (aceita outra janela, ex.: 2h)
node scripts/medir-slos.js --zerar    # grava uma linha de base: as próximas medições mostram só o que vier depois
node scripts/medir-slos.js --limpar   # remove a linha de base
```

Resultado depois de uma carga normal (20 pedidos, 5 pagos, 300 leituras):

```
SLO  Medição                      Meta      Medido    Amostras  Situação
1    GET /produtos (2xx), p95     < 300 ms  10 ms          120  OK
2    POST /pedidos (2xx), p95     < 1,5 s   100 ms          20  OK
3    POST /pedidos sem 5xx        ≥ 99 %    100.00 %        20  OK
4    e-mail: evento → envio, p95  < 10 s    475 ms          25  OK
5    gateway sem 5xx (log, 24h)   ≥ 99 %    99.39 %       1314  OK
```

Resultado depois de derrubar o Catálogo por cerca de 30 s (circuit breaker, seção 2): o SLO 3 passa a mostrar as 8 respostas 503 que o cliente recebeu.

```
3    POST /pedidos sem 5xx        ≥ 99 %    72.41 %         29  VIOLADO     (21 × 201 e 8 × 503)
5    gateway sem 5xx (log, 24h)   ≥ 99 %    98.80 %       1331  VIOLADO
```

**Como interpretar**
- Sem linha de base, os histogramas e contadores dos serviços valem **desde que o container subiu** (zeram ao recriá-lo), e só o log do Nginx respeita a janela pedida; falhas antigas continuam aparecendo. Com `--zerar`, os serviços e o Nginx passam a valer **desde o instante em que a linha de base foi gravada**, o que permite medir um trecho qualquer sem recriar nada (ex.: `--zerar`, gerar a carga, medir). Se um container for recriado depois da linha de base, a série dele volta a valer inteira.
- O SLO 1 foi medido com o cache aquecido: listagens repetidas acertam o cache (`catalogo_cache_total`); um *miss* custa mais.
- O SLO 4 depende de `EMAIL_INTERVALO_MS`: com `0` (desenvolvimento com o Mailpit) o e-mail sai em milissegundos; com o plano gratuito do Mailtrap (`10500`) o segundo e-mail de cada rajada espera ~10 s e o SLO não seria cumprido. Para o SLO valer, o SMTP deve aceitar o ritmo de envio.
- Uma queda planejada (deploy) conta contra o orçamento. Por isso o deploy confere a saúde e volta sozinho (ADR-014).

## 2. Estratégias de resiliência aplicadas

| Estratégia | Onde | Configuração | Evidência |
|---|---|---|---|
| **Timeout** em toda chamada entre serviços | `clients/http.ts` de Vendas e Pagamento | `HTTP_TIMEOUT_MS` (5000) | testes dos clients; ADR-003 |
| **Retry com backoff exponencial**, só em chamadas idempotentes (consultas, reserva e devolução por pedido) | `clients/http.ts` | `HTTP_BACKOFF_BASE_MS` (200: 200 ms, 400 ms...) | testes dos clients |
| **Circuit breaker** por serviço chamado: abre após 5 falhas seguidas, recusa na hora com 503 e testa uma chamada a cada 10 s (meio-aberto) | `clients/http.ts` | `CIRCUIT_FALHAS` (5), `CIRCUIT_RESET_MS` (10000) | métricas `circuito_aberto`, `circuito_recusou_chamada`, `circuito_fechado`; testes; demonstração |
| **Idempotência**: reserva de estoque por pedido; e-mail único por (pedido, tipo); webhook de pagamento reconsulta o Mercado Pago e confirma uma vez; troca de status condicional ao status lido | Catálogo, Notificação, Pagamento, Vendas | UNIQUE e UPDATE condicional no banco | ADR-008, 009, 011; testes e e2e |
| **Degradação graciosa**: Redis fora não derruba a API (Catálogo lê do banco; Vendas e Pagamento seguem sem publicar o evento) | `cacheService.ts`, `eventos.ts` | timeouts curtos do cliente Redis | ADR-017; demonstração do cache |
| **Reenvio automático de e-mail** em `FALHA` e em `PENDENTE` preso, com espera crescente | Notificação (`jobs/reenviarNotificacoes.ts`) | `NOTIFICACAO_REENVIO_MAX_TENTATIVAS` (5), `NOTIFICACAO_REENVIO_VERIFICAR_SEGUNDOS` (60) | ADR-008; demonstração |
| **Recuperação e expiração de pedidos**: pedido que ficou pela metade é desfeito e a reserva devolvida; pedido sem pagamento expira e devolve o estoque | Vendas (`jobs/expirarPedidos.ts`) | `PEDIDO_ORFAO_MINUTOS` (10), `PEDIDO_EXPIRA_MINUTOS` (30) | métricas `pedido_orfao_recuperado`, `pedido_expirado`; e2e |
| **Rate limit por IP** (login, cadastro, criação de pedido, teto geral) | middleware `rateLimit` de cada serviço | `RATE_LIMIT_*` (ex.: 20 pedidos por 15 min) | respostas 429; testes |
| **Healthchecks, reinício e ordem de subida** | Docker Compose e Dockerfiles | `restart: unless-stopped`, `depends_on: service_healthy`, `HEALTHCHECK` | `docker compose ps` |
| **Isolamento de falha no gateway**: um serviço parado só derruba a própria rota (502/504 em até ~5 s) | Nginx | `resolver` dinâmico, `proxy_connect_timeout 5s` | ADR-018; `scripts/verificar-gateway.sh --isolamento` |
| **Rollback de versão** automático e manual | CD | `scripts/deploy.sh`, `scripts/rollback.sh` | ADR-014; runbook |

**Comportamento observado com o circuit breaker** (Catálogo parado, 8 tentativas de pedido): as 5 primeiras falharam em 8 a 9 s cada (duas tentativas de ~4 s, porque o nome do container parado demora a falhar no DNS do Docker); o circuito abriu e as 3 seguintes foram recusadas em ~20 ms; religado o Catálogo e passados 10 s, a tentativa seguinte foi aceita (201) e o circuito fechou sozinho. Isso mostra o limite da proteção: antes de abrir, cada cliente espera vários segundos.

**Não implementado (limites conhecidos)**
- Réplicas e balanceamento: cada serviço roda uma instância; o Nginx e o Redis são pontos únicos de falha.
- Fila durável de eventos: o Redis Pub/Sub não guarda mensagens. Com a Notificação fora, o evento se perde (o log do publicador mostra `receptores: 0`) e o e-mail daquele pedido não é gerado depois.
- O Redis não persiste dados (sem volume): ao ser recriado, o cache e os refresh tokens se perdem.
- Rotina automática de backup dos bancos: não há; o runbook trata a restauração do volume.
- Alertas automáticos: as métricas estão no formato Prometheus, mas não há Prometheus, Grafana nem Alertmanager configurados; a leitura é manual (`scripts/medir-slos.js`).

## 3. Plano de observabilidade

**Logs** (JSON, Pino): `level`, `time`, `servico`, `idCorrelacao`, `msg` em toda linha; nível por resultado da requisição (info, warn, error); mensagens de negócio por fluxo (login, produto, estoque, pedido, evento publicado e recebido, e-mail enviado, falhas). O `x-correlation-id` é repassado entre os serviços e nos eventos, e `scripts/seguir-id.sh <id>` mostra uma compra inteira em ordem de tempo. Detalhes e catálogo de mensagens: [boas-praticas.md](../documentacao-arquiteturial/boas-praticas.md).

**Métricas** (`GET /<serviço>/metrics`, formato Prometheus, exige `METRICS_TOKEN`):

| Métrica | Rótulos | Para que serve |
|---|---|---|
| `http_requisicoes_total` | `metodo`, `rota` (padrão da rota, ex. `/pedidos/:id`, também nas respostas de erro), `status` | taxa de requisições e de 5xx por rota (SLI 3) |
| `http_requisicao_duracao_segundos` | `metodo`, `rota`, `status` | latência p95 por rota (SLI 1 e 2) |
| `<serviço>_eventos_total` | `evento` | eventos de negócio e de resiliência (`pedido_criado`, `circuito_aberto`, `email_falha`, `evento_nao_publicado`, ...), tabela no [runbook](../operacao/runbook-incidentes.md) |
| `catalogo_cache_total` | `resultado` (`hit`, `miss`, `erro`) | eficácia do cache e Redis fora do ar |
| `notificacao_entrega_segundos` | `tipo` | tempo evento → e-mail (SLI 4) |
| métricas padrão do processo (CPU, memória, event loop) | — | saúde do processo Node |

**Saúde:** `GET /health/live` (processo), `GET /health` (banco e Redis; `degradado` se só o Redis falhar) e o `/health` do Nginx; o Docker usa os healthchecks para reiniciar e ordenar a subida.

**Fora do que é coletado:** log de acesso do Nginx (`docker logs nginx`), usado no SLO 5; o corpo das requisições e o cabeçalho `Authorization` nunca são registrados.

**O que observar em caso de erro:** pegue o `x-correlation-id` da resposta que falhou e rode `scripts/seguir-id.sh <id>`: ele junta, em ordem de tempo, as linhas de Vendas, Identidade, Catálogo, Pagamento e Notificação, inclusive o evento publicado e o e-mail enviado. A última linha da linha do tempo mostra até onde o fluxo chegou. Depois, `node scripts/medir-slos.js` mostra se o orçamento de erro está sendo consumido, e o [runbook](../operacao/runbook-incidentes.md) diz o que fazer em cada situação conhecida.
