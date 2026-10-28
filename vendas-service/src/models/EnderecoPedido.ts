import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface EnderecoPedidoAttributes {
  id_endereco_pedido: number;
  id_pedido: number;
  endereco: string;
  numero: string;
  complemento?: string | null;
  bairro?: string | null;
  cidade: string;
  estado: string;
  cep: string;
}

type EnderecoPedidoCreationAttributes = Optional<
  EnderecoPedidoAttributes,
  'id_endereco_pedido' | 'complemento' | 'bairro'
>;

export class EnderecoPedido
  extends Model<EnderecoPedidoAttributes, EnderecoPedidoCreationAttributes>
  implements EnderecoPedidoAttributes
{
  declare id_endereco_pedido: number;
  declare id_pedido: number;
  declare endereco: string;
  declare numero: string;
  declare complemento: string | null;
  declare bairro: string | null;
  declare cidade: string;
  declare estado: string;
  declare cep: string;
}

EnderecoPedido.init(
  {
    id_endereco_pedido: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    id_pedido: { type: DataTypes.INTEGER, allowNull: false },
    endereco: { type: DataTypes.STRING(255), allowNull: false },
    numero: { type: DataTypes.STRING(255), allowNull: false },
    complemento: { type: DataTypes.STRING(255), allowNull: true },
    bairro: { type: DataTypes.STRING(255), allowNull: true },
    cidade: { type: DataTypes.STRING(255), allowNull: false },
    estado: { type: DataTypes.STRING(255), allowNull: false },
    cep: { type: DataTypes.STRING(255), allowNull: false },
  },
  { sequelize, modelName: 'EnderecoPedido', tableName: 'endereco_pedido', timestamps: false }
);
