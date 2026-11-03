import { Router } from 'express';
import * as carrinhoController from '../controllers/carrinhoController';
import { autenticar } from '../middlewares/authMiddleware';
import { validar } from '../middlewares/validate';
import { adicionarItemSchema, atualizarItemSchema } from '../validators/carrinhoValidators';
import { idParamSchema } from '../validators/paramsValidators';

const router = Router();

router.use(autenticar);

router.get('/', carrinhoController.buscar);
router.post('/itens', validar(adicionarItemSchema), carrinhoController.adicionarItem);
router.patch(
  '/itens/:id',
  validar(idParamSchema, 'params'),
  validar(atualizarItemSchema),
  carrinhoController.atualizarItem
);
router.delete('/itens/:id', validar(idParamSchema, 'params'), carrinhoController.removerItem);

export default router;
