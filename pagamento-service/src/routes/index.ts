import { Router } from 'express';
import pagamentoRoutes from './pagamentoRoutes';
import { vivo, pronto, metricas } from '../controllers/healthController';

const router = Router();

router.use('/pagamentos', pagamentoRoutes);

router.get('/health/live', vivo);
router.get('/health', pronto);
router.get('/metrics', metricas);

export default router;
