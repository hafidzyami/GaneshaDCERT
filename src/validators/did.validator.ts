import { body, param } from "express-validator";

/**
 * DID Validators
 * Validates DID-related requests
 */

/**
 * Validator for registering new DID
 */
export const registerDIDValidator = [
  body("did_string")
    .trim()
    .notEmpty()
    .withMessage("DID string is required")
    .matches(/^did:dcert:[iu][a-zA-Z0-9_-]{44}$/)
    .withMessage(
      "Invalid DID format. Must follow pattern: did:method:identifier (e.g., did:dcert:123...)"
    ),

  body("public_key")
    .trim()
    .notEmpty()
    .withMessage("Public key is required")
    .matches(/^(?:[a-fA-F0-9]{66}|[a-fA-F0-9]{130})$/)
    .withMessage(
      "Invalid public key format. Must be hex string (64-65 bytes, 128-130 hex characters)"
    ),

  body("role")
    .trim()
    .notEmpty()
    .withMessage("Role is required")
    .isIn(["individual", "institution"])
    .withMessage("Role must be either 'individual' or 'institution'"),

  // Email field - required for institution role to query InstitutionRegistration
  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Must be a valid email address")
    .custom((value, { req }) => {
      // If role is institution, email is required
      if (req.body.role === "institution" && !value) {
        throw new Error("Email is required for institution role");
      }
      return true;
    }),
];

/**
 * Validator for checking DID existence
 */
export const checkDIDValidator = [
  param("did")
    .trim()
    .notEmpty()
    .withMessage("DID string is required")
    .matches(/^did:dcert:[iu][a-zA-Z0-9_-]{44}$/)
    .withMessage(
      "Invalid DID format. Must follow pattern: did:method:identifier (e.g., did:dcert:123...)"
    ),
];

/**
 * Validator for key rotation
 */
export const keyRotationValidator = [
  param("did")
    .trim()
    .notEmpty()
    .withMessage("DID parameter is required")
    .matches(/^did:dcert:[iu][a-zA-Z0-9_-]{44}$/)
    .withMessage("Invalid DID format"),

  body("new_public_key")
    .trim()
    .notEmpty()
    .withMessage("New public key is required")
    .matches(/^[a-fA-F0-9]{66,130}$/)
    .withMessage("Invalid new public key format"),

  body("signature")
    .trim()
    .notEmpty()
    .withMessage("Signature is required for verification")
    .matches(/^[a-fA-F0-9]+$/)
    .withMessage("Invalid signature format"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason must not exceed 500 characters"),
];

/**
 * Validator for DID deletion/deactivation
 */
export const deleteDIDValidator = [
  param("did")
    .trim()
    .notEmpty()
    .withMessage("DID parameter is required")
    .matches(/^did:dcert:[iu][a-zA-Z0-9_-]{44}$/)
    .withMessage("Invalid DID format"),

  body("signature")
    .trim()
    .notEmpty()
    .withMessage("Signature is required for verification")
    .matches(/^[a-fA-F0-9]+$/)
    .withMessage("Invalid signature format"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason must not exceed 500 characters"),
];

/**
 * Validator for getting DID document
 */
export const getDIDDocumentValidator = [
  param("did")
    .trim()
    .notEmpty()
    .withMessage("DID parameter is required")
    .matches(/^did:dcert:[iu][a-zA-Z0-9_-]{44}$/)
    .withMessage("Invalid DID format"),
];
