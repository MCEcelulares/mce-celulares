# MCE Celulares: back-end

Loja online de celulares e eletrônicos, feita com 5 microsserviços em Node/TypeScript (Express, Sequelize, MySQL), Redis para cache e mensagens, e um gateway Nginx.

| Serviço | Pelo gateway | Faz |
|---|---|---|
| Identidade | `/identidade/` | Usuários, login, endereços, cargos e permissões |
| Catálogo | `/catalogo/` | Produtos, categorias, marcas, estoque e imagens |
| Vendas | `/vendas/` | Carrinho, pedidos e painel de vendas |
| Pagamento | `/pagamento/` | Pagamento pelo Mercado Pago |
| Notificação | `/notificacao/` | E-mails de pedido e pagamento |

O gateway fica em **http://localhost:8080** (ex.: `/catalogo/produtos`). A documentação das APIs (Swagger) fica em **http://localhost:8080/docs/**.

## Como rodar

Precisa de Docker Desktop e Node 20+.

1. Na raiz, copie `.env.example` para `.env` e troque as senhas dos bancos.
2. Gere as chaves do login: `cd keys && node generate-jwt-keys.js`. A chave privada vai só no `.env` do Identidade e a pública nos outros 4 serviços. Não rode de novo depois.
3. Em cada `*-service/`, copie `.env.example` para `.env` e preencha (os comentários do arquivo explicam cada campo). O essencial:
   - `DB_PASSWORD` igual ao do `.env` da raiz;
   - `ADMIN_EMAIL` e `ADMIN_SENHA` no Identidade (o primeiro administrador);
   - `SERVICE_TOKEN` no Catálogo e no Vendas, repetido como `CATALOGO_SERVICE_TOKEN` (Vendas) e `VENDAS_SERVICE_TOKEN` (Pagamento);
   - `METRICS_TOKEN` igual nos 5.
4. Suba: `docker compose --profile dev up -d --build` (o perfil `dev` também sobe o Mailpit, a caixa de e-mails de teste em http://127.0.0.1:8025; no `.env` da Notificação use `SMTP_HOST=mailpit` e `SMTP_PORT=1025`).
5. Confira: `curl http://localhost:8080/vendas/health` deve responder `"status":"ok"`.

Mudou um `.env`? Recrie o serviço: `docker compose up -d --force-recreate <serviço>`.

## Testes

- **Por serviço:** `cd vendas-service && npm ci && npx tsc --noEmit && npx jest --runInBand`. Identidade e Catálogo usam um MySQL de verdade, então rodam dentro da rede do Docker.

## Dados de demonstração

```bash
node scripts/popular-catalogo.js    # 8 categorias, 20 marcas e 49 produtos
node scripts/popular-imagens.js     # fotos dos produtos (da Wikipedia/Wikimedia, só para demonstração)
```

Para apagar tudo e recomeçar: pare os containers, apague os volumes (`docker compose down -v`), suba de novo e rode os dois scripts.

## Pagamento (Mercado Pago)

- `GATEWAY_PAGAMENTO=simulado`: aprova na hora, sem cobrar (desenvolvimento e testes).
- `GATEWAY_PAGAMENTO=mercadopago`: usa o Checkout Pro com o token do **vendedor de teste** (`MERCADOPAGO_ACCESS_TOKEN`). `npm run mp:verificar` (em `pagamento-service/`) confere o token.
- Em `localhost` o Mercado Pago **não volta para a loja nem envia webhook**. Depois de pagar, clique em **Já paguei**: o serviço consulta o Mercado Pago e confirma o pedido.
- Pague em janela anônima com o **comprador de teste** (cartão `5480 8328 0103 3311`, validade `11/30`, CVV `123`, titular `APRO`, CPF `12345678909`). Com uma conta real o Mercado Pago recusa.

## Como o código é organizado

Cada serviço segue as mesmas camadas: `routes → controllers → services → repositories → models`. Só os repositories falam com o banco (o CI confere). A entrada é validada com Zod, os erros saem em JSON (`{ "erro": "..." }`) por um middleware único, e os logs são estruturados com um `idCorrelacao` que acompanha a requisição entre os serviços.

## Documentação

- [Arquitetura (C4)](docs/arquitetura.md)
- [DDD: contextos e agregados](docs/ddd.md)
- [Decisões (ADRs)](documentacao-arquiteturial/ADRs/)
- [Qualidade: SLOs, resiliência e observabilidade](docs/qualidade.md)
- [Entrega: pipeline, deploy e runbook](docs/entrega.md)
- [Gestão do projeto (Jira, Cynefin, ciclo de vida)](tech-forge/)
- Contratos das APIs: [`apis/`](apis/)
