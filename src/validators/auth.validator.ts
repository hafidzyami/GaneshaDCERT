import { body, param, query } from "express-validator";

/**
 * Authentication Validators
 */

export const registerInstitutionValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 3, max: 255 })
    .withMessage("Name must be between 3 and 255 characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Must be a valid email")
    .normalizeEmail(),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone is required")
    .isMobilePhone("any")
    .withMessage("Must be a valid mobile phone number with a country code (e.g., +1... or +62...)"),

  body("country")
    .trim()
    .notEmpty()
    .withMessage("Country is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Country must be between 2 and 100 characters"),

  body("website")
    .trim()
    .notEmpty()
    .withMessage("Website is required")
    .isURL()
    .withMessage("Must be a valid URL"),

  body("address")
    .trim()
    .notEmpty()
    .withMessage("Address is required")
    .isLength({ min: 10, max: 500 })
    .withMessage("Address must be between 10 and 500 characters"),
];

export const approveInstitutionValidator = [
  param("institutionId")
    .trim()
    .notEmpty()
    .withMessage("Institution ID is required")
    .isUUID()
    .withMessage("Invalid institution ID format"),

  body("approvedBy")
    .trim()
    .notEmpty()
    .withMessage("Approver name is required")
    .isLength({ min: 3, max: 255 })
    .withMessage("Approver name must be between 3 and 255 characters"),
];

export const rejectInstitutionValidator = [
  param("institutionId")
    .trim()
    .notEmpty()
    .withMessage("Institution ID is required")
    .isUUID()
    .withMessage("Invalid institution ID format"),
];

export const verifyMagicLinkValidator = [
  body("token")
    .trim()
    .notEmpty()
    .withMessage("Token is required")
    .isJWT()
    .withMessage("Invalid token format"),
];

export const getAllRegistrationInstitutionsValidator = [
  query("status")
    .optional()
    .isIn(["PENDING", "APPROVED", "REJECTED"])
    .withMessage("Status must be PENDING, APPROVED, or REJECTED"),
];
