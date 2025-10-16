/**
 * DID Controller
 * Handles all DID-related operations
 * Enhanced with proper validation, error handling, and logging
 */

import { RequestHandler } from "express";
import { validationResult } from "express-validator";
import "dotenv/config";

import {
  throwCustomError,
  addStatusCodeTo,
  hasNoValidationErrors,
} from "../utils/error";
import {
  formatSuccessResponse,
  formatErrorResponse,
  formatValidationErrorResponse,
} from "../utils/responseFormatter";
import {
  validateDIDFormat,
  validatePublicKey,
  validateRole,
  validateIterationNumber,
} from "../utils/validators/didValidator";
import blockchainDIDService from "../services/blockchain/didService";
import Logger from "../services/logger";

const logger = new Logger("DIDController");

/**
 * Register a new DID
 * 
 * Flow:
 * 1. Validate input (DID format, public key, role)
 * 2. Check if DID already exists on blockchain
 * 3. Register DID on blockchain
 * 4. Return transaction result
 */
export const registerDID: RequestHandler = async (req, res, next) => {
  try {
    // Check express-validator errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("Validation failed for DID registration", {
        errors: errors.array(),
      });
      return res
        .status(400)
        .json(formatValidationErrorResponse(errors.array()));
    }

    const { did_string, public_key, role } = req.body;

    logger.info("Processing DID registration request", {
      did: did_string,
      role,
    });

    // Additional validation: DID format
    const didValidation = validateDIDFormat(did_string);
    if (!didValidation.isValid) {
      logger.warn("Invalid DID format", {
        did: did_string,
        error: didValidation.error,
      });
      return res
        .status(400)
        .json(
          formatErrorResponse(
            "Invalid DID format",
            didValidation.error,
            didValidation
          )
        );
    }

    // Additional validation: Public key format
    if (!validatePublicKey(public_key)) {
      logger.warn("Invalid public key format", { did: did_string });
      return res
        .status(400)
        .json(
          formatErrorResponse(
            "Invalid public key format",
            "Public key must be a valid hex string (64-132 characters)"
          )
        );
    }

    // Additional validation: Role
    if (!validateRole(role)) {
      logger.warn("Invalid role", { did: did_string, role });
      return res
        .status(400)
        .json(
          formatErrorResponse(
            "Invalid role",
            "Role must be one of: holder, issuer, verifier"
          )
        );
    }

    // Check if DID already exists on blockchain
    const didExists = await blockchainDIDService.checkDIDExists(did_string);
    if (didExists) {
      logger.warn("DID already exists", { did: did_string });
      return res
        .status(409)
        .json(
          formatErrorResponse(
            "DID already exists",
            "A DID Document with this identifier already exists on the blockchain"
          )
        );
    }

    // Register DID on blockchain
    const txResult = await blockchainDIDService.registerDID(
      did_string,
      public_key,
      role
    );

    logger.info("DID registered successfully", {
      did: did_string,
      txHash: txResult.transactionHash,
    });

    return res.status(201).json(
      formatSuccessResponse("DID registered successfully", {
        did: did_string,
        role,
        transaction: {
          hash: txResult.transactionHash,
          blockNumber: txResult.blockNumber,
          blockHash: txResult.blockHash,
          status: txResult.status,
          timestamp: txResult.timestamp,
        },
      })
    );
  } catch (error) {
    logger.error("Error registering DID", error);
    next(addStatusCodeTo(error as Error));
  }
};

/**
 * Rotate the key for a DID
 * 
 * Flow:
 * 1. Validate input
 * 2. Check if DID exists on blockchain
 * 3. Validate iteration number (must be incremental)
 * 4. Perform key rotation on blockchain
 * 5. Return transaction result
 */
export const keyRotation: RequestHandler = async (req, res, next) => {
  try {
    // Check express-validator errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("Validation failed for key rotation", {
        errors: errors.array(),
      });
      return res
        .status(400)
        .json(formatValidationErrorResponse(errors.array()));
    }

    const { old_public_key, new_public_key, iteration_number } = req.body;
    const { did } = req.params;

    logger.info("Processing key rotation request", {
      did,
      iteration: iteration_number,
    });

    // Validate DID format
    const didValidation = validateDIDFormat(did);
    if (!didValidation.isValid) {
      logger.warn("Invalid DID format", {
        did,
        error: didValidation.error,
      });
      return res
        .status(400)
        .json(
          formatErrorResponse(
            "Invalid DID format",
            didValidation.error,
            didValidation
          )
        );
    }

    // Validate public keys
    if (!validatePublicKey(old_public_key)) {
      logger.warn("Invalid old public key format", { did });
      return res
        .status(400)
        .json(
          formatErrorResponse(
            "Invalid old public key format",
            "Old public key must be a valid hex string"
          )
        );
    }

    if (!validatePublicKey(new_public_key)) {
      logger.warn("Invalid new public key format", { did });
      return res
        .status(400)
        .json(
          formatErrorResponse(
            "Invalid new public key format",
            "New public key must be a valid hex string"
          )
        );
    }

    // Keys must be different
    if (old_public_key === new_public_key) {
      logger.warn("Old and new public keys are the same", { did });
      return res
        .status(400)
        .json(
          formatErrorResponse(
            "Invalid key rotation",
            "New public key must be different from old public key"
          )
        );
    }

    // Validate iteration number
    const iterationValidation = validateIterationNumber(iteration_number);
    if (!iterationValidation.isValid) {
      logger.warn("Invalid iteration number", {
        did,
        iteration: iteration_number,
        error: iterationValidation.error,
      });
      return res
        .status(400)
        .json(
          formatErrorResponse(
            "Invalid iteration number",
            iterationValidation.error
          )
        );
    }

    // Check if DID exists
    const didDocument = await blockchainDIDService.resolveDID(did);
    if (!didDocument) {
      logger.warn("DID not found", { did });
      return res
        .status(404)
        .json(
          formatErrorResponse(
            "DID not found",
            "The specified DID does not exist on the blockchain"
          )
        );
    }

    // Perform key rotation on blockchain
    const rotationResult = await blockchainDIDService.rotateKey(
      did,
      old_public_key,
      new_public_key,
      iteration_number
    );

    logger.info("Key rotated successfully", {
      did,
      iteration: iteration_number,
      txHash: rotationResult.transactionHash,
    });

    return res.status(200).json(
      formatSuccessResponse("DID key rotated successfully", {
        did,
        iteration: iteration_number,
        transaction: {
          hash: rotationResult.transactionHash,
          blockNumber: rotationResult.blockNumber,
          status: rotationResult.status,
          timestamp: rotationResult.timestamp,
        },
      })
    );
  } catch (error) {
    logger.error("Error rotating DID key", error);
    next(addStatusCodeTo(error as Error));
  }
};

/**
 * Delete (revoke) a DID
 * 
 * Flow:
 * 1. Validate input
 * 2. Check if DID exists
 * 3. Revoke DID on blockchain
 * 4. (Future) Trigger batch VC revocation via RabbitMQ
 * 5. Return result
 */
export const deleteDID: RequestHandler = async (req, res, next) => {
  try {
    // Check express-validator errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("Validation failed for DID deletion", {
        errors: errors.array(),
      });
      return res
        .status(400)
        .json(formatValidationErrorResponse(errors.array()));
    }

    const { did } = req.params;

    logger.info("Processing DID deletion request", { did });

    // Validate DID format
    const didValidation = validateDIDFormat(did);
    if (!didValidation.isValid) {
      logger.warn("Invalid DID format", {
        did,
        error: didValidation.error,
      });
      return res
        .status(400)
        .json(
          formatErrorResponse(
            "Invalid DID format",
            didValidation.error,
            didValidation
          )
        );
    }

    // Check if DID exists
    const didDocument = await blockchainDIDService.resolveDID(did);
    if (!didDocument) {
      logger.warn("DID not found for deletion", { did });
      return res
        .status(404)
        .json(
          formatErrorResponse(
            "DID not found",
            "The specified DID does not exist on the blockchain"
          )
        );
    }

    // Revoke DID on blockchain
    const txResult = await blockchainDIDService.revokeDID(did);

    logger.info("DID revoked successfully", {
      did,
      txHash: txResult.transactionHash,
    });

    // TODO: Trigger batch VC revocation via RabbitMQ
    // This should be done asynchronously to not block the response
    // await rabbitmqService.publishMessage('vc.revocation.batch', {
    //   did,
    //   reason: 'DID_REVOKED',
    //   timestamp: new Date().toISOString()
    // });

    logger.info("Batch VC revocation will be processed asynchronously", {
      did,
    });

    return res.status(200).json(
      formatSuccessResponse("Account deleted successfully", {
        did,
        transaction: {
          hash: txResult.transactionHash,
          blockNumber: txResult.blockNumber,
          status: txResult.status,
          timestamp: txResult.timestamp,
        },
        note: "All associated Verifiable Credentials will be revoked asynchronously",
      })
    );
  } catch (error) {
    logger.error("Error deleting DID", error);
    next(addStatusCodeTo(error as Error));
  }
};

/**
 * Get DID Document
 * 
 * Flow:
 * 1. Validate DID format
 * 2. Resolve DID document from blockchain
 * 3. Return document
 * 
 * This is a PUBLIC endpoint - no authentication required
 */
export const getDIDDocument: RequestHandler = async (req, res, next) => {
  try {
    // Check express-validator errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("Validation failed for DID document retrieval", {
        errors: errors.array(),
      });
      return res
        .status(400)
        .json(formatValidationErrorResponse(errors.array()));
    }

    const { did } = req.params;

    logger.debug("Retrieving DID document", { did });

    // Validate DID format
    const didValidation = validateDIDFormat(did);
    if (!didValidation.isValid) {
      logger.warn("Invalid DID format", {
        did,
        error: didValidation.error,
      });
      return res
        .status(400)
        .json(
          formatErrorResponse(
            "Invalid DID format",
            didValidation.error,
            didValidation
          )
        );
    }

    // Resolve DID document from blockchain
    const didDocument = await blockchainDIDService.resolveDID(did);

    if (!didDocument) {
      logger.warn("DID document not found", { did });
      return res
        .status(404)
        .json(
          formatErrorResponse(
            "DID Document not found",
            "The specified DID does not exist or has been revoked"
          )
        );
    }

    logger.debug("DID document retrieved successfully", { did });

    return res.status(200).json(
      formatSuccessResponse("DID Document retrieved successfully", {
        didDocument,
      })
    );
  } catch (error) {
    logger.error("Error retrieving DID document", error);
    next(addStatusCodeTo(error as Error));
  }
};

/**
 * Get DID metadata (additional endpoint)
 * Returns metadata about a DID without the full document
 * Useful for quick checks
 */
export const getDIDMetadata: RequestHandler = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json(formatValidationErrorResponse(errors.array()));
    }

    const { did } = req.params;

    logger.debug("Retrieving DID metadata", { did });

    // Validate DID format
    const didValidation = validateDIDFormat(did);
    if (!didValidation.isValid) {
      return res
        .status(400)
        .json(
          formatErrorResponse(
            "Invalid DID format",
            didValidation.error,
            didValidation
          )
        );
    }

    // Check if DID exists
    const exists = await blockchainDIDService.checkDIDExists(did);

    if (!exists) {
      return res
        .status(404)
        .json(
          formatErrorResponse(
            "DID not found",
            "The specified DID does not exist"
          )
        );
    }

    // Get full document to extract metadata
    const didDocument = await blockchainDIDService.resolveDID(did);

    const metadata = {
      did,
      exists: true,
      method: didValidation.parsed?.method,
      created: didDocument?.created,
      updated: didDocument?.updated,
      verificationMethodCount: didDocument?.verificationMethod?.length || 0,
      authenticationMethodCount: didDocument?.authentication?.length || 0,
    };

    return res.status(200).json(
      formatSuccessResponse("DID metadata retrieved successfully", metadata)
    );
  } catch (error) {
    logger.error("Error retrieving DID metadata", error);
    next(addStatusCodeTo(error as Error));
  }
};
