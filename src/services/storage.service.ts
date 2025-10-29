import { Readable } from "stream";
import MinioConfig from "../config/minio";
import logger from "../config/logger";
import { BadRequestError } from "../utils/errors/AppError";

/**
 * Storage Service for MinIO Object Storage Operations
 * Provides CRUD operations for file management with flexible directory structure
 */
class StorageService {
  private minioClient = MinioConfig.getClient();
  private bucketName = MinioConfig.getBucketName();

  /**
   * Build file path from directory and filename
   * @param directory - Directory path (e.g., "background", "documents/certificates")
   * @param fileName - File name (e.g., "logo.png")
   * @returns Full path (e.g., "background/logo.png")
   */
  private buildFilePath(directory: string, fileName: string): string {
    // Remove leading/trailing slashes from directory
    const cleanDir = directory.trim().replace(/^\/+|\/+$/g, "");
    const cleanFileName = fileName.trim();

    if (!cleanFileName) {
      throw new BadRequestError("File name cannot be empty");
    }

    // If directory is empty, return just the filename
    if (!cleanDir) {
      return cleanFileName;
    }

    return `${cleanDir}/${cleanFileName}`;
  }

  /**
   * Upload a file to MinIO storage
   * @param directory - Target directory (e.g., "background", "documents")
   * @param fileName - File name (e.g., "logo.png")
   * @param fileBuffer - File content as Buffer
   * @param contentType - MIME type (e.g., "image/png")
   * @param metadata - Optional metadata to attach to the file
   * @returns Object with file path and URL
   */
  async uploadFile(
    directory: string,
    fileName: string,
    fileBuffer: Buffer,
    contentType?: string,
    metadata?: Record<string, string>
  ): Promise<{ filePath: string; url: string; size: number }> {
    try {
      const filePath = this.buildFilePath(directory, fileName);

      // Prepare metadata
      const fileMetadata: Record<string, string> = {
        "Content-Type": contentType || "application/octet-stream",
        ...metadata,
      };

      // Upload file to MinIO
      await this.minioClient.putObject(
        this.bucketName,
        filePath,
        fileBuffer,
        fileBuffer.length,
        fileMetadata
      );

      logger.info(`File uploaded successfully`, {
        filePath,
        size: fileBuffer.length,
        contentType,
      });

      // Generate presigned URL for accessing the file (valid for 7 days)
      const url = await this.getFileUrl(directory, fileName, 7 * 24 * 60 * 60);

      return {
        filePath,
        url,
        size: fileBuffer.length,
      };
    } catch (error) {
      logger.error("Failed to upload file to MinIO", {
        directory,
        fileName,
        error,
      });
      throw new Error(
        `File upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Upload a file from stream
   * @param directory - Target directory
   * @param fileName - File name
   * @param fileStream - File content as Readable stream
   * @param contentType - MIME type
   * @param metadata - Optional metadata
   * @returns Object with file path and URL
   */
  async uploadFileStream(
    directory: string,
    fileName: string,
    fileStream: Readable,
    contentType?: string,
    metadata?: Record<string, string>
  ): Promise<{ filePath: string; url: string }> {
    try {
      const filePath = this.buildFilePath(directory, fileName);

      // Prepare metadata
      const fileMetadata: Record<string, string> = {
        "Content-Type": contentType || "application/octet-stream",
        ...metadata,
      };

      // Upload file stream to MinIO
      await this.minioClient.putObject(
        this.bucketName,
        filePath,
        fileStream,
        undefined,
        fileMetadata
      );

      logger.info(`File stream uploaded successfully`, {
        filePath,
        contentType,
      });

      // Generate presigned URL
      const url = await this.getFileUrl(directory, fileName, 7 * 24 * 60 * 60);

      return {
        filePath,
        url,
      };
    } catch (error) {
      logger.error("Failed to upload file stream to MinIO", {
        directory,
        fileName,
        error,
      });
      throw new Error(
        `File stream upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get/Download a file from MinIO storage
   * @param directory - Directory path
   * @param fileName - File name
   * @returns File stream and metadata
   */
  async getFile(
    directory: string,
    fileName: string
  ): Promise<{ stream: Readable; metadata: Record<string, any> }> {
    try {
      const filePath = this.buildFilePath(directory, fileName);

      // Check if file exists
      const exists = await this.fileExists(directory, fileName);
      if (!exists) {
        throw new BadRequestError(`File not found: ${filePath}`);
      }

      // Get file stream
      const stream = await this.minioClient.getObject(
        this.bucketName,
        filePath
      );

      // Get file metadata
      const stat = await this.minioClient.statObject(this.bucketName, filePath);

      logger.info(`File retrieved successfully`, { filePath });

      return {
        stream,
        metadata: {
          size: stat.size,
          etag: stat.etag,
          lastModified: stat.lastModified,
          contentType: stat.metaData?.["content-type"] || "application/octet-stream",
          ...stat.metaData,
        },
      };
    } catch (error) {
      logger.error("Failed to get file from MinIO", {
        directory,
        fileName,
        error,
      });
      throw new Error(
        `File retrieval failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Update a file (overwrites existing file)
   * This is essentially the same as upload - MinIO overwrites by default
   * @param directory - Directory path
   * @param fileName - File name
   * @param fileBuffer - New file content
   * @param contentType - MIME type
   * @param metadata - Optional metadata
   * @returns Object with file path and URL
   */
  async updateFile(
    directory: string,
    fileName: string,
    fileBuffer: Buffer,
    contentType?: string,
    metadata?: Record<string, string>
  ): Promise<{ filePath: string; url: string; size: number }> {
    try {
      const filePath = this.buildFilePath(directory, fileName);

      // Check if file exists
      const exists = await this.fileExists(directory, fileName);
      if (!exists) {
        throw new BadRequestError(`File not found: ${filePath}`);
      }

      // Upload new version (overwrites existing)
      const result = await this.uploadFile(
        directory,
        fileName,
        fileBuffer,
        contentType,
        metadata
      );

      logger.info(`File updated successfully`, { filePath });

      return result;
    } catch (error) {
      logger.error("Failed to update file in MinIO", {
        directory,
        fileName,
        error,
      });
      throw new Error(
        `File update failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Delete a file from MinIO storage
   * @param directory - Directory path
   * @param fileName - File name
   * @returns Success status
   */
  async deleteFile(
    directory: string,
    fileName: string
  ): Promise<{ success: boolean; filePath: string }> {
    try {
      const filePath = this.buildFilePath(directory, fileName);

      // Check if file exists
      const exists = await this.fileExists(directory, fileName);
      if (!exists) {
        throw new BadRequestError(`File not found: ${filePath}`);
      }

      // Delete file
      await this.minioClient.removeObject(this.bucketName, filePath);

      logger.info(`File deleted successfully`, { filePath });

      return {
        success: true,
        filePath,
      };
    } catch (error) {
      logger.error("Failed to delete file from MinIO", {
        directory,
        fileName,
        error,
      });
      throw new Error(
        `File deletion failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Delete multiple files at once
   * @param files - Array of {directory, fileName}
   * @returns Array of deletion results
   */
  async deleteFiles(
    files: Array<{ directory: string; fileName: string }>
  ): Promise<Array<{ filePath: string; success: boolean; error?: string }>> {
    const results: Array<{
      filePath: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const file of files) {
      try {
        const result = await this.deleteFile(file.directory, file.fileName);
        results.push({ ...result, success: true });
      } catch (error) {
        const filePath = this.buildFilePath(file.directory, file.fileName);
        results.push({
          filePath,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  }

  /**
   * Get presigned URL for file access
   * @param directory - Directory path
   * @param fileName - File name
   * @param expirySeconds - URL expiry time in seconds (default: 7 days)
   * @returns Presigned URL
   */
  async getFileUrl(
    directory: string,
    fileName: string,
    expirySeconds: number = 7 * 24 * 60 * 60
  ): Promise<string> {
    try {
      const filePath = this.buildFilePath(directory, fileName);

      // Generate presigned URL
      const url = await this.minioClient.presignedGetObject(
        this.bucketName,
        filePath,
        expirySeconds
      );

      return url;
    } catch (error) {
      logger.error("Failed to generate presigned URL", {
        directory,
        fileName,
        error,
      });
      throw new Error(
        `URL generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Check if a file exists
   * @param directory - Directory path
   * @param fileName - File name
   * @returns Boolean indicating if file exists
   */
  async fileExists(directory: string, fileName: string): Promise<boolean> {
    try {
      const filePath = this.buildFilePath(directory, fileName);
      await this.minioClient.statObject(this.bucketName, filePath);
      return true;
    } catch (error: any) {
      if (error.code === "NotFound") {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file metadata/info
   * @param directory - Directory path
   * @param fileName - File name
   * @returns File metadata
   */
  async getFileInfo(
    directory: string,
    fileName: string
  ): Promise<{
    size: number;
    etag: string;
    lastModified: Date;
    contentType: string;
    metadata: Record<string, any>;
  }> {
    try {
      const filePath = this.buildFilePath(directory, fileName);

      const stat = await this.minioClient.statObject(this.bucketName, filePath);

      return {
        size: stat.size,
        etag: stat.etag,
        lastModified: stat.lastModified,
        contentType: stat.metaData?.["content-type"] || "application/octet-stream",
        metadata: stat.metaData || {},
      };
    } catch (error) {
      logger.error("Failed to get file info", {
        directory,
        fileName,
        error,
      });
      throw new Error(
        `Failed to get file info: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * List files in a directory
   * @param directory - Directory path (empty string for root)
   * @param recursive - Whether to list recursively (default: false)
   * @returns Array of file objects
   */
  async listFiles(
    directory: string = "",
    recursive: boolean = false
  ): Promise<
    Array<{
      name: string;
      size: number;
      lastModified: Date;
      etag: string;
      isDirectory: boolean;
    }>
  > {
    return new Promise((resolve, reject) => {
      try {
        const prefix = directory
          ? directory.trim().replace(/^\/+|\/+$/g, "") + "/"
          : "";

        const stream = this.minioClient.listObjects(
          this.bucketName,
          prefix,
          recursive
        );

        const files: Array<{
          name: string;
          size: number;
          lastModified: Date;
          etag: string;
          isDirectory: boolean;
        }> = [];

        stream.on("data", (obj) => {
          if (obj.name && obj.size !== undefined && obj.lastModified && obj.etag) {
            files.push({
              name: obj.name,
              size: obj.size,
              lastModified: obj.lastModified,
              etag: obj.etag,
              isDirectory: obj.name.endsWith("/"),
            });
          }
        });

        stream.on("end", () => {
          logger.info(`Listed files successfully`, {
            directory,
            count: files.length,
          });
          resolve(files);
        });

        stream.on("error", (error) => {
          logger.error("Failed to list files", { directory, error });
          reject(error);
        });
      } catch (error) {
        logger.error("Failed to list files", { directory, error });
        reject(error);
      }
    });
  }

  /**
   * Copy a file from one location to another
   * @param sourceDir - Source directory
   * @param sourceFile - Source file name
   * @param destDir - Destination directory
   * @param destFile - Destination file name
   * @returns Object with destination file info
   */
  async copyFile(
    sourceDir: string,
    sourceFile: string,
    destDir: string,
    destFile: string
  ): Promise<{ filePath: string; url: string }> {
    try {
      const sourcePath = this.buildFilePath(sourceDir, sourceFile);
      const destPath = this.buildFilePath(destDir, destFile);

      // Copy object
      await this.minioClient.copyObject(
        this.bucketName,
        destPath,
        `/${this.bucketName}/${sourcePath}`
      );

      logger.info(`File copied successfully`, { sourcePath, destPath });

      const url = await this.getFileUrl(destDir, destFile, 7 * 24 * 60 * 60);

      return {
        filePath: destPath,
        url,
      };
    } catch (error) {
      logger.error("Failed to copy file", {
        sourceDir,
        sourceFile,
        destDir,
        destFile,
        error,
      });
      throw new Error(
        `File copy failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get bucket statistics
   * @returns Bucket statistics
   */
  async getBucketStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    bucketName: string;
  }> {
    return new Promise((resolve, reject) => {
      try {
        const stream = this.minioClient.listObjects(this.bucketName, "", true);

        let totalFiles = 0;
        let totalSize = 0;

        stream.on("data", (obj) => {
          if (obj.name && obj.size !== undefined && !obj.name.endsWith("/")) {
            totalFiles++;
            totalSize += obj.size;
          }
        });

        stream.on("end", () => {
          resolve({
            totalFiles,
            totalSize,
            bucketName: this.bucketName,
          });
        });

        stream.on("error", (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}

export default new StorageService();
