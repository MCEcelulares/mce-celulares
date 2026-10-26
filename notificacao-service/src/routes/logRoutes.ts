import { Router } from 'express';
import * as logController from '../controllers/logController';
import { autenticar } from '../middlewares/authMiddleware';
import { exigirPermissao } from '../middlewares/permissaoMiddleware';
import { validar } from '../middlewares/validate';
import { idPedidoParamSchema } from '../validators/paramsValidators';

const router = Router();

router.get(
  '/:idPedido',
  autenticar,
  validar(idPedidoParamSchema, 'params'),
  exigirPermissao('pedidos:listar-todos'),
  logController.listarPorPedido
);

export default router;
