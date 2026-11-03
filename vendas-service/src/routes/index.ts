import { Router } from 'express';
import carrinhoRoutes from './carrinhoRoutes';
import pedidoRoutes from './pedidoRoutes';
import { vivo, pronto, metricas } from '../controllers/healthController';

const router = Router();

router.use('/carrinho', carrinhoRoutes);
router.use('/pedidos', pedidoRoutes);

router.get('/health/live', vivo);
router.get('/health', pronto);
router.get('/metrics', metricas);

export default router;
