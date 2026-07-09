import { Router } from 'express';
import {
  processImportSync,
  startImport,
  getImportProgress,
  getImportResult,
} from '../controllers/importController';

const router = Router();

router.post('/process', processImportSync);
router.post('/start', startImport);
router.get('/:jobId/progress', getImportProgress);
router.get('/:jobId/result', getImportResult);

export default router;
