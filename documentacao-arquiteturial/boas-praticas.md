# Boas práticas adotadas nos serviços

Convenções comuns aos 5 serviços (Identidade, Catálogo, Vendas, Pagamento, Notificação). Cada item aponta para onde está no código.

## 1. Organização do código

Todos os serviços têm a mesma estrutura em `src/`, e a regra de dependência entre camadas é verificada no CI ([arquitetura-em-camadas.md](arquitetura-em-camadas.md), [ADR-015](ADRs/ADR-015-camada-repository.md)).

| Pasta | Papel |
|---|---|
| `routes/` | endpoints e a ordem dos middlewares (autenticação, permissão, validação) |
| `controllers/` | traduzem HTTP em chamada de service; não têm regra de negócio |
| `services/` | regras de negócio, transações e decisão entre 404, 409 e seguir |
| `repositories/` | único acesso ao banco; traduzem erros do banco |
| `models/` | mapeamento das tabelas (Sequelize) |
| `validators/` | schemas de entrada (Zod), um arquivo por recurso |
| `middlewares/` | autenticação (JWT), permissão, validação, log de requisição, tratamento de erros |
| `clients/` (Vendas, Pagamento) | chamadas HTTP a outros serviços, com timeout, retry e circuit breaker |
| `jobs/`, `gateways/` | tarefas agendadas (Vendas, Notificação) e adaptadores de pagamento (Pagamento) |
| `utils/` | logger, contexto de requisição, métricas, eventos |

## 2. DTOs (entrada e saída)

- **Entrada:** cada rota valida `body`, `params` e `query` com um schema Zod pelo middleware `validar(schema, origem)`. Dado inválido responde 400 com `{ "erro": "Dados inválidos", "detalhes": { ... } }`. O dado que chega ao controller já está tipado e normalizado (e-mail em minúsculas, números convertidos, campos extras descartados).
- **Saída:** os services devolvem objetos montados por funções `paraResposta`/`resumo`, nunca a instância do model. Isso controla o que sai: o CPF não aparece nas respostas de pedido, o Pagamento não expõe `id_externo` nem o link de pagamento nas listagens, e o Catálogo transforma o nome do arquivo de imagem em URL.

## 3. Tratamento de erros

Um contrato único: o corpo de erro é `{ "erro": "mensagem" }`, com `detalhes` quando há o que detalhar (validação e alguns erros do Catálogo).

| Status | Quando |
|---|---|
| 400 | dados inválidos (Zod), JSON malformado, upload inválido |
| 401 / 403 | sem token ou token inválido / sem a permissão exigida |
| 404 | recurso inexistente; rota inexistente (resposta padronizada) |
| 409 | conflito de negócio: nome duplicado, estoque insuficiente, status que mudou no meio da operação |
| 413 | corpo ou imagem maior que o limite (Nginx ou upload) |
| 422 | regra de negócio não atendida (carrinho vazio, cadastro incompleto) |
| 429 | limite de requisições (login e cadastro) |
| 502 / 503 | outro serviço respondeu algo inesperado / está fora do ar (timeout, 5xx ou circuito aberto) |
| 500 | erro inesperado: mensagem genérica ao cliente, detalhes só no log |

Como funciona: os services lançam `ErroHttp(status, mensagem)`; um `errorHandler` por serviço converte em resposta e em log (`erro de negócio` em nível warn, `erro não tratado` em nível error). Erros do banco são traduzidos no repository (`RegistroDuplicadoError` vira 409 no service), e nenhuma exceção do Sequelize chega ao cliente. Os serviços também tratam `SIGTERM` e erros não capturados no processo (`src/index.ts`).

## 4. Logs

- **Formato:** JSON (Pino), uma linha por evento, com `level`, `time`, `servico`, `idCorrelacao` e `msg`. Sem corpo de requisição nem cabeçalho `Authorization` (`redact`).
- **Nível por resultado:** requisição 2xx/3xx = info, 4xx = warn, 5xx = error. A mensagem de requisição é `MÉTODO /caminho -> status`.
- **Mensagens de negócio principais** (para procurar com `grep`):

| Fluxo | Mensagens |
|---|---|
| Autenticação | `login falhou`, `renovação de sessão negada` |
| Catálogo | `produto criado`, `produto atualizado`, `produto inativado`, `estoque ajustado`, `estoque reservado`, `imagem do produto atualizada` |
| Cache | `cache indisponível: consultando o banco`, `cache indisponível: invalidação não aplicada (vale o TTL)` |
| Vendas | `reserva incerta: pedido invisível mantido para recuperação`, `reserva não devolvida: ...` |
| Entre serviços | `falha ao chamar outro serviço` (depois das tentativas e do circuit breaker) |
| Eventos | `evento publicado`, `evento recebido`, `e-mail enviado`, `notificação já registrada, evento ignorado`, `evento descartado`, `falha ao publicar evento` |

Dados pessoais: os eventos não levam CPF nem telefone, e os logs de publicação trazem só identificadores.

## 5. Correlação: seguir um fluxo entre serviços

- **Entrada:** o `x-correlation-id` recebido é aproveitado (ou um UUID é gerado), devolvido no cabeçalho de resposta e guardado no contexto da requisição (`AsyncLocalStorage`), de onde o logger o coloca em toda linha.
- **Entre serviços:** os clients HTTP de Vendas e Pagamento repassam esse id às chamadas internas (Identidade, Catálogo, Vendas). Chamadas a sistemas externos (Mercado Pago) não o recebem.
- **Eventos:** o envelope pode levar `idCorrelacao` (opcional, [ADR-008](ADRs/ADR-008-contrato-eventos-assincronos.md)). A Notificação registra `idCorrelacaoOrigem` e usa o `idEvento` como correlação das próprias linhas.
- **Como usar:** `scripts/seguir-id.sh <id>` junta os logs dos 5 serviços em ordem de tempo. Exemplo real, com `x-correlation-id: corr-demo-123` enviado a `POST /vendas/pedidos`:

```
21:20:01.402  identidade  info  GET /usuarios/109 -> 200
21:20:01.413  identidade  info  GET /usuarios/109/enderecos/94 -> 200
21:20:01.419  catalogo    info  GET /produtos/214 -> 200
21:20:01.477  catalogo    info  estoque reservado
21:20:01.477  catalogo    info  POST /interno/reservas -> 201
21:20:01.505  vendas      info  evento publicado  [idPedido=81 tipo=pedido.criado receptores=1 idEvento=6d41d0ad-…]
21:20:01.508  notificacao info  evento recebido  [idPedido=81 canal=pedido.criado idEvento=6d41d0ad-… idCorrelacaoOrigem=corr-demo-123]
21:20:01.515  vendas      info  POST /pedidos -> 201
21:20:01.633  notificacao info  e-mail enviado  [idPedido=81 tipo=PEDIDO_CRIADO]
```

Roteiro completo em [demonstracao/rastreio-de-fluxo.md](../demonstracao/rastreio-de-fluxo.md).

## 6. Saúde e métricas

Cada serviço expõe `GET /health/live` (processo no ar), `GET /health` (banco e Redis; `degradado` se só o Redis falhar) e `GET /metrics` (formato Prometheus, exige `Authorization: Bearer <METRICS_TOKEN>`; responde 404 se o token não estiver configurado). Contadores principais: `http_requisicoes_total`, `<serviço>_eventos_total` (eventos de negócio e de circuit breaker) e `catalogo_cache_total`. Plano de observabilidade e SLOs em [quality-scenarios-slo.md](../qualidade-observabilidade/quality-scenarios-slo.md).

## 7. Testes

Jest e Supertest em cada serviço: rotas (com mocks ou banco real), repositories, clients HTTP (timeout, retry, circuit breaker), eventos e cache. Mais o e2e contra o ambiente no ar (`e2e/`) e a verificação do gateway (`scripts/verificar-gateway.sh`). O CI roda tipagem, testes, contratos, camadas e `nginx -t`.
