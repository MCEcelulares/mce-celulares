# ADR-016: MySQL 8.0 como banco de dados relacional dos serviços

**Status:** Aceito

## Contexto
O [ADR-002](ADR-002-banco-por-servico.md) definiu que cada serviço tem o próprio banco. Falta registrar **qual tecnologia** usar nesses bancos. Os dados do sistema são majoritariamente relacionais e transacionais:
- **Vendas:** pedido, itens, carrinho. O total do pedido precisa ser coerente com os itens e gravado de forma atômica (pedido e carrinho encerrado na mesma transação).
- **Catálogo:** produto, categoria, marca e reserva de estoque. Reservar e devolver estoque exige transação e consistência.
- **Identidade, Pagamento e Notificação:** entidades com relacionamentos simples e esquema estável (usuário, cargo, permissão, pagamento, log de notificação).

## Decisão
Usar **MySQL 8.0** (imagem oficial `mysql:8.0`) nos 5 serviços, **uma instância por serviço**, cada uma com container, volume e senha próprios no Docker Compose. O acesso é feito pelo **Sequelize** (driver `mysql2`), com **migrations** versionadas por serviço.

## Justificativa
- **Modelo relacional e ACID (InnoDB):** pedidos, itens e reservas de estoque precisam de transações; os repositories usam transação (`comTransacao`, [ADR-015](ADR-015-camada-repository.md)).
- **Esquema bem definido:** o domínio de e-commerce tem entidades e relações estáveis, sem a flexibilidade de esquema que justificaria um banco de documentos.
- **Integração com a stack:** Sequelize tem suporte maduro a MySQL, a migrations e a seeders, já usados em todos os serviços.
- **Uma só tecnologia:** menos custo operacional e de aprendizado para a dupla; mesma imagem, healthcheck e configuração em todos os bancos.
- **Ambiente reproduzível:** imagem oficial, sobe vazio no `docker compose up` e cada serviço aplica as próprias migrations ao iniciar.

## Consequências
- **Positivas:** integridade e transações dentro de cada serviço; ferramentas e imagem bem conhecidas; migrations reproduzíveis.
- **Negativas:**
  - Escala de escrita vertical.
  - Sem chave estrangeira entre serviços (consequência do ADR-002, não do MySQL).
  - Busca textual do catálogo feita com `LIKE`, menos eficiente que um motor de busca dedicado.
- **Mitigação:** cache-aside no Redis para as leituras frequentes do catálogo. Se a busca virar gargalo, avaliar um índice de busca dedicado em novo ADR.

## Alternativas consideradas
- **PostgreSQL:** tecnicamente equivalente para este caso, com mais recursos (JSONB, busca textual avançada). Nenhum requisito do projeto depende deles, então a troca não traria ganho que compense.
- **MongoDB (documentos):** o esquema é relacional e as operações críticas (pedido, estoque) exigem transações entre entidades; o modelo de documentos traria consistência mais fraca sem benefício claro.
- **Redis como banco principal:** é volátil e orientado a chave-valor. É usado apenas para cache, refresh token e Pub/Sub ([ADR-003](ADR-003-comunicacao-sincrona-assincrona.md), [ADR-007](ADR-007-refresh-token-no-redis.md)), nunca como fonte da verdade.
