import { PrismaClient } from '@prisma/client';

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
        log: process.env.NODE_ENV === 'development' 
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
      console.log('✅ Database connected successfully');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      process.exit(1);
    }
  }

  public static async disconnect(): Promise<void> {
    await DatabaseService.getInstance().$disconnect();
    console.log('Database disconnected');
  }
}

export const prisma = DatabaseService.getInstance();
export default DatabaseService;
