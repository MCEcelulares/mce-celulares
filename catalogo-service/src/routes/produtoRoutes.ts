import { Router } from 'express';
import * as produtoController from '../controllers/produtoController';
import { autenticar } from '../middlewares/authMiddleware';
import { exigirPermissao } from '../middlewares/permissaoMiddleware';
import { exigirTokenServico } from '../middlewares/servicoMiddleware';
import { validar } from '../middlewares/validate';
import {
  listarProdutosQuerySchema,
  limiteQuerySchema,
  criarProdutoSchema,
  atualizarProdutoSchema,
  baixaEstoqueSchema,
} from '../validators/produtoValidators';
import { idParamSchema } from '../validators/paramsValidators';

const router = Router();

const podeGerenciar = exigirPermissao('catalogo:gerenciar');

router.get('/', validar(listarProdutosQuerySchema, 'query'), produtoController.listar);
router.get('/destaque', validar(limiteQuerySchema, 'query'), produtoController.destaque);
router.get('/recentes', validar(limiteQuerySchema, 'query'), produtoController.recentes);
router.get('/:id', validar(idParamSchema, 'params'), produtoController.buscar);

router.post('/', autenticar, podeGerenciar, validar(criarProdutoSchema), produtoController.criar);
router.patch(
  '/:id',
  autenticar,
  validar(idParamSchema, 'params'),
  podeGerenciar,
  validar(atualizarProdutoSchema),
  produtoController.atualizar
);

// Chamadas pelo Vendas: baixa ao criar o pedido (RF16) e reposição se o pedido falhar ou for cancelado.
router.post(
  '/:id/estoque/baixa',
  exigirTokenServico,
  validar(idParamSchema, 'params'),
  validar(baixaEstoqueSchema),
  produtoController.baixarEstoque
);

router.post(
  '/:id/estoque/reposicao',
  exigirTokenServico,
  validar(idParamSchema, 'params'),
  validar(baixaEstoqueSchema),
  produtoController.reporEstoque
);

export default router;
