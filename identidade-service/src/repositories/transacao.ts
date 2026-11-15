import type { Transaction } from 'sequelize';
import { sequelize } from '../config/database';

export type Transacao = Transaction;

export function comTransacao<T>(trabalho: (transacao: Transacao) => Promise<T>): Promise<T> {
  return sequelize.transaction(trabalho);
}
