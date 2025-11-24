import multer from "multer";
import { Request, Response, NextFunction } from "express";
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

// Middleware to require image file after multer processes the request
export const requireImageFile = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.file) {
    throw new BadRequestError("Background image is required");
  }
  next();
};

// Middleware to require either image_link or image file for update
export const requireImageOrLink = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const hasImageFile = !!req.file;
  const hasImageLink = !!req.body.image_link;

  if (!hasImageFile && !hasImageLink) {
    throw new BadRequestError(
      "Either background image file or image_link is required"
    );
  }

  next();
};

// Configure multer instance for any file upload (for VC documents)
export const uploadSingleFile = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
}).single("file"); // Field name is "file"
