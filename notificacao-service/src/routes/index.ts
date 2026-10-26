import { Router } from 'express';
import contatoRoutes from './contatoRoutes';
import logRoutes from './logRoutes';
import { vivo, pronto, metricas } from '../controllers/healthController';

const router = Router();

router.use('/contato', contatoRoutes);
router.use('/logs', logRoutes);

router.get('/health/live', vivo);
router.get('/health', pronto);
router.get('/metrics', metricas);

export default router;
