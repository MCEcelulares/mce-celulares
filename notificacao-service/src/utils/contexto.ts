import { AsyncLocalStorage } from 'async_hooks';

export interface ContextoRequisicao {
  idCorrelacao: string;
}

export const contextoRequisicao = new AsyncLocalStorage<ContextoRequisicao>();