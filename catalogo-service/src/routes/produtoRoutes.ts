import { Router } from 'express';
import * as produtoController from '../controllers/produtoController';
import { autenticar, autenticarOpcional } from '../middlewares/authMiddleware';
import { exigirPermissao } from '../middlewares/permissaoMiddleware';
import { validar } from '../middlewares/validate';
import { receberImagem } from '../middlewares/uploadImagem';
import { permissaoGerenciar } from '../config/catalogo';
import {
  criarProdutoSchema,
  atualizarProdutoSchema,
  ajustarEstoqueSchema,
  listarProdutosQuerySchema,
  vitrineQuerySchema,
} from '../validators/produtoValidators';
import { idParamSchema } from '../validators/paramsValidators';

const router = Router();

const podeGerenciar = exigirPermissao(permissaoGerenciar);

router.get('/', autenticarOpcional, validar(listarProdutosQuerySchema, 'query'), produtoController.listar);
router.get('/destaque', validar(vitrineQuerySchema, 'query'), produtoController.destaques);
router.get('/recentes', validar(vitrineQuerySchema, 'query'), produtoController.recentes);
router.get('/:id', autenticarOpcional, validar(idParamSchema, 'params'), produtoController.buscar);

router.post('/', autenticar, podeGerenciar, validar(criarProdutoSchema), produtoController.criar);
router.patch(
  '/:id',
  autenticar,
  validar(idParamSchema, 'params'),
  podeGerenciar,
  validar(atualizarProdutoSchema),
  produtoController.atualizar
);
router.delete('/:id', autenticar, validar(idParamSchema, 'params'), podeGerenciar, produtoController.inativar);

router.patch(
  '/:id/estoque',
  autenticar,
  validar(idParamSchema, 'params'),
  podeGerenciar,
  validar(ajustarEstoqueSchema),
  produtoController.ajustarEstoque
);

router.put(
  '/:id/imagem',
  autenticar,
  validar(idParamSchema, 'params'),
  podeGerenciar,
  receberImagem,
  produtoController.enviarImagem
);
router.delete('/:id/imagem', autenticar, validar(idParamSchema, 'params'), podeGerenciar, produtoController.removerImagem);

export default router;
