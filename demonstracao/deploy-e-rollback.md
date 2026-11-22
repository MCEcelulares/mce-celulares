# Demonstração: deploy e rollback com um registro local

Ensaia `scripts/deploy.sh` e `scripts/rollback.sh` sem depender do GitHub nem do GHCR: sobe um registro local, publica nele versões de teste e aplica, com verificação de saúde e rollback automático e manual. Estratégia no [ADR-014](../documentacao-arquiteturial/ADRs/ADR-014-cd-com-rollback-por-tag.md) e fluxo completo em [pipeline-ci-cd.md](../documentacao-arquiteturial/pipeline-ci-cd.md).

Comandos para um terminal bash (Git Bash no Windows), na raiz do repositório, com o ambiente de desenvolvimento no ar. As saídas são de uma execução real.

> **Efeitos:** os 5 serviços são recriados a partir de imagens do registro local (o mesmo código), e o Catálogo fica fora por 1 a 2 minutos durante o teste da versão quebrada. Ao final, a seção 6 devolve o ambiente ao normal.

## 1. Registro local e versões de teste

`docker-compose.deploy.yml` monta o nome da imagem como `${REGISTRY:-ghcr.io}/${REGISTRY_OWNER}/mce-<serviço>-service:${TAG}`. Com `REGISTRY=localhost:5000`, o mesmo script usa o registro local.

```bash
docker run -d --name registro-local -p 127.0.0.1:5000:5000 registry:2

R=localhost:5000/teste
for svc in identidade catalogo vendas pagamento notificacao; do
  for tag in v0.0.1 v0.0.3; do docker tag mce-celulares-$svc:latest $R/mce-$svc-service:$tag; done   # versões boas
  if [ $svc = catalogo ]; then
    docker tag busybox:latest $R/mce-$svc-service:v0.0.2        # v0.0.2: Catálogo quebrado (o container sai na hora)
  else
    docker tag mce-celulares-$svc:latest $R/mce-$svc-service:v0.0.2
  fi
  for tag in v0.0.1 v0.0.2 v0.0.3; do docker push -q $R/mce-$svc-service:$tag; done
done
curl -s http://localhost:5000/v2/teste/mce-catalogo-service/tags/list
# {"name":"teste/mce-catalogo-service","tags":["v0.0.1","v0.0.3","v0.0.2"]}
```

As imagens locais `mce-celulares-<serviço>` existem depois de um `docker compose up -d --build`.

## 2. Deploy de uma versão boa

```bash
export REGISTRY=localhost:5000 REGISTRY_OWNER=teste HEALTH_TENTATIVAS=10 HEALTH_INTERVALO=3
rm -rf .deploy
./scripts/deploy.sh v0.0.1
```

```
✓ v0.0.1 no ar
```

```bash
cat .deploy/tag-atual                      # v0.0.1
docker ps --format '{{.Names}}\t{{.Image}}' | grep catalogo
# catalogo    localhost:5000/teste/mce-catalogo-service:v0.0.1
```

`HEALTH_TENTATIVAS` e `HEALTH_INTERVALO` só encurtam a espera do ensaio (o padrão é 30 tentativas de 5 s por serviço).

## 3. Deploy de uma versão ruim: rollback automático

```bash
./scripts/deploy.sh v0.0.2; echo "exit: $?"
```

```
→ aplicando v0.0.2 (atual: v0.0.1)
✗ catalogo não ficou saudável
✗ v0.0.2 falhou
→ rollback automático para v0.0.1
✓ v0.0.1 restaurada; v0.0.2 NÃO está no ar
exit: 1
```

**O que isso mostra**
- O script detectou, pelo gateway, que o Catálogo da v0.0.2 não respondeu `"status":"ok"`.
- Voltou **sozinho** para a v0.0.1, conferiu a saúde de novo e terminou com **erro** (`exit 1`), que é o que deixaria o job do CD vermelho.
- `.deploy/tag-atual` continua `v0.0.1`: a versão ruim nunca foi registrada como a atual.
- No fim, os 5 serviços respondem `ok` e o Catálogo usa a imagem `v0.0.1`.

## 4. Rollback manual

```bash
./scripts/deploy.sh v0.0.3                 # versão boa: atual=v0.0.3, anterior=v0.0.1
./scripts/rollback.sh                      # sem argumento: volta para a anterior registrada
./scripts/rollback.sh v0.0.3               # com tag explícita
```

```
→ aplicando v0.0.3 (atual: v0.0.1)
✓ v0.0.3 no ar                  estado: atual=v0.0.3 anterior=v0.0.1

→ rollback v0.0.3 → v0.0.1
✓ v0.0.1 no ar                  estado: atual=v0.0.1 anterior=v0.0.3

→ rollback v0.0.1 → v0.0.3
✓ v0.0.3 no ar                  estado: atual=v0.0.3 anterior=v0.0.1
```

O `rollback.sh` delega ao `deploy.sh`, então também confere a saúde e atualiza o estado, e as duas tags se alternam em `tag-atual` e `tag-anterior`.

**Rollback para uma tag que não existe:**

```bash
./scripts/rollback.sh v9.9.9; echo "exit: $?"
```

```
→ rollback v0.0.3 → v9.9.9
→ aplicando v9.9.9 (atual: v0.0.3)
✗ v9.9.9 falhou
→ rollback automático para v0.0.3
✓ v0.0.3 restaurada; v9.9.9 NÃO está no ar
exit: 1
```

Uma tag inexistente não deixa o sistema pior do que estava: o script volta para a versão que estava em uso.

## 5. Limites que o ensaio deixou claros

- **O deploy recria os 5 serviços**, não só o que mudou (o nome de imagem muda para todos quando a tag muda), então há uma breve indisponibilidade durante a troca, e uma versão ruim a repete duas vezes (aplicar e restaurar).
- **O rollback não desfaz migrations** (ADR-014): se a versão ruim rodou uma migration destrutiva, a restauração do banco é manual (runbook, seção 3.9).
- **Este ensaio não substitui a primeira execução real no GitHub:** o `cd.yml` (publicação no GHCR e SSH) só é exercitado ao publicar uma tag. O roteiro de conferência está em [pipeline-ci-cd.md](../documentacao-arquiteturial/pipeline-ci-cd.md).

## 6. Desfazer o ensaio

```bash
unset REGISTRY REGISTRY_OWNER HEALTH_TENTATIVAS HEALTH_INTERVALO
docker compose --profile dev up -d                 # volta aos serviços construídos localmente
docker rm -f registro-local
for svc in identidade catalogo vendas pagamento notificacao; do
  for tag in v0.0.1 v0.0.2 v0.0.3; do docker rmi localhost:5000/teste/mce-$svc-service:$tag; done
done
rm -rf .deploy
```

## Registro da evidência

| Passo | Esperado | Obtido (cole a saída ou um print) |
|---|---|---|
| 2. Deploy v0.0.1 | `✓ v0.0.1 no ar`, `tag-atual = v0.0.1` | |
| 3. Deploy v0.0.2 (Catálogo quebrado) | rollback automático, `exit 1`, `tag-atual = v0.0.1` | |
| 4. `rollback.sh` e `rollback.sh v0.0.3` | tags se alternam, saúde conferida | |
| 4. `rollback.sh v9.9.9` | volta para a versão em uso, `exit 1` | |
