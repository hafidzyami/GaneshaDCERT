import { RequestHandler } from "express";
import { validationResult } from "express-validator";
import { PrismaClient, RequestType} from "@prisma/client";
import { hasNoValidationErrors, addStatusCodeTo, throwCustomError } from "../utils/error";


const prisma = new PrismaClient();

export const requestCredential: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    try {
      const { encrypted_body, issuer_did, holder_did } = req.body;

      // Create a new VCIssuanceRequest record using the new schema
      const newRequest = await prisma.vCIssuanceRequest.create({
        data: {
          encrypted_body: encrypted_body,
          issuer_did: issuer_did,
          holder_did: holder_did,
        },
      });

      // Send the successful response
      res.status(201).json({
        message:
          "Verifiable Credential request has been successfully submitted.",
        request_id: newRequest.id,
      });
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};

export const getCredentialRequestsByType: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    try {
      const { type, issuer_did } = req.query; // Get issuer_did from query
      let requests;

      // Build a dynamic where clause
      const whereClause: { issuer_did?: string } = {};
      if (issuer_did) {
        whereClause.issuer_did = issuer_did as string;
      }

      switch (type) {
        case RequestType.ISSUANCE:
          requests = await prisma.vCIssuanceRequest.findMany({
            where: whereClause, // Apply the where clause
            orderBy: { createdAt: 'desc' }
          });
          break;
        case RequestType.RENEWAL:
          requests = await prisma.vCRenewalRequest.findMany({
            where: whereClause, // Apply the where clause
            orderBy: { createdAt: 'desc' }
          });
          break;
        case RequestType.UPDATE:
          requests = await prisma.vCUpdateRequest.findMany({
            where: whereClause, // Apply the where clause
            orderBy: { createdAt: 'desc' }
          });
          break;
        case RequestType.REVOKE:
          requests = await prisma.vCRevokeRequest.findMany({
            where: whereClause, // Apply the where clause
            orderBy: { createdAt: 'desc' }
          });
          break;
        default:
          throwCustomError("Invalid request type specified.", 400);
          return;
      }

      res.status(200).json({
        message: `Successfully retrieved ${type} requests.`,
        count: requests.length,
        data: requests,
      });

    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};

export const processCredentialResponse: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    try {
      const { 
        request_id, 
        issuer_did, 
        holder_did, 
        encrypted_body,
        request_type // The new dynamic field
      } = req.body;

      // Create a new VCResponse record with the provided type
      const newVCResponse = await prisma.vCResponse.create({
        data: {
          request_id: request_id,
          request_type: request_type, // Use the dynamic type from the body
          issuer_did: issuer_did,
          holder_did: holder_did,
          encrypted_body: encrypted_body,
        },
      });

      // Send the successful response
      res.status(201).json({
        message: `VC ${request_type.toLowerCase()} processed successfully`,
        vc_response_id: newVCResponse.id,
      });
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};

export const getHolderVCs: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    try {
      const { holderDid } = req.query;

      // TODO: Implement blockchain query logic here.
      // 1. Connect to the blockchain network/smart contract.
      // 2. Call the smart contract function to get all VCs associated with the holderDid.
      // const vcsFromBlockchain = await queryBlockchainForVCs(holderDid);

      console.log(`Fetching VCs for holder DID from blockchain: ${holderDid}`);

      // PLACEHOLDER DATA
      const placeholderVCs = [
        {
          vc_id: "vc:hid:11111",
          schema_id: "sch:hid:22222",
          issuer_did: "did:example:b34ca6cd37bbf23",
          hash: "0x123abc...",
          status: true,
        },
        {
          vc_id: "vc:hid:33333",
          schema_id: "sch:hid:44444",
          issuer_did: "did:example:c56ef89abce56",
          hash: "0x456def...",
          status: true,
        },
      ];

      res.status(200).json({
        message: `Successfully retrieved VCs for holder ${holderDid}.`,
        count: placeholderVCs.length,
        data: placeholderVCs, // Replace with vcsFromBlockchain when ready
      });
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};

export const requestCredentialUpdate: RequestHandler = async (req, res, next) => {
    if (hasNoValidationErrors(validationResult(req))) {
        try {
            const { issuer_did, holder_did, encrypted_body } = req.body;

            // Create a new VCUpdateRequest record
            const newUpdateRequest = await prisma.vCUpdateRequest.create({
                data: {
                    issuer_did: issuer_did,
                    holder_did: holder_did,
                    encrypted_body: encrypted_body, // Renamed from encrypted_data for consistency
                    status: "PENDING",
                },
            });

            res.status(201).json({
                message: "Verifiable Credential update request submitted successfully.",
                request_id: newUpdateRequest.id,
            });

        } catch (error) {
            next(addStatusCodeTo(error as Error));
        }
    }
};

export const requestCredentialRenewal: RequestHandler = async (req, res, next) => {
    if (hasNoValidationErrors(validationResult(req))) {
        try {
            const { issuer_did, holder_did, encrypted_body } = req.body;

            // Create a new VCRenewalRequest record
            const newRenewalRequest = await prisma.vCRenewalRequest.create({
                data: {
                    issuer_did: issuer_did,
                    holder_did: holder_did,
                    encrypted_body: encrypted_body,
                    status: "PENDING",
                },
            });

            res.status(201).json({
                message: "Verifiable Credential renewal request submitted successfully.",
                new_request_id: newRenewalRequest.id,
            });

        } catch (error) {
            next(addStatusCodeTo(error as Error));
        }
    }
};

export const requestCredentialRevocation: RequestHandler = async (req, res, next) => {
    if (hasNoValidationErrors(validationResult(req))) {
        try {
            const { issuer_did, holder_did, encrypted_body } = req.body;

            // Create a new VCRevokeRequest record
            const newRevokeRequest = await prisma.vCRevokeRequest.create({
                data: {
                    issuer_did: issuer_did,
                    holder_did: holder_did,
                    encrypted_body: encrypted_body,
                    status: "PENDING",
                },
            });

            res.status(201).json({
                message: "Verifiable Credential revocation request submitted successfully.",
                request_id: newRevokeRequest.id,
            });

        } catch (error) {
            next(addStatusCodeTo(error as Error));
        }
    }
};

export const addVCStatusBlock: RequestHandler = async (req, res, next) => {
    if (hasNoValidationErrors(validationResult(req))) {
        try {
            const { vc_id, issuer_did, holder_did, status, hash } = req.body;

            // TODO: Implement blockchain transaction logic here.
            // 1. Connect to your blockchain network and smart contract.
            // 2. Prepare the transaction payload with the VC status data.
            // 3. Send the transaction to the smart contract to create a new block.
            // const transactionReceipt = await createVCStatusBlock({ vc_id, issuer_did, holder_did, status, hash });

            console.log(`Submitting new status block for VC: ${vc_id} to the blockchain...`);

            // Placeholder response until blockchain is integrated
            res.status(201).json({
                message: "VC status block transaction has been submitted.",
                // transactionHash: transactionReceipt.hash // Example response field
            });

        } catch (error) {
            next(addStatusCodeTo(error as Error));
        }
    }
};

export const getVCStatus: RequestHandler = async (req, res, next) => {
    if (hasNoValidationErrors(validationResult(req))) {
        try {
            const { vcId } = req.params;
            const { issuerDid, holderDid } = req.query;

            // TODO: Implement blockchain query logic here.
            // 1. Connect to the blockchain and use a DID resolver to verify the issuer and holder DIDs.
            // const isIssuerValid = await resolveDid(issuerDid);
            // const isHolderValid = await resolveDid(holderDid);

            // 2. Query the smart contract to get the status of the VC using its vcId.
            // const vcStatusFromChain = await getVCStatusFromBlockchain(vcId);

            console.log(`Checking status for VC: ${vcId} on the blockchain...`);

            // Placeholder response until blockchain is integrated
            const placeholderStatus = {
                status: "active", // e.g., "active", "expired", "revoked"
                revoked: false,
                // Add other relevant status fields from your smart contract
            };

            res.status(200).json(placeholderStatus); // Replace with vcStatusFromChain when ready

        } catch (error) {
            next(addStatusCodeTo(error as Error));
        }
    }
};