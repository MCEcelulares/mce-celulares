import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface ReservaEstoqueAttributes {
  id_reserva_estoque: number;
  id_pedido: number;
  id_produto: number;
  quantidade: number;
  status: string;
  criado_em: Date;
  atualizado_em: Date;
}

type ReservaEstoqueCreationAttributes = Optional<
  ReservaEstoqueAttributes,
  'id_reserva_estoque' | 'status' | 'criado_em' | 'atualizado_em'
>;

export class ReservaEstoque
  extends Model<ReservaEstoqueAttributes, ReservaEstoqueCreationAttributes>
  implements ReservaEstoqueAttributes
{
  declare id_reserva_estoque: number;
  declare id_pedido: number;
  declare id_produto: number;
  declare quantidade: number;
  declare status: string;
  declare criado_em: Date;
  declare atualizado_em: Date;
}

ReservaEstoque.init(
  {
    id_reserva_estoque: { 
      type: DataTypes.INTEGER, 
      primaryKey: true, 
      autoIncrement: true 
    },
    id_pedido: { 
      type: DataTypes.INTEGER, 
      allowNull: false 
    },
    id_produto: { 
      type: DataTypes.INTEGER, 
      allowNull: false 
    },
    quantidade: { 
      type: DataTypes.INTEGER, 
      allowNull: false 
    },
    status: { 
      type: DataTypes.STRING(20), 
      allowNull: false, 
      defaultValue: 'ATIVA' 
    },
    criado_em: { 
      type: DataTypes.DATE, 
      allowNull: false, 
      defaultValue: DataTypes.NOW 
    },
    atualizado_em: { 
      type: DataTypes.DATE, 
      allowNull: false, 
      defaultValue: DataTypes.NOW 
    },
  },
  { 
    sequelize, 
    modelName: 'ReservaEstoque', 
    tableName: 'reserva_estoque', 
    timestamps: false 
  }
);
