import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

// Sanitize MongoDB URI to mask credentials when logging
export function sanitizeMongoUri(uri: string): string {
  try {
    const url = new URL(uri.replace('mongodb+srv://', 'http://').replace('mongodb://', 'http://'));
    const isSrv = uri.startsWith('mongodb+srv://');
    const protocol = isSrv ? 'mongodb+srv://' : 'mongodb://';
    return `${protocol}${url.host}${url.pathname}`;
  } catch {
    return '[PROTECTED_MONGO_URI]';
  }
}

let isConnecting = false;

export async function connectDatabase(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (isConnecting) {
    // Wait for in-flight connection
    return new Promise((resolve, reject) => {
      mongoose.connection.once('connected', () => resolve(mongoose));
      mongoose.connection.once('error', reject);
    });
  }

  isConnecting = true;
  const maskedTarget = sanitizeMongoUri(uri);

  try {
    logger.info({ target: maskedTarget }, 'Connecting to MongoDB...');
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      autoIndex: env.NODE_ENV !== 'production',
    });

    logger.info({ target: maskedTarget }, '✅ MongoDB connection established successfully');
    isConnecting = false;
    return conn;
  } catch (error) {
    isConnecting = false;
    logger.error(
      { error: (error as Error).message, target: maskedTarget },
      '❌ Failed to connect to MongoDB'
    );
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('MongoDB connection closed');
  }
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

// Lifecycle listeners
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('error', err => {
  logger.error({ err: err.message }, 'MongoDB connection error event');
});
