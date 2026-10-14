import { Router } from 'express';
import * as usuarioController from '../controllers/usuarioController';
import { autenticar } from '../middlewares/authMiddleware';
import { exigirPermissao, donoOuPermissao } from '../middlewares/permissaoMiddleware';
import { validar } from '../middlewares/validate';
import { limitarCadastro } from '../utils/rateLimit';
import {
  criarUsuarioSchema,
  atualizarPerfilSchema,
  alterarSenhaSchema,
  listarUsuariosQuerySchema,
  definirCargosSchema,
  atualizarUsuarioAdminSchema,
  alterarStatusSchema,
} from '../validators/usuarioValidators';
import { idParamSchema } from '../validators/paramsValidators';

const router = Router();

router.post('/', limitarCadastro, validar(criarUsuarioSchema), usuarioController.criar);

router.get(
  '/',
  autenticar,
  exigirPermissao('usuarios:listar'),
  validar(listarUsuariosQuerySchema, 'query'),
  usuarioController.listar
);

router.get('/me', autenticar, usuarioController.me);
router.patch('/me', autenticar, validar(atualizarPerfilSchema), usuarioController.atualizarPerfil);
router.patch('/me/senha', autenticar, validar(alterarSenhaSchema), usuarioController.alterarSenha);

router.get(
  '/:id',
  autenticar,
  validar(idParamSchema, 'params'),
  donoOuPermissao('usuarios:ver'),
  usuarioController.buscarPorId
);

router.patch(
  '/:id',
  autenticar,
  validar(idParamSchema, 'params'),
  exigirPermissao('usuarios:editar'),
  validar(atualizarUsuarioAdminSchema),
  usuarioController.atualizarComoAdmin
);

router.patch(
  '/:id/status',
  autenticar,
  validar(idParamSchema, 'params'),
  exigirPermissao('usuarios:editar'),
  validar(alterarStatusSchema),
  usuarioController.alterarStatus
);

router.delete(
  '/:id',
  autenticar,
  validar(idParamSchema, 'params'),
  exigirPermissao('usuarios:excluir'),
  usuarioController.excluir
);

router.put(
  '/:id/cargos',
  autenticar,
  validar(idParamSchema, 'params'),
  exigirPermissao('usuarios:gerenciar-cargos'),
  validar(definirCargosSchema),
  usuarioController.definirCargos
);

export default router;
