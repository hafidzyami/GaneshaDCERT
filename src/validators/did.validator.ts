import { body, param } from "express-validator";

/**
 * DID Validators
 */

export const registerDIDValidator = [
  body("did_string")
    .trim()
    .notEmpty()
    .withMessage("DID string is required")
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid DID format. Must follow did:method:identifier pattern"),

  body("public_key")
    .trim()
    .notEmpty()
    .withMessage("Public key is required")
    .isLength({ min: 64 })
    .withMessage("Invalid public key length"),

  body("role")
    .trim()
    .notEmpty()
    .withMessage("Role is required")
    .isIn(["individual", "institutional", "Individual", "Institutional"])
    .withMessage("Role must be 'individual' or 'institutional'"),

  // Institutional fields (conditional validation handled in controller)
  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Must be a valid email"),

  body("name")
    .optional()
    .trim()
    .isLength({ min: 3, max: 255 })
    .withMessage("Name must be between 3 and 255 characters"),

  body("phone")
    .optional()
    .trim()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage("Must be a valid phone number"),

  body("country")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Country must be between 2 and 100 characters"),

  body("website")
    .optional()
    .trim()
    .isURL()
    .withMessage("Must be a valid URL"),

  body("address")
    .optional()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage("Address must be between 10 and 500 characters"),
];

export const checkDIDValidator = [
  param("did")
    .trim()
    .notEmpty()
    .withMessage("DID is required")
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid DID format"),
];

export const keyRotationValidator = [
  param("did")
    .trim()
    .notEmpty()
    .withMessage("DID is required")
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid DID format"),

  body("old_public_key")
    .optional()
    .trim()
    .isLength({ min: 64 })
    .withMessage("Invalid old public key length"),

  body("new_public_key")
    .trim()
    .notEmpty()
    .withMessage("New public key is required")
    .isLength({ min: 64 })
    .withMessage("Invalid new public key length"),

  body("iteration_number")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Iteration number must be a positive integer"),
];

export const deleteDIDValidator = [
  param("did")
    .trim()
    .notEmpty()
    .withMessage("DID is required")
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid DID format"),
];

export const getDIDDocumentValidator = [
  param("did")
    .trim()
    .notEmpty()
    .withMessage("DID is required")
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid DID format"),
];
