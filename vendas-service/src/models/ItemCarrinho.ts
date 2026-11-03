import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface ItemCarrinhoAttributes {
  id_item_carrinho: number;
  id_carrinho: number;
  id_produto: number;
  preco_unitario: number;
  quantidade: number;
}

type ItemCarrinhoCreationAttributes = Optional<ItemCarrinhoAttributes, 'id_item_carrinho'>;

export class ItemCarrinho
  extends Model<ItemCarrinhoAttributes, ItemCarrinhoCreationAttributes>
  implements ItemCarrinhoAttributes
{
  declare id_item_carrinho: number;
  declare id_carrinho: number;
  declare id_produto: number;
  declare preco_unitario: number;
  declare quantidade: number;
}

ItemCarrinho.init(
  {
    id_item_carrinho: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    id_carrinho: { type: DataTypes.INTEGER, allowNull: false },
    id_produto: { type: DataTypes.INTEGER, allowNull: false },
    preco_unitario: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    quantidade: { type: DataTypes.INTEGER, allowNull: false },
  },
  { sequelize, modelName: 'ItemCarrinho', tableName: 'item_carrinho', timestamps: false }
);
