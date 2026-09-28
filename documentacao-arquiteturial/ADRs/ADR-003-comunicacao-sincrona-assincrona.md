# ADR-003: Comunicação síncrona apenas onde é crítica; resto é assíncrono via Redis Pub/Sub

**Status:** Aceito

## Contexto
Comunicação síncrona (HTTP) entre serviços acumula latência e acoplamento temporal: se o serviço chamado cair, a operação falha. Comunicação assíncrona desacopla no tempo, mas é mais complexa de implementar e depurar.

## Decisão
- **Síncrono (HTTP):** usado só quando a resposta é necessária imediatamente para o fluxo continuar.
  - Vendas → Identidade: valida se o usuário existe antes de criar o pedido.
  - Pagamento → Vendas: atualiza o status do pedido após confirmar o pagamento.
- **Assíncrono (Redis Pub/Sub):** usado para efeitos colaterais que não bloqueiam o usuário.
  - Vendas publica `pedido.criado` → Notificação envia e-mail de pedido confirmado.
  - Pagamento publica `pagamento.confirmado` → Notificação envia e-mail de pagamento confirmado.

## Consequências
- **Positivas:** o usuário não espera pelo envio de e-mail; menos acoplamento entre Vendas/Pagamento e Notificação; mais fácil escalar o processamento assíncrono depois.
- **Negativas:** as duas chamadas síncronas continuam sendo pontos únicos de falha e exigem estratégias de resiliência (retry/timeout).

## Alternativas consideradas
- **Alternativa 1:** Tudo Síncrono via http -> achamos melhor não colocar http em tudo principalmente por causa do nosso sistema de notificação que não é prioridade do sistema