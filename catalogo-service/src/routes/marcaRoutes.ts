import { Router } from 'express';
import * as marcaController from '../controllers/marcaController';
import { autenticar } from '../middlewares/authMiddleware';
import { exigirPermissao } from '../middlewares/permissaoMiddleware';
import { validar } from '../middlewares/validate';
import { criarMarcaSchema, atualizarMarcaSchema } from '../validators/categoriaValidators';
import { idParamSchema } from '../validators/paramsValidators';

const router = Router();

const podeGerenciar = exigirPermissao('catalogo:gerenciar');

router.get('/', marcaController.listar);
router.post('/', autenticar, podeGerenciar, validar(criarMarcaSchema), marcaController.criar);
router.patch(
  '/:id',
  autenticar,
  validar(idParamSchema, 'params'),
  podeGerenciar,
  validar(atualizarMarcaSchema),
  marcaController.atualizar
);

export default router;
