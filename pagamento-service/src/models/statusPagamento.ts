export const STATUS_PAGAMENTO = ['PENDENTE', 'APROVADO', 'RECUSADO', 'REEMBOLSAR'] as const;
export type StatusPagamento = (typeof STATUS_PAGAMENTO)[number];
