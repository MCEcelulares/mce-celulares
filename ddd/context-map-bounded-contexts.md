# Context Map e Bounded Contexts

## Bounded Contexts (= os 5 microsserviços)

| Bounded Context | Responsabilidade | Relação com outros contextos |
|---|---|---|
| **Identidade** | Cadastro/autenticação de usuários, endereços, cargos/permissões | É fornecedor (Upstream) para Vendas |
| **Catálogo** | Produtos, categorias, marcas, busca | É fornecedor (Upstream) para Vendas |
| **Vendas** | Carrinho, criação e acompanhamento de pedidos | Cliente (Downstream) de Identidade e Catálogo; fornecedor para Pagamento e Notificação |
| **Pagamento** | Processamento e status de pagamento | Cliente (Downstream) de Vendas (consulta/atualiza status); fornecedor para Notificação |
| **Notificação** | Envio de e-mails transacionais e contato | Cliente (Downstream) de Vendas e Pagamento (via eventos) |

### Padrão de relação: Customer/Supplier
Vendas é "cliente" de Identidade e Catálogo — depende deles, mas não o contrário. Isso é coerente com a decisão de comunicação síncrona só nesse sentido (ADR-003).

---

## Contexto detalhado: Vendas

Escolhido para detalhar por ser o contexto mais rico em regras de negócio do sistema.

### Aggregate Root
**`Pedido`**
- Garante consistência interna: um pedido só existe com pelo menos 1 item, um valor total coerente com os itens, e um status válido (`AGUARDANDO_PAGAMENTO`, `PAGO`, `ENVIADO`, `ENTREGUE`, `CANCELADO`).
- Toda alteração no pedido (adicionar item, mudar status) passa pelo Aggregate Root.

### Entities
- **`ItemPedido`** — tem identidade própria dentro do agregado (id do item), mas só existe no contexto de um `Pedido`. Guarda snapshot de `nome_produto` e `preco_unitario`.

### Value Objects
- **`EnderecoEntrega`** (mapeado em `endereco_pedido`) — não tem identidade própria fora do pedido; é definido inteiramente pelos seus atributos (rua, número, cidade, etc.) e é imutável depois de criado.
- **`DadosCliente`** (mapeado em `usuario_pedido`) — snapshot imutável do nome/email/cpf/telefone do cliente no momento da compra.

### Por que snapshot e não referência viva?
Porque `Pedido` pertence ao Bounded Context de Vendas, e não deve depender do estado atual de `Usuario` (Identidade) ou `Produto` (Catálogo) para manter sua própria consistência histórica — se o cliente mudar de nome ou o produto for descontinuado, o pedido já feito continua íntegro.
