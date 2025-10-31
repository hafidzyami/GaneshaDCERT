import { PrismaClient, RequestType, RequestStatus } from "@prisma/client"; // Removed Prisma import
import { prisma } from "../config/database";
import { BadRequestError, NotFoundError, BlockchainError } from "../utils/errors/AppError";
import logger from "../config/logger";
import { ProcessUpdateVCDTO, ProcessUpdateVCResponseDTO, ProcessRenewalVCDTO, ProcessRenewalVCResponseDTO, VCStatusResponseDTO,CredentialRevocationRequestDTO, CredentialRevocationResponseDTO, ProcessIssuanceVCDTO, ProcessIssuanceVCResponseDTO, HolderCredentialDTO, RevokeVCDTO, RevokeVCResponseDTO } from "../dtos";
import VCBlockchainService from "./blockchain/vcBlockchain.service";


/**
 * Credential Service with Dependency Injection
 * Handles VC issuance, renewal, update, and revocation requests
 */
class CredentialService {
  private db: PrismaClient;

  /**
   * Constructor with dependency injection
   * @param dependencies - Optional dependencies for testing
   */
  constructor(dependencies?: {
    db?: PrismaClient;
  }) {
    this.db = dependencies?.db || prisma;
  }

  /**
   * Request credential issuance
   */
  async requestCredentialIssuance(data: {
    encrypted_body: string;
    issuer_did: string;
    holder_did: string;
  }) {
    const newRequest = await this.db.vCIssuanceRequest.create({
      data: {
        encrypted_body: data.encrypted_body,
        issuer_did: data.issuer_did,
        holder_did: data.holder_did,
      },
    });

    logger.success(`VC Issuance request created: ${newRequest.id}`);

    return {
      message: "Verifiable Credential request has been successfully submitted.",
      request_id: newRequest.id,
    };
  }

  /**
   * Get credential requests by type
   */
  async getCredentialRequestsByType(type: RequestType, issuerDid?: string, holderDid?: string) { // Added holderDid parameter
    
    interface WhereClause {
        issuer_did?: string;
        holder_did?: string;
    }

    const whereClause: WhereClause = {};
    if (issuerDid) {
      whereClause.issuer_did = issuerDid;
    }
    if (holderDid) { // Add holderDid to the where clause if present
      whereClause.holder_did = holderDid;
    }

    logger.info(`Fetching ${type} requests with filters:`, whereClause);

    let requests;

    switch (type) {
      case RequestType.ISSUANCE:
        requests = await this.db.vCIssuanceRequest.findMany({
          where: whereClause, 
          orderBy: { createdAt: "desc" },
        });
        break;

      case RequestType.RENEWAL:
        requests = await this.db.vCRenewalRequest.findMany({
          where: whereClause, 
          orderBy: { createdAt: "desc" },
        });
        break;

      case RequestType.UPDATE:
        requests = await this.db.vCUpdateRequest.findMany({
          where: whereClause, 
          orderBy: { createdAt: "desc" },
        });
        break;

      case RequestType.REVOKE:
        requests = await this.db.vCRevokeRequest.findMany({
          where: whereClause, 
          orderBy: { createdAt: "desc" },
        });
        break;

      default:
        throw new BadRequestError("Invalid request type specified.");
    }

     logger.info(`Found ${requests.length} ${type} requests matching criteria.`);

    return {
      message: `Successfully retrieved ${type} requests.`,
      count: requests.length,
      data: requests,
    };
  }

  /**
   * Process credential response
   */
  async processCredentialResponse(data: {
    request_id: string;
    issuer_did: string;
    holder_did: string;
    encrypted_body: string;
    request_type: RequestType;
  }) {
    const newVCResponse = await this.db.vCResponse.create({
      data: {
        request_id: data.request_id,
        request_type: data.request_type,
        issuer_did: data.issuer_did,
        holder_did: data.holder_did,
        encrypted_body: data.encrypted_body,
      },
    });

    logger.success(`VC Response created: ${newVCResponse.id}`);

    return {
      message: `VC ${data.request_type.toLowerCase()} processed successfully`,
      vc_response_id: newVCResponse.id,
    };
  }

  /**
   * Get holder's VCs from blockchain
   */
  async getHolderVCs(holderDid: string) {
    // TODO: Implement blockchain query to get all VCs for holder
    logger.info(`Fetching VCs for holder DID: ${holderDid}`);

    // Placeholder data
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

    return {
      message: `Successfully retrieved VCs for holder ${holderDid}.`,
      count: placeholderVCs.length,
      data: placeholderVCs,
    };
  }

  /**
   * Request credential update
   */
  async requestCredentialUpdate(data: {
    issuer_did: string;
    holder_did: string;
    encrypted_body: string;
  }) {
    const newUpdateRequest = await this.db.vCUpdateRequest.create({
      data: {
        issuer_did: data.issuer_did,
        holder_did: data.holder_did,
        encrypted_body: data.encrypted_body,
        status: "PENDING",
      },
    });

    logger.success(`VC Update request created: ${newUpdateRequest.id}`);

    return {
      message: "Verifiable Credential update request submitted successfully.",
      request_id: newUpdateRequest.id,
    };
  }

  /**
   * Request credential renewal
   */
  async requestCredentialRenewal(data: {
    issuer_did: string;
    holder_did: string;
    encrypted_body: string;
  }) {
    const newRenewalRequest = await this.db.vCRenewalRequest.create({
      data: {
        issuer_did: data.issuer_did,
        holder_did: data.holder_did,
        encrypted_body: data.encrypted_body,
        status: "PENDING",
      },
    });

    logger.success(`VC Renewal request created: ${newRenewalRequest.id}`);

    return {
      message: "Verifiable Credential renewal request submitted successfully.",
      new_request_id: newRenewalRequest.id,
    };
  }

  /**
   * Request credential revocation
   */
  async requestCredentialRevocation(data: CredentialRevocationRequestDTO): Promise<CredentialRevocationResponseDTO> {
    // Logic to create a new VCRevokeRequest record
    const newRevokeRequest = await this.db.vCRevokeRequest.create({
      data: {
        issuer_did: data.issuer_did,
        holder_did: data.holder_did,
        encrypted_body: data.encrypted_body,
        status: RequestStatus.PENDING, // Default status
      },
    });

    logger.success(`VC Revocation request created: ${newRevokeRequest.id}`);

    // TODO: Optionally, notify the issuer via RabbitMQ or another mechanism

    return {
      message: "Verifiable Credential revocation request submitted successfully.",
      request_id: newRevokeRequest.id, // Return the ID of the new request record
    };
  }

  /**
   * Add VC status block to blockchain
   */
  async addVCStatusBlock(data: {
    vc_id: string;
    issuer_did: string;
    holder_did: string;
    status: boolean;
    hash: string;
  }) {
    // TODO: Implement blockchain transaction to create status block
    logger.info(`Submitting VC status block for: ${data.vc_id}`);

    return {
      message: "VC status block transaction has been submitted.",
      vc_id: data.vc_id,
    };
  }

  /**
   * Get VC status from blockchain
   */
  async getVCStatus(vcId: string): Promise<VCStatusResponseDTO> {
    logger.info(`Checking VC status from blockchain for: ${vcId}`);

    try {
      // Call the blockchain service to get the status struct
      const blockchainStatus = await VCBlockchainService.getVCStatusFromBlockchain(vcId);

      // Map the blockchain response (which is likely an array/tuple or object from ethers)
      // to our DTO. Adjust indexing/property names based on the actual return structure
      // of getVCStatusFromBlockchain (which calls contract.getVCStatus).
      // Based on VCManager.json ABI, it returns a struct, accessible like an object/array.
      const response: VCStatusResponseDTO = {
        vc_id: blockchainStatus.id,
        issuer_did: blockchainStatus.issuerDID,
        holder_did: blockchainStatus.holderDID,
        vc_type: blockchainStatus.vcType,
        schema_id: blockchainStatus.schemaID,
        // Convert BigInt to number if necessary. Handle potential large numbers if needed.
        schema_version: Number(blockchainStatus.schemaVersion),
        status: blockchainStatus.status, // boolean (true=active, false=revoked/inactive)
        hash: blockchainStatus.hash,
      };

      logger.info(`Successfully retrieved status for VC: ${vcId}`);
      return response;

    } catch (error: any) {
      logger.error(`Failed to get VC status from blockchain for ${vcId}:`, error);
      // Rethrow specific errors or wrap them
      if (error instanceof NotFoundError) {
        throw new NotFoundError(`VC with ID ${vcId} not found on the blockchain.`);
      }
      throw new BlockchainError(`Failed to retrieve VC status from blockchain: ${error.message}`);
    }
  }

  async processIssuanceVC(data: ProcessIssuanceVCDTO): Promise<ProcessIssuanceVCResponseDTO> {
    const {
        request_id,
        issuer_did,
        holder_did,
        action,
        request_type,
        // Fields for approval
        vc_id,
        vc_type,
        schema_id,
        schema_version,
        vc_hash,
        encrypted_body
    } = data;

    // 1. Find the original issuance request
    const issuanceRequest = await this.db.vCIssuanceRequest.findUnique({
      where: { id: request_id },
    });

    if (!issuanceRequest) {
      throw new NotFoundError(`Issuance request with ID ${request_id} not found.`);
    }

    if (issuanceRequest.status !== RequestStatus.PENDING) {
      throw new BadRequestError(`Issuance request ${request_id} has already been processed (Status: ${issuanceRequest.status}).`);
    }

    if (issuanceRequest.issuer_did !== issuer_did || issuanceRequest.holder_did !== holder_did) {
      throw new BadRequestError(`Issuer DID or Holder DID does not match the original request.`);
    }

    if (request_type !== RequestType.ISSUANCE) {
        throw new BadRequestError(`Invalid request_type for this endpoint. Expected ISSUANCE, got ${request_type}.`);
    }

    // 2. Process based on action
    if (action === RequestStatus.REJECTED) {
      // Update status to REJECTED
      const updatedRequest = await this.db.vCIssuanceRequest.update({
        where: { id: request_id },
        data: { status: RequestStatus.REJECTED },
      });

      logger.warn(`VC Issuance request rejected: ${request_id}`);

      return {
        message: "Verifiable Credential issuance request rejected.",
        request_id: updatedRequest.id,
        status: updatedRequest.status,
      };

    } else if (action === RequestStatus.APPROVED) {
      if (!encrypted_body || !vc_id || !vc_type || !schema_id || !schema_version || !vc_hash) {
        throw new BadRequestError(
          "When action is APPROVED, vc_id, vc_type, schema_id, schema_version, vc_hash, and encrypted_body are required."
        );
      }

      // --- Blockchain Call (Directly, similar to did.service.ts) ---
      let blockchainReceipt: any;
      try {
          blockchainReceipt = await VCBlockchainService.issueVCInBlockchain(
              vc_id,
              issuer_did,
              holder_did,
              vc_type,
              schema_id,
              schema_version,
              vc_hash
          );
           logger.info(`Blockchain issuance successful for ${vc_id}. TX: ${blockchainReceipt?.hash}`);
      } catch (blockchainError: any) {
          logger.error("Blockchain issuance failed:", blockchainError);
          // Decide how to handle this: rethrow or just log and potentially skip DB updates?
          // Rethrowing is safer to indicate the overall operation failed.
          throw new BadRequestError(`Blockchain issuance failed: ${blockchainError.message}`);
      }
      // ----------------------------------------------------------------

      // --- Database Updates (Perform AFTER successful blockchain call) ---
      // !! Note: If these fail, the blockchain entry exists but DB is inconsistent !!
      let updatedRequest;
      let newVCResponse;
      try {
        updatedRequest = await this.db.vCIssuanceRequest.update({
          where: { id: request_id },
          data: { status: RequestStatus.APPROVED },
        });

        newVCResponse = await this.db.vCResponse.create({
          data: {
            request_id: request_id,
            request_type: RequestType.ISSUANCE,
            issuer_did: issuer_did,
            holder_did: holder_did,
            encrypted_body: encrypted_body,
          },
        });
        logger.success(`Database updated for approved request: ${request_id}. VCResponse created: ${newVCResponse.id}`);

      } catch (dbError: any) {
          logger.error(`Database update failed for approved request ${request_id} after successful blockchain TX ${blockchainReceipt?.hash}:`, dbError);
          return {
              message: "Blockchain issuance succeeded, but database update failed. Please check logs.",
              request_id: request_id, // Return original request ID
              status: RequestStatus.APPROVED, // Reflect intended status
              vc_response_id: undefined, // Indicate DB write failure
              transaction_hash: blockchainReceipt?.hash,
              block_number: blockchainReceipt?.blockNumber,
          };
      }
      // ------------------------------------------------------------------

      return {
        message: "Verifiable Credential issued successfully on blockchain and database.",
        request_id: updatedRequest.id,
        status: updatedRequest.status,
        vc_response_id: newVCResponse.id,
        transaction_hash: blockchainReceipt?.hash,
        block_number: blockchainReceipt?.blockNumber,
      };
    } else {
        throw new BadRequestError(`Invalid action: ${action}. Must be APPROVED or REJECTED.`);
    }
  }

  async getHolderCredentialsFromDB(holderDid: string): Promise<HolderCredentialDTO[]> {
    logger.info(`Fetching credentials from DB for holder DID: ${holderDid}`);

    // Query the VCResponse table, selecting all fields
    // Filter out soft-deleted records (deletedAt is not null)
    const vcResponses = await this.db.vCResponse.findMany({
      where: {
        holder_did: holderDid,
        deletedAt: null, // Only get non-deleted records
      },
      // No 'select' means all fields are returned by default
      orderBy: {
        request_id: 'desc', // Example sort, consider adding createdAt
      }
    });

    if (vcResponses.length === 0) {
      logger.info(`No credentials found in DB for holder DID: ${holderDid}`);
    } else {
       logger.info(`Found ${vcResponses.length} credential responses in DB for holder DID: ${holderDid}`);
    }

    // Map the Prisma results directly (DTO now matches the model)
    // No explicit mapping needed if DTO field names match model field names
    const credentials: HolderCredentialDTO[] = vcResponses; // Direct assignment works if DTO matches

    return credentials;
  }

  async revokeVC(data: RevokeVCDTO): Promise<RevokeVCResponseDTO> {
    const { request_id, issuer_did, holder_did, action, vc_id } = data;

    // 1. Find the original revocation request in the database
    const revokeRequest = await this.db.vCRevokeRequest.findUnique({
      where: { id: request_id },
    });

    if (!revokeRequest) {
      throw new NotFoundError(`Revocation request with ID ${request_id} not found.`);
    }

    // 2. Check if already processed
    if (revokeRequest.status !== RequestStatus.PENDING) {
      throw new BadRequestError(`Revocation request ${request_id} has already been processed (Status: ${revokeRequest.status}).`);
    }

    // 3. Validate DIDs match the request
    if (revokeRequest.issuer_did !== issuer_did || revokeRequest.holder_did !== holder_did) {
      throw new BadRequestError(`Issuer DID or Holder DID does not match the original revocation request.`);
    }

    // 4. Process based on action
    if (action === RequestStatus.REJECTED) {
      // Update DB status to REJECTED
      const updatedRequest = await this.db.vCRevokeRequest.update({
        where: { id: request_id },
        data: { status: RequestStatus.REJECTED },
      });

      logger.warn(`VC Revocation request rejected: ${request_id}`);

      return {
        message: "Verifiable Credential revocation request rejected.",
        request_id: updatedRequest.id,
        status: updatedRequest.status,
      };

    } else if (action === RequestStatus.APPROVED) {
      // Ensure vc_id is provided for approval
      if (!vc_id) {
        throw new BadRequestError("vc_id is required when action is APPROVED.");
      }

      logger.info(`Processing approval for revocation request ${request_id} targeting VC ${vc_id}`);

      // --- Pre-Revocation Blockchain Check ---
      try {
        const currentVcStatus = await VCBlockchainService.getVCStatusFromBlockchain(vc_id);
        if (currentVcStatus && currentVcStatus.status === false) {
            logger.warn(`Attempted to approve revocation for an already revoked VC: ${vc_id}`);
             await this.db.vCRevokeRequest.update({ // Still update request status
                where: { id: request_id },
                data: { status: RequestStatus.APPROVED },
             });
            throw new BadRequestError(`VC with ID ${vc_id} is already revoked on the blockchain.`);
        }
        logger.info(`VC ${vc_id} found and is currently active. Proceeding with blockchain revocation.`);
      } catch (error: any) {
          logger.error(`Pre-revocation check failed for VC ${vc_id}:`, error);
          if (error instanceof NotFoundError) {
               throw new NotFoundError(`VC with ID ${vc_id} not found on the blockchain. Cannot approve revocation request ${request_id}.`);
          }
          if (error instanceof BadRequestError) { throw error; }
          throw new BadRequestError(`Failed to verify VC status before revocation: ${error.message}`);
      }
      // ------------------------------------

      // --- Blockchain Revocation Call ---
      let blockchainReceipt: any;
      try {
        blockchainReceipt = await VCBlockchainService.revokeVCInBlockchain(vc_id);
        logger.success(`VC ${vc_id} revoked successfully on blockchain. TX: ${blockchainReceipt?.hash}`);
      } catch (blockchainError: any) {
        logger.error(`Blockchain revocation failed during approval for request ${request_id} (VC ${vc_id}):`, blockchainError);
        throw new BadRequestError(`Blockchain revocation failed: ${blockchainError.message}`);
      }
      // ---------------------------------

      // --- Update DB Status ---
      const updatedRequest = await this.db.vCRevokeRequest.update({
        where: { id: request_id },
        data: { status: RequestStatus.APPROVED },
      });
      logger.info(`Revocation request ${request_id} status updated to APPROVED in DB.`);
      // ------------------------

      return {
        message: "Verifiable Credential revocation request approved and VC revoked on blockchain.",
        request_id: updatedRequest.id,
        status: updatedRequest.status,
        transaction_hash: blockchainReceipt?.hash,
        block_number: blockchainReceipt?.blockNumber,
      };
    } else {
      throw new BadRequestError(`Invalid action specified: ${action}.`);
    }
  }

  async processRenewalVC(data: ProcessRenewalVCDTO): Promise<ProcessRenewalVCResponseDTO> {
    const { request_id, issuer_did, holder_did, action, vc_id, encrypted_body } = data;

    // 1. Find the original renewal request
    const renewalRequest = await this.db.vCRenewalRequest.findUnique({
      where: { id: request_id },
    });

    if (!renewalRequest) {
      throw new NotFoundError(`Renewal request with ID ${request_id} not found.`);
    }

    // 2. Check if already processed
    if (renewalRequest.status !== RequestStatus.PENDING) {
      throw new BadRequestError(`Renewal request ${request_id} has already been processed (Status: ${renewalRequest.status}).`);
    }

    // 3. Validate DIDs
    if (renewalRequest.issuer_did !== issuer_did || renewalRequest.holder_did !== holder_did) {
      throw new BadRequestError(`Issuer DID or Holder DID does not match the original renewal request.`);
    }

    // 4. Process based on action
    if (action === RequestStatus.REJECTED) {
      // Update DB status to REJECTED
      const updatedRequest = await this.db.vCRenewalRequest.update({
        where: { id: request_id },
        data: { status: RequestStatus.REJECTED },
      });

      logger.warn(`VC Renewal request rejected: ${request_id}`);

      return {
        message: "Verifiable Credential renewal request rejected.",
        request_id: updatedRequest.id,
        status: updatedRequest.status,
      };

    } else if (action === RequestStatus.APPROVED) {
      // Ensure required fields for approval are present
      if (!vc_id || !encrypted_body) {
        throw new BadRequestError("vc_id and encrypted_body are required when action is APPROVED.");
      }

      logger.info(`Processing approval for renewal request ${request_id} targeting VC ${vc_id}`);

      // --- Blockchain Call ---
      let blockchainReceipt: any;
      try {
        // Call the renew function on the blockchain
        blockchainReceipt = await VCBlockchainService.renewVCInBlockchain(vc_id);
        logger.success(`VC ${vc_id} renewed successfully on blockchain. TX: ${blockchainReceipt?.hash}`);
      } catch (blockchainError: any) {
        logger.error(`Blockchain renewal failed during approval for request ${request_id} (VC ${vc_id}):`, blockchainError);
        // Handle specific errors like NotFoundError if the service throws them
        if (blockchainError instanceof NotFoundError) {
             throw new NotFoundError(`VC with ID ${vc_id} not found on the blockchain. Cannot process renewal request ${request_id}.`);
        }
        throw new BadRequestError(`Blockchain renewal failed: ${blockchainError.message}`);
      }
      // -------------------------

      // --- Database Updates ---
      // Use a transaction for atomicity
      const result = await this.db.$transaction(async (tx) => {
          // Update renewal request status
          const updatedRequest = await tx.vCRenewalRequest.update({
            where: { id: request_id },
            data: { status: RequestStatus.APPROVED },
          });

          // Create a new VCResponse record for the renewal
          const newVCResponse = await tx.vCResponse.create({
            data: {
              request_id: request_id, // Link to the VCRenewalRequest
              request_type: RequestType.RENEWAL, // Set type to RENEWAL
              issuer_did: issuer_did,
              holder_did: holder_did,
              encrypted_body: encrypted_body, // Store the new encrypted body
            },
          });

          logger.info(`Renewal request ${request_id} status updated to APPROVED. New VCResponse created: ${newVCResponse.id}`);
          return { updatedRequest, newVCResponse };
      });
      // ------------------------

      return {
        message: "Verifiable Credential renewal request approved and VC renewed on blockchain.",
        request_id: result.updatedRequest.id,
        status: result.updatedRequest.status,
        vc_response_id: result.newVCResponse.id, // Include the new VCResponse ID
        transaction_hash: blockchainReceipt?.hash,
        block_number: blockchainReceipt?.blockNumber,
      };
    } else {
      throw new BadRequestError(`Invalid action specified: ${action}.`);
    }
  }

  async processUpdateVC(data: ProcessUpdateVCDTO): Promise<ProcessUpdateVCResponseDTO> {
    const { request_id, issuer_did, holder_did, action, vc_id, new_vc_hash, encrypted_body } = data;

    // 1. Find the original update request
    const updateRequest = await this.db.vCUpdateRequest.findUnique({
      where: { id: request_id },
    });

    if (!updateRequest) {
      throw new NotFoundError(`Update request with ID ${request_id} not found.`);
    }

    // 2. Check if already processed
    if (updateRequest.status !== RequestStatus.PENDING) {
      throw new BadRequestError(`Update request ${request_id} has already been processed (Status: ${updateRequest.status}).`);
    }

    // 3. Validate DIDs
    if (updateRequest.issuer_did !== issuer_did || updateRequest.holder_did !== holder_did) {
      throw new BadRequestError(`Issuer DID or Holder DID does not match the original update request.`);
    }

    // 4. Process based on action
    if (action === RequestStatus.REJECTED) {
      // Update DB status to REJECTED
      const updatedRequest = await this.db.vCUpdateRequest.update({
        where: { id: request_id },
        data: { status: RequestStatus.REJECTED },
      });

      logger.warn(`VC Update request rejected: ${request_id}`);

      return {
        message: "Verifiable Credential update request rejected.",
        request_id: updatedRequest.id,
        status: updatedRequest.status,
      };

    } else if (action === RequestStatus.APPROVED) {
      // Ensure required fields for approval are present
      if (!vc_id || !new_vc_hash || !encrypted_body) {
        throw new BadRequestError("vc_id, new_vc_hash, and encrypted_body are required when action is APPROVED.");
      }

      logger.info(`Processing approval for update request ${request_id} targeting VC ${vc_id}`);

      // --- Pre-Update Blockchain Check ---
      try {
        const currentVcStatus = await VCBlockchainService.getVCStatusFromBlockchain(vc_id);
        if (currentVcStatus && currentVcStatus.status === false) {
           logger.warn(`Attempted to approve update for an inactive/revoked VC: ${vc_id}`);
           // Decide if you should allow updating a revoked VC. Usually not.
           throw new BadRequestError(`Cannot approve update for VC ${vc_id} because it is currently inactive/revoked on the blockchain.`);
        }
        logger.info(`VC ${vc_id} found and is active. Proceeding with blockchain update.`);
      } catch (error: any) {
          logger.error(`Pre-update check failed for VC ${vc_id}:`, error);
          if (error instanceof NotFoundError) {
               throw new NotFoundError(`Original VC with ID ${vc_id} not found on the blockchain. Cannot approve update request ${request_id}.`);
          }
           if (error instanceof BadRequestError) { throw error; } // Rethrow specific errors
          throw new BadRequestError(`Failed to verify VC status before update: ${error.message}`);
      }
      // ------------------------------------

      // --- Blockchain Update Call ---
      let blockchainReceipt: any;
      try {
        // Call the update function on the blockchain
        blockchainReceipt = await VCBlockchainService.updateVCInBlockchain(vc_id, new_vc_hash);
        logger.success(`VC ${vc_id} updated successfully on blockchain with new hash. TX: ${blockchainReceipt?.hash}`);
      } catch (blockchainError: any) {
        logger.error(`Blockchain update failed during approval for request ${request_id} (VC ${vc_id}):`, blockchainError);
        throw new BadRequestError(`Blockchain update failed: ${blockchainError.message}`);
      }
      // -----------------------------

      // --- Database Updates ---
      const result = await this.db.$transaction(async (tx) => {
          // Update update request status
          const updatedRequest = await tx.vCUpdateRequest.update({
            where: { id: request_id },
            data: { status: RequestStatus.APPROVED },
          });

          // Create a new VCResponse record for the update
          const newVCResponse = await tx.vCResponse.create({
            data: {
              request_id: request_id, // Link to the VCUpdateRequest
              request_type: RequestType.UPDATE, // Set type to UPDATE
              issuer_did: issuer_did,
              holder_did: holder_did,
              encrypted_body: encrypted_body, // Store the new encrypted body
            },
          });

          logger.info(`Update request ${request_id} status updated to APPROVED. New VCResponse created: ${newVCResponse.id}`);
          return { updatedRequest, newVCResponse };
      });
      // ------------------------

      return {
        message: "Verifiable Credential update request approved and VC updated on blockchain.",
        request_id: result.updatedRequest.id,
        status: result.updatedRequest.status,
        vc_response_id: result.newVCResponse.id, // Include the new VCResponse ID
        transaction_hash: blockchainReceipt?.hash,
        block_number: blockchainReceipt?.blockNumber,
      };
    } else {
      throw new BadRequestError(`Invalid action specified: ${action}.`);
    }
  }

  /**
   * Phase 1: Claim VC - Atomically update status to PROCESSING
   * This uses a raw SQL query to ensure atomicity
   */
  async claimVC(holderDid: string) {
    logger.info(`Attempting to claim VC for holder DID: ${holderDid}`);

    // Use Prisma's raw query for atomic UPDATE...RETURNING
    // This ensures only one VC is claimed at a time and prevents race conditions
    const result = await this.db.$queryRaw<any[]>`
      UPDATE "VCResponse"
      SET status = 'PROCESSING'::"VCResponseStatus",
          processing_at = NOW(),
          "updatedAt" = NOW()
      WHERE id = (
        SELECT id
        FROM "VCResponse"
        WHERE holder_did = ${holderDid}
          AND status = 'PENDING'::"VCResponseStatus"
          AND "deletedAt" IS NULL
        ORDER BY "createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *;
    `;

    if (!result || result.length === 0) {
      logger.info(`No pending VCs found for holder DID: ${holderDid}`);
      return null;
    }

    const vcResponse = result[0];
    logger.success(`VC claimed successfully: ${vcResponse.id} for holder DID: ${holderDid}`);

    return vcResponse;
  }

  /**
   * Phase 2: Confirm VC - Update status to CLAIMED and set deletedAt (soft delete)
   */
  async confirmVC(vcId: string, holderDid: string) {
    logger.info(`Confirming VC claim: ${vcId} for holder DID: ${holderDid}`);

    // Update the VC to CLAIMED status and set deletedAt for soft delete
    const updatedVC = await this.db.vCResponse.updateMany({
      where: {
        id: vcId,
        holder_did: holderDid,
        status: "PROCESSING", // Only confirm if currently in PROCESSING state
      },
      data: {
        status: "CLAIMED",
        deletedAt: new Date(),
      },
    });

    if (updatedVC.count === 0) {
      logger.warn(`VC confirmation failed: VC ${vcId} not found or not in PROCESSING state for holder ${holderDid}`);
      throw new NotFoundError(`VC with ID ${vcId} not found or not in PROCESSING state.`);
    }

    logger.success(`VC confirmed and soft-deleted: ${vcId}`);

    return {
      message: "VC claimed and confirmed successfully.",
      vc_id: vcId,
    };
  }

  /**
   * Phase 1 Batch: Claim multiple VCs atomically
   * Claims up to 'limit' VCs in a single atomic transaction
   */
  async claimVCsBatch(holderDid: string, limit: number = 10) {
    logger.info(`Attempting to claim batch of VCs (limit: ${limit}) for holder DID: ${holderDid}`);

    // Validate limit (max 50 for safety)
    const safeLimit = Math.min(Math.max(limit, 1), 50);

    // Use Prisma's raw query for atomic batch UPDATE...RETURNING
    const result = await this.db.$queryRaw<any[]>`
      UPDATE "VCResponse"
      SET status = 'PROCESSING'::"VCResponseStatus",
          processing_at = NOW(),
          "updatedAt" = NOW()
      WHERE id IN (
        SELECT id
        FROM "VCResponse"
        WHERE holder_did = ${holderDid}
          AND status = 'PENDING'::"VCResponseStatus"
          AND "deletedAt" IS NULL
        ORDER BY "createdAt" ASC
        LIMIT ${safeLimit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *;
    `;

    if (!result || result.length === 0) {
      logger.info(`No pending VCs found for holder DID: ${holderDid}`);
      return {
        claimed_vcs: [],
        claimed_count: 0,
        remaining_count: 0,
        has_more: false,
      };
    }

    // Check if there are more pending VCs
    const remainingCount = await this.db.vCResponse.count({
      where: {
        holder_did: holderDid,
        status: "PENDING",
        deletedAt: null,
      },
    });

    logger.success(`Batch claimed ${result.length} VCs for holder DID: ${holderDid}`);

    return {
      claimed_vcs: result,
      claimed_count: result.length,
      remaining_count: remainingCount,
      has_more: remainingCount > 0,
    };
  }

  /**
   * Phase 2 Batch: Confirm multiple VCs and soft-delete them
   */
  async confirmVCsBatch(vcIds: string[], holderDid: string) {
    logger.info(`Confirming batch of ${vcIds.length} VCs for holder DID: ${holderDid}`);

    // Update multiple VCs to CLAIMED status and set deletedAt
    const updatedVCs = await this.db.vCResponse.updateMany({
      where: {
        id: { in: vcIds },
        holder_did: holderDid,
        status: "PROCESSING", // Only confirm if currently in PROCESSING state
      },
      data: {
        status: "CLAIMED",
        deletedAt: new Date(),
      },
    });

    if (updatedVCs.count === 0) {
      logger.warn(`Batch VC confirmation failed: No VCs found in PROCESSING state for holder ${holderDid}`);
      throw new NotFoundError(`No VCs found in PROCESSING state for confirmation.`);
    }

    if (updatedVCs.count < vcIds.length) {
      logger.warn(`Partial batch confirmation: ${updatedVCs.count}/${vcIds.length} VCs confirmed for holder ${holderDid}`);
    }

    logger.success(`Batch confirmed and soft-deleted ${updatedVCs.count} VCs`);

    return {
      message: `Successfully confirmed ${updatedVCs.count} VCs.`,
      confirmed_count: updatedVCs.count,
      requested_count: vcIds.length,
    };
  }

}

// Export singleton instance for backward compatibility
export default new CredentialService();

// Export class for testing and custom instantiation
export { CredentialService };
