import { Router } from 'express';
import * as cargoController from '../controllers/cargoController';
import { autenticar } from '../middlewares/authMiddleware';
import { exigirPermissao } from '../middlewares/permissaoMiddleware';
import { validar } from '../middlewares/validate';
import {
  criarCargoSchema,
  atualizarCargoSchema,
  definirPermissoesDoCargoSchema,
} from '../validators/cargoValidators';
import { idParamSchema } from '../validators/paramsValidators';

const router = Router();

const podeLer = exigirPermissao('cargos:gerenciar', 'usuarios:gerenciar-cargos');
const podeEscrever = exigirPermissao('cargos:gerenciar');

router.get('/', autenticar, podeLer, cargoController.listar);
router.get('/:id', autenticar, validar(idParamSchema, 'params'), podeLer, cargoController.buscar);
router.post('/', autenticar, podeEscrever, validar(criarCargoSchema), cargoController.criar);
router.patch(
  '/:id',
  autenticar,
  validar(idParamSchema, 'params'),
  podeEscrever,
  validar(atualizarCargoSchema),
  cargoController.renomear
);
router.delete('/:id', autenticar, validar(idParamSchema, 'params'), podeEscrever, cargoController.excluir);
router.put(
  '/:id/permissoes',
  autenticar,
  validar(idParamSchema, 'params'),
  podeEscrever,
  validar(definirPermissoesDoCargoSchema),
  cargoController.definirPermissoes
);

export default router;
