import { Router } from 'express';
import * as categoriaController from '../controllers/categoriaController';
import { autenticar, autenticarOpcional, autenticarSeIncluirInativos } from '../middlewares/authMiddleware';
import { exigirPermissao } from '../middlewares/permissaoMiddleware';
import { validar } from '../middlewares/validate';
import { permissaoGerenciar } from '../config/catalogo';
import {
  criarCategoriaSchema,
  atualizarCategoriaSchema,
  listarCadastrosQuerySchema,
} from '../validators/categoriaValidators';
import { idParamSchema } from '../validators/paramsValidators';

const router = Router();

const podeGerenciar = exigirPermissao(permissaoGerenciar);

router.get(
  '/',
  autenticarSeIncluirInativos,
  autenticarOpcional,
  validar(listarCadastrosQuerySchema, 'query'),
  categoriaController.listar
);
router.get('/:id', autenticarOpcional, validar(idParamSchema, 'params'), categoriaController.buscar);
router.post('/', autenticar, podeGerenciar, validar(criarCategoriaSchema), categoriaController.criar);
router.patch(
  '/:id',
  autenticar,
  validar(idParamSchema, 'params'),
  podeGerenciar,
  validar(atualizarCategoriaSchema),
  categoriaController.atualizar
);
router.delete('/:id', autenticar, validar(idParamSchema, 'params'), podeGerenciar, categoriaController.excluir);

export default router;
