# **Requisitos funcionais:**  
## **1	Autenticação e Usuários**  
RF01:	O sistema deve permitir o cadastro de novos usuários (nome, e-mail, CPF, telefone e senha), garantindo que o e-mail seja único

RF02:	O sistema deve permitir login com e-mail e senha, e permanecer logado quando retornar ao site

RF03:	O sistema deve permitir logout do usuário

RF04:	O sistema deve permitir a visualização e edição dos dados da própria conta

RF05:	O sistema deve suportar diferentes cargos de usuário (ex.: cliente, vendas, atendimento, auditor, administrador,)

RF06:	O sistema deve associar permissões a cargos (RBAC — Role-Based Access Control)

RF07:	O sistema deve restringir o acesso a rotas administrativas com base nas permissões do usuário logado

RF08:	O sistema deve listar clientes cadastrados (para usuários com permissão)

RF09:	O sistema deve exibir detalhes de um usuário específico (painel admin)

## **2	Produtos**  
RF10:	O sistema deve permitir o cadastro de produtos com nome, descrição, preço, estoque, imagem, marca, categoria, ativo e destaque

RF11:	O sistema deve permitir a edição de produtos existentes

RF12:	O sistema deve permitir a exclusão (ou inativação) de produtos

RF13:	O sistema deve permitir a listagem paginada de produtos

RF14:	O sistema deve exibir detalhes de um produto específico

RF15:	O sistema deve permitir anexo de arquivos de imagem no cadastro/edição de produtos para sua exibição

RF16:	O sistema deve controlar o estoque dos produtos, decrementando-o após a finalização de um pedido

RF17:	O sistema deve exibir produtos em destaque/novidades na página inicial

RF18:	O sistema deve exibir os produtos mais vendidos no painel administrativo

## **3	Categorias e Marcas**  
RF19:	O sistema deve permitir CRUD (criar, listar, editar, excluir) de categorias e marcas de produtos

RF20:	O sistema deve exibir categorias na página inicial para navegação do usuário

RF21:	O sistema deve permitir a busca/filtro de produtos por categoria e marca

## **4	Carrinho de Compras**  
RF22:	O sistema deve permitir adicionar produtos ao carrinho

RF23:	O sistema deve permitir alterar a quantidade de itens no carrinho

RF24:	O sistema deve permitir remover itens do carrinho

RF25:	O sistema deve calcular o valor total do carrinho automaticamente

RF26:	O sistema deve validar a disponibilidade dos produtos e a quantidade em estoque antes de confirmar itens do carrinho

RF27:	O sistema deve impedir a criação de pedidos caso o carrinho não possua itens ou não foi encontrado

## **5	Pedidos**  
RF28:	O sistema deve permitir a criação de um pedido a partir dos itens do carrinho

RF29:	O sistema deve vincular endereço de entrega ao pedido

RF30:	O sistema deve vincular o usuário responsável ao pedido

RF31:	O sistema deve permitir consulta do histórico de pedidos do usuário

RF32:	O sistema deve permitir que usuários com permissão visualizem todos os pedidos

RF33:	O sistema deve permitir a atualização do status de um pedido ('AGUARDANDO PAGAMENTO', 'PAGO', 'ENVIADO', 'ENTREGUE', 'CANCELADO')

RF34:	O sistema deve restringir a visualização de um pedido apenas ao dono ou a usuários autorizados

RF35:	O sistema deve permitir a exclusão/cancelamento de pedidos (mediante permissão)

RF36:	O sistema deve exibir contagem de novos pedidos e quantidade total no painel admin

RF37:	O sistema deve permitir paginação e filtro de pedidos por status

## **6	Endereços**  
RF38:	O sistema deve permitir o cadastro de múltiplos endereços por usuário

RF39:	O sistema deve permitir a edição e exclusão de endereços

RF40:	O sistema deve obrigar a seleção de um endereço no momento da finalização da compra

## **7	Pagamentos**  
RF41:	O sistema deve integrar com o Mercado Pago para processar pagamentos

RF42:	O sistema deve gerar uma preferência de pagamento com os itens do pedido

RF43:	O sistema deve limpar os itens do carrinho do usuário, após fechamento do pedido

## **8	Contato**  
RF44:	O sistema deve disponibilizar um formulário de contato para os usuários

RF45:	O sistema deve enviar um e-mail automático a partir dos dados preenchidos no formulário de contato

## **9	Painel Administrativo**  
RF46:	O sistema deve exibir um dashboard com métricas (receita, contagem de produtos, usuários, pedidos)

RF47:	O sistema deve exibir gráfico/indicador de receita

RF48:	O sistema deve oferecer atalhos de ações rápidas no painel

RF49:	O sistema deve redirecionar o usuário autenticado para a rota do painel para a qual ele tem permissão

## **10	Aplicativo Móvel**  
RF50:	O aplicativo móvel deve possuir um menu vertical retrátil (Drawer) para navegação.

RF51:	O aplicativo móvel deve abrir os links de contato nos apps nativos correspondentes (WhatsApp e Instagram).
