# Demonstração: Docker Compose e gateway Nginx

Mostra a orquestração (rede, healthchecks, ordem de subida, portas) e o Nginx como proxy reverso (roteamento, bloqueio de rota interna, isolamento de falha). Decisões no [ADR-018](../documentacao-arquiteturial/ADRs/ADR-018-gateway-nginx.md). Comandos para um terminal bash (Git Bash no Windows), na raiz do repositório; as saídas são de uma execução real.

## 1. Subir e conferir a orquestração

```bash
docker compose --profile dev up -d --build
docker compose --profile dev ps --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}'
```

**Esperado:** todos `healthy`, e **só** estas portas publicadas no host:

```
nginx      Up (healthy)   0.0.0.0:8080->80/tcp
mailpit    Up (healthy)   127.0.0.1:8025->8025/tcp     (só com --profile dev)
catalogo   Up (healthy)   3002/tcp                      (porta interna, não publicada)
redis      Up (healthy)   6379/tcp                      (idem)
*_db       Up (healthy)   3306/tcp, 33060/tcp           (idem)
```

```bash
docker compose config -q && echo "compose válido"
docker exec nginx nginx -t        # nginx: configuration file ... test is successful
```

## 2. Roteamento por prefixo

```bash
for s in identidade catalogo vendas pagamento notificacao; do
  printf "$s: "; curl -s http://localhost:8080/$s/health; echo
done
```

Cada um responde `{"status":"ok","servico":"<nome>-service","banco":"ok","redis":"ok"}`. O prefixo é removido pelo Nginx antes de chegar ao serviço (o serviço atende `/health`, não `/catalogo/health`).

## 3. Rotas internas bloqueadas (inclusive as tentativas de contornar)

```bash
for c in /catalogo/interno/reservas/1 /catalogo/Interno/reservas/1 /catalogo/INTERNO/produtos \
         //catalogo/interno/reservas/1 /catalogo/%69nterno/reservas/1 "/catalogo/x/../interno/reservas/1"; do
  printf "%-45s " "$c"; curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8080$c"
done
```

**Esperado:** `404` em todas, vindo do Nginx. Antes da correção (`~` em vez de `~*`), `/catalogo/Interno/...` e `/catalogo/INTERNO/...` chegavam ao Catálogo e respondiam `401`, barradas só pelo token de serviço.

## 4. Documentação da API, `/health` e rota inexistente

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/docs/        # 200 (Swagger UI)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/health       # 200 ("nginx ok")
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/nao-existe   # 404
curl -sI http://localhost:8080/health | grep -i '^server'                    # Server: nginx (sem versão)
```

## 5. Limite de corpo

```bash
head -c 2000000 /dev/zero | tr '\0' 'a' | curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -H 'Content-Type: application/json' --data-binary @- http://localhost:8080/vendas/pedidos
```

**Esperado:** `413` (o padrão do Nginx é 1 MB; só o Catálogo aceita até 3 MB, para o upload de imagem).

## 6. Isolamento de falha: um serviço cai, o resto continua

```bash
docker stop vendas
curl -s -o /dev/null -w "vendas:   %{http_code} em %{time_total}s\n" http://localhost:8080/vendas/health
curl -s -o /dev/null -w "catalogo: %{http_code}\n"                   http://localhost:8080/catalogo/health
curl -s -o /dev/null -w "nginx:    %{http_code}\n"                   http://localhost:8080/health
docker start vendas
```

**Resultado obtido:**

```
vendas:   504 em 5.0s     (ou 502: depende do cache de 10 s do resolver)
catalogo: 200
nginx:    200
```

O gateway não cai com o serviço, e o erro é rápido (até ~5 s, `proxy_connect_timeout`) em vez dos 60 s do padrão.

## 7. Tudo de uma vez

```bash
bash scripts/verificar-gateway.sh              # leituras (roteamento, bloqueios, /docs, 413, Server)
bash scripts/verificar-gateway.sh --isolamento # também para o vendas por alguns segundos
node e2e/executar.js catalogo                  # inclui as variantes do bloqueio de /catalogo/interno
```

O script sai com código `0` quando tudo passa (`gateway OK`) e `1` caso contrário. No CI (`ci.yml`): `nginx -t` com os dois arquivos de configuração, a regra `~*` e a validade do compose (com e sem o profile `dev`).

## 8. Acesso a bancos e Redis (sem portas no host)

```bash
docker exec redis redis-cli ping                                                  # PONG
docker exec identidade_db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "show tables"'
# para uma sessão interativa, use `docker exec -it ...` em vez de `docker exec ...`
```

## Registro da evidência

| Passo | Esperado | Obtido (cole a saída ou um print) |
|---|---|---|
| 1. `ps` | tudo `healthy`; só `8080` (e `8025` no profile dev) publicadas | |
| 2. Roteamento | 5 serviços `ok` | |
| 3. Rotas internas | 404 em todas as variantes | |
| 4. `/docs`, `/health`, 404, `Server` | 200, 200, 404, sem versão | |
| 5. Limite | 413 | |
| 6. Isolamento | vendas 502/504; catálogo e nginx 200 | |
| 7. Script | `gateway OK` | |
