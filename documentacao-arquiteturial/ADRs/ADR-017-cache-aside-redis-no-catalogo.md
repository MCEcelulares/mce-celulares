# ADR-017: Cache-aside com Redis no Catálogo (TTL e invalidação por versão)

**Status:** Aceito

## Contexto
O Catálogo é o serviço mais lido do sistema: home, listagem com filtros, detalhe de produto e, a cada pedido, a consulta de preço e estoque feita pelo Vendas (`GET /produtos/:id`). As leituras repetem as mesmas consultas ao MySQL, e o requisito de qualidade 1 ([quality-scenarios-slo.md](../../qualidade-observabilidade/quality-scenarios-slo.md)) pede p95 < 300 ms na listagem com cache. O cache precisa ser **distribuído** (o Redis já existe no ambiente, [ADR-003](ADR-003-comunicacao-sincrona-assincrona.md)), para continuar válido se o serviço rodar em mais de uma réplica.

## Decisão
Usar o padrão **cache-aside** no `catalogo-service`, implementado em `services/cacheService.ts`:

1. **Leitura (`obterOuCarregar`):** consulta o Redis; no *hit* devolve o valor; no *miss* carrega do MySQL e grava no Redis com **TTL** (`CACHE_TTL_SEGUNDOS`, padrão 300 s).
2. **O que é cacheado:** listagem de produtos (chave por hash SHA-1 dos filtros), detalhe do produto, destaques, recentes, listas de categorias e de marcas.
3. **O que não é cacheado:** a visão do gestor (`incluirInativos=true`), as rotas internas do Vendas (reserva e consulta em lote) e qualquer escrita.
4. **Invalidação por versão:** as chaves têm o formato `catalogo:v<versão>:<chave>`. Toda escrita que altera o catálogo (produto, categoria, marca, estoque, imagem, reserva e devolução) executa `INCR catalogo:versao`. As chaves da versão anterior deixam de ser lidas e expiram sozinhas pelo TTL, sem `SCAN` nem `DEL` em massa.
5. **Degradação graciosa:** se o Redis falhar, a leitura cai direto no banco e a invalidação é só registrada em log; a requisição nunca falha por causa do cache. O cliente Redis usa timeout de comando de 2 s, uma tentativa e fila offline desligada, para não segurar a requisição.
6. **Observabilidade:** o contador `catalogo_cache_total{resultado="hit|miss|erro"}` em `/metrics`.

## Consequências
- **Positivas:** menos carga no MySQL nas leituras repetidas; leituras do Vendas na criação de pedido deixam de ir ao banco quando o produto já está em cache; invalidação em O(1), sem varrer chaves; o cache nunca derruba a API.
- **Frescor garantido pela invalidação, não pelo TTL:** uma alteração no catálogo aparece na leitura seguinte, porque a versão sobe antes da resposta. O TTL é a rede de segurança.
- **Negativas e limites:**
  - Se o Redis estiver fora no momento da escrita, a invalidação não acontece; nesse caso, o cache também está indisponível, e o risco de dado antigo vale só até o TTL (5 min) depois que o Redis voltar.
  - Chaves da versão anterior ficam órfãs até o TTL, ocupando memória por até 5 minutos.
  - Não há proteção contra *cache stampede* (muitos *misses* simultâneos na mesma chave logo após uma invalidação); aceitável na escala do projeto.
  - Toda alteração invalida **todo** o catálogo em cache, não só o item alterado. É simples e seguro; só deixaria de ser adequado se as escritas fossem muito frequentes.
  - O estoque lido pelo Vendas na criação do pedido pode vir do cache. A decisão final de venda não depende dele: a reserva de estoque é atômica e idempotente no Catálogo ([ADR-009](ADR-009-vendas-catalogo-estoque-http.md)).

## Alternativas consideradas
- **Sem cache:** mais simples, mas toda leitura repetida vai ao MySQL e não cumpre o SLO de listagem.
- **Só TTL, sem invalidação:** o cliente veria preço e estoque antigos por até 5 minutos após uma edição. Descartado.
- **Invalidar chave por chave (`DEL` ou `SCAN`):** as listagens têm chaves derivadas de filtros, então não dá para saber quais apagar sem varrer o Redis. A versão no prefixo evita isso.
- **Write-through / write-behind:** a escrita atualizaria o cache junto com o banco. Complica o código e não resolve as listagens filtradas.
- **Cache em memória do processo:** mais rápido, mas não é distribuído: cada réplica teria o seu e a invalidação em uma não alcançaria as outras.
