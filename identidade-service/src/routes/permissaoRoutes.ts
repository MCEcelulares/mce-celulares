import { Router } from 'express';
import * as permissaoController from '../controllers/permissaoController';
import { autenticar } from '../middlewares/authMiddleware';
import { exigirPermissao } from '../middlewares/permissaoMiddleware';
import { validar } from '../middlewares/validate';
import { criarPermissaoSchema, atualizarPermissaoSchema } from '../validators/cargoValidators';
import { idParamSchema } from '../validators/paramsValidators';

const router = Router();
const pode = exigirPermissao('cargos:gerenciar');

router.get('/', autenticar, pode, permissaoController.listar);
router.get('/:id', autenticar, validar(idParamSchema, 'params'), pode, permissaoController.buscar);
router.post('/', autenticar, pode, validar(criarPermissaoSchema), permissaoController.criar);
router.patch(
  '/:id',
  autenticar,
  validar(idParamSchema, 'params'),
  pode,
  validar(atualizarPermissaoSchema),
  permissaoController.renomear
);
router.delete('/:id', autenticar, validar(idParamSchema, 'params'), pode, permissaoController.excluir);

export default router;
