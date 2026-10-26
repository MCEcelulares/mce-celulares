import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface NotificacaoLogAttributes {
  id_notificacao: number;
  id_pedido: number;
  tipo: string;
  destinatario: string;
  status: string;
  erro?: string | null;
  enviado_em?: Date | null;
}

type NotificacaoLogCreationAttributes = Optional<
  NotificacaoLogAttributes,
  'id_notificacao' | 'status' | 'erro' | 'enviado_em'
>;

export class NotificacaoLog
  extends Model<NotificacaoLogAttributes, NotificacaoLogCreationAttributes>
  implements NotificacaoLogAttributes
{
  declare id_notificacao: number;
  declare id_pedido: number;
  declare tipo: string;
  declare destinatario: string;
  declare status: string;
  declare erro: string | null;
  declare enviado_em: Date | null;
}

NotificacaoLog.init(
  {
    id_notificacao: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    id_pedido: { type: DataTypes.INTEGER, allowNull: false },
    tipo: { type: DataTypes.STRING(30), allowNull: false },
    destinatario: { type: DataTypes.STRING(255), allowNull: false },
    status: { type: DataTypes.STRING(20), defaultValue: 'ENVIADO' },
    erro: { type: DataTypes.STRING(255), allowNull: true },
    enviado_em: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, modelName: 'NotificacaoLog', tableName: 'notificacao_log', timestamps: false }
);
