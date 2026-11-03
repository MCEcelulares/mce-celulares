import { Carrinho } from './Carrinho';
import { ItemCarrinho } from './ItemCarrinho';
import { Pedido } from './Pedido';
import { ItemPedido } from './ItemPedido';
import { EnderecoPedido } from './EnderecoPedido';
import { UsuarioPedido } from './UsuarioPedido';

Carrinho.hasMany(ItemCarrinho, { foreignKey: 'id_carrinho', as: 'itens' });
ItemCarrinho.belongsTo(Carrinho, { foreignKey: 'id_carrinho' });

Pedido.hasMany(ItemPedido, { foreignKey: 'id_pedido', as: 'itens' });
ItemPedido.belongsTo(Pedido, { foreignKey: 'id_pedido' });

Pedido.hasOne(EnderecoPedido, { foreignKey: 'id_pedido', as: 'endereco' });
EnderecoPedido.belongsTo(Pedido, { foreignKey: 'id_pedido' });

Pedido.hasOne(UsuarioPedido, { foreignKey: 'id_pedido', as: 'cliente' });
UsuarioPedido.belongsTo(Pedido, { foreignKey: 'id_pedido' });

export { Carrinho, ItemCarrinho, Pedido, ItemPedido, EnderecoPedido, UsuarioPedido };
