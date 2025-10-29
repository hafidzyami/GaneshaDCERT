import * as Minio from "minio";
import { env } from "./env";
import logger from "./logger";

/**
 * MinIO Client Configuration
 * Singleton instance for object storage operations
 */
class MinioConfig {
  private static instance: Minio.Client | null = null;
  private static bucketName: string = env.MINIO_BUCKET_NAME;

  /**
   * Get MinIO client instance (Singleton pattern)
   */
  public static getClient(): Minio.Client {
    if (!MinioConfig.instance) {
      try {
        MinioConfig.instance = new Minio.Client({
          endPoint: env.MINIO_ENDPOINT,
          port: env.MINIO_PORT,
          useSSL: env.MINIO_USE_SSL,
          accessKey: env.MINIO_ROOT_USER,
          secretKey: env.MINIO_ROOT_PASSWORD,
        });

        logger.info("MinIO client initialized successfully", {
          endpoint: env.MINIO_ENDPOINT,
          port: env.MINIO_PORT,
          useSSL: env.MINIO_USE_SSL,
          bucket: MinioConfig.bucketName,
        });
      } catch (error) {
        logger.error("Failed to initialize MinIO client", { error });
        throw new Error(
          `MinIO initialization failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    return MinioConfig.instance;
  }

  /**
   * Get default bucket name
   */
  public static getBucketName(): string {
    return MinioConfig.bucketName;
  }

  /**
   * Initialize bucket - create if not exists
   */
  public static async initializeBucket(): Promise<void> {
    const client = MinioConfig.getClient();
    const bucketName = MinioConfig.getBucketName();

    try {
      const bucketExists = await client.bucketExists(bucketName);

      if (!bucketExists) {
        await client.makeBucket(bucketName, "us-east-1");
        logger.info(`Bucket '${bucketName}' created successfully`);
      } else {
        logger.info(`Bucket '${bucketName}' already exists`);
      }
    } catch (error) {
      logger.error(`Failed to initialize bucket '${bucketName}'`, { error });
      throw new Error(
        `Bucket initialization failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Check MinIO connection health
   */
  public static async checkHealth(): Promise<boolean> {
    try {
      const client = MinioConfig.getClient();
      const bucketName = MinioConfig.getBucketName();
      await client.bucketExists(bucketName);
      return true;
    } catch (error) {
      logger.error("MinIO health check failed", { error });
      return false;
    }
  }
}

// Initialize bucket on module load
MinioConfig.initializeBucket().catch((error) => {
  logger.error("Failed to initialize MinIO bucket on startup", { error });
});

export default MinioConfig;
export { MinioConfig };
