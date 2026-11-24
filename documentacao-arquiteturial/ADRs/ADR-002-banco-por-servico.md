# ADR-002: Um banco de dados MySQL por serviço, sem FK entre serviços

**Status:** Aceito

## Contexto
O schema original (monolítico) tinha FKs cruzando o que hoje são fronteiras de serviço diferentes (ex.: `carrinho.id_usuario`, `item_pedido.id_produto`, `usuario_pedido.id_usuario`). Em microsserviços, cada serviço deve ser dono exclusivo dos seus dados.

## Decisão
Cada um dos 5 serviços terá seu próprio banco MySQL (`identidade-db`, `catalogo-db`, `vendas-db`, `pagamento-db`, `notificacao-db`). Referências que antes eram FK física viram:
- **Campo simples (int) sem constraint**, validado por chamada HTTP síncrona no momento da escrita (ex.: Vendas valida `id_usuario` em Identidade antes de criar o pedido).
- **Snapshot de dados** quando o dado precisa sobreviver a mudanças futuras na origem (ex.: `item_pedido.nome_produto`/`preco_unitario`, `usuario_pedido.nome`/`email`, `endereco_pedido.*` guardam uma cópia no momento do pedido).

## Consequências
- **Positivas:** autonomia real de deploy e schema por serviço; histórico de pedidos não se corrompe se o produto ou o cadastro do usuário mudar depois.
- **Negativas:** perde-se integridade referencial garantida pelo banco; é preciso aceitar consistência eventual e tratar o caso de uma referência "solta" (ex.: usuário validado na hora, mas depois desativado).

## Alternativas consideradas
- **Alternativa 1:** Mesmo banco para todas as tabelas -> se vamos fazer microsserviços mesmo achamos melhor usar bancos separados