import * as Minio from "minio";
import { env } from "./env";
import logger from "./logger";

/**
 * MinIO Client Configuration
 * Singleton instance for object storage operations
 */
class MinioConfig {
  private static instance: Minio.Client | null = null;
  private static publicClient: Minio.Client | null = null;
  private static bucketName: string = env.MINIO_BUCKET_NAME;
  private static publicUrl: string | undefined = env.MINIO_PUBLIC_URL;

  /**
   * Get MinIO client instance for internal operations (upload/download)
   * Uses MINIO_ENDPOINT (localhost or minio service name)
   */
  public static getClient(): Minio.Client {
    if (!MinioConfig.instance) {
      try {
        // Prioritize ACCESS_KEY/SECRET_KEY, fallback to ROOT_USER/PASSWORD
        const accessKey = env.MINIO_ACCESS_KEY || env.MINIO_ROOT_USER;
        const secretKey = env.MINIO_SECRET_KEY || env.MINIO_ROOT_PASSWORD;

        if (!accessKey || !secretKey) {
          throw new Error("MinIO credentials are required");
        }

        MinioConfig.instance = new Minio.Client({
          endPoint: env.MINIO_ENDPOINT,
          port: env.MINIO_PORT,
          useSSL: env.MINIO_USE_SSL,
          accessKey: accessKey,
          secretKey: secretKey,
        });

        logger.info("MinIO internal client initialized successfully", {
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
   * Get MinIO client instance for generating presigned URLs
   * Uses MINIO_PUBLIC_URL if available, otherwise falls back to internal client
   */
  public static getPublicClient(): Minio.Client {
    // If no public URL configured, use internal client
    if (!MinioConfig.publicUrl) {
      return MinioConfig.getClient();
    }

    if (!MinioConfig.publicClient) {
      try {
        const accessKey = env.MINIO_ACCESS_KEY || env.MINIO_ROOT_USER;
        const secretKey = env.MINIO_SECRET_KEY || env.MINIO_ROOT_PASSWORD;

        if (!accessKey || !secretKey) {
          throw new Error("MinIO credentials are required");
        }

        // Parse public URL to get endpoint and SSL settings
        const publicUrlObj = new URL(MinioConfig.publicUrl);
        const useSSL = publicUrlObj.protocol === "https:";
        const port = publicUrlObj.port
          ? parseInt(publicUrlObj.port)
          : useSSL
            ? 443
            : 80;

        MinioConfig.publicClient = new Minio.Client({
          endPoint: publicUrlObj.hostname,
          port: port,
          useSSL: useSSL,
          accessKey: accessKey,
          secretKey: secretKey,
        });

        logger.info("MinIO public client initialized successfully", {
          endpoint: publicUrlObj.hostname,
          port: port,
          useSSL: useSSL,
          publicUrl: MinioConfig.publicUrl,
        });
      } catch (error) {
        logger.error("Failed to initialize MinIO public client", { error });
        throw new Error(
          `MinIO public client initialization failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    return MinioConfig.publicClient;
  }

  /**
   * Get default bucket name
   */
  public static getBucketName(): string {
    return MinioConfig.bucketName;
  }

  /**
   * Get public URL for MinIO (used for presigned URLs accessible from browser)
   * If not set, falls back to constructing URL from endpoint
   */
  public static getPublicUrl(): string | undefined {
    return MinioConfig.publicUrl;
  }

  /**
   * Initialize bucket - create if not exists
   * @param throwOnError - If true, throws error on failure. If false, logs error only.
   */
  public static async initializeBucket(
    throwOnError: boolean = false
  ): Promise<boolean> {
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
      return true;
    } catch (error) {
      logger.error(`Failed to initialize bucket '${bucketName}'`, { error });
      if (throwOnError) {
        throw new Error(
          `Bucket initialization failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
      return false;
    }
  }

  /**
   * Ensure bucket exists (lazy initialization)
   * Creates bucket if it doesn't exist, used automatically by storage service
   */
  private static bucketInitialized = false;
  public static async ensureBucketExists(): Promise<void> {
    if (MinioConfig.bucketInitialized) {
      return; // Already initialized, skip
    }

    const success = await MinioConfig.initializeBucket(false);
    if (success) {
      MinioConfig.bucketInitialized = true;
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

// Note: Bucket initialization is now lazy-loaded on first use
// This prevents startup errors when MinIO is not immediately available

export default MinioConfig;
export { MinioConfig };
