# Runbook de incidentes — MCEcelulares

Para quem está de plantão: o que olhar, em que ordem, e o que fazer em cada situação conhecida.
Complementa os SLOs (`qualidade-observabilidade/quality-scenarios-slo.md`) e os ADRs 003, 009, 011 e 014.

## 0. O sistema todo caiu? (servidor reiniciou, Docker parou, nada responde)
1. **O Docker está de pé?** `docker info`. Se não, inicie o Docker (ou o servidor) primeiro.
2. **O que está parado?** `docker compose ps -a`.
3. **Subir tudo.** `docker compose up -d` (em desenvolvimento, `docker compose --profile dev up -d` também sobe o Mailpit). A ordem é resolvida pelo `depends_on`: bancos e Redis primeiro, depois os serviços. O Nginx não espera por eles (ele resolve os nomes na hora de cada requisição, ADR-018), então durante a subida as rotas dos serviços que ainda não estão prontos respondem 502 ou 504. Em servidor com imagens versionadas, reaplique a versão em uso: `REGISTRY_OWNER=<dono> ./scripts/deploy.sh $(cat .deploy/tag-atual)`.
4. **Esperar ficar saudável.** `docker compose ps` até todos mostrarem `healthy` (os serviços levam até ~30 s). Depois: `bash scripts/verificar-gateway.sh` (roteamento dos 5 serviços, bloqueio de `/catalogo/interno`, `/docs`, limites).
5. **Teste de fumaça (só em ambiente de teste).** `node demonstracao/fluxo-pedido.js` cria um pedido e um pagamento de teste e deve terminar com `201` e `APROVADO`. Em produção, use só os `curl .../health` da seção 1.
6. **O que se perdeu no meio do caminho:** o cache e os refresh tokens (o Redis não tem volume; os usuários precisam entrar de novo); os eventos publicados durante a queda (e-mails desse período não são gerados depois, seção 3.4); os pedidos sem pagamento que passaram de 30 min expiram sozinhos e devolvem o estoque (seção 3.6); e-mails em `FALHA` são reenviados sozinhos (seção 3.8). Os dados dos bancos ficam nos volumes `<serviço>_db_data`: **nunca** rode `docker compose down -v`.
7. **Não subiu?** Serviço em loop: seção 3.2. Banco fora: seção 3.3. Se a causa for a versão recém-implantada, vá para o rollback (seção 3.9).

## 1. Primeiros 5 minutos (qualquer incidente)
1. **Qual o tamanho?** `curl -s localhost:8080/health` (gateway) e, por serviço, `curl -s localhost:8080/<serviço>/health` (`identidade`, `catalogo`, `vendas`, `pagamento`, `notificacao`).
   - `"status":"ok"` normal · `"degradado"` Redis fora (serviço funciona sem cache e sem eventos) · HTTP 503 `"indisponivel"` banco fora.
2. **Quem está de pé?** `docker compose ps` (reinício em loop aparece como `Restarting`).
3. **O que o serviço diz?** `docker compose logs --tail=200 <serviço>` (JSON; filtre por `"level":50` para erros). Toda requisição tem `idCorrelacao`: o cliente recebe o mesmo valor no header `x-correlation-id`, e o Vendas e o Pagamento o repassam às chamadas entre serviços e aos eventos. Para seguir uma compra de ponta a ponta, rode `bash scripts/seguir-id.sh <x-correlation-id>`: ele junta, em ordem de tempo, os logs de Identidade, Catálogo, Vendas, Pagamento e Notificação (inclusive o evento publicado e o e-mail enviado). A última linha mostra até onde o fluxo chegou.
4. **Métricas:** `curl -s -H "Authorization: Bearer $METRICS_TOKEN" localhost:8080/<serviço>/metrics`. Interessam `http_requisicoes_total` (picos de 5xx), `http_requisicao_duracao_segundos` e `<serviço>_eventos_total{evento="..."}` (veja a tabela da seção 4). `/metrics` responde **404 se o `METRICS_TOKEN` do serviço estiver vazio** (o endpoint fica desligado) e 401 com token errado. Para ver se o orçamento de erro está sendo consumido: `node scripts/medir-slos.js` (os 5 SLOs de `qualidade-observabilidade/quality-scenarios-slo.md`; `--zerar` mede só o que vier depois).
5. **Mudou algo recentemente?** Se começou logo depois de um deploy: **vá direto para a seção 3.9 (rollback)** e investigue depois.

## 2. Severidade
| Nível | Exemplo | Meta de reação |
|---|---|---|
| SEV1 | Ninguém consegue comprar (checkout fora), site/gateway fora, pagamento aprovado sem pedido pago | começar em 15 min |
| SEV2 | Um serviço degradado, e-mails atrasados, cache fora | no mesmo dia útil |
| SEV3 | Erro isolado, reserva de estoque presa de um pedido | na semana |

## 3. Situações conhecidas

| Sintoma | Vá para |
|---|---|
| Nada responde, Docker ou servidor reiniciou | seção 0 |
| 502 ou 504 em todas as rotas | 3.1 |
| Um serviço reinicia em loop ou 502/504 só nele | 3.2 |
| `banco: falha`, HTTP 503 | 3.3 |
| `status: degradado` (Redis) | 3.4 |
| Checkout com 503 "... indisponível no momento" | 3.5 |
| Estoque que não volta | 3.6 |
| Pagamento aprovado, pedido ainda `AGUARDANDO_PAGAMENTO` | 3.7 |
| E-mails não saem | 3.8 |
| Problema logo depois de um deploy | 3.9 |
| 429 em muitas requisições | 3.10 |

### 3.1 Gateway fora ou 502/504 em tudo
`docker compose ps nginx` → se parado: `docker compose up -d nginx`. Se subir e dar erro: `docker compose logs nginx` e valide a configuração com `docker compose exec nginx nginx -t`. O container do Nginx tem healthcheck (`docker compose ps` mostra `healthy`), e `bash scripts/verificar-gateway.sh` confere roteamento, bloqueios e limites de uma vez. 502 ou 504 numa rota só significa que aquele serviço está fora (504 se o nome ainda estava no cache de 10 s do resolver; os dois falham em até ~5 s). 502 em um prefixo só (`/catalogo/...`) significa que aquele serviço está fora (seção 3.2).

### 3.2 Um serviço reinicia em loop ou não responde
`docker compose logs --tail=100 <serviço>`. Causas comuns: `.env` faltando ou com senha de banco diferente da do `.env` da raiz; banco ainda subindo. Depois de mudar `.env`: `docker compose up -d --force-recreate <serviço>` (`restart` não relê o arquivo).

### 3.3 Banco de um serviço fora (`banco: falha`, HTTP 503)
`docker compose ps <serviço>_db`; `docker compose logs --tail=100 <serviço>_db`. Subir: `docker compose up -d <serviço>_db`. Os dados ficam no volume `<serviço>_db_data`; **nunca** rode `docker compose down -v` (apaga os volumes). Quando o banco voltar o serviço se recupera sozinho (o `/health` volta a `ok`).

### 3.4 Redis fora (`status: degradado`)
Efeitos: Catálogo lê direto do banco (mais lento); **os eventos `pedido.criado` e `pagamento.confirmado` não são publicados**, então e-mails não saem (métrica `evento_nao_publicado` sobe no Vendas e no Pagamento). Pedidos e pagamentos continuam funcionando. `docker compose up -d redis`; depois, os pedidos criados durante a queda **não geram e-mail retroativo**: avise o suporte se for relevante. O Redis **não tem volume**: recriá-lo (e não só reiniciá-lo) apaga também os refresh tokens, e os usuários precisam entrar de novo. Para testar o Redis sem portas no host: `docker exec redis redis-cli ping` (deve responder `PONG`).

### 3.5 Checkout falhando com 503 ("… indisponível no momento")
1. Descubra **qual** serviço: a mensagem diz (`Catálogo`, `Identidade`, `Vendas`, `Mercado Pago`).
2. Esse serviço está de pé? (seção 3.2/3.3).
3. Olhe as métricas do Vendas/Pagamento: `evento="circuito_aberto"` > 0 significa que o circuit breaker abriu depois de 5 falhas seguidas; ele recusa na hora e **testa de novo sozinho a cada 10 s** (`CIRCUIT_RESET_MS`). Se o serviço voltou, o circuito fecha sozinho (`circuito_fechado`); não é preciso reiniciar nada. Se continuar aberto com o serviço saudável, confira `CATALOGO_SERVICE_URL`/`*_SERVICE_TOKEN` no `.env` do chamador (token errado vira 502 "Não foi possível reservar o estoque"). Antes de o circuito abrir, cada tentativa pode levar 8 a 9 s (retry mais a resolução do nome do serviço parado); depois de aberto, as chamadas são recusadas em milissegundos. Demonstrado em `demonstracao/demo-circuit-breaker.js`.
4. 409 "Estoque insuficiente" e 422 não são incidente: é regra de negócio.

### 3.6 Estoque preso (reserva sem pedido, ou pedido cancelado que não devolveu)
Como o Vendas cria o pedido: grava invisível (`ativo=false`), reserva o estoque no Catálogo e só então torna o pedido visível (ADR-009). Se o Vendas cair no meio, uma rotina recupera sozinha o pedido invisível depois de `PEDIDO_ORFAO_MINUTOS` (padrão 10): devolve a reserva e apaga o pedido (métrica `pedido_orfao_recuperado`). **Não é preciso fazer nada** nesse caso; só espere o prazo.

Intervenção manual só se a métrica `estoque_nao_devolvido` subiu no Vendas: a devolução no **cancelamento ou expiração** falhou mesmo depois de 2 tentativas e **não é repetida sozinha**.
1. Reservas ativas antigas, no banco do Catálogo:
   ```bash
   docker compose exec catalogo_db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT id_pedido, id_produto, quantidade, criado_em FROM reserva_estoque WHERE status=\"ATIVA\" AND criado_em < NOW() - INTERVAL 2 HOUR ORDER BY criado_em"'
   ```
2. Para cada `id_pedido`, veja o pedido no banco do Vendas: `SELECT id_pedido, status, ativo FROM pedido WHERE id_pedido = <id>;`
   - `ativo=1` e `PAGO`, `ENVIADO`, `ENTREGUE` ou `AGUARDANDO_PAGAMENTO` dentro do prazo: a reserva está **correta**, não mexa.
   - `ativo=0`: pedido invisível ainda dentro do prazo da recuperação automática; espere (ou confira se a métrica `pedido_orfao_recuperado` sobe depois).
   - `CANCELADO`, ou **pedido inexistente**: devolva a reserva. As rotas `/interno` não passam pelo gateway, então chame de dentro da rede do Docker, a partir do container do Vendas (ele já tem a URL e o token):
   ```bash
   docker compose exec vendas node -e "fetch(process.env.CATALOGO_SERVICE_URL+'/interno/reservas/<ID>/devolucao',{method:'POST',headers:{Authorization:'Bearer '+process.env.CATALOGO_SERVICE_TOKEN}}).then(async r=>console.log(r.status,await r.text()))"
   ```
   A devolução é idempotente: repetir não soma duas vezes. Resposta esperada: 200 com `"status":"DEVOLVIDA"`.

### 3.7 Pagamento aprovado mas o pedido continua `AGUARDANDO_PAGAMENTO`
1. Métricas do Pagamento: `pagamento_aprovado` subiu? `webhook_ignorado`, `pagamento_pedido_nao_pagavel`, `pagamento_valor_divergente` e `pagamento_a_reembolsar` apontam o motivo.
2. Logs do Pagamento filtrando o `idPedido`. Se o Vendas estava fora, o Mercado Pago **repete a notificação** (o webhook responde 5xx de propósito): normalmente se resolve sozinho quando o Vendas volta. Se o webhook nunca chegou, o plano B é `POST /pagamento/pagamentos/<idPedido>/sincronizar` (autenticado): consulta o Mercado Pago agora e confirma se já foi pago.
3. **Reembolso pendente (ADR-011):** pagamento aprovado depois de o pedido ter sido cancelado/expirado vira o status `REEMBOLSAR`. Liste com `GET /pagamento/pagamentos?status=REEMBOLSAR` (JWT de quem tem `pedidos:listar-todos`); cada item traz o `id_pagamento_gateway` para localizar a transação no painel do Mercado Pago. **O reembolso em si é manual**; registre o caso. `pagamento_valor_divergente` também exige conferência manual.

### 3.8 E-mails não saem
1. Métricas do Notificação: `email_falha`/`contato_falha` subindo → problema de SMTP (credenciais, limite do provedor, `EMAIL_INTERVALO_MS`).
2. Tabela `notificacao_log` (banco do Notificação): `SELECT id_pedido, tipo, status, tentativas, erro FROM notificacao_log WHERE status IN ('FALHA','PENDENTE') ORDER BY criado_em DESC LIMIT 20;`
3. **O reenvio é automático (ADR-008):** a rotina reenvia as notificações em `FALHA` (e as `PENDENTE` presas há mais de 10 minutos) com espera que dobra a cada rodada (2, 4, 8... até 60 min), no máximo `NOTIFICACAO_REENVIO_MAX_TENTATIVAS` rodadas (padrão 5). Depois disso o registro fica em `FALHA` definitiva: corrija a causa (SMTP) e avise o suporte; registros antigos, de antes do reenvio existir, não têm conteúdo guardado e não são reenviados. `evento_duplicado` é normal.
4. Se o Redis esteve fora (seção 3.4), os e-mails desse período não existem: não são falha do SMTP. O mesmo vale se a Notificação estava fora: o log `evento publicado` do Vendas e do Pagamento traz `receptores: 0` quando ninguém estava ouvindo o canal (o Pub/Sub não guarda mensagens). Em desenvolvimento o SMTP é o Mailpit (`docker compose --profile dev up -d`, caixa em http://127.0.0.1:8025).

### 3.9 Deploy ruim → rollback (ADR-014)
- O `deploy.sh` já volta sozinho se a versão nova não ficar saudável; o job do CD fica vermelho.
- Manual, no servidor: `REGISTRY_OWNER=<dono> ./scripts/rollback.sh` (volta para a anterior) ou `./scripts/rollback.sh v1.2.0` (tag específica). Pelo GitHub: *Actions → Rollback → Run workflow*.
- **Atenção às migrations:** o rollback de imagem **não** desfaz migrations. Se a versão ruim rodou uma migration, confirme que a versão anterior continua compatível com o banco (regra do ADR-014). Se a migration foi destrutiva, restaure o backup do volume MySQL do serviço.
- Confira com `curl -s localhost:8080/<serviço>/health` e rode `node e2e/executar.js` quando houver ambiente.
- O deploy recria os 5 serviços (breve indisponibilidade durante a troca). O fluxo foi ensaiado com um registro local, incluindo uma versão com o Catálogo quebrado (rollback automático) e o `rollback.sh` manual: [demonstracao/deploy-e-rollback.md](../demonstracao/deploy-e-rollback.md). O pipeline completo está em [pipeline-ci-cd.md](../documentacao-arquiteturial/pipeline-ci-cd.md).

### 3.10 Muitos 429
É o limite de requisições por IP. No login: 10 por 15 min (`RATE_LIMIT_LOGIN_MAX`). Se for tráfego legítimo atrás de um mesmo IP (rede da loja), suba o limite no `.env` do serviço e `--force-recreate`; se for abuso, mantenha o limite.

## 4. Métricas que importam (`<serviço>_eventos_total{evento=...}`)
| Serviço | Evento | Significa |
|---|---|---|
| Vendas / Pagamento | `circuito_aberto`, `circuito_recusou_chamada`, `circuito_fechado` | circuit breaker do serviço chamado abriu / recusou / voltou |
| Vendas | `estoque_nao_devolvido` | cancelamento/expiração não conseguiu devolver a reserva (seção 3.6) |
| Vendas / Pagamento | `evento_nao_publicado` | Redis fora, evento perdido (seção 3.4) |
| Vendas | `pedido_expirado` | pedido sem pagamento cancelado pelo prazo (normal) |
| Vendas | `pedido_orfao_recuperado` | criação de pedido caiu no meio e a rotina devolveu a reserva e apagou o pedido (seção 3.6) |
| Catálogo | `reserva_estoque_insuficiente` | cliente tentou comprar acima do saldo (normal; pico = estoque acabando) |
| Pagamento | `pagamento_a_reembolsar`, `pagamento_valor_divergente`, `pagamento_pedido_nao_pagavel` | **reembolso/conferência manual** (seção 3.7) |
| Notificação | `email_falha`, `contato_falha` | SMTP com problema (seção 3.8) |
| Identidade | `login_falha`, `refresh_falha` | pico = tentativa de invasão ou erro de front |

## 5. Depois do incidente
Registre em 5 linhas: o que quebrou, desde quando, como foi detectado, o que resolveu, o que muda para não repetir (um teste, um alerta, um ajuste de limite). Se a causa foi um cenário não coberto, acrescente-o em `qualidade-observabilidade/quality-scenarios-slo.md` ou aqui.

## 6. Ensaios de incidente (como testar este runbook)
Cada situação abaixo pode ser provocada de propósito em ambiente de teste, com a saída esperada documentada:

| Situação | Ensaio | Seção |
|---|---|---|
| Redis fora do ar | [cache-redis.md](../demonstracao/cache-redis.md), seção 7 | 3.4 |
| Serviço fora do ar e isolamento no gateway | `bash scripts/verificar-gateway.sh --isolamento` | 3.1, 3.2 |
| Dependência fora do ar, circuit breaker | `node demonstracao/demo-circuit-breaker.js` | 3.5 |
| SMTP fora do ar, reenvio de e-mail | `node demonstracao/demo-reenvio-email.js` | 3.8 |
| Notificação fora do ar, evento perdido (`receptores: 0`) | [mensageria-pubsub.md](../demonstracao/mensageria-pubsub.md), seção 8 | 3.4, 3.8 |
| Versão ruim, rollback automático e manual | [deploy-e-rollback.md](../demonstracao/deploy-e-rollback.md) | 3.9 |
| Orçamento de erro consumido | `node scripts/medir-slos.js` depois de um dos ensaios acima | 1 |
