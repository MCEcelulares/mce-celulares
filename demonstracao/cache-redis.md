# Demonstração: cache-aside com Redis (Catálogo)

Mostra, em sequência, **miss → hit → alteração (invalidação) → miss com dado novo → expiração por TTL → Redis fora do ar**. Decisão e detalhes em [ADR-017](../documentacao-arquiteturial/ADRs/ADR-017-cache-aside-redis-no-catalogo.md); código em `catalogo-service/src/services/cacheService.ts`.

Os comandos usam `curl` e `docker exec` num terminal bash (Git Bash no Windows). Os blocos "Saída esperada" descrevem o que deve aparecer; troque pelas saídas reais ao gravar a evidência.

## 0. Pré-requisitos

- Ambiente no ar: `docker compose up -d --build` (veja o README).
- `METRICS_TOKEN` preenchido em `catalogo-service/.env` (sem ele `/metrics` responde 404). Use o mesmo valor abaixo.
- Credenciais do administrador: `ADMIN_EMAIL` e `ADMIN_SENHA` do `identidade-service/.env`.

```bash
export GW=http://localhost:8080
export METRICS_TOKEN=<valor do catalogo-service/.env>

# token do administrador
export TOKEN=$(curl -s -X POST $GW/identidade/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<ADMIN_EMAIL>","senha":"<ADMIN_SENHA>"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

# escolha um produto ativo qualquer
curl -s "$GW/catalogo/produtos?limite=3"
export ID=<id_produto de um dos resultados>

# atalhos
metricas() { curl -s -H "Authorization: Bearer $METRICS_TOKEN" $GW/catalogo/metrics | grep '^catalogo_cache_total'; }
tempo()    { curl -s -o /dev/null -w "HTTP %{http_code} em %{time_total}s\n" $GW/catalogo/produtos/$ID; }
```

## 1. Estado inicial

```bash
docker exec redis redis-cli --scan --pattern 'catalogo:*'
docker exec redis redis-cli GET catalogo:versao
metricas
```

Anote o valor de `catalogo:versao` (vazio equivale à versão 0; num ambiente já usado ele é um número maior) e os contadores. Os contadores recomeçam do zero sempre que o container `catalogo` é recriado, e só aparecem na saída depois da primeira consulta.

## 2. Primeira leitura: miss, o dado vai para o cache com TTL

```bash
tempo
docker exec redis redis-cli --scan --pattern 'catalogo:*'
docker exec redis redis-cli TTL "catalogo:v<versão>:produtos:$ID"
metricas
```

**Saída esperada:**
- A chave `catalogo:v<versão>:produtos:<ID>` passa a existir.
- `TTL` devolve um valor próximo de 300 (`CACHE_TTL_SEGUNDOS`).
- `catalogo_cache_total{resultado="miss"}` aumenta em 1.

## 3. Segunda leitura: hit

```bash
tempo
metricas
```

**Saída esperada:** `catalogo_cache_total{resultado="hit"}` aumenta em 1, o `miss` não muda, e o tempo é menor que o da primeira leitura (na execução de teste, 30 ms contra 7 ms). O `TTL` da chave continua diminuindo: o hit não renova o prazo (alguns segundos depois, 299 virou 290).

## 4. Alteração: a invalidação

```bash
curl -s $GW/catalogo/produtos/$ID | node -pe 'JSON.parse(require("fs").readFileSync(0)).preco'   # preço antes

curl -s -X PATCH $GW/catalogo/produtos/$ID \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"preco": 1234.56}'

docker exec redis redis-cli GET catalogo:versao
docker logs catalogo --tail 5
```

**Saída esperada:**
- `catalogo:versao` sobe em 1 (`INCR`).
- O log do catálogo mostra a linha `produto atualizado` com `id_produto`, `campos` e `alteradoPor`.
- A chave antiga (`catalogo:v<versão antiga>:produtos:<ID>`) ainda existe no Redis, mas não é mais lida: está órfã e some pelo TTL.

## 5. Leitura depois da alteração: miss com dado novo

```bash
curl -s $GW/catalogo/produtos/$ID | node -pe 'JSON.parse(require("fs").readFileSync(0)).preco'   # preço depois
metricas
docker exec redis redis-cli --scan --pattern 'catalogo:*'
```

**Saída esperada:** o preço novo (`1234.56`) aparece na primeira leitura depois do `PATCH`; `miss` aumenta em 1; surge uma chave nova com a versão atual.

## 6. Expiração por TTL

Para não esperar 5 minutos, reduza o TTL só para esta demonstração: em `catalogo-service/.env`, `CACHE_TTL_SEGUNDOS=10`, e `docker compose up -d --force-recreate catalogo` (o `restart` não relê o `.env`). O novo TTL só vale para chaves gravadas **depois** da troca; uma chave criada antes continua com o prazo antigo. Por isso, apague a chave primeiro:

```bash
V=$(docker exec redis redis-cli GET catalogo:versao)
docker exec redis redis-cli DEL "catalogo:v$V:produtos:$ID"
tempo                                   # miss: grava a chave
docker exec redis redis-cli TTL "catalogo:v<versão>:produtos:$ID"   # ~10
sleep 11
docker exec redis redis-cli EXISTS "catalogo:v<versão>:produtos:$ID" # 0 (expirou)
tempo                                   # novo miss
```

Volte `CACHE_TTL_SEGUNDOS` para 300 ao terminar.

## 7. Redis fora do ar: a API continua respondendo

```bash
docker stop redis
tempo                                   # continua HTTP 200, lendo do MySQL
curl -s $GW/catalogo/health             # "status":"degradado","redis":"falha"
docker start redis
metricas                                # o contador de erro aumentou: resultado="erro"
```

**Saída esperada:** as leituras seguem com HTTP 200; `/health` mostra `"status":"degradado","redis":"falha"`; os logs do catálogo trazem `cache indisponível: consultando o banco`. Uma escrita (`PATCH`) com o Redis fora também responde 200, e o log avisa `cache indisponível: invalidação não aplicada (vale o TTL)`: nesse caso, chaves antigas que ainda estejam no Redis só deixam de valer quando o TTL expirar.

## 8. Prova automatizada

Os testes do Catálogo cobrem os mesmos comportamentos (`describe('cache-aside com Redis (rubrica)')` em `catalogo-service/tests/api.test.ts`):

Os testes usam um MySQL real. O `DB_HOST` do `.env` (`catalogo_db`) só existe dentro da rede do Docker, e o banco do Catálogo não publica porta no host, então rode os testes num container da mesma rede, com uma cópia do serviço (assim o `node_modules` do Windows não interfere). Use um banco descartável ou um banco já migrado do zero (veja a nota abaixo):

```bash
# na raiz do repositório, em Git Bash
MSYS_NO_PATHCONV=1 docker run --rm --network mce-celulares_backend \
  -v "$(pwd -W)/catalogo-service:/src:ro" node:20 sh -c '
    mkdir /app && cd /src && tar cf - --exclude=node_modules --exclude=dist . | tar xf - -C /app &&
    cd /app && npm ci --no-audit --no-fund >/dev/null 2>&1 &&
    npx jest --runInBand -t "cache-aside"'
```

Resultado obtido: `Tests: 3 passed`.

> **Nota:** os testes criam produtos `teste-*` no banco configurado e os removem no fim. Num banco criado com migrations antigas (sem `UNIQUE` em `categoria.nome` e `marca.nome`), 2 testes de nome duplicado falham. Num banco criado do zero, a suíte completa do Catálogo passa (98 de 98).

- segunda leitura vem do cache e uma escrita invalida;
- a visão do gestor (inativos) não passa pelo cache;
- Redis fora do ar não derruba a API (degrada para o banco).

## Registro da evidência

| Passo | Resultado esperado | Resultado obtido (cole a saída ou um print) |
|---|---|---|
| 2. Primeira leitura | chave criada, TTL ≈ 300, `miss` +1 | |
| 3. Segunda leitura | `hit` +1 | |
| 4. PATCH | `catalogo:versao` +1, log `produto atualizado` | |
| 5. Leitura após PATCH | preço novo, `miss` +1 | |
| 6. TTL | chave some após o prazo | |
| 7. Redis parado | HTTP 200, `/health` degradado | |
| 8. Testes | 3 testes passando | |
