import { Router } from 'express';
import * as pagamentoController from '../controllers/pagamentoController';
import { autenticar } from '../middlewares/authMiddleware';
import { validar } from '../middlewares/validate';
import { exigirPermissao } from '../middlewares/permissaoMiddleware';
import { registrarPagamentoSchema, idPedidoParamSchema, listarPagamentosQuerySchema } from '../validators/pagamentoValidators';
import { limitarPagamento } from '../utils/rateLimit';

const router = Router();

router.post('/webhook', pagamentoController.webhook);

router.post('/', autenticar, limitarPagamento, validar(registrarPagamentoSchema), pagamentoController.registrar);

router.post(
  '/:idPedido/sincronizar',
  autenticar,
  limitarPagamento,
  validar(idPedidoParamSchema, 'params'),
  pagamentoController.sincronizar
);

router.get('/', autenticar, exigirPermissao('pedidos:listar-todos'), validar(listarPagamentosQuerySchema, 'query'), pagamentoController.listar);

router.get('/:idPedido', autenticar, validar(idPedidoParamSchema, 'params'), pagamentoController.buscar);

export default router;
