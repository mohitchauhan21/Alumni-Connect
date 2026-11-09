/**
 * upload.ts
 * Multer memory storage configuration for secure file uploads.
 * Restricts files to in-memory buffers; never writes files to public disk storage.
 */

import multer from 'multer';
import { Request } from 'express';
import { AppError } from './errorHandler.js';
import { MAX_FILE_SIZE_BYTES } from '../modules/verification/csv.service.js';

const storage = multer.memoryStorage();

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback
): void {
  // Allow text/csv, text/plain, or files with .csv extension
  const hasCsvExtension = file.originalname.toLowerCase().endsWith('.csv');
  const isCsvMime = [
    'text/csv',
    'text/plain',
    'application/vnd.ms-excel',
    'application/csv',
    'text/x-csv',
  ].includes(file.mimetype);

  if (hasCsvExtension || isCsvMime) {
    callback(null, true);
  } else {
    callback(
      new AppError(
        'Invalid file type. Please upload a standard comma-separated (.csv) file.',
        400,
        'INVALID_FILE_TYPE'
      )
    );
  }
}

export const csvUpload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter,
});
