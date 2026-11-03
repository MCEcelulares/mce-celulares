# ADR-003: Comunicação síncrona apenas onde é crítica; resto é assíncrono via Redis Pub/Sub

**Status:** Aceito

## Contexto
Comunicação síncrona (HTTP) entre serviços acumula latência e acoplamento temporal: se o serviço chamado cair, a operação falha. Comunicação assíncrona desacopla no tempo, mas é mais complexa de implementar e depurar.

## Decisão
- **Síncrono (HTTP):** usado só quando a resposta é necessária imediatamente para o fluxo continuar.
  - Vendas → Identidade: valida se o usuário existe (e o endereço escolhido) antes de criar o pedido, repassando o token do usuário (ADR-006).
  - Pagamento → Vendas: lê o pedido (valor e dono) antes de cobrar e atualiza o seu status após confirmar o pagamento (ADR-010, ADR-011).
  - Vendas → Catálogo: consulta preço e estoque e faz a baixa e a reposição de estoque (ADR-009, ADR-010).
  - Pagamento → Mercado Pago (sistema externo): cria a preferência de pagamento e consulta o pagamento (ADR-011).
- **Assíncrono (Redis Pub/Sub):** usado para efeitos colaterais que não bloqueiam o usuário.
  - Vendas publica `pedido.criado` → Notificação envia e-mail de pedido confirmado.
  - Pagamento publica `pagamento.confirmado` → Notificação envia e-mail de pagamento confirmado.

## Consequências
- **Positivas:** o usuário não espera pelo envio de e-mail; menos acoplamento entre Vendas/Pagamento e Notificação; mais fácil escalar o processamento assíncrono depois.
- **Negativas:** as chamadas síncronas continuam sendo pontos únicos de falha e exigem estratégias de resiliência (retry/timeout).

## Alternativas consideradas
- **Alternativa 1:** Tudo Síncrono via http -> achamos melhor não colocar http em tudo principalmente por causa do nosso sistema de notificação que não é prioridade do sistema

## Atualização (2026-10-29) — o que a implementação acrescentou
- **Terceira chamada síncrona (Vendas → Catálogo):** não estava prevista aqui; é necessária porque o estoque é do Catálogo e o evento `pedido.criado` não leva os itens. Decisão e riscos no **ADR-009**.
- **Resiliência implementada:** todas as chamadas HTTP entre serviços têm **timeout de 5 s** (`HTTP_TIMEOUT_MS`). Consultas (GET) têm **1 nova tentativa**; o `PATCH` de status `PAGO` também, porque o Vendas aceita repetir o mesmo status; operações não idempotentes (baixa/reposição de estoque, criação de preferência de pagamento) **não** são repetidas. Falha ou timeout do serviço chamado vira **503** para o cliente.
- **Autenticação entre serviços:** token de serviço quando não há usuário (ADR-010).
- **Cache-aside de `user:{id}` no Vendas (previsto no C4): não foi implementado.** O Vendas valida o usuário e o endereço com o **token do próprio usuário** (ADR-006) e precisa dos dados **atuais** (conta ativa, CPF, telefone, endereço) no fechamento da compra; um cache por `user:{id}` serviria dado possivelmente velho, e economizaria só uma chamada por pedido. Reavaliar se o SLO 2 (`POST /pedidos` com p95 < 1,5 s) não for atingido. O cache `produto:{id}` do Catálogo existe como previsto.