# Testes ponta a ponta

Exercitam os serviços **de verdade** (banco, Redis, SMTP, gateway Nginx), diferente dos testes unitários de cada serviço,
que usam mocks. Sem dependências: só Node 20+ e Docker.

```bash
docker compose up -d --build     # ambiente no ar
node e2e/executar.js             # tudo (Catálogo, Vendas e Pagamento)
node e2e/executar.js vendas      # só um cenário (catalogo | vendas | pagamento)
```
Código de saída `0` = tudo passou. Leva alguns minutos: espera o e-mail sair (o `EMAIL_INTERVALO_MS` do desenvolvimento é de
10,5 s por e-mail) e a rotina que expira pedidos sem pagamento (roda a cada minuto).

## O que cobrem
- **Catálogo:** cadastro, filtros e paginação, cache no Redis, baixa/reposição de estoque (inclusive 6 baixas simultâneas),
  upload de imagem (tipo, conteúdo, tamanho, substituição, caminho malicioso), visão do painel com itens inativos e resumo.
- **Vendas:** carrinho, pedido com Identidade e Catálogo reais, acesso por dono/permissão, status, cancelamento com
  devolução de estoque, disputa pela última unidade, **expiração de pedido sem pagamento** e e-mail do `pedido.criado`.
- **Pagamento:** validações, pagamento com o gateway simulado, `sincronizar`, webhook, e-mails dos dois eventos, painel de
  vendas (receita e mais vendidos) e devolução de estoque ao cancelar um pedido pago.

## Pré-requisitos do ambiente
- `GATEWAY_PAGAMENTO=simulado` no `pagamento-service/.env` (a compra real com Mercado Pago é manual: veja o README do Pagamento).
- Notificação com SMTP funcionando (o Mailtrap serve) e `PEDIDO_EXPIRA_MINUTOS` do Vendas maior que 0.
- Login do Identidade: a suíte faz alguns logins seguidos. Se bater no limite (429), suba `RATE_LIMIT_LOGIN_MAX` e
  `RATE_LIMIT_CADASTRO_MAX` no `identidade-service/.env` (só desenvolvimento) ou espere 15 minutos.

## Efeitos colaterais
Cria categorias, marcas, produtos, usuários (`e2e-<id>-…@mce.test`), pedidos e pagamentos de teste, todos com o sufixo da
execução no nome. Nada é apagado ao final. Aponte para outro endereço com `E2E_BASE_URL`.
