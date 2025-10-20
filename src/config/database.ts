import { PrismaClient } from '@prisma/client';
import { env } from './env';
import logger from './logger';

/**
 * Singleton Prisma Client Instance
 * Prevents multiple instances and connection pool exhaustion
 */
class DatabaseService {
  private static instance: PrismaClient;

  private constructor() {}

  public static getInstance(): PrismaClient {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new PrismaClient({
        log: env.NODE_ENV === 'development' 
          ? ['query', 'info', 'warn', 'error'] 
          : ['error'],
      });

      // Graceful shutdown
      process.on('beforeExit', async () => {
        await DatabaseService.instance.$disconnect();
      });
    }

    return DatabaseService.instance;
  }

  public static async connect(): Promise<void> {
    try {
      await DatabaseService.getInstance().$connect();
      logger.success('Database connected successfully');
    } catch (error) {
      logger.error('Database connection failed', error);
      process.exit(1);
    }
  }

  public static async disconnect(): Promise<void> {
    await DatabaseService.getInstance().$disconnect();
    logger.info('Database disconnected');
  }

  public static async isConnected(): Promise<boolean> {
    try {
      await DatabaseService.getInstance().$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error('Database health check failed', error);
      return false;
    }
  }
}

export const prisma = DatabaseService.getInstance();
export default DatabaseService;
