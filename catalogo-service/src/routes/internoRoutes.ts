import { Router } from 'express';
import * as estoqueController from '../controllers/estoqueController';
import { autenticarServico } from '../middlewares/servicoMiddleware';
import { validar } from '../middlewares/validate';
import { reservarEstoqueSchema, consultarProdutosInternoSchema } from '../validators/estoqueValidators';
import { idPedidoParamSchema } from '../validators/paramsValidators';

// Rotas só para outros serviços (Vendas). O nginx bloqueia /catalogo/interno/ e aqui exigimos o token de serviço (ADR-009).
const router = Router();

router.use(autenticarServico);

router.get('/produtos', validar(consultarProdutosInternoSchema, 'query'), estoqueController.consultarProdutos);
router.post('/reservas', validar(reservarEstoqueSchema), estoqueController.reservar);
router.get('/reservas/:idPedido', validar(idPedidoParamSchema, 'params'), estoqueController.buscarReserva);
router.post(
  '/reservas/:idPedido/devolucao',
  validar(idPedidoParamSchema, 'params'),
  estoqueController.devolver
);

export default router;
