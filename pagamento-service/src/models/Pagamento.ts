import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export const STATUS_PAGAMENTO = ['PENDENTE', 'APROVADO', 'RECUSADO'] as const;
export type StatusPagamento = (typeof STATUS_PAGAMENTO)[number];

interface PagamentoAttributes {
  id_pagamento: number;
  id_pedido: number;
  id_usuario: number;
  metodo_pagamento: string;
  valor: number;
  data_pagamento?: Date | null;
  status: StatusPagamento;
  id_externo?: string | null;
  url_pagamento?: string | null;
}

type PagamentoCreationAttributes = Optional<
  PagamentoAttributes,
  'id_pagamento' | 'data_pagamento' | 'status' | 'id_externo' | 'url_pagamento'
>;

export class Pagamento
  extends Model<PagamentoAttributes, PagamentoCreationAttributes>
  implements PagamentoAttributes
{
  declare id_pagamento: number;
  declare id_pedido: number;
  declare id_usuario: number;
  declare metodo_pagamento: string;
  declare valor: number;
  declare data_pagamento: Date | null;
  declare status: StatusPagamento;
  declare id_externo: string | null;
  declare url_pagamento: string | null;
}

Pagamento.init(
  {
    id_pagamento: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    id_pedido: { type: DataTypes.INTEGER, allowNull: false },
    id_usuario: { type: DataTypes.INTEGER, allowNull: false },
    metodo_pagamento: { type: DataTypes.STRING(255), allowNull: false },
    valor: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    data_pagamento: { type: DataTypes.DATE, allowNull: true },
    status: { type: DataTypes.STRING(20), defaultValue: 'PENDENTE' },
    id_externo: { type: DataTypes.STRING(100), allowNull: true },
    url_pagamento: { type: DataTypes.STRING(500), allowNull: true },
  },
  { sequelize, modelName: 'Pagamento', tableName: 'pagamento', timestamps: false }
);
