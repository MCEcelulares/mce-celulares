import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface ItemPedidoAttributes {
  id_item: number;
  id_pedido: number;
  id_produto?: number | null;
  nome_produto: string;
  quantidade: number;
  preco_unitario: number;
}

type ItemPedidoCreationAttributes = Optional<ItemPedidoAttributes, 'id_item' | 'id_produto'>;

export class ItemPedido
  extends Model<ItemPedidoAttributes, ItemPedidoCreationAttributes>
  implements ItemPedidoAttributes
{
  declare id_item: number;
  declare id_pedido: number;
  declare id_produto: number | null;
  declare nome_produto: string;
  declare quantidade: number;
  declare preco_unitario: number;
}

ItemPedido.init(
  {
    id_item: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    id_pedido: { type: DataTypes.INTEGER, allowNull: false },
    id_produto: { type: DataTypes.INTEGER, allowNull: true },
    nome_produto: { type: DataTypes.STRING(150), allowNull: false },
    quantidade: { type: DataTypes.INTEGER, allowNull: false },
    preco_unitario: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  },
  { sequelize, modelName: 'ItemPedido', tableName: 'item_pedido', timestamps: false }
);
