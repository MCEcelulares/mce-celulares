import { Router } from 'express';
import usuarioRoutes from './usuarioRoutes';
import authRoutes from './authRoutes';
import enderecoRoutes from './enderecoRoutes';

const router = Router();

router.use('/usuarios/:id/enderecos', enderecoRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/auth', authRoutes);

router.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

export default router;
