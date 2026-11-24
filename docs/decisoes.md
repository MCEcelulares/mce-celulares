# Decisões de arquitetura (ADRs)

Cada decisão importante está registrada com o contexto, o que foi escolhido, o custo e o que foi descartado.

## ADR-001: Microsserviços reais, não monólito

- **Contexto:** a disciplina exige microsserviços de verdade, e a ideia inicial era um monólito modular.
- **Decisão:** 5 serviços independentes (Identidade, Catálogo, Vendas, Pagamento, Notificação), cada um com banco e deploy próprios.
- **Custo:** mais containers, mais pontos de falha e necessidade de timeout e retry nas chamadas entre serviços.
- **Descartado:** monólito modular (não atendia a exigência) e apenas 1 microsserviço.

## ADR-002: Um banco por serviço, sem chave estrangeira entre serviços

- **Decisão:** cada serviço tem o seu MySQL. Referências entre serviços viram um número simples, validado por HTTP na hora de gravar, ou uma cópia dos dados no momento da compra.
- **Ganho:** autonomia de cada serviço, e o histórico de pedidos não muda se o produto ou o usuário mudar.
- **Custo:** o banco não garante a integridade entre serviços, e aceita-se consistência eventual.
- **Descartado:** um banco único para todos.

## ADR-003: HTTP só onde a resposta é necessária; o resto é assíncrono

- **Decisão:**
  - **HTTP:** quando o fluxo precisa da resposta na hora (Vendas consulta Identidade e Catálogo; Pagamento consulta o Vendas e o Mercado Pago).
  - **Redis Pub/Sub:** para avisos que não bloqueiam o usuário (`pedido.criado` e `pagamento.confirmado` fazem a Notificação enviar o e-mail).
- **Ganho:** o cliente não espera o e-mail, e Vendas e Pagamento não dependem da Notificação.
- **Custo:** as chamadas HTTP são pontos de falha, então têm timeout, retry e circuit breaker. O Pub/Sub não guarda mensagens: com a Notificação parada, o e-mail daquele pedido se perde (o pedido não é afetado).
- **Descartado:** tudo síncrono.

## ADR-016: MySQL 8.0 como banco

- **Decisão:** MySQL em todos os serviços, uma instância por serviço, acessado pelo Sequelize com migrations.
- **Por quê:** pedidos, itens e estoque precisam de transações (ACID) e o esquema do e-commerce é estável. Uma só tecnologia reduz o custo de operar.
- **Custo:** escrita escala na vertical, e a busca do catálogo usa `LIKE` (o cache do Redis ameniza).
- **Descartado:** PostgreSQL (nenhum requisito usa o que ele tem a mais), MongoDB (o modelo é relacional e precisa de transações) e Redis como banco principal (é volátil).

## ADR-017: Cache-aside com Redis no Catálogo

- **Decisão:** o Catálogo consulta o Redis primeiro. Se não achar (*miss*), lê do MySQL e guarda no Redis com **TTL de 300 s**. O que entra no cache: listagens, detalhe de produto, destaques, categorias e marcas.
- **Invalidação:** toda escrita no catálogo incrementa um número de versão (`INCR catalogo:versao`) que faz parte da chave do cache. As chaves antigas deixam de ser lidas e expiram sozinhas. Assim o dado nunca fica velho depois de uma edição.
- **Se o Redis cair:** a API lê direto do banco e continua funcionando.
- **Custo:** toda alteração invalida o catálogo inteiro, e o dado pode ficar até 5 min no Redis se a invalidação falhar.
- **Descartado:** sem cache, só TTL (preço antigo por até 5 min), `DEL` chave a chave e cache em memória do processo.

## ADR-018: Nginx como único ponto de entrada, com Docker Compose

- **Decisão:** o Nginx é a única porta exposta (8080) e roteia por prefixo (`/vendas/`, `/catalogo/`...) para os serviços. Serviços, bancos e Redis ficam só na rede interna. As rotas internas do Catálogo (`/catalogo/interno/`) são bloqueadas no gateway. O Compose usa `healthcheck` e `depends_on: service_healthy` para subir na ordem certa.
- **Ganho:** um só endereço e uma só superfície exposta; um serviço parado derruba só a própria rota.
- **Custo:** o Nginx é um ponto único de falha, e não há HTTPS neste ambiente.
- **Descartado:** expor a porta de cada serviço e usar Traefik ou Kong (mais do que o projeto precisa).

## Outras decisões

| ADR | Decisão |
|---|---|
| 004 | TypeScript no back-end e no front-end |
| 005 | O JWT é assinado com RS256: só o Identidade tem a chave privada, os outros só verificam |
| 006 | As permissões do usuário vão dentro do JWT |
| 007 | O refresh token fica no Redis e é de uso único |
| 008 | Os eventos seguem um envelope único e versionado (`id`, `tipo`, `versao`, `origem`, `ocorridoEm`, `dados`) |
| 009 | O Vendas reserva o estoque no Catálogo por HTTP, "tudo ou nada" e sem duplicar; o pedido só fica visível depois da reserva |
| 010 | Chamadas entre serviços sem usuário usam um token de serviço |
| 011 | Pagamento pelo Checkout Pro do Mercado Pago. O webhook não é confiável: o serviço consulta o Mercado Pago e só confirma se estiver aprovado e com o valor igual |
| 012 | Cada serviço expõe as próprias métricas em `/metrics` |
| 013 | As imagens de produto ficam num volume em disco e são servidas pelo Catálogo |
| 014 | Deploy com imagens versionadas por tag e rollback por tag, sem blue/green (ver [entrega.md](entrega.md)) |
| 015 | Só os repositories falam com o banco; um script confere isso no CI |
