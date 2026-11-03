import { Router } from 'express';
import * as marcaController from '../controllers/marcaController';
import { autenticar, autenticarOpcional } from '../middlewares/authMiddleware';
import { exigirPermissao } from '../middlewares/permissaoMiddleware';
import { validar } from '../middlewares/validate';
import { permissaoGerenciar } from '../config/catalogo';
import { criarMarcaSchema, atualizarMarcaSchema } from '../validators/marcaValidators';
import { listarCadastrosQuerySchema } from '../validators/categoriaValidators';
import { idParamSchema } from '../validators/paramsValidators';

const router = Router();

const podeGerenciar = exigirPermissao(permissaoGerenciar);

router.get('/', autenticarOpcional, validar(listarCadastrosQuerySchema, 'query'), marcaController.listar);
router.get('/:id', autenticarOpcional, validar(idParamSchema, 'params'), marcaController.buscar);
router.post('/', autenticar, podeGerenciar, validar(criarMarcaSchema), marcaController.criar);
router.patch(
  '/:id',
  autenticar,
  validar(idParamSchema, 'params'),
  podeGerenciar,
  validar(atualizarMarcaSchema),
  marcaController.atualizar
);
router.delete('/:id', autenticar, validar(idParamSchema, 'params'), podeGerenciar, marcaController.excluir);

export default router;
