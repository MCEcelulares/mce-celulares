# ADR-018: Nginx como único ponto de entrada (proxy reverso) e orquestração com Docker Compose

**Status:** Aceito

## Contexto
O sistema tem 5 microsserviços, 5 bancos MySQL e um Redis ([ADR-001](ADR-001-microsservicos-reais.md), [ADR-002](ADR-002-banco-por-servico.md)). O cliente (frontend) precisa de um endereço único, e os serviços não devem ser alcançáveis diretamente de fora. Parte das rotas (reserva de estoque do Catálogo) só deve ser usada entre serviços ([ADR-009](ADR-009-vendas-catalogo-estoque-http.md), [ADR-010](ADR-010-token-de-servico-entre-servicos.md)).

## Decisão

**1. Gateway único.** Um container Nginx publica a porta 8080 e roteia por prefixo (`/identidade/`, `/catalogo/`, `/vendas/`, `/pagamento/`, `/notificacao/`) para o serviço correspondente, removendo o prefixo (`rewrite ... break`). Também serve o Swagger UI em `/docs/` e responde `/health`.

**2. Só o Nginx publica porta.** Serviços, bancos e Redis ficam na rede interna `backend`. Bancos e Redis são acessados por `docker exec`. A única exceção, só em desenvolvimento (profile `dev`), é a caixa de e-mails do Mailpit em `127.0.0.1:8025`.

**3. Resolução de nomes em tempo de requisição.** `resolver 127.0.0.11 valid=10s` e `proxy_pass` com variável (`set $upstream_x http://servico:porta`). O Nginx **não** depende (`depends_on`) dos serviços para subir e não falha se um deles não existe: só a rota daquele serviço responde erro. Com o `vendas` parado, o gateway devolve 502 (nome já fora do DNS) ou 504 (nome ainda no cache de 10 s do resolver; desiste em 5 s), e as demais rotas seguem normais.

**4. Rotas internas bloqueadas.** `location ~* ^/catalogo/interno(/|$) { return 404; }`, declarada antes de `/catalogo/` (o regex tem precedência sobre o prefixo). É **sem diferenciar maiúsculas** porque o Express não diferencia: com `~` (diferencia), `/catalogo/Interno/...` passava pelo gateway e só o token de serviço barrava. O Nginx já decodifica `%xx` e normaliza `//`, `./` e `../` antes de casar o `location`. O serviço continua exigindo o token de serviço (defesa em profundidade).

**5. Cabeçalhos e timeouts comuns** em `infra/nginx/proxy-headers.conf` (incluído em cada `location`): HTTP/1.1, `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`, `proxy_connect_timeout 5s`, `proxy_send_timeout` e `proxy_read_timeout` de 60 s. Os serviços usam `trust proxy = 1`, então enxergam o IP real do cliente (último valor de `X-Forwarded-For`, o que o Nginx acrescenta; um valor forjado pelo cliente vem antes e é ignorado).

**6. Limites e discrição.** `client_max_body_size 3m` só no Catálogo (upload de imagem de até 2 MB); o padrão de 1 MB vale nos demais. `server_tokens off` esconde a versão do Nginx.

**7. Compose.** Nome fixo do projeto (`name: mce-celulares`, para a rede e os volumes não dependerem da pasta); `depends_on` com `condition: service_healthy` entre serviços, bancos e Redis; healthchecks nos bancos, no Redis, no Nginx e em cada serviço (Dockerfile); `restart: unless-stopped`; volumes nomeados para os bancos e para os uploads do Catálogo; configurações montadas como somente leitura. Em servidor, `docker-compose.deploy.yml` troca `build:` pela imagem publicada da tag ([ADR-014](ADR-014-cd-com-rollback-por-tag.md)).

## Consequências
- **Positivas:** um só endereço e uma só superfície exposta; falha de um serviço fica isolada (erro só na rota dele); a regra de bloqueio e o roteamento são verificáveis por script (`scripts/verificar-gateway.sh`, também coberto pelo e2e do Catálogo) e a sintaxe pelo CI (`nginx -t`).
- **Negativas e limites:**
  - Sem `depends_on`, `docker compose up` pode deixar o gateway no ar antes dos serviços; as rotas respondem 502/504 até eles ficarem saudáveis.
  - O cache do resolver (10 s) faz o primeiro erro depois de uma queda ser 504 em vez de 502. Ambos falham em até ~5 s.
  - O Nginx é um ponto único de falha; em produção seriam necessárias réplicas atrás de um balanceador (fora do escopo).
  - Sem HTTPS nem *rate limit* no gateway: o TLS ficaria num balanceador/CDN à frente, e o limite de taxa já existe em cada serviço.
  - Não há blue/green (decisão no ADR-014).
  - O Mailpit publica uma porta no host em desenvolvimento, uma exceção consciente à regra 2.

## Alternativas consideradas
- **Expor a porta de cada serviço** e o frontend chamar direto: sem ponto único, sem bloqueio de rotas internas, mais superfície e CORS por serviço. Descartado.
- **`upstream` fixo + `depends_on`:** o Nginx só sobe com todos os serviços e falha ao iniciar se um nome não resolve. Descartado em favor do `resolver` dinâmico.
- **Traefik/Kong (gateway com descoberta e plugins):** mais recursos que o necessário para 5 serviços fixos (descoberta dinâmica, plugins de autenticação); o Nginx basta para roteamento por prefixo e é uma imagem oficial leve.
- **Bloquear a rota interna só no serviço:** o token de serviço já faz isso, mas manter o bloqueio no gateway evita que a rota sequer seja alcançável de fora.
