import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import type { ItemPedido } from './ItemPedido';
import type { EnderecoPedido } from './EnderecoPedido';
import type { UsuarioPedido } from './UsuarioPedido';
import type { StatusPedido } from './statusPedido';

interface PedidoAttributes {
  id_pedido: number;
  data: Date;
  valor_total: number;
  valor_frete: number;
  metodo_envio?: string | null;
  prazo_entrega_dias?: number | null;
  codigo_rastreio?: string | null;
  id_envio_externo?: string | null;
  ativo: boolean;
  status: StatusPedido;
}

type PedidoCreationAttributes = Optional<
  PedidoAttributes,
  | 'id_pedido'
  | 'data'
  | 'valor_frete'
  | 'metodo_envio'
  | 'prazo_entrega_dias'
  | 'codigo_rastreio'
  | 'id_envio_externo'
  | 'ativo'
  | 'status'
>;

export class Pedido extends Model<PedidoAttributes, PedidoCreationAttributes> implements PedidoAttributes {
  declare id_pedido: number;
  declare data: Date;
  declare valor_total: number;
  declare valor_frete: number;
  declare metodo_envio: string | null;
  declare prazo_entrega_dias: number | null;
  declare codigo_rastreio: string | null;
  declare id_envio_externo: string | null;
  declare ativo: boolean;
  declare status: StatusPedido;

  declare itens?: ItemPedido[];
  declare endereco?: EnderecoPedido;
  declare cliente?: UsuarioPedido;
}

Pedido.init(
  {
    id_pedido: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    data: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    valor_total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    valor_frete: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    metodo_envio: { type: DataTypes.STRING(50), allowNull: true },
    prazo_entrega_dias: { type: DataTypes.INTEGER, allowNull: true },
    codigo_rastreio: { type: DataTypes.STRING(100), allowNull: true },
    id_envio_externo: { type: DataTypes.STRING(100), allowNull: true },
    ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
    status: { type: DataTypes.STRING(30), defaultValue: 'AGUARDANDO_PAGAMENTO' },
  },
  { sequelize, modelName: 'Pedido', tableName: 'pedido', timestamps: false }
);
