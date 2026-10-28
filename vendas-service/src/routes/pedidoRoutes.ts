import { Router } from 'express';
import * as pedidoController from '../controllers/pedidoController';
import { autenticar } from '../middlewares/authMiddleware';
import { autenticarOuServico } from '../middlewares/servicoMiddleware';
import { validar } from '../middlewares/validate';
import {
  criarPedidoSchema,
  listarPedidosQuerySchema,
  atualizarStatusSchema,
} from '../validators/pedidoValidators';
import { idParamSchema } from '../validators/paramsValidators';

const router = Router();

router.post('/', autenticar, validar(criarPedidoSchema), pedidoController.criar);
router.get('/', autenticar, validar(listarPedidosQuerySchema, 'query'), pedidoController.listar);
router.get('/:id', autenticar, validar(idParamSchema, 'params'), pedidoController.buscar);

// Chamada pelo Pagamento (token de serviço) ou por quem tem permissão (JWT).
router.patch(
  '/:id/status',
  autenticarOuServico,
  validar(idParamSchema, 'params'),
  validar(atualizarStatusSchema),
  pedidoController.atualizarStatus
);

export default router;
