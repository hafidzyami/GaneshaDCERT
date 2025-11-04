import multer from "multer";
import { BadRequestError } from "../utils/errors/AppError";

/**
 * Multer Middleware for File Uploads
 * Configured to store files in memory as Buffer
 */

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter for images only
const imageFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Accept images only
  if (!file.mimetype.startsWith("image/")) {
    return cb(
      new BadRequestError("Only image files are allowed (jpeg, jpg, png, gif, webp)")
    );
  }

  // Accept common image formats
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(
      new BadRequestError(
        "Invalid image format. Allowed formats: JPEG, JPG, PNG, GIF, WEBP"
      )
    );
  }

  cb(null, true);
};

// Configure multer instance for single image upload
export const uploadSingleImage = multer({
  storage: storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
}).single("image"); // Field name is "image"

// Configure multer instance for optional single image upload (doesn't throw error if no file)
export const uploadOptionalImage = multer({
  storage: storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
}).single("image"); // Field name is "image"
