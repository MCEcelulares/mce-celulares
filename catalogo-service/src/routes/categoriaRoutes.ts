import { Router } from 'express';
import * as categoriaController from '../controllers/categoriaController';
import { autenticar } from '../middlewares/authMiddleware';
import { exigirPermissao } from '../middlewares/permissaoMiddleware';
import { validar } from '../middlewares/validate';
import { criarCategoriaSchema, atualizarCategoriaSchema } from '../validators/categoriaValidators';
import { idParamSchema } from '../validators/paramsValidators';

const router = Router();

const podeGerenciar = exigirPermissao('catalogo:gerenciar');

router.get('/', categoriaController.listar);
router.post('/', autenticar, podeGerenciar, validar(criarCategoriaSchema), categoriaController.criar);
router.patch(
  '/:id',
  autenticar,
  validar(idParamSchema, 'params'),
  podeGerenciar,
  validar(atualizarCategoriaSchema),
  categoriaController.atualizar
);

export default router;
