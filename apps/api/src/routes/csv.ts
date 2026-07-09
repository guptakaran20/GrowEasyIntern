import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { analyzeCsv } from '../controllers/csvController';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (config.upload.allowedExtensions.includes(ext as '.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

const router = Router();

function handleUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (err: unknown) => {
    if (err) {
      next(new AppError('INVALID_FILE_TYPE', (err as Error).message, 415));
      return;
    }
    void analyzeCsv(req, res, next);
  });
}

router.post('/analyze', handleUpload);

export default router;
