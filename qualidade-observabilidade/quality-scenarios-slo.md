# Atributos de Qualidade, Resiliência e Observabilidade

## Quality Scenarios (SLOs/SLIs)

| # | Cenário | Estímulo | SLI (o que medir) | SLO (meta) |
|---|---|---|---|---|
| 1 | Listagem de produtos | Cliente abre a tela de produtos | Tempo de resposta do `GET /produtos` | p95 < 300ms (com cache hit) |
| 2 | Criação de pedido | Cliente finaliza a compra | Tempo de resposta do `POST /pedidos` | p95 < 1,5s (inclui chamada síncrona a Identidade) |
| 3 | Disponibilidade do checkout | Cliente tenta finalizar pedido | % de requisições `POST /pedidos` com sucesso | ≥ 99% em janela de 24h |
| 4 | Entrega de e-mail | Pedido criado ou pago | Tempo entre evento publicado e e-mail enviado | p95 < 10s |
| 5 | Disponibilidade geral do Gateway | Qualquer requisição do cliente | % de respostas 2xx/3xx no Nginx | ≥ 99% em janela de 24h |

## Estratégias de resiliência aplicadas

- **Timeout:** toda chamada HTTP entre serviços tem timeout de 5 s (`HTTP_TIMEOUT_MS`) para não travar a requisição do cliente esperando um serviço lento.
- **Retry com backoff exponencial:** só em chamadas idempotentes (consultas GET, reserva e devolução de estoque por pedido, mudança de status repetível). 1 nova tentativa após 200 ms (`HTTP_BACKOFF_BASE_MS`; as seguintes dobrariam: 400 ms, 800 ms...). Falha de rede, timeout e 5xx são repetidos; 4xx não.
- **Circuit breaker:** implementado em `clients/http.ts` do Vendas e do Pagamento, um circuito por serviço chamado (Identidade, Catálogo, Vendas, Mercado Pago). Abre depois de 5 chamadas seguidas que falharam (`CIRCUIT_FALHAS`); aberto, recusa na hora com 503 sem tocar na rede; passados 10 s (`CIRCUIT_RESET_MS`) deixa passar uma única chamada de teste (meio-aberto): se der certo fecha, se falhar reabre. Respostas 4xx não contam como falha. Observável nas métricas `*_eventos_total{evento="circuito_aberto|circuito_fechado|circuito_recusou_chamada"}`.
- **Cache-aside como mitigação de latência:** reduz a necessidade de repetir a mesma chamada síncrona (usuário) ou consulta pesada (produto) em um curto intervalo.
- **Redundância (fora do escopo didático):** em produção, cada serviço rodaria com mais de uma réplica atrás do Nginx — mencionado aqui como estratégia, não implementado no ambiente de desenvolvimento.

## Plano simples de observabilidade

- **Logs estruturados** em todos os serviços: nível (info/warn/error), nome do serviço, timestamp, e um `idCorrelacao` (ex.: id do pedido) propagado entre as chamadas relacionadas a uma mesma compra.
- **Métricas mínimas por serviço:** contagem de requisições por status HTTP, tempo médio de resposta, contagem de falhas nas chamadas síncronas entre serviços.
- **O que observar em caso de erro:** se o cliente recebe erro ao finalizar pedido, primeiro checar logs do serviço Vendas (quem recebeu a requisição), depois do serviço Identidade (quem foi chamado por ele) — o `idCorrelacao` ajuda a filtrar rapidamente.
