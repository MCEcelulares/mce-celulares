# ADR-010: Chamadas entre serviços sem usuário usam token de serviço

**Status:** Aceito

## Contexto
Os ADRs 005 e 006 tratam do JWT **do usuário**. Algumas chamadas entre serviços não têm usuário por trás ou exigem mais permissão do que o usuário tem:
- o Vendas baixa e repõe estoque no Catálogo (o cliente não tem `catalogo:gerenciar`);
- o Pagamento confirma o pagamento no Vendas e lê o valor do pedido, inclusive quando a chamada nasce de um **webhook do Mercado Pago**, em que não existe usuário logado.

Já a validação do usuário e do endereço no Identidade continua usando o **JWT do próprio usuário repassado** (ADR-006), porque o dado pertence a ele.

## Decisão
- As rotas **internas** aceitam `Authorization: Bearer <token de serviço>`: um segredo por serviço de destino, configurado como `SERVICE_TOKEN` no destino e com o mesmo valor numa variável do chamador (`CATALOGO_SERVICE_TOKEN` no Vendas, `VENDAS_SERVICE_TOKEN` no Pagamento).
- Rotas internas hoje:
  - Catálogo: `GET /interno/produtos`, `POST /interno/reservas`, `GET /interno/reservas/{idPedido}` e `POST /interno/reservas/{idPedido}/devolucao` (somente token de serviço; o prefixo `/interno/` é **bloqueado no gateway**, então só é alcançável dentro da rede dos contêineres);
  - Vendas: `GET /pedidos/{id}` e `PATCH /pedidos/{id}/status` (**token de serviço ou** JWT de usuário com a permissão adequada).
- O token é comparado em **tempo constante**. JWT de usuário não vale nas rotas só-serviço, e o token de serviço não vale nas demais rotas.
- Sem `SERVICE_TOKEN` configurado, a rota interna fica **desligada (404)**, no mesmo padrão do `/metrics`.
- Os tokens ficam nos `.env` (nunca no git) e devem ser aleatórios e longos (os atuais têm 192 bits, gerados com `crypto.randomBytes(24)`).

## Consequências
- **Positivas:** simples, sem nova dependência nem nova chamada por requisição; a rota pode ser desligada por configuração; separa claramente "usuário" de "serviço".
- **Negativas:**
  - É um **segredo compartilhado**: quem o possui executa qualquer operação interna daquele serviço, e não há identidade do chamador para auditoria.
  - A rotação é manual e exige atualizar dois serviços ao mesmo tempo.
  - As rotas internas **passam pelo gateway** (o Nginx encaminha todo o prefixo `/catalogo/` e `/vendas/`), então hoje só o token as protege. Endurecimento possível: bloquear essas rotas no Nginx para tráfego externo.

## Alternativas consideradas
- **JWT de serviço emitido pelo Identidade (client credentials):** identifica o chamador e expira, mas adiciona um fluxo de emissão e uma dependência do Identidade em cada chamada interna. É a evolução natural; descartada por ora.
- **Repassar o JWT do usuário:** não serve para o webhook (sem usuário) nem para operações que o cliente não tem permissão de fazer. Descartada.
- **mTLS entre serviços:** forte, mas pesado para o ambiente atual. Descartada.
- **Confiar na rede interna do Docker, sem autenticação:** o Nginx expõe todas as rotas ao exterior, então qualquer cliente poderia baixar estoque. Descartada.
