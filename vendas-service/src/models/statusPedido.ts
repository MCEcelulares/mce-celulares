export const STATUS_PEDIDO = ['AGUARDANDO_PAGAMENTO', 'PAGO', 'ENVIADO', 'ENTREGUE', 'CANCELADO'] as const;
export type StatusPedido = (typeof STATUS_PEDIDO)[number];
