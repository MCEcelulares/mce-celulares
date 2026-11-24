# ADR-006: Cargos e permissões (RBAC) dentro do JWT

**Status:** Aceito

## Contexto
O sistema precisa de controle de acesso por cargo (RF05, RF06, RF07, RNF03, RNF19): o painel administrativo, o CRUD de produtos, a gestão de pedidos etc. só podem ser usados por quem tem a permissão certa. Os cargos e permissões são **administrados** no Identidade, mas são **verificados** em todos os serviços (Catálogo, Vendas, Pagamento...).

## Decisão
No login e a cada renovação de sessão, o Identidade calcula os cargos do usuário e a união das permissões desses cargos e os grava **dentro do JWT**. Os outros serviços não chamam o Identidade para autorizar: validam a assinatura com a chave pública (ADR-005) e conferem o campo `permissoes`.

Contrato do payload do access token:

```json
{
  "id_usuario": 12,
  "email": "maria@exemplo.com",
  "admin": false,
  "cargos": ["vendas"],
  "permissoes": ["catalogo:gerenciar", "painel:acessar"],
  "iat": 1760000000,
  "exp": 1760000900
}
```

As permissões têm o formato `recurso:acao` e o catálogo inicial (12) é criado pelo seed do Identidade. Cada serviço decide qual permissão exige em cada rota (ex.: `catalogo:gerenciar` para criar produto).

## Consequências
- **Positivas:** autorização sem chamada síncrona entre serviços (coerente com a ADR-003: o Identidade não vira ponto único de falha a cada requisição); latência menor; o front monta o menu do painel só lendo as permissões da resposta de login (RNF19).
- **Negativas:**
  - Mudança de cargo/permissão só vale no próximo login ou refresh (no máximo `JWT_EXPIRES_IN`). Por isso o access token deve ser curto: **recomendado 15 minutos em produção**.
  - Um access token já emitido não pode ser revogado individualmente; conta desativada continua autorizada até o token expirar (a sessão renovável é derrubada na hora, ver ADR-007).
  - O token cresce com o número de permissões.
- **Impacto no Vendas:** `GET /usuarios/:id` do Identidade passou a exigir ser o próprio usuário ou ter `usuarios:ver`. O Vendas deve **repassar o `Authorization` do usuário logado** ao validar o usuário na criação do pedido (e não usar um token de serviço sem permissão).

## Alternativas consideradas
- **Cada serviço consulta o Identidade a cada requisição (introspection):** permissões sempre atuais, mas acopla todos os serviços ao Identidade e multiplica chamadas síncronas — contra a ADR-003. Descartada.
- **Só o cargo no token e permissões resolvidas por cada serviço:** exigiria replicar a tabela cargo-permissão em todos os serviços. Descartada.
