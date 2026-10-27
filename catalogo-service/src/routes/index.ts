import { Router } from 'express';
import produtoRoutes from './produtoRoutes';
import categoriaRoutes from './categoriaRoutes';
import marcaRoutes from './marcaRoutes';
import { vivo, pronto, metricas } from '../controllers/healthController';

const router = Router();

router.use('/produtos', produtoRoutes);
router.use('/categorias', categoriaRoutes);
router.use('/marcas', marcaRoutes);

router.get('/health/live', vivo);
router.get('/health', pronto);
router.get('/metrics', metricas);

export default router;
