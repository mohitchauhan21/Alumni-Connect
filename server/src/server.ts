import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { logger } from './config/logger.js';
import http from 'http';

let server: http.Server | null = null;

async function startServer(): Promise<void> {
  try {
    // Attempt database connection
    try {
      await connectDatabase();
    } catch (dbErr) {
      logger.warn(
        { error: (dbErr as Error).message },
        'Initial database connection failed. Server will start in degraded mode.'
      );
    }

    server = app.listen(env.PORT, () => {
      logger.info(
        {
          port: env.PORT,
          env: env.NODE_ENV,
          clientUrl: env.CLIENT_URL,
        },
        `🚀 P11 Backend API listening on port ${env.PORT}`
      );
    });
  } catch (err) {
    logger.fatal({ err }, 'Fatal error during server startup');
    process.exit(1);
  }
}

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Graceful shutdown initiated');

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      try {
        await disconnectDatabase();
        logger.info('Database connections cleanly terminated');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error disconnecting database during shutdown');
        process.exit(1);
      }
    });

    // Force close after 10 seconds if graceful shutdown hangs
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown) => {
  logger.error({ reason }, 'Unhandled Promise Rejection detected');
});

process.on('uncaughtException', (err: Error) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'Uncaught Exception detected');
  process.exit(1);
});

startServer();
