import { Router } from 'express';
import * as authController from '../controllers/authController';
import { validar } from '../middlewares/validate';
import { loginSchema, loginGoogleSchema } from '../validators/authValidators';

const router = Router();

router.post('/login', validar(loginSchema), authController.login);
router.post('/google', validar(loginGoogleSchema), authController.loginGoogle);

export default router;
