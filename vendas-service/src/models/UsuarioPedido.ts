import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface UsuarioPedidoAttributes {
  id_usuario_pedido: number;
  id_pedido: number;
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  id_usuario?: number | null;
}

type UsuarioPedidoCreationAttributes = Optional<UsuarioPedidoAttributes, 'id_usuario_pedido' | 'id_usuario'>;

export class UsuarioPedido
  extends Model<UsuarioPedidoAttributes, UsuarioPedidoCreationAttributes>
  implements UsuarioPedidoAttributes
{
  declare id_usuario_pedido: number;
  declare id_pedido: number;
  declare nome: string;
  declare email: string;
  declare cpf: string;
  declare telefone: string;
  declare id_usuario: number | null;
}

UsuarioPedido.init(
  {
    id_usuario_pedido: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    id_pedido: { type: DataTypes.INTEGER, allowNull: false },
    nome: { type: DataTypes.STRING(255), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false },
    cpf: { type: DataTypes.STRING(255), allowNull: false },
    telefone: { type: DataTypes.STRING(255), allowNull: false },
    id_usuario: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, modelName: 'UsuarioPedido', tableName: 'usuario_pedido', timestamps: false }
);
