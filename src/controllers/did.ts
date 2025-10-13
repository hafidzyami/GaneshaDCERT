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
        .json({ message: "DID Document's succesfully created!" }); // Add DID and transactionHash if Blockchain already to use
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};
