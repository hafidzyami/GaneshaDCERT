import { Request, Response, NextFunction } from "express";
import { verifySessionToken } from "../services";
import { HTTP_STATUS } from "../constants";
import { logger } from "../config";
import { prisma } from "../config/database";
import { generateSessionToken } from "../services/jwt.service";

/**
 * Extended Request interface with institution data
 */
export interface RequestWithInstitution extends Request {
  institutionData?: {
    id: string;
    email: string;
    name: string;
    phone: string;
    country: string;
    website: string;
    address: string;
  };
}

/**
 * Authentication Middleware
 * Verifies session token and attaches user info to request
 */
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Token tidak ditemukan",
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifySessionToken(token);

    if (!decoded) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Token tidak valid atau sudah kadaluarsa",
      });
      return;
    }

    // Attach decoded data to request
    req.institutionId = decoded.userId;
    req.email = decoded.email;

    logger.debug("Authentication successful", {
      institutionId: decoded.userId,
      email: decoded.email,
    });

    next();
  } catch (error) {
    logger.error("Error in authMiddleware", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Terjadi kesalahan server",
    });
  }
};

/**
 * Optional Institution Authentication Middleware
 * - For "individual" role: Token is optional (skip validation)
 * - For "institution" role: Token is REQUIRED and must be valid MagicLink
 *
 * This middleware validates MagicLink tokens from InstitutionRegistration
 */
export const optionalInstitutionAuthMiddleware = async (
  req: RequestWithInstitution,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { role } = req.body;

    // If role is "individual", skip token validation
    if (role === "individual") {
      logger.info("Individual DID registration - no token required");
      return next();
    }

    // If role is "institution", token is REQUIRED
    if (role === "institution") {
      const authHeader = req.headers.authorization;

      // Check if Authorization header exists
      if (!authHeader) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message:
            "Authorization token is required for institution registration",
        });
        return;
      }

      // Check Bearer format
      if (!authHeader.startsWith("Bearer ")) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: "Invalid token format. Use: Bearer <token>",
        });
        return;
      }

      // Extract token
      const token = authHeader.substring(7); // Remove "Bearer "

      if (!token) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: "Token is missing",
        });
        return;
      }

      // Query MagicLink with institution data
      const magicLink = await prisma.magicLink.findUnique({
        where: { token },
        include: {
          institution: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              country: true,
              website: true,
              address: true,
              status: true,
            },
          },
        },
      });

      // Check if magic link exists
      if (!magicLink) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: "Invalid or expired token",
        });
        return;
      }

      // Check if token is expired
      if (new Date() > magicLink.expiresAt) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: "Token has expired. Please request a new magic link.",
        });
        return;
      }

      // Check if token already used
      if (magicLink.used) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message:
            "Token has already been used. Please request a new magic link.",
        });
        return;
      }

      // Check if institution is approved
      if (magicLink.institution.status !== "APPROVED") {
        res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: `Institution registration is not approved. Current status: ${magicLink.institution.status}`,
        });
        return;
      }

      // Inject institution data into request
      req.institutionData = {
        id: magicLink.institution.id,
        email: magicLink.institution.email,
        name: magicLink.institution.name,
        phone: magicLink.institution.phone,
        country: magicLink.institution.country,
        website: magicLink.institution.website,
        address: magicLink.institution.address,
      };

      logger.success(
        `Institution authenticated via MagicLink: ${magicLink.institution.email}`
      );
      return next();
    }

    // If role is neither "individual" nor "institution", continue
    // Let validator handle invalid role
    next();
  } catch (error) {
    logger.error("Error in optionalInstitutionAuthMiddleware", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Terjadi kesalahan server",
    });
  }
};

/**
 * Optional Institution Authentication Middleware
 * - For "individual" role: Token is optional (skip validation)
 * - For "institution" role: Token is REQUIRED and must be valid MagicLink
 *
 * This middleware validates MagicLink tokens from InstitutionRegistration
 */
export const verifyTokenInstitutionAuthMiddleware = async (
  req: RequestWithInstitution,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { role, email } = req.body;

    // If role is "individual", skip token validation
    if (role === "individual") {
      logger.info("Individual DID registration - no token required");
      return next();
    }

    // If role is "institution", token is REQUIRED
    if (role === "institution") {
      const authHeader = req.headers.authorization;

      // Check if Authorization header exists
      if (!authHeader) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message:
            "Authorization token is required for institution registration",
        });
        return;
      }

      // Check Bearer format
      if (!authHeader.startsWith("Bearer ")) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: "Invalid token format. Use: Bearer <token>",
        });
        return;
      }

      // Extract token
      const token = authHeader.substring(7); // Remove "Bearer "

      if (!token) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: "Token is missing",
        });
        return;
      }

      const institution = await prisma.institutionRegistration.findUnique({
        where: { email },
      });

      // Check if institution registry not found
      if (!institution) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: `Institution with Email ${email} Not Found`,
        });
        return;
      }

      const sessionToken = generateSessionToken(
        institution.id,
        institution.email
      );

      // Check if token token match
      if (token === sessionToken) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: "Token does not match. Please fill your valid token.",
        });
        return;
      }

      logger.success(
        `Matching Token Institution Registration Success: ${token}`
      );
      return next();
    }

    // If role is neither "individual" nor "institution", continue
    // Let validator handle invalid role
    next();
  } catch (error) {
    logger.error("Error in optionalInstitutionAuthMiddleware", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Terjadi kesalahan server",
    });
  }
};
