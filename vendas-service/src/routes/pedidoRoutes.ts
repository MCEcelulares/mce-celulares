import { Router } from 'express';
import * as pedidoController from '../controllers/pedidoController';
import * as painelController from '../controllers/painelController';
import { autenticar } from '../middlewares/authMiddleware';
import { exigirPermissao } from '../middlewares/permissaoMiddleware';
import { autenticarOuServico } from '../middlewares/servicoMiddleware';
import { validar } from '../middlewares/validate';
import {
  criarPedidoSchema,
  listarPedidosQuerySchema,
  atualizarStatusSchema,
  resumoQuerySchema,
  maisVendidosQuerySchema,
} from '../validators/pedidoValidators';
import { idParamSchema } from '../validators/paramsValidators';
import { limitarCriacaoPedido } from '../utils/rateLimit';

const router = Router();

const podeVerPainel = exigirPermissao('dashboard:ver');

router.post('/', autenticar, limitarCriacaoPedido, validar(criarPedidoSchema), pedidoController.criar);
router.get('/', autenticar, validar(listarPedidosQuerySchema, 'query'), pedidoController.listar);

router.get('/resumo', autenticar, podeVerPainel, validar(resumoQuerySchema, 'query'), painelController.resumo);
router.get(
  '/mais-vendidos',
  autenticar,
  podeVerPainel,
  validar(maisVendidosQuerySchema, 'query'),
  painelController.maisVendidos
);

router.get('/:id', autenticarOuServico, validar(idParamSchema, 'params'), pedidoController.buscar);

router.patch(
  '/:id/status',
  autenticarOuServico,
  validar(idParamSchema, 'params'),
  validar(atualizarStatusSchema),
  pedidoController.atualizarStatus
);

export default router;
