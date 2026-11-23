# MCEcelulares — back-end em microsserviços

E-commerce de celulares com 5 microsserviços Node/TypeScript (Express + Sequelize + MySQL), Redis para cache e
mensageria, e um gateway Nginx. Cada serviço tem o próprio banco e o próprio contrato (OpenAPI).

| Serviço | Porta | Pelo gateway | Responsabilidade |
|---|---|---|---|
| Identidade | 3001 | `/identidade/` | Usuários, login (JWT RS256), endereços, cargos e permissões |
| Catálogo | 3002 | `/catalogo/` | Produtos, categorias, marcas, busca, estoque, imagens |
| Vendas | 3003 | `/vendas/` | Carrinho, pedidos, status, painel de vendas |
| Pagamento | 3004 | `/pagamento/` | Pagamento via Mercado Pago (Checkout Pro) e webhook |
| Notificação | 3005 | `/notificacao/` | E-mails transacionais (por eventos) e formulário de contato |

O gateway fica em **http://localhost:8080**. Ex.: `http://localhost:8080/catalogo/produtos`.

## Pré-requisitos
- Docker Desktop (Compose v2) e Node.js 20+ (para rodar testes e scripts fora dos containers).

## Subindo o ambiente (primeira vez)

**1. Senhas dos bancos.** Copie `.env.example` para `.env` na raiz e troque as senhas `troque_esta_senha_*`.

**2. Chaves JWT.** O Identidade assina os tokens; os outros serviços só validam (ADR-005).
```bash
cd keys
node generate-jwt-keys.js
```
O script imprime `JWT_PRIVATE_KEY=...` (vai **só** no `identidade-service/.env`) e `JWT_PUBLIC_KEY=...` (vai no `.env` dos outros 4).
Não rode de novo depois: um par novo invalida o anterior. Os `.pem` ficam em `keys/` e são ignorados pelo git.

**3. `.env` de cada serviço.** Em cada pasta `*-service/`, copie `.env.example` para `.env` e preencha:

| Variável | Onde | De onde vem |
|---|---|---|
| `JWT_PUBLIC_KEY` | catálogo, vendas, pagamento, notificação | Passo 2 |
| `JWT_PRIVATE_KEY` | identidade | Passo 2 (com quebras de linha reais, entre aspas) |
| `DB_PASSWORD` | todos | O `*_DB_PASSWORD` correspondente do `.env` da raiz |
| `ADMIN_EMAIL`, `ADMIN_SENHA` | identidade | Você escolhe; o seed cria o primeiro administrador |
| `SERVICE_TOKEN` | catálogo e vendas | Um segredo aleatório novo em cada um (ex.: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`) |
| `CATALOGO_SERVICE_TOKEN` | vendas | **O mesmo valor** do `SERVICE_TOKEN` do catálogo |
| `VENDAS_SERVICE_TOKEN` | pagamento | **O mesmo valor** do `SERVICE_TOKEN` do vendas |
| `METRICS_TOKEN` | todos os 5 | Um valor aleatório, o mesmo nos cinco (use o comando acima). Libera `GET /<serviço>/metrics` com `Authorization: Bearer <valor>`; vazio desliga o endpoint (404). Necessário para medir os SLOs (`node scripts/medir-slos.js`) |
| `SMTP_*`, `EMAIL_CONTATO_LOJA`, `EMAIL_REMETENTE` | notificação | Seu provedor de e-mail. Em desenvolvimento, use o Mailpit do compose: `SMTP_HOST=mailpit`, `SMTP_PORT=1025` (veja o passo 4) |
| `GATEWAY_PAGAMENTO` | pagamento | `simulado` para desenvolver sem Mercado Pago; `mercadopago` para valer |

Os `.env` **não vão para o git**. Detalhes de cada variável estão comentados nos `.env.example`.

**4. Subir.**
```bash
docker compose up -d --build                 # servidor ou ambiente sem e-mail de teste
docker compose --profile dev up -d --build   # desenvolvimento: também sobe o Mailpit (caixa de e-mails em http://127.0.0.1:8025)
```
Os bancos são criados vazios e cada serviço roda as próprias migrations ao iniciar (o Identidade também faz o seed).

**5. Conferir.**
```bash
curl http://localhost:8080/identidade/health
curl http://localhost:8080/catalogo/health
curl http://localhost:8080/vendas/health
curl http://localhost:8080/pagamento/health
curl http://localhost:8080/notificacao/health
```
`"status":"ok"` em todos. `"degradado"` significa Redis fora do ar (o serviço funciona, mas sem cache/eventos).

## Gateway (Nginx) e Docker Compose
O único ponto de entrada é o Nginx, na porta **8080**; os serviços, os bancos e o Redis ficam só na rede interna `backend` e não publicam porta no host. A única exceção, apenas em desenvolvimento (`--profile dev`), é a caixa de e-mails do Mailpit em `127.0.0.1:8025`.

| Rota no gateway | Destino | Observação |
|---|---|---|
| `/identidade/`, `/catalogo/`, `/vendas/`, `/pagamento/`, `/notificacao/` | cada serviço (`:3001` a `:3005`) | o prefixo é removido antes de chegar ao serviço |
| `/catalogo/interno/…` | bloqueada (404) | rotas internas do Vendas; vale para qualquer caixa de letras e variantes codificadas (ADR-009/010) |
| `/docs/` | Swagger UI | contratos de `apis/` |
| `/health` | resposta do próprio Nginx | usada no healthcheck do container |

Acesso aos bancos e ao Redis, por dentro dos containers:
```bash
docker exec -it redis redis-cli
docker exec -it catalogo_db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'   # idem para identidade_db, vendas_db, ...
```
Conferir o gateway no ambiente que está no ar: `bash scripts/verificar-gateway.sh` (acrescente `--isolamento` para parar o Vendas por alguns segundos e conferir que só ele sai do ar). Detalhes das decisões no [ADR-018](documentacao-arquiteturial/ADRs/ADR-018-gateway-nginx.md) e roteiro em [demonstracao/gateway-nginx.md](demonstracao/gateway-nginx.md).

## Testes
Os testes de **Vendas, Pagamento e Notificação** usam mocks e rodam direto na sua máquina (um serviço por vez):
```bash
cd vendas-service && npm ci && npx tsc --noEmit && npx jest --runInBand
```
Os de **Identidade e Catálogo** usam um MySQL de verdade (criam e apagam dados de teste no banco do ambiente). O host do banco (`identidade_db`, `catalogo_db`) só existe dentro da rede do Docker, então rode-os num container dessa rede, com o ambiente no ar (`docker compose up -d`):
```bash
# Linux/macOS (no Git Bash do Windows, use MSYS_NO_PATHCONV=1 e "$(pwd -W)" no lugar de "$PWD")
docker run --rm --network mce-celulares_backend -v "$PWD:/src:ro" node:20 sh -c '
  mkdir /app && cd /src/catalogo-service && tar cf - --exclude=node_modules --exclude=dist . | tar xf - -C /app &&
  cd /app && npm ci && npx tsc --noEmit && npx jest --runInBand'
```
(troque `catalogo-service` por `identidade-service` para o outro). Rodar esses dois no host, sem a rede do Docker, falha com `ENOTFOUND`.

Ponta a ponta, contra o ambiente que está no ar:
```bash
node e2e/executar.js
```
Antes, suba os limites de login e cadastro no `identidade-service/.env` (instruções em [e2e/README.md](e2e/README.md)). O [CI](.github/workflows/ci.yml) roda tipagem e testes dos 5 serviços (com um MySQL próprio), a validação dos contratos contra as rotas, a regra de camadas (`python3 scripts/verificar-camadas.py`), `nginx -t` e o build das imagens.

## Arquitetura em camadas
Cada serviço segue `routes → controllers → services → repositories → models`; só os repositories falam com o Sequelize (ADR-015). Mapa completo: [arquitetura-em-camadas.md](documentacao-arquiteturial/arquitetura-em-camadas.md). Ao criar uma entidade nova, crie o repository dela e rode `python3 scripts/verificar-camadas.py`.

## Documentação da API
Com o ambiente no ar, o Swagger UI com os contratos dos 5 serviços fica em `http://localhost:8080/docs/` (seletor no topo; carrega a interface de um CDN, então precisa de internet). Os contratos ficam em `apis/` e o CI falha se uma rota do código estiver sem documentação (`python3 scripts/verificar-contratos.py`).

## Deploy e rollback
Cada tag `v*` publica as imagens no GitHub Container Registry (`cd.yml`). No servidor: `REGISTRY_OWNER=<dono> ./scripts/deploy.sh v1.0.0` aplica a versão, confere a saúde dos 5 serviços e volta sozinho para a anterior se algo falhar; `./scripts/rollback.sh [tag]` volta manualmente. Detalhes e limites (migrations!) em [ADR-014](documentacao-arquiteturial/ADRs/ADR-014-cd-com-rollback-por-tag.md). Em incidente, siga o [runbook](operacao/runbook-incidentes.md).

## Mercado Pago
O pagamento real usa o Checkout Pro. O roteiro de teste (contas, cartões, webhook) está em
[pagamento-service/README.md](pagamento-service/README.md). Sem token configurado, `POST /pagamentos` responde 503 de propósito.

## Indo para produção — o que mudar
- `GATEWAY_PAGAMENTO=mercadopago` com o token de **produção**, `PUBLIC_BASE_URL` (webhook) e `FRONTEND_URL` reais.
- `EMAIL_INTERVALO_MS=0` e um SMTP de verdade no Notificação (o `10500` do desenvolvimento serve só para o plano gratuito do Mailtrap).
- `CORS_ORIGINS` com os domínios do front em cada serviço (vazio libera qualquer origem).
- Segredos novos e longos: senhas dos bancos, `SERVICE_TOKEN`s, `METRICS_TOKEN`, par de chaves JWT.
- `JWT_EXPIRES_IN=15m` no Identidade (ADR-006).
- HTTPS no Nginx: **não está configurado** neste repositório (RNF06); em produção termine o TLS no Nginx ou no balanceador da hospedagem.
- Backup dos volumes MySQL e do volume `catalogo_uploads` (imagens).

## Problemas comuns
- **429 no login do Identidade:** o limite é 10 logins por 15 min por IP. Em desenvolvimento, suba `RATE_LIMIT_LOGIN_MAX` no `identidade-service/.env`.
- **`npm ci` falha no build do Docker ("Missing ... from lock file"):** o `package-lock.json` foi gerado por outra versão do npm. Gere-o com o npm do container: `docker run --rm -v "$PWD:/app" node:20-alpine sh -c "mkdir /tmp/n && cp /app/package.json /tmp/n/ && cd /tmp/n && npm install --package-lock-only --ignore-scripts && cp package-lock.json /app/"` (dentro da pasta do serviço).
- **Serviço reinicia em loop:** `docker compose logs <serviço>`; costuma ser `.env` faltando ou senha do banco diferente da do `.env` da raiz.
- **Mudou um `.env`:** `docker compose up -d --force-recreate <serviço>` (o `restart` não relê o arquivo).

## Mapa do repositório
- `identidade-service/`, `catalogo-service/`, `vendas-service/`, `pagamento-service/`, `notificacao-service/` — os serviços
- `apis/` — contrato OpenAPI de cada serviço
- `documentacao-arquiteturial/` — C4 (contexto, containers e [camadas de um serviço](documentacao-arquiteturial/arquitetura-em-camadas.md)), diagramas, o [guia de boas práticas](documentacao-arquiteturial/boas-praticas.md) (DTOs, erros, logs e correlação), o [pipeline de CI/CD](documentacao-arquiteturial/pipeline-ci-cd.md) e os ADRs (decisões 001 a 018)
- `ddd/` — Context Map e Bounded Contexts
- `demonstracao/` — roteiros para demonstrar o [cache com Redis](demonstracao/cache-redis.md), a [mensageria com Pub/Sub](demonstracao/mensageria-pubsub.md), o [gateway Nginx](demonstracao/gateway-nginx.md), o [rastreio de um fluxo pelos logs](demonstracao/rastreio-de-fluxo.md), os [SLOs medidos e a resiliência em ação](demonstracao/resiliencia-e-slos.md) e o [deploy e rollback ensaiados](demonstracao/deploy-e-rollback.md)
- `requisitos/` — requisitos funcionais e não funcionais
- `qualidade-observabilidade/` — SLOs e SLIs, estratégias de resiliência e plano de observabilidade
- `operacao/` — runbook de incidentes
- `scripts/` — deploy, rollback, verificação dos contratos, das camadas e do gateway, `seguir-id.sh` (segue um id de correlação nos logs dos 5 serviços) e `medir-slos.js` (mede os SLOs a partir de `/metrics` e do log do Nginx)
- `tech-forge/` — Cynefin e ciclo de vida
- `infra/nginx/` — configuração do gateway (`nginx.conf` e `proxy-headers.conf`) · `infra/swagger/` — página do Swagger UI
- `keys/` — gerador do par de chaves JWT
- `e2e/` — testes ponta a ponta
