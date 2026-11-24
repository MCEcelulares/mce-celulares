# Qualidade: SLOs, resiliência e observabilidade

## 1. Quality Scenarios (SLOs e SLIs)

**SLI** é o que se mede. **SLO** é a meta. **p95** significa que 95% das respostas são mais rápidas que o valor.

| # | Cenário | Estímulo | SLI (o que medir) | SLO (meta) |
|---|---|---|---|---|
| 1 | Listagem de produtos | Cliente abre a tela de produtos | p95 de `GET /produtos` no Catálogo | p95 < 300 ms |
| 2 | Criação de pedido | Cliente finaliza a compra | p95 de `POST /pedidos` no Vendas | p95 < 1,5 s |
| 3 | Disponibilidade do checkout | Cliente tenta finalizar | % de `POST /pedidos` sem erro 5xx | ≥ 99% em 24 h |
| 4 | Entrega de e-mail | Pedido criado ou pago | p95 do tempo entre o evento e o e-mail enviado | p95 < 10 s |
| 5 | Disponibilidade do gateway | Qualquer requisição | % de respostas sem 5xx no log do Nginx | ≥ 99% em 24 h |

Só erros **5xx** contam como falha. Um 404 ou um 409 ("estoque insuficiente") é o sistema funcionando.

**Como medir:** `node scripts/medir-slos.js` lê as métricas dos serviços e o log do Nginx e mostra uma tabela com Meta, Medido e Situação. Exemplo de uma execução depois de uma carga normal:

```
SLO  Medição                      Meta      Medido    Situação
1    GET /produtos, p95           < 300 ms  10 ms     OK
2    POST /pedidos, p95           < 1,5 s   100 ms    OK
3    POST /pedidos sem 5xx        ≥ 99 %    100 %     OK
4    e-mail: evento → envio, p95  < 10 s    475 ms    OK
5    gateway sem 5xx              ≥ 99 %    99,39 %   OK
```

## 2. Resiliência: o que protege o sistema quando algo falha

| Estratégia | O que faz | Onde |
|---|---|---|
| **Timeout** | Toda chamada entre serviços tem prazo (5 s) | `clients/http.ts` |
| **Retry com backoff** | Tenta de novo esperando 200 ms, 400 ms... só em chamadas que podem ser repetidas | `clients/http.ts` |
| **Circuit breaker** | Depois de 5 falhas seguidas, recusa na hora (503) e testa de novo a cada 10 s | `clients/http.ts` |
| **Idempotência** | Repetir uma operação não duplica o efeito (reserva de estoque, e-mail, confirmação de pagamento) | Catálogo, Notificação, Pagamento |
| **Degradação** | Redis fora não derruba a API: o Catálogo lê do banco | `cacheService.ts` |
| **Reenvio de e-mail** | Tenta de novo o que falhou, a cada 60 s | Notificação |
| **Expiração de pedidos** | Pedido sem pagamento é cancelado e o estoque volta | Vendas |
| **Limite por IP** | Devolve 429 em login, cadastro e pedidos em excesso | todos os serviços |
| **Healthchecks** | O Docker reinicia o que cai e só sobe um serviço depois do banco | Docker Compose |

**Limites conhecidos:** uma instância por serviço (Nginx e Redis são pontos únicos de falha); o Pub/Sub não guarda mensagens, então um evento publicado com a Notificação parada se perde; o Redis não persiste dados; não há backup automático nem alertas.

## 3. Plano de observabilidade

- **Logs:** JSON (Pino), uma linha por acontecimento, com `idCorrelacao`. O mesmo id acompanha uma requisição por todos os serviços. Para seguir um pedido: `bash scripts/seguir-id.sh <id>`.
- **Métricas:** cada serviço expõe `GET /<serviço>/metrics` (formato Prometheus, protegido por `METRICS_TOKEN`).

  | Métrica | Para quê |
  |---|---|
  | `http_requisicoes_total` | Taxa de requisições e de erros 5xx por rota |
  | `http_requisicao_duracao_segundos` | Tempo de resposta (p95) por rota |
  | `<serviço>_eventos_total` | Eventos de negócio e de falha (`pedido_criado`, `circuito_aberto`, `email_falha`) |
  | `catalogo_cache_total` | Acertos e erros do cache |

- **Saúde:** `GET /<serviço>/health` confere o banco e o Redis. Responde `ok`, `degradado` (Redis fora) ou 503 (banco fora).
