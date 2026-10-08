import { Router } from 'express';
import * as usuarioController from '../controllers/usuarioController';
import { autenticar } from '../middlewares/authMiddleware';
import { validar } from '../middlewares/validate';
import { criarUsuarioSchema } from '../validators/usuarioValidators';

const router = Router();

router.post('/', validar(criarUsuarioSchema), usuarioController.criar);
router.get('/:id', autenticar, usuarioController.buscarPorId);

export default router;
