import { Router } from 'express';
import * as pagamentoController from '../controllers/pagamentoController';
import { autenticar } from '../middlewares/authMiddleware';
import { validar } from '../middlewares/validate';
import { exigirPermissao } from '../middlewares/permissaoMiddleware';
import { registrarPagamentoSchema, idPedidoParamSchema, listarPagamentosQuerySchema } from '../validators/pagamentoValidators';
import { limitarPagamento } from '../utils/rateLimit';

const router = Router();

// Público: quem chama é o Mercado Pago. O conteúdo nunca é confiado; o pagamento é consultado na API do gateway.
router.post('/webhook', pagamentoController.webhook);

router.post('/', autenticar, limitarPagamento, validar(registrarPagamentoSchema), pagamentoController.registrar);

// Plano B do webhook: consulta o Mercado Pago agora e confirma se já foi pago.
router.post(
  '/:idPedido/sincronizar',
  autenticar,
  limitarPagamento,
  validar(idPedidoParamSchema, 'params'),
  pagamentoController.sincronizar
);

// Visão do operador (pagamentos aprovados, a reembolsar...). Fica antes de /:idPedido.
router.get('/', autenticar, exigirPermissao('pedidos:listar-todos'), validar(listarPagamentosQuerySchema, 'query'), pagamentoController.listar);

router.get('/:idPedido', autenticar, validar(idPedidoParamSchema, 'params'), pagamentoController.buscar);

export default router;
