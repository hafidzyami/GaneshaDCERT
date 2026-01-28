import {
    body,
    query,
    param,
    header,
    ValidationChain,
    CustomValidator,
} from "express-validator";

export const paymentValidators: ValidationChain[] = [
    body("holder_did")
        .exists({ checkFalsy: true })
        .withMessage("Holder DID is required")
        .isString()
        .withMessage("Holder DID must be a string"),
    body("item_ids")
        .exists({ checkFalsy: true })
        .withMessage("Item IDs are required")
        .isArray({ min: 1 })
        .withMessage("Item IDs must be a non-empty array"),
    body("currency")
        .optional()
        .isString()
        .withMessage("Currency must be a string")
        .isLength({ min: 3, max: 3 })
        .withMessage("Currency must be a 3-letter code (e.g., IDR, USD)")
        .toUpperCase(),
];

export const getUnpaidItemsValidator: ValidationChain[] = [
    body("holder_did")
        .exists({ checkFalsy: true })
        .withMessage("Holder DID is required")
        .isString()
        .withMessage("Holder DID must be a string")
        .notEmpty()
        .withMessage("Holder DID cannot be empty"),
];

export const getItemFromBlockchainValidator: ValidationChain[] = [
    param("id")
        .exists({ checkFalsy: true })
        .withMessage("Item ID is required")
        .isString()
        .withMessage("Item ID must be a string")
        .notEmpty()
        .withMessage("Item ID cannot be empty"),
];

export const getOrderFromBlockchainValidator: ValidationChain[] = [
    param("id")
        .exists({ checkFalsy: true })
        .withMessage("Order ID is required")
        .isString()
        .withMessage("Order ID must be a string")
        .notEmpty()
        .withMessage("Order ID cannot be empty"),
];

export const getPaymentFromBlockchainValidator: ValidationChain[] = [
    param("id")
        .exists({ checkFalsy: true })
        .withMessage("Payment ID is required")
        .isString()
        .withMessage("Payment ID must be a string")
        .notEmpty()
        .withMessage("Payment ID cannot be empty"),
];

export const dokuWebhookHeaderValidators: ValidationChain[] = [
    header("client-id")
        .exists({ checkFalsy: true })
        .withMessage("Client-Id header is required")
        .isString()
        .withMessage("Client-Id must be a string"),
    header("request-id")
        .exists({ checkFalsy: true })
        .withMessage("Request-Id header is required")
        .isUUID()
        .withMessage("Request-Id must be a valid UUID"),
    header("request-timestamp")
        .exists({ checkFalsy: true })
        .withMessage("Request-Timestamp header is required")
        .isISO8601()
        .withMessage("Request-Timestamp must be a valid ISO 8601 timestamp"),
    header("signature")
        .exists({ checkFalsy: true })
        .withMessage("Signature header is required")
        .isString()
        .withMessage("Signature must be a string")
        .matches(/^HMACSHA256=/)
        .withMessage("Signature must start with HMACSHA256="),
];



export const vaPaymentNotificationHeaderValidators: ValidationChain[] = [
    header("client-id")
        .exists({ checkFalsy: true })
        .withMessage("Client-Id header is required")
        .isString()
        .withMessage("Client-Id must be a string"),
    header("request-id")
        .exists({ checkFalsy: true })
        .withMessage("Request-Id header is required")
        .isString()
        .withMessage("Request-Id must be a string")
        .isLength({ max: 128 })
        .withMessage("Request-Id must not exceed 128 characters"),
    header("request-timestamp")
        .exists({ checkFalsy: true })
        .withMessage("Request-Timestamp header is required")
        .isString()
        .withMessage("Request-Timestamp must be a string")
        .isISO8601()
        .withMessage("Request-Timestamp must be in ISO8601 format"),
    header("signature")
        .exists({ checkFalsy: true })
        .withMessage("Signature header is required")
        .isString()
        .withMessage("Signature must be a string"),
];

/**
 * Validator for DOKU VA payment notification body
 * Updated to support multiple payment types: VA, Credit Card, O2O, E-wallet, Debit, Paylater, QRIS
 */
export const vaPaymentNotificationBodyValidators: ValidationChain[] = [
    body("service.id")
        .exists({ checkFalsy: true })
        .withMessage("service.id is required")
        .isString()
        .withMessage("service.id must be a string"),
    body("acquirer.id")
        .optional()
        .isString()
        .withMessage("acquirer.id must be a string"),
    body("channel.id")
        .optional()
        .isString()
        .withMessage("channel.id must be a string"),
    body("transaction.status")
        .exists({ checkFalsy: true })
        .withMessage("transaction.status is required")
        .isString()
        .withMessage("transaction.status must be a string"),
    body("transaction.date")
        .exists({ checkFalsy: true })
        .withMessage("transaction.date is required")
        .isString()
        .withMessage("transaction.date must be a string"),
    body("order.invoice_number")
        .exists({ checkFalsy: true })
        .withMessage("order.invoice_number is required")
        .isString()
        .withMessage("order.invoice_number must be a string"),
    body("order.amount")
        .exists({ checkFalsy: true })
        .withMessage("order.amount is required"),
    
    // Optional fields that may exist depending on payment type
    body("transaction.original_request_id")
        .optional()
        .isString()
        .withMessage("transaction.original_request_id must be a string"),
    body("customer")
        .optional()
        .isObject()
        .withMessage("customer must be an object"),
    body("virtual_account_info")
        .optional()
        .isObject()
        .withMessage("virtual_account_info must be an object"),
    body("card_payment")
        .optional()
        .isObject()
        .withMessage("card_payment must be an object"),
    body("online_to_offline_info")
        .optional()
        .isObject()
        .withMessage("online_to_offline_info must be an object"),
    body("emoney_payment")
        .optional()
        .isObject()
        .withMessage("emoney_payment must be an object"),
    body("peer_to_peer_info")
        .optional()
        .isObject()
        .withMessage("peer_to_peer_info must be an object"),
];
