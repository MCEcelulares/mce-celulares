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
| `SMTP_*`, `EMAIL_CONTATO_LOJA`, `EMAIL_REMETENTE` | notificação | Seu provedor de e-mail (em desenvolvimento, uma caixa de teste como o Mailtrap) |
| `GATEWAY_PAGAMENTO` | pagamento | `simulado` para desenvolver sem Mercado Pago; `mercadopago` para valer |

Os `.env` **não vão para o git**. Detalhes de cada variável estão comentados nos `.env.example`.

**4. Subir.**
```bash
docker compose up -d --build
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

## Testes
```bash
# unitários (não precisam de Docker), um por serviço
cd catalogo-service && npm ci && npx tsc --noEmit && npx jest --runInBand
# ponta a ponta, contra o ambiente que está no ar
node e2e/executar.js
```
Veja [e2e/README.md](e2e/README.md) e o [CI](.github/workflows/ci.yml), que roda tipagem, testes, validação dos contratos e o build das imagens.

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
- `documentacao-arquiteturial/` — C4 (contexto e containers), diagramas e os ADRs (decisões 001 a 013)
- `ddd/` — Context Map e Bounded Contexts
- `requisitos/` — requisitos funcionais e não funcionais
- `qualidade-observabilidade/` — cenários de qualidade e SLOs
- `tech-forge/` — Cynefin e ciclo de vida
- `infra/nginx/` — configuração do gateway
- `keys/` — gerador do par de chaves JWT
- `e2e/` — testes ponta a ponta
