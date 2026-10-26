import { Router } from 'express';
import * as contatoController from '../controllers/contatoController';
import { validar } from '../middlewares/validate';
import { contatoSchema } from '../validators/contatoValidators';
import { limitarContato } from '../utils/rateLimit';

const router = Router();

router.post('/', limitarContato, validar(contatoSchema), contatoController.enviar);

export default router;
