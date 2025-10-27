import { body, param } from "express-validator";

/**
 * Notification Validators
 */

export const registerPushTokenValidator = [
  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^did:dcert:[iu][a-zA-Z0-9_-]{44}$/)
    .withMessage("Invalid holder DID format"),

  body("token").trim().notEmpty().withMessage("Push token is required"),

  body("deviceInfo")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Device info must not exceed 500 characters"),
];

export const unregisterPushTokenValidator = [
  body("token").trim().notEmpty().withMessage("Push token is required"),
];

export const getPushTokensByHolderValidator = [
  param("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^did:dcert:[iu][a-zA-Z0-9_-]{44}$/)
    .withMessage("Invalid holder DID format"),
];

export const sendPushNotificationValidator = [
  body("holder_dids")
    .isArray({ min: 1 })
    .withMessage("holder_dids must be a non-empty array"),

  body("holder_dids.*")
    .trim()
    .matches(/^did:dcert:[iu][a-zA-Z0-9_-]{44}$/)
    .withMessage("Each holder DID must be valid"),

  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 100 })
    .withMessage("Title must not exceed 100 characters"),

  body("body")
    .trim()
    .notEmpty()
    .withMessage("Body is required")
    .isLength({ max: 500 })
    .withMessage("Body must not exceed 500 characters"),

  body("data").optional().isObject().withMessage("Data must be an object"),
];
