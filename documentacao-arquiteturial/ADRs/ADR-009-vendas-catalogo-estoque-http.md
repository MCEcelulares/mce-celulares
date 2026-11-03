# ADR-009: Vendas consulta o Catálogo e controla o estoque por HTTP, com reserva e compensação

**Status:** Aceito

## Contexto
O RF26 pede validar disponibilidade e quantidade antes de confirmar itens do carrinho, e o RF16 pede decrementar o estoque ao finalizar o pedido. O estoque é dado do Catálogo (RF10 edita o estoque no cadastro do produto) e, pelo ADR-002, cada serviço é dono exclusivo dos seus dados. O ADR-003 listava apenas duas chamadas síncronas (Vendas → Identidade e Pagamento → Vendas), e o evento `pedido.criado` (ADR-008) **não carrega os itens**, então o Catálogo não conseguiria baixar o estoque a partir dele. Vender acima do estoque é um erro pior do que uma chamada síncrona a mais.

## Decisão
**1. O Vendas chama o Catálogo por HTTP (síncrono):**
- `GET /produtos/{id}` — nome, preço atual, estoque e situação. Usado ao adicionar/alterar item do carrinho e de novo ao criar o pedido. O preço gravado no pedido é o do Catálogo **no momento da criação**; o preço guardado no carrinho é só o que o cliente viu.
- `POST /produtos/{id}/estoque/baixa` com `{quantidade}` — **atômica no banco** (`UPDATE ... WHERE estoque >= quantidade`): responde 200, 409 (insuficiente) ou 404.
- `POST /produtos/{id}/estoque/reposicao` com `{quantidade}` — devolve estoque (vale também para produto inativo).

**2. Criação do pedido** (`POST /pedidos`): valida carrinho, usuário e endereço → reconfere preço e estoque de cada item → **reserva** item a item (baixa) → grava pedido, itens, endereço e cliente em **uma transação local** → publica `pedido.criado`. Se qualquer passo depois da primeira baixa falhar, o Vendas **repõe o que já reservou** (compensação orquestrada pelo próprio Vendas).

**3. Cancelamento** (`PATCH /pedidos/{id}/status` → `CANCELADO`): o pedido é marcado como cancelado e o estoque de cada item é devolvido.

**4. Reposição é "melhor esforço":** se falhar, vira log e a métrica `vendas_eventos_total{evento="estoque_nao_devolvido"}`, e **não é repetida** (repetir poderia devolver duas vezes e criar estoque fantasma).

**5. Resiliência (ADR-003):** timeout de 5 s (`HTTP_TIMEOUT_MS`); consultas (GET) têm 1 nova tentativa; baixa e reposição **não** são repetidas automaticamente porque não são idempotentes. Catálogo fora do ar responde 503 ao cliente.

**6. Autenticação** dessas chamadas: token de serviço (ADR-010).

## Consequências
- **Positivas:** nunca se vende acima do estoque, nem com pedidos simultâneos (verificado com dois clientes disputando a última unidade: um pedido criado, um recusado); o Catálogo continua sendo o único dono do estoque, sem cópia em outro serviço; o preço cobrado é sempre o vigente.
- **Negativas:**
  - É a **terceira dependência síncrona** do Vendas: com o Catálogo fora do ar não se adiciona item ao carrinho nem se cria pedido (503).
  - Consistência eventual: se o processo cair entre a baixa e a gravação do pedido, o estoque fica reservado sem pedido, e **não há conciliação automática**.
  - Um pedido `AGUARDANDO_PAGAMENTO` mantém o estoque reservado até ser pago, cancelado ou **expirar** (ver "Atualização" abaixo).
  - A devolução do estoque no cancelamento e na expiração depende de uma chamada de melhor esforço.

## Alternativas consideradas
- **Catálogo baixa o estoque ao assinar `pedido.criado`:** exigiria itens no evento (contraria o ADR-008, que descartou o payload completo) e o Vendas só saberia da falta de estoque **depois** de criar o pedido, sem poder recusá-lo. Descartada.
- **Estoque dentro do Vendas:** duplicaria um dado que o cadastro de produto edita. Descartada.
- **Transação distribuída (2PC):** complexidade desproporcional ao projeto. Descartada.
- **Reservar o estoque só no pagamento:** permitiria vender o que não existe. Descartada.

## Atualização (2026-10-29) — expiração de pedidos não pagos
- Uma rotina do Vendas (a cada `PEDIDO_EXPIRA_VERIFICAR_SEGUNDOS`, padrão 60) cancela os pedidos `AGUARDANDO_PAGAMENTO` mais antigos que `PEDIDO_EXPIRA_MINUTOS` (padrão 30; `0` desliga) e **devolve o estoque** de cada item. Sem isso, um pedido abandonado prenderia o estoque para sempre.
- O pedido informa `expira_em` (data de criação + prazo) enquanto aguarda pagamento. O Pagamento usa esse valor para encerrar também o link do Mercado Pago (ADR-011), o que **reduz** a chance de um pagamento chegar depois do cancelamento por prazo, mas não a elimina (depende do Mercado Pago honrar a expiração e de os relógios coincidirem); nesse caso vale o tratamento manual descrito no ADR-011.
- **Corrida entre pagar e expirar:** a troca de status é **condicional** (`UPDATE ... WHERE status = <o lido>`), então só uma das duas chamadas vence e só quem vence devolve o estoque. A mesma regra vale para qualquer troca de status (a que perde recebe 409).
- Com várias instâncias do Vendas a rotina roda em todas, e a troca condicional impede o cancelamento em dobro.
- **Continua sem conciliação automática** para o caso de o processo cair entre a baixa do estoque e a gravação do pedido, e para devoluções de estoque que falharem (ficam em log e na métrica `estoque_nao_devolvido`).
