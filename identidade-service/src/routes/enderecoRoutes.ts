import { Router } from 'express';
import * as enderecoController from '../controllers/enderecoController';
import { autenticar } from '../middlewares/authMiddleware';
import { validar } from '../middlewares/validate';
import { criarEnderecoSchema } from '../validators/enderecoValidators';

const router = Router({ mergeParams: true });

router.get('/', autenticar, enderecoController.listar);
router.post('/', autenticar, validar(criarEnderecoSchema), enderecoController.criar);
router.patch('/:idEndereco/principal', autenticar, enderecoController.marcarPrincipal);

export default router;
