import { Router } from 'express';
import usuarioRoutes from './usuarioRoutes';
import authRoutes from './authRoutes';
import enderecoRoutes from './enderecoRoutes';
import cargoRoutes from './cargoRoutes';
import permissaoRoutes from './permissaoRoutes';
import { vivo, pronto, metricas } from '../controllers/healthController';

const router = Router();

router.use('/usuarios/:id/enderecos', enderecoRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/cargos', cargoRoutes);
router.use('/permissoes', permissaoRoutes);
router.use('/auth', authRoutes);

router.get('/health/live', vivo);
router.get('/health', pronto);
router.get('/metrics', metricas);

export default router;
