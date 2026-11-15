# ADR-014: CD com imagens versionadas e rollback por tag (sem blue/green)

**Status:** Aceito

## Contexto
O CI (`ci.yml`) valida tipagem, testes, contratos, gateway e o build das imagens, mas nada publicava versões nem definia como voltar atrás quando um deploy desse errado. O ambiente é uma única máquina com Docker Compose (ADR-001/ADR-002), sem orquestrador.

## Decisão
**1. Publicação.** Cada tag `v*` dispara `cd.yml`: roda de novo tipagem e testes que não precisam de banco, constrói as 5 imagens e as publica no GitHub Container Registry como `ghcr.io/<dono>/mce-<serviço>:<tag>` e `:<hash curto do commit>`. Uma versão é **imutável**: corrigir é publicar outra tag.

**2. Deploy.** `scripts/deploy.sh <tag>` (usado pelo job `deploy` por SSH, que só roda se `DEPLOY_HOST` estiver configurado) faz `pull` e `up -d --no-build` com `docker-compose.deploy.yml`, que troca o `build:` pela imagem da tag. Depois confere a saúde dos 5 serviços pelo gateway (`/<serviço>/health` com `"status":"ok"`, até 30 tentativas de 5 s).

**3. Rollback.**
- **Automático:** se a nova versão não ficar saudável, o próprio `deploy.sh` reaplica a tag anterior (guardada em `.deploy/tag-atual`) e termina com erro, para o job do CD falhar e alguém ser avisado.
- **Manual:** workflow `Rollback` (ou `scripts/rollback.sh [tag]` no servidor) volta para a tag informada ou, sem argumento, para a anterior ao último deploy bem-sucedido, com a mesma verificação de saúde.

**3.1 Por que não blue/green.** Blue/green exige duas pilhas completas (inclusive bancos ou um esquema compatível com as duas) e troca de tráfego no gateway; para uma máquina só isso dobra a memória e a complexidade sem ganho proporcional. Rollback por tag dá a volta rápida (segundos para subir imagens já baixadas) com o custo de uma janela curta de indisponibilidade durante a troca.

## Consequências
- **Positivas:** voltar a uma versão é um comando; toda versão em produção tem origem rastreável (tag e commit); o deploy não "passa" sem a verificação de saúde.
- **Negativas e limites:**
  - **Migrations não voltam junto com a imagem.** Os serviços rodam as migrations ao subir (`RUN_MIGRATIONS=true`). Regra: toda migration deve ser compatível com a versão **anterior** do código (adicionar coluna/tabela antes de usá-la; só remover depois que nenhuma versão em produção a use). Uma migration destrutiva exige restaurar backup, não só o rollback de imagem.
  - Há uma janela curta de indisponibilidade na troca de containers.
  - O health check cobre "o serviço responde e vê o banco", não o fluxo de negócio; os testes e2e continuam sendo a validação de fluxo.
  - O estado (`.deploy/`) fica no servidor; perdê-lo só faz o rollback automático ficar sem "anterior" até o próximo deploy.

## Alternativas consideradas
- **Blue/green no Nginx:** descartado pelo custo descrito em 3.1.
- **Kubernetes/Swarm com rolling update:** infraestrutura desproporcional ao projeto.
- **Deploy sem verificação de saúde:** descartado; um deploy quebrado só seria percebido por usuários.
