import { Router } from 'express';
import * as produtoController from '../controllers/produtoController';
import { autenticar } from '../middlewares/authMiddleware';
import { exigirGestorParaInativos } from '../middlewares/inativosMiddleware';
import { exigirPermissao } from '../middlewares/permissaoMiddleware';
import { exigirTokenServico } from '../middlewares/servicoMiddleware';
import { receberImagem } from '../middlewares/uploadMiddleware';
import { validar } from '../middlewares/validate';
import {
  listarProdutosQuerySchema,
  limiteQuerySchema,
  criarProdutoSchema,
  atualizarProdutoSchema,
  baixaEstoqueSchema,
} from '../validators/produtoValidators';
import { idParamSchema } from '../validators/paramsValidators';
import { limitarUpload } from '../utils/rateLimit';

const router = Router();

const podeGerenciar = exigirPermissao('catalogo:gerenciar');
const podeVerPainel = exigirPermissao('dashboard:ver');

router.get('/', exigirGestorParaInativos, validar(listarProdutosQuerySchema, 'query'), produtoController.listar);
router.get('/destaque', validar(limiteQuerySchema, 'query'), produtoController.destaque);
router.get('/recentes', validar(limiteQuerySchema, 'query'), produtoController.recentes);

// Painel administrativo (RF46). Precisa vir antes de "/:id".
router.get('/resumo', autenticar, podeVerPainel, produtoController.resumo);

router.get('/:id', exigirGestorParaInativos, validar(idParamSchema, 'params'), produtoController.buscar);

router.post('/', autenticar, podeGerenciar, validar(criarProdutoSchema), produtoController.criar);
router.patch(
  '/:id',
  autenticar,
  validar(idParamSchema, 'params'),
  podeGerenciar,
  validar(atualizarProdutoSchema),
  produtoController.atualizar
);

// RF15: imagem do produto (multipart/form-data, campo "imagem"). A autenticação vem antes do upload
// para que quem não pode gerenciar nem consiga enviar o arquivo.
router.post(
  '/:id/imagem',
  autenticar,
  validar(idParamSchema, 'params'),
  podeGerenciar,
  limitarUpload,
  receberImagem,
  produtoController.enviarImagem
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
