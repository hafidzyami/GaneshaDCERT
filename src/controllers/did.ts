import { RequestHandler } from "express";
import { validationResult } from "express-validator";
import axios from "axios";
import * as blockchain from "../utils/blockchainService";
import "dotenv/config";

import {
  throwCustomError,
  addStatusCodeTo,
  hasNoValidationErrors,
} from "../utils/error";

/**
 * Registers a new DID for a person or institution.
 * @param req
 * @param res
 * @param next
 */
export const registerDID: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    const { did_string, public_key, role } = req.body;

    try {
      // TODO: Implement logic to check if the DID already exists on the blockchain.
      // const didExists = await checkDIDOnBlockchain(did_string);
      // if (didExists) {
      //   throwCustomError("A DID Document already exists with this DID.", 409);
      // }

      // TODO: Call the smart contract to write the new DID document to the blockchain.
      console.log(`Registering DID: ${did_string} with role: ${role}`);
      await blockchain.registerDIDOnChain(did_string, public_key);
      // const transaction = await registerDIDOnBlockchain(did_string, public_key, role);

      // Placeholder for blockchain transaction response
      // const transactionHash =
      //   "0x" +
      //   [...Array(64)]
      //     .map(() => Math.floor(Math.random() * 16).toString(16))
      //     .join("");

      return res.status(201).json({
        message: "DID registered successfully",
        did: did_string,
        // transactionHash: transactionHash,
      });
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};

/**
 * Registers a new DID for a person or institution.
 * @param req
 * @param res
 * @param next
 */
export const checkDID: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    const { did } = req.params;

    try {
      const didExists = await blockchain.checkDIDOnChain(did);
      if (!didExists) {
        throwCustomError("DID not found.", 404);
      }

      return res.status(200).json({
        message: "DID exists",
        did,
      });
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};

export const numberofBlocks: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {

    try {
      const blockCount = await blockchain.getNumberOfBlocksOnChain();

      return res.status(200).json({
        message: "Number of blocks",
        blockCount,
      });
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};


/**
 * Rotates the key associated with a DID.
 * @param req
 * @param res
 * @param next
 */
export const keyRotation: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    const { old_public_key, new_public_key, iteration_number } = req.body;
    const { did } = req.params;

    try {
      // TODO: Implement logic to find the DID on the blockchain.
      // const didDocument = await findDIDOnBlockchain(did);
      // if (!didDocument) {
      //   throwCustomError("DID not found.", 404);
      // }

      // TODO: Call the smart contract to update the key for the DID.
      console.log(`Rotating key for DID: ${did}`);
      // await rotateKeyOnBlockchain(did, old_public_key, new_public_key, iteration_number);

      return res.status(200).json({ message: "DID key rotated successfully" });
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};

/**
 * Deletes a holder's account (DID).
 * @param req
 * @param res
 * @param next
 */
export const deleteDID: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    const { did } = req.params;

    try {
      // TODO: Implement logic to find the DID on the blockchain.
      // const didDocument = await findDIDOnBlockchain(did);
      // if (!didDocument) {
      //   throwCustomError("DID not found.", 404);
      // }

      // TODO: Call the smart contract to revoke the DID.
      // This might involve setting a 'revoked' flag in the DID document.
      console.log(`Deleting DID: ${did}`);
      // await revokeDIDOnBlockchain(did);

      // TODO: Asynchronously initiate batch revocation for all associated VCs.
      // This could be done via a message queue (RabbitMQ).

      return res.status(200).json({ message: "Account deleted successfully" });
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};

/**
 * Fetches the public DID document for a given DID.
 * @param req
 * @param res
 * @param next
 */
export const getDIDDocument: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    const { did } = req.params;

    try {
      // TODO: Call the DID resolver on the blockchain to get the document.
      console.log(`Fetching document for DID: ${did}`);
      // const didDocument = await resolveDIDOnBlockchain(did);

      // Placeholder for a DID document
      const didDocument = {
        "@context": "https://www.w3.org/ns/did/v1",
        id: did,
        verificationMethod: [
          {
            id: `${did}#keys-1`,
            type: "EcdsaSecp256k1VerificationKey2019",
            controller: did,
            publicKeyHex: "04e6a...",
          },
        ],
        authentication: [`${did}#keys-1`],
      };

      if (!didDocument) {
        throwCustomError("DID Document not found.", 404);
      }

      return res.status(200).json({
        did_document: didDocument,
      });
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};
