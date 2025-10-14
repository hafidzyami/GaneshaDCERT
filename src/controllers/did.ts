import { RequestHandler } from "express";
import { validationResult } from "express-validator";
import axios from "axios";
import "dotenv/config";

import {
  throwCustomError,
  addStatusCodeTo,
  hasNoValidationErrors,
} from "../utils/error";

export const person: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    const { did_string, public_key, role } = req.body;

    try {
      // Checking Role of Registry
      if (role == "holder") {
        // Logic of Registry as a Holder
      } else {
        // Logic of Registry as a Issuer
      }

      // Call API of created Block into Blockchain
      const apiUrl = "APIofBlockChain";
      const response = await axios.post(apiUrl);

      if (response.status != 200) {
        throwCustomError("Invalid to created DID Document's block", 500);
      }

      const externalData = response.data;

      return res
        .status(201)
        .json({ message: "Create DID document successfully" }); // Add DID and transactionHash if Blockchain already to use
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};

export const keyRotation: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    const { old_public_key, new_public_key, iteration_number } = req.body;
    const did = req.params.did;

    try {
      // Create block with old_public_key with status false and create block with new_public_key with status true

      // Call API of Smart Contract
      const apiUrl = "APIofBlockChain";
      const response = await axios.post(apiUrl);

      if (response.status != 200) {
        throwCustomError("Invalid to created DID Document's block", 500);
      }

      const externalData = response.data;

      return res.status(201).json({ message: "DID key rotation successfully" }); // Add DID and transactionHash if Blockchain already to use
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};

export const deleteDID: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    const did = req.params.did;

    try {
      // Revoke All associated VC of DID Holder

      // Call API of Smart Contract
      const apiUrl = "APIofBlockChain";
      const response = await axios.post(apiUrl);

      if (response.status != 200) {
        throwCustomError("Invalid to created DID Document's block", 500);
      }

      const externalData = response.data;

      return res.status(201).json({ message: "DID key rotation successfully" }); // Add DID and transactionHash if Blockchain already to use
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};

export const getDIDDocument: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    const did = req.params.did;

    try {
      // Revoke All associated VC of DID Holder

      // Call API of Smart Contract
      const apiUrl = "APIofBlockChain";
      const response = await axios.post(apiUrl);

      if (response.status != 200) {
        throwCustomError("Invalid to created DID Document's block", 500);
      }

      const externalData = response.data;

      return res.status(201).json({ message: "DID key rotation successfully" }); // Add DID and transactionHash if Blockchain already to use
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};
