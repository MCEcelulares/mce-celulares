# **Diagrama Entidade Relacionamento:**  

<img width="1000" height="644" alt="image" src="https://github.com/user-attachments/assets/25ccf294-3a77-4c97-9576-15169f2dd19a" />

## Alterações em relação à imagem acima (2026-10-29)

A imagem mostra o modelo original. Na implementação, o esquema de cada serviço é criado pelas **migrations do Sequelize** da própria pasta do serviço (os scripts SQL de `infra/migrations/` deixaram de ser usados). Diferenças em relação ao DER:

| Serviço | Tabela | Mudança |
|---|---|---|
| Vendas | `carrinho` | Índice em (`id_usuario`, `ativo`) para achar o carrinho ativo |
| Vendas | `item_carrinho` | `UNIQUE (id_carrinho, id_produto)`: um produto aparece uma vez por carrinho (a quantidade é somada) |
| Vendas | `pedido` | Índice em `status` (filtro de pedidos, RF37); `metodo_envio`, `prazo_entrega_dias`, `codigo_rastreio` e `id_envio_externo` existem, mas ainda não são preenchidos (frete não é calculado) |
| Vendas | `usuario_pedido` | Índice em `id_usuario` (histórico do cliente); `cpf` e `telefone` continuam obrigatórios, então o pedido só é criado se o usuário os tiver |
| Pagamento | `pagamento` | Novas colunas `id_usuario`, `id_externo` (id da preferência no Mercado Pago) e `url_pagamento`; `UNIQUE (id_pedido)`; `status` assume `PENDENTE`, `APROVADO` ou `RECUSADO` |
| Catálogo | `produto` | Sem o índice `FULLTEXT` do SQL original: a busca por nome usa `LIKE` |

Sem chave estrangeira entre serviços, como no ADR-002: `id_usuario` e `id_produto` são números sem restrição, validados por chamada HTTP no momento da escrita.
