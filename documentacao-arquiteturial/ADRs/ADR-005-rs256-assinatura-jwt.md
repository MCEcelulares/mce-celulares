# ADR-005: RS256 (par de chaves) para assinatura de JWT entre serviços

**Status:** Aceito

## Contexto
Só o `identidade-service` emite o token no login (RNF02), mas os outros 4 serviços (Catálogo, Vendas, Pagamento, Notificação) precisam **validar** esse token nas rotas protegidas definidas nos respectivos OpenAPI. Isso exige compartilhar algo entre os 5 serviços que permita a validação — e a forma como esse algo é compartilhado tem implicação direta de segurança (RNF01-RNF03).

## Decisão
Usar **RS256** (assinatura assimétrica) em vez de um segredo único compartilhado (HS256):
- O `identidade-service` guarda a **chave privada** (`JWT_PRIVATE_KEY`) e é o único serviço que assina tokens.
- Os outros 4 serviços guardam apenas a **chave pública** correspondente (`JWT_PUBLIC_KEY`), suficiente para validar um token, mas incapaz de gerar um novo.
- O par de chaves é gerado uma única vez (script `keys/generate-jwt-keys.js`, versionado no repositório) e seus arquivos `.pem` nunca são commitados (`.gitignore`) — só o conteúdo entra nos `.env` de cada serviço.

## Consequências
- **Positivas:** se qualquer um dos 4 serviços que só validam token for comprometido, não é possível forjar um token válido com a chave pública exposta nele — só a posse da chave privada (que fica isolada no Identidade) permite assinar. Isso limita o raio de impacto de uma eventual falha de segurança a um único serviço.
- **Negativas:** mais um passo de setup em relação a um segredo único (gerar o par de chaves, distribuir a pública para 4 `.env` diferentes); rotacionar a chave exige atualizar o `.env` de todos os 5 serviços, não só um.

## Alternativas consideradas
- **HS256 com segredo único compartilhado:** mais simples de configurar (uma variável, copiada em todos), mas qualquer serviço com o segredo também pode assinar tokens — descartado por dar mais superfície de ataque do que o necessário, já que só o Identidade precisa dessa capacidade.