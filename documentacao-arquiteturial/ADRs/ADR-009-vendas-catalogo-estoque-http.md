# ADR-009: Vendas consulta o Catálogo e reserva o estoque por pedido, por HTTP, com devolução idempotente

**Status:** Aceito (reescrito em 2026-11-05 para o contrato de reservas do Catálogo)

## Contexto
O RF26 pede validar disponibilidade antes de confirmar itens do carrinho, e o RF16 pede decrementar o estoque ao finalizar o pedido. O estoque é dado do Catálogo e, pelo ADR-002, cada serviço é dono exclusivo dos seus dados. O evento `pedido.criado` (ADR-008) **não carrega os itens**, então o Catálogo não conseguiria baixar o estoque a partir dele. Vender acima do estoque é um erro pior do que uma chamada síncrona a mais.

## Decisão
**1. O Vendas chama o Catálogo por HTTP (síncrono):**
- `GET /produtos/{id}` (público) — nome, preço atual, estoque e situação; usado ao adicionar/alterar item do carrinho. O preço gravado no pedido é o do Catálogo no momento da criação.
- `POST /interno/reservas` com `{id_pedido, itens:[{id_produto, quantidade}]}` — reserva **todos** os itens numa transação (tudo ou nada) e é **idempotente por pedido**: 201 na primeira vez, 200 se repetida com os mesmos itens. Erros: 409 "Estoque insuficiente" (com `detalhes` listando as faltas), 409 produto inativo / reserva já devolvida / reserva diferente, 404 produto inexistente.
- `POST /interno/reservas/{idPedido}/devolucao` — devolve a reserva ao estoque; **idempotente** (repetir não devolve duas vezes); 404 se não havia reserva.
- `GET /interno/produtos?ids=` e `GET /interno/reservas/{idPedido}` — consultas internas.
- Rotas `/interno/*` exigem token de serviço (ADR-010) e são **bloqueadas no gateway** (`/catalogo/interno/` responde 404).

**2. Criação do pedido** (`POST /pedidos`), em três passos:
1. grava o pedido **invisível** (`ativo=false`) com itens, endereço e cliente, numa transação local, obtendo o `id_pedido`;
2. **reserva** o estoque no Catálogo para esse pedido (se faltar estoque ou o Catálogo recusar, o pedido invisível é apagado e o cliente recebe o erro);
3. torna o pedido **visível**, fecha o carrinho e publica `pedido.criado`.

**3. Cancelamento e expiração:** o pedido muda de status de forma condicional e só quem vence a troca chama a devolução da reserva.

**4. Recuperação de órfãos:** se o processo cair entre os passos 1 e 3, sobra um pedido invisível. Uma rotina do Vendas (`PEDIDO_ORFAO_MINUTOS`) encontra pedidos `ativo=false` antigos, **devolve a reserva** (idempotente: se nunca houve reserva, o 404 é aceito) e apaga o pedido. Assim não há mais estoque preso sem pedido.

**5. Resiliência (ADR-003):** timeout de 5 s (`HTTP_TIMEOUT_MS`); **reservar e devolver agora são repetidos** (2 tentativas) porque são idempotentes por pedido. Catálogo fora do ar responde 503 ao cliente.

**6. Autenticação:** token de serviço (ADR-010).

## Consequências
- **Positivas:** nunca se vende acima do estoque, nem com pedidos simultâneos; a reserva é atômica para o pedido inteiro (sem compensação item a item); falhas de rede podem ser repetidas sem risco de baixar ou devolver em dobro; não há mais estoque preso sem pedido (recuperação de órfãos); o Catálogo continua único dono do estoque.
- **Negativas:**
  - O Vendas depende do Catálogo (503 sem ele) e o Catálogo precisa manter o contrato `/interno/*`.
  - Um pedido `AGUARDANDO_PAGAMENTO` mantém o estoque reservado até ser pago, cancelado ou expirar.
  - A devolução depende de o Catálogo estar no ar. Se falhar mesmo depois das 2 tentativas, o pedido continua cancelado, a falha vai para o log e para a métrica `estoque_nao_devolvido` e a reserva fica presa até ser conciliada à mão: **não há repetição automática** dessa devolução (só os pedidos órfãos têm rotina de recuperação).

## Alternativas consideradas
- **Catálogo baixa o estoque ao assinar `pedido.criado`:** exigiria itens no evento e o Vendas só saberia da falta de estoque depois de criar o pedido. Descartada.
- **Estoque dentro do Vendas:** duplicaria um dado do Catálogo. Descartada.
- **Transação distribuída (2PC):** complexidade desproporcional. Descartada.
- **Reservar só no pagamento:** permitiria vender o que não existe. Descartada.
- **Baixa/reposição por produto (contrato anterior):** não era idempotente, exigia compensação item a item e deixava estoque preso se o processo caísse. Substituída por reserva por pedido.

## Atualização (2026-10-29) — expiração de pedidos não pagos
- Uma rotina do Vendas (a cada `PEDIDO_EXPIRA_VERIFICAR_SEGUNDOS`, padrão 60) cancela os pedidos `AGUARDANDO_PAGAMENTO` mais antigos que `PEDIDO_EXPIRA_MINUTOS` (padrão 30; `0` desliga) e **devolve a reserva** do pedido.
- O pedido informa `expira_em` enquanto aguarda pagamento; o Pagamento o usa para encerrar também o link do Mercado Pago (ADR-011), o que reduz, mas não elimina, a chance de um pagamento chegar depois do cancelamento (nesse caso vale o tratamento do ADR-011: status `REEMBOLSAR`).
- **Corrida entre pagar e expirar:** a troca de status é condicional (`UPDATE ... WHERE status = <o lido>`); só quem vence devolve a reserva. A perdedora recebe 409.
- Com várias instâncias do Vendas a rotina roda em todas; a troca condicional impede o cancelamento em dobro.
