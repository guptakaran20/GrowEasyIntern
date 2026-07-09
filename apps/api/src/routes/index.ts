import { Router } from 'express';
import healthRouter from './health';
import csvRouter from './csv';
import importRouter from './import';

const router = Router();

router.use(healthRouter);
router.use('/api/csv', csvRouter);
router.use('/api/import', importRouter);

export default router;
