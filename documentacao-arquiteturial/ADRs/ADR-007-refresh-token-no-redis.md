# ADR-007: Refresh token opaco no Redis (sessão renovável e logout)

**Status:** Aceito

## Contexto
O usuário deve continuar logado ao voltar ao site (RF02) e poder sair (RF03). Um JWT sozinho é *stateless*: não dá para "apagar" uma sessão. Ao mesmo tempo, o access token precisa ser curto (ADR-006), então algo precisa renová-lo sem pedir a senha de novo. O Redis já faz parte da infraestrutura (cache e Pub/Sub).

## Decisão
- **Access token:** JWT RS256 de vida curta (`JWT_EXPIRES_IN`).
- **Refresh token:** valor aleatório opaco de 48 bytes (não é JWT), válido por `REFRESH_TOKEN_TTL_DIAS` (padrão 7).
- No Redis fica apenas o **hash SHA-256** do token (`identidade:rt:<hash>` → id do usuário, com TTL) e um conjunto por usuário (`identidade:rt:usuario:<id>`) usado para encerrar todas as sessões de uma vez.
- **Uso único com rotação:** `POST /auth/refresh` consome o token e devolve um par novo (e recalcula cargos/permissões).
- `POST /auth/logout` revoga um refresh token; `POST /auth/logout-todos` revoga todos os do usuário. Troca de senha e desativação de conta também revogam todos.
- **Redis indisponível:** o login continua funcionando e devolve `refreshToken: null`; refresh e logout respondem 503 (nunca fingem sucesso); `/health` reporta `degradado`.

## Consequências
- **Positivas:** logout e revogação de sessão de verdade; vazamento do Redis não entrega tokens utilizáveis (só hashes); o Identidade continua funcional sem o Redis, só sem sessão renovável.
- **Negativas:** o Redis vira dependência da sessão renovável; access tokens já emitidos continuam válidos até expirar (mitigado pela vida curta); não há detecção de **reuso** de refresh token roubado (um token reutilizado apenas falha com 401, sem derrubar as demais sessões) — evolução futura possível.

## Alternativas consideradas
- **JWT de vida longa (ex.: 7 dias) sem Redis:** simples, mas sem revogação e com janela de risco enorme. Descartada.
- **Refresh token também em JWT:** continua sem revogação sem guardar estado. Descartada.
- **Sessão em cookie com armazenamento central:** acopla os serviços ao armazenamento de sessão. Descartada.
