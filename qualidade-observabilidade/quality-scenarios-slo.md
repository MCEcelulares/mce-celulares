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

- **Retry com backoff:** na chamada síncrona Vendas → Identidade (validar usuário). Ex.: até 2 retentativas com backoff de 200ms/500ms antes de falhar a criação do pedido.
- **Timeout:** toda chamada HTTP entre serviços tem timeout curto (ex.: 2s) para não travar a requisição do cliente esperando um serviço lento.
- **Circuit breaker (se sobrar tempo):** na mesma chamada Vendas → Identidade, abrindo o circuito após N falhas seguidas e voltando a tentar depois de um tempo, evitando sobrecarregar um serviço já instável.
- **Cache-aside como mitigação de latência:** reduz a necessidade de repetir a mesma chamada síncrona (usuário) ou consulta pesada (produto) em um curto intervalo.
- **Redundância (fora do escopo didático):** em produção, cada serviço rodaria com mais de uma réplica atrás do Nginx — mencionado aqui como estratégia, não implementado no ambiente de desenvolvimento.

## Plano simples de observabilidade

- **Logs estruturados** em todos os serviços: nível (info/warn/error), nome do serviço, timestamp, e um `idCorrelacao` (ex.: id do pedido) propagado entre as chamadas relacionadas a uma mesma compra.
- **Métricas mínimas por serviço:** contagem de requisições por status HTTP, tempo médio de resposta, contagem de falhas nas chamadas síncronas entre serviços.
- **O que observar em caso de erro:** se o cliente recebe erro ao finalizar pedido, primeiro checar logs do serviço Vendas (quem recebeu a requisição), depois do serviço Identidade (quem foi chamado por ele) — o `idCorrelacao` ajuda a filtrar rapidamente.
