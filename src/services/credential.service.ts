import { PrismaClient, RequestType, RequestStatus, VCResponseStatus } from "@prisma/client"; // Removed Prisma import
import { prisma } from "../config/database";
import { BadRequestError, NotFoundError, BlockchainError, ForbiddenError, InternalServerError } from "../utils/errors/AppError";
import logger from "../config/logger";
import { ProcessUpdateVCDTO, 
  ProcessUpdateVCResponseDTO, 
  ProcessRenewalVCDTO, 
  ProcessRenewalVCResponseDTO, 
  VCStatusResponseDTO,
  CredentialRevocationRequestDTO, 
  CredentialRevocationResponseDTO, 
  ProcessIssuanceVCDTO, 
  ProcessIssuanceVCResponseDTO, 
  HolderCredentialDTO, 
  RevokeVCDTO, 
  RevokeVCResponseDTO, 
  AggregatedRequestDTO, 
  AllIssuerRequestsResponseDTO, 
  IssuerIssueVCDTO, 
  IssuerIssueVCResponseDTO,
  IssuerUpdateVCDTO,
  IssuerUpdateVCResponseDTO,
  IssuerRevokeVCDTO,
  IssuerRevokeVCResponseDTO,
  IssuerRenewVCDTO,
  IssuerRenewVCResponseDTO,
  ClaimIssuerInitiatedVCsDTO,
  ClaimIssuerInitiatedVCsResponseDTO,
  ConfirmIssuerInitiatedVCsDTO,
  ConfirmIssuerInitiatedVCsResponseDTO } from "../dtos";
import VCBlockchainService from "./blockchain/vcBlockchain.service";
import NotificationService from "./notification.service";


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
   * Calculate expiredAt timestamp from expiredIn years
   * @param expiredIn - Number of years from now (0 = lifetime/no expiration)
   * @returns ISO 8601 timestamp string, or empty string for lifetime
   */
  private calculateExpiredAt(expiredIn: number): string {
    // If expiredIn is 0, return empty string to indicate lifetime/no expiration
    if (expiredIn === 0) {
      return "";
    }

    const now = new Date();
    now.setFullYear(now.getFullYear() + expiredIn);
    return now.toISOString();
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
   * Process credential response TIDAK KEPAKAI
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
        action,
        // Fields for approval
        vc_id,
        schema_id,
        schema_version,
        vc_hash,
        encrypted_body,
        expired_at
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

    const issuer_did = issuanceRequest.issuer_did;
    const holder_did = issuanceRequest.holder_did;
    const request_type = RequestType.ISSUANCE;

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
      if (!encrypted_body || !vc_id || !schema_id || !schema_version || !vc_hash || !expired_at) {
        throw new BadRequestError(
          "When action is APPROVED, vc_id, schema_id, schema_version, vc_hash, expired_at, and encrypted_body are required."
        );
      }

      // Query VCSchema to get the name (vc_type) based on schema_id and schema_version
      const vcSchema = await this.db.vCSchema.findUnique({
        where: {
          id_version: {
            id: schema_id,
            version: schema_version
          }
        },
        select: { name: true }
      });

      if (!vcSchema) {
        throw new NotFoundError(`VCSchema with ID ${schema_id} and version ${schema_version} not found.`);
      }

      const vc_type = vcSchema.name;

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
              expired_at,
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

        // Send push notification to holder
        try {
          await NotificationService.sendVCStatusNotification(
            holder_did,
            "New Credential Issued!",
            "Your verifiable credential has been successfully issued and is ready to claim.",
            {
              type: "VC_ISSUED",
              vc_response_id: newVCResponse.id,
              request_id: request_id,
              request_type: RequestType.ISSUANCE,
              transaction_hash: blockchainReceipt?.hash,
            }
          );
          logger.success(`Push notification sent to holder: ${holder_did}`);
        } catch (notifError: any) {
          // Don't fail the issuance if notification fails
          logger.error(`Failed to send push notification to ${holder_did}:`, notifError);
        }

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
    const { request_id, issuer_did, holder_did, action, vc_id, encrypted_body, expired_at } = data;

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
      if (!vc_id || !encrypted_body || !expired_at) {
        throw new BadRequestError("vc_id, encrypted_body, and expired_at are required when action is APPROVED.");
      }

      logger.info(`Processing approval for renewal request ${request_id} targeting VC ${vc_id}`);

      // --- Blockchain Call ---
      let blockchainReceipt: any;
      try {
        // Call the renew function on the blockchain
        blockchainReceipt = await VCBlockchainService.renewVCInBlockchain(vc_id, expired_at);
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
    const { request_id, issuer_did, holder_did, action, vc_id, new_vc_id, vc_type, schema_id, schema_version, new_vc_hash, encrypted_body, expired_at } = data;

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
      if (!vc_id || !new_vc_id || !vc_type || !schema_id || !schema_version || !new_vc_hash || !encrypted_body || !expired_at) {
        throw new BadRequestError("vc_id, new_vc_id, vc_type, schema_id, schema_version, new_vc_hash, encrypted_body, and expired_at are required when action is APPROVED.");
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
        blockchainReceipt = await VCBlockchainService.updateVCInBlockchain(
          vc_id,
          new_vc_id,
          issuer_did,
          holder_did,
          vc_type,
          schema_id,
          schema_version,
          expired_at,
          new_vc_hash
        );
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
   *
   * Idempotent re-claim: Also allows claiming VCs stuck in PROCESSING
   * for more than 5 minutes to handle network failures/crashes
   */
  async claimVCsBatch(holderDid: string, limit: number = 10) {
    logger.info(`Attempting to claim batch of VCs (limit: ${limit}) for holder DID: ${holderDid}`);

    // Validate limit (max 100 for safety)
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    // Use Prisma's raw query for atomic batch UPDATE...RETURNING
    // Includes PENDING VCs AND stuck PROCESSING VCs (>5 min timeout)
    const result = await this.db.$queryRaw<any[]>`
      UPDATE "VCResponse"
      SET status = 'PROCESSING'::"VCResponseStatus",
          processing_at = NOW(),
          "updatedAt" = NOW()
      WHERE id IN (
        SELECT id
        FROM "VCResponse"
        WHERE holder_did = ${holderDid}
          AND "deletedAt" IS NULL
          AND (
            status = 'PENDING'::"VCResponseStatus"
            OR (
              status = 'PROCESSING'::"VCResponseStatus"
              AND processing_at < NOW() - INTERVAL '5 minutes'
            )
          )
        ORDER BY "createdAt" ASC
        LIMIT ${safeLimit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING request_id, encrypted_body, status, processing_at;
    `;

    if (!result || result.length === 0) {
      logger.info(`No claimable VCs found for holder DID: ${holderDid}`);
      return {
        claimed_vcs: [],
        claimed_count: 0,
        remaining_count: 0,
        has_more: false,
      };
    }

    // Check if there are more claimable VCs (PENDING or stuck PROCESSING)
    const remainingCount = await this.db.vCResponse.count({
      where: {
        holder_did: holderDid,
        deletedAt: null,
        OR: [
          { status: "PENDING" },
          {
            status: "PROCESSING",
            processing_at: {
              lt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
            },
          },
        ],
      },
    });

    logger.success(`Batch claimed ${result.length} VCs for holder DID: ${holderDid} (includes re-claims)`);

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

  /**
   * Background cleanup: Reset VCs stuck in PROCESSING for >15 minutes
   * This should be called by a scheduled job (cron) periodically
   *
   * @param timeoutMinutes - Default 15 minutes timeout
   * @returns Number of VCs reset from PROCESSING to PENDING
   */
  async resetStuckProcessingVCs(timeoutMinutes: number = 15) {
    logger.info(`Running cleanup job: resetting VCs stuck in PROCESSING for >${timeoutMinutes} minutes`);

    const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    // Find and reset stuck PROCESSING VCs atomically
    const result = await this.db.$queryRaw<any[]>`
      UPDATE "VCResponse"
      SET status = 'PENDING'::"VCResponseStatus",
          processing_at = NULL,
          "updatedAt" = NOW()
      WHERE status = 'PROCESSING'::"VCResponseStatus"
        AND processing_at < ${cutoffTime}
        AND "deletedAt" IS NULL
      RETURNING id, holder_did, processing_at;
    `;

    const resetCount = result?.length || 0;

    if (resetCount > 0) {
      logger.warn(`Cleanup job reset ${resetCount} stuck PROCESSING VCs back to PENDING`);
      // Log the affected VCs for debugging
      result.forEach((vc: any) => {
        logger.debug(`Reset VC ${vc.id} for holder ${vc.holder_did}, stuck since ${vc.processing_at}`);
      });
    } else {
      logger.info(`Cleanup job completed: no stuck PROCESSING VCs found`);
    }

    return {
      reset_count: resetCount,
      timeout_minutes: timeoutMinutes,
      cutoff_time: cutoffTime,
    };
  }

  async getAllIssuerRequests(
    issuerDid: string,
    status?: RequestStatus | 'ALL' // Perbarui tipe untuk menyertakan 'ALL'
  ): Promise<AllIssuerRequestsResponseDTO> {
    
    logger.info(`Fetching all requests for issuer: ${issuerDid}, status: ${status || 'ALL'}`);

    // Tentukan klausa 'where'
    const whereClause: { issuer_did: string; status?: RequestStatus } = {
      issuer_did: issuerDid,
    };

    // Hanya tambahkan filter status jika ada DAN bukan 'ALL'
    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    //
    const selectFields = {
      id: true,
      issuer_did: true,
      holder_did: true,
      status: true,
      encrypted_body: true,
      createdAt: true,
    };

    // ... (sisa fungsi tetap sama: Promise.all, map, sort) ...
    //
    const [
      issuanceRequests,
      renewalRequests,
      updateRequests,
      revokeRequests,
    ] = await Promise.all([
      this.db.vCIssuanceRequest.findMany({ where: whereClause, select: selectFields }),
      this.db.vCRenewalRequest.findMany({ where: whereClause, select: selectFields }),
      this.db.vCUpdateRequest.findMany({ where: whereClause, select: selectFields }),
      this.db.vCRevokeRequest.findMany({ where: whereClause, select: selectFields }),
    ]);

    const aggregatedRequests: AggregatedRequestDTO[] = [
      ...issuanceRequests.map(req => ({ ...req, request_type: RequestType.ISSUANCE })),
      ...renewalRequests.map(req => ({ ...req, request_type: RequestType.RENEWAL })),
      ...updateRequests.map(req => ({ ...req, request_type: RequestType.UPDATE })),
      ...revokeRequests.map(req => ({ ...req, request_type: RequestType.REVOKE })),
    ];

    aggregatedRequests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    logger.success(`Found ${aggregatedRequests.length} total requests for issuer: ${issuerDid}`);

    return {
      count: aggregatedRequests.length,
      requests: aggregatedRequests,
    };
  }

  async issuerIssueVC(
    data: IssuerIssueVCDTO,
    authenticatedDid: string // DID dari token JWT
  ): Promise<IssuerIssueVCResponseDTO> {
    
    // Validasi Keamanan: Pastikan DID yang diautentikasi adalah issuer yang sebenarnya
    if (data.issuer_did !== authenticatedDid) {
      logger.warn(`Auth mismatch: Token DID (${authenticatedDid}) != Issuer DID (${data.issuer_did})`);
      // --- MENGGUNAKAN ForbiddenError YANG DIIMPOR ---
      throw new ForbiddenError("Authenticated DID does not match the issuer_did in the request body.");
    }

    const {
      issuer_did,
      holder_did,
      vc_id,
      vc_type,
      schema_id,
      schema_version,
      vc_hash,
      encrypted_body,
      expiredAt
    } = data;

    logger.info(`Attempting direct issue by issuer ${issuer_did} for VC ${vc_id}`);

    // 1. Panggil Blockchain
    let blockchainReceipt: any;
    try {
      blockchainReceipt = await VCBlockchainService.issueVCInBlockchain(
        vc_id,
        issuer_did,
        holder_did,
        vc_type,
        schema_id,
        schema_version,
        expiredAt, // Menggunakan parameter expiredAt yang baru
        vc_hash
      );
      logger.info(`Blockchain issue successful for ${vc_id}. TX: ${blockchainReceipt?.hash}`);
    } catch (blockchainError: any) {
      logger.error(`Blockchain direct issue failed for ${vc_id}:`, blockchainError);
      throw new BadRequestError(`Blockchain issuance failed: ${blockchainError.message}`);
    }

    // 2. Simpan ke tabel VCinitiatedByIssuer
    try {
      const newRecord = await this.db.vCinitiatedByIssuer.create({
        data: {
          request_type: RequestType.ISSUANCE, // Hardcode sebagai ISSUANCE
          issuer_did: issuer_did,
          holder_did: holder_did,
          encrypted_body: encrypted_body,
          // --- MENGGUNAKAN VCResponseStatus YANG DIIMPOR ---
          status: VCResponseStatus.PENDING, // Status default PENDING
          // processing_at, createdAt, updatedAt, deletedAt akan di-handle oleh Prisma
        },
      });

      logger.success(`New VC record created in VCinitiatedByIssuer: ${newRecord.id}`);
      
      // (Opsional) Kirim notifikasi push ke holder
      try {
        // --- PERBAIKAN 3: Menambahkan argumen yang diperlukan ---
        await NotificationService.sendVCStatusNotification(
          holder_did, // 1. holder_did
          "Credential Baru Telah Diterbitkan!", // 2. title
          "Sebuah kredensial baru telah diterbitkan untuk Anda dan siap untuk diklaim.", // 3. body
          { // 4. data (opsional)
            type: "VC_ISSUED_BY_ISSUER",
            record_id: newRecord.id,
            request_type: RequestType.ISSUANCE,
          }
        );
        logger.success(`Push notification sent to holder (direct issue): ${holder_did}`);
      } catch (notifError: any) {
        logger.error(`Failed to send push notification (direct issue) to ${holder_did}:`, notifError);
      }

      return {
        message: "VC issued directly to blockchain and stored for holder claim.",
        record_id: newRecord.id,
        transaction_hash: blockchainReceipt.hash,
        block_number: blockchainReceipt.blockNumber,
      };

    } catch (dbError: any) {
      logger.error(`Database storage failed for VCinitiatedByIssuer (VC ${vc_id}) after successful TX ${blockchainReceipt?.hash}:`, dbError);
      // Ini adalah error kritis. Blockchain berhasil tapi DB gagal.
      // --- MENGGUNAKAN InternalServerError YANG DIIMPOR ---
      throw new InternalServerError(`Blockchain succeeded (TX: ${blockchainReceipt.hash}), but database save failed. Please contact support. Error: ${dbError.message}`);
    }
  }

  async issuerUpdateVC(
    data: IssuerUpdateVCDTO,
    authenticatedDid: string
  ): Promise<IssuerUpdateVCResponseDTO> {
    
    // 1. Validasi Keamanan
    if (data.issuer_did !== authenticatedDid) {
      logger.warn(`Auth mismatch: Token DID (${authenticatedDid}) != Issuer DID (${data.issuer_did})`);
      throw new ForbiddenError("Authenticated DID does not match the issuer_did in the request body.");
    }

    const {
      issuer_did,
      holder_did,
      old_vc_id,
      new_vc_id,
      vc_type,
      schema_id,
      schema_version,
      new_vc_hash,
      encrypted_body,
      expiredAt
    } = data;

    logger.info(`Attempting direct update by issuer ${issuer_did} for old VC ${old_vc_id} -> new VC ${new_vc_id}`);

    // 2. Pre-Check: Pastikan VC lama ada dan aktif
    try {
      const currentVcStatus = await VCBlockchainService.getVCStatusFromBlockchain(old_vc_id);
      if (currentVcStatus && currentVcStatus.status === false) {
         logger.warn(`Attempted to update an inactive/revoked VC: ${old_vc_id}`);
         throw new BadRequestError(`Cannot update VC ${old_vc_id} because it is currently inactive/revoked on the blockchain.`);
      }
      logger.info(`VC ${old_vc_id} found and is active. Proceeding with blockchain update.`);
    } catch (error: any) {
        logger.error(`Pre-update check failed for VC ${old_vc_id}:`, error);
        if (error instanceof NotFoundError) {
             throw new NotFoundError(`Original VC with ID ${old_vc_id} not found on the blockchain. Cannot process update.`);
        }
        if (error instanceof BadRequestError) { throw error; }
        throw new BadRequestError(`Failed to verify VC status before update: ${error.message}`);
    }

    // 3. Panggil Blockchain (UpdateVC)
    let blockchainReceipt: any;
    try {
      blockchainReceipt = await VCBlockchainService.updateVCInBlockchain(
        old_vc_id,
        new_vc_id,
        issuer_did,
        holder_did,
        vc_type,
        schema_id,
        schema_version,
        expiredAt,
        new_vc_hash
      );
      logger.info(`Blockchain update successful for ${new_vc_id}. TX: ${blockchainReceipt?.hash}`);
    } catch (blockchainError: any)
    {
      logger.error(`Blockchain direct update failed for ${old_vc_id} -> ${new_vc_id}:`, blockchainError);
      throw new BadRequestError(`Blockchain update failed: ${blockchainError.message}`);
    }

    // 4. Simpan VC BARU ke tabel VCinitiatedByIssuer
    try {
      const newRecord = await this.db.vCinitiatedByIssuer.create({
        data: {
          request_type: RequestType.UPDATE, // Hardcode sebagai UPDATE
          issuer_did: issuer_did,
          holder_did: holder_did,
          encrypted_body: encrypted_body, // Menyimpan body VC yang BARU
          status: VCResponseStatus.PENDING, // Status default PENDING
        },
      });

      logger.success(`New VC record (from update) created in VCinitiatedByIssuer: ${newRecord.id}`);
      
      // (Opsional) Kirim notifikasi push ke holder
      try {
        await NotificationService.sendVCStatusNotification(
          holder_did,
          "Kredensial Anda Telah Diperbarui!",
          "Sebuah kredensial Anda telah diperbarui oleh penerbit dan siap untuk diklaim.",
          {
            type: "VC_UPDATED_BY_ISSUER",
            record_id: newRecord.id,
            request_type: RequestType.UPDATE,
          }
        );
        logger.success(`Push notification sent to holder (direct update): ${holder_did}`);
      } catch (notifError: any) {
        logger.error(`Failed to send push notification (direct update) to ${holder_did}:`, notifError);
      }

      return {
        message: "VC updated directly on blockchain and new VC stored for holder claim.",
        record_id: newRecord.id,
        transaction_hash: blockchainReceipt.hash,
        block_number: blockchainReceipt.blockNumber,
      };

    } catch (dbError: any) {
      logger.error(`Database storage failed for VCinitiatedByIssuer (VC ${new_vc_id}) after successful TX ${blockchainReceipt?.hash}:`, dbError);
      throw new InternalServerError(`Blockchain update succeeded (TX: ${blockchainReceipt.hash}), but database save failed. Please contact support. Error: ${dbError.message}`);
    }
  }

  async issuerRevokeVC(
    data: IssuerRevokeVCDTO,
    authenticatedDid: string
  ): Promise<IssuerRevokeVCResponseDTO> {
    
    // 1. Validasi Keamanan
    if (data.issuer_did !== authenticatedDid) {
      logger.warn(`Auth mismatch: Token DID (${authenticatedDid}) != Issuer DID (${data.issuer_did})`);
      throw new ForbiddenError("Authenticated DID does not match the issuer_did in the request body.");
    }

    const { issuer_did, vc_id } = data;

    logger.info(`Attempting direct revoke by issuer ${issuer_did} for VC ${vc_id}`);

    // 2. Pre-Check: Pastikan VC ada dan aktif
    try {
      const currentVcStatus = await VCBlockchainService.getVCStatusFromBlockchain(vc_id);
      
      // Periksa apakah issuer-nya cocok
      if (currentVcStatus.issuerDID !== issuer_did) {
         logger.warn(`Revoke attempt failed: VC ${vc_id} was not issued by ${issuer_did}.`);
         throw new ForbiddenError(`Authenticated issuer (${issuer_did}) did not issue this VC.`);
      }

      if (currentVcStatus && currentVcStatus.status === false) {
         logger.warn(`Attempted to revoke an already revoked VC: ${vc_id}`);
         throw new BadRequestError(`VC with ID ${vc_id} is already revoked on the blockchain.`);
      }
      logger.info(`VC ${vc_id} found, is active, and matches issuer. Proceeding with blockchain revocation.`);
    } catch (error: any) {
        logger.error(`Pre-revocation check failed for VC ${vc_id}:`, error);
        if (error instanceof NotFoundError) {
             throw new NotFoundError(`VC with ID ${vc_id} not found on the blockchain.`);
        }
        if (error instanceof BadRequestError || error instanceof ForbiddenError) {
          throw error; // Lemparkan kembali error yang sudah spesifik
        }
        throw new BadRequestError(`Failed to verify VC status before revocation: ${error.message}`);
    }

    // 3. Panggil Blockchain (RevokeVC)
    let blockchainReceipt: any;
    try {
      blockchainReceipt = await VCBlockchainService.revokeVCInBlockchain(vc_id);
      logger.success(`VC ${vc_id} revoked successfully on blockchain. TX: ${blockchainReceipt?.hash}`);
    } catch (blockchainError: any) {
      logger.error(`Blockchain direct revoke failed for ${vc_id}:`, blockchainError);
      throw new BadRequestError(`Blockchain revocation failed: ${blockchainError.message}`);
    }

    // 4. Kirim respons
    return {
      message: "VC revoked directly on blockchain.",
      vc_id: vc_id,
      transaction_hash: blockchainReceipt.hash,
      block_number: blockchainReceipt.blockNumber,
    };
  }

  async issuerRenewVC(
    data: IssuerRenewVCDTO,
    authenticatedDid: string
  ): Promise<IssuerRenewVCResponseDTO> {
    
    // 1. Validasi Keamanan
    if (data.issuer_did !== authenticatedDid) {
      logger.warn(`Auth mismatch: Token DID (${authenticatedDid}) != Issuer DID (${data.issuer_did})`);
      throw new ForbiddenError("Authenticated DID does not match the issuer_did in the request body.");
    }

    // Destrukturisasi data, termasuk expiredAt
    const { issuer_did, holder_did, vc_id, encrypted_body, expiredAt } = data; // <-- TAMBAHKAN expiredAt

    logger.info(`Attempting direct renew by issuer ${issuer_did} for VC ${vc_id}`);

    // 2. Pre-Check: Pastikan VC ada dan milik issuer
    try {
      // ... (Logika pre-check tetap sama) ...
      const currentVcStatus = await VCBlockchainService.getVCStatusFromBlockchain(vc_id);
      if (currentVcStatus.issuerDID !== issuer_did) {
         throw new ForbiddenError(`Authenticated issuer (${issuer_did}) did not issue this VC.`);
      }
      logger.info(`VC ${vc_id} found and matches issuer. Proceeding with blockchain renewal.`);
    } catch (error: any) {
      // ... (Error handling pre-check tetap sama) ...
      if (error instanceof NotFoundError) {
           throw new NotFoundError(`VC with ID ${vc_id} not found on the blockchain.`);
      }
      if (error instanceof ForbiddenError) { throw error; }
      throw new BadRequestError(`Failed to verify VC status before renewal: ${error.message}`);
    }

    // 3. Panggil Blockchain (RenewVC)
    let blockchainReceipt: any;
    try {
      // --- PERBAIKAN: Teruskan expiredAt ke fungsi blockchain ---
      blockchainReceipt = await VCBlockchainService.renewVCInBlockchain(vc_id, expiredAt);
      logger.success(`VC ${vc_id} renewed successfully on blockchain. TX: ${blockchainReceipt?.hash}`);
    } catch (blockchainError: any) {
      logger.error(`Blockchain direct renew failed for ${vc_id}:`, blockchainError);
      throw new BadRequestError(`Blockchain renewal failed: ${blockchainError.message}`);
    }

    // 4. Simpan VC BARU ke tabel VCinitiatedByIssuer
    try {
      // ... (Logika penyimpanan DB tetap sama) ...
      const newRecord = await this.db.vCinitiatedByIssuer.create({
        data: {
          request_type: RequestType.RENEWAL,
          issuer_did: issuer_did,
          holder_did: holder_did,
          encrypted_body: encrypted_body,
          status: VCResponseStatus.PENDING,
        },
      });

      logger.success(`New VC record (from renew) created in VCinitiatedByIssuer: ${newRecord.id}`);
      
      // ... (Logika notifikasi push tetap sama) ...
      try {
        await NotificationService.sendVCStatusNotification(
          holder_did,
          "Kredensial Anda Telah Diperbarui!",
          "Sebuah kredensial Anda telah diperbarui (renew) oleh penerbit dan siap untuk diklaim.",
          {
            type: "VC_RENEWED_BY_ISSUER",
            record_id: newRecord.id,
            request_type: RequestType.RENEWAL,
          }
        );
      } catch (notifError: any) {
         logger.error(`Failed to send push notification (direct renew) to ${holder_did}:`, notifError);
      }

      return {
        message: "VC renewed directly on blockchain and new VC stored for holder claim.",
        record_id: newRecord.id,
        transaction_hash: blockchainReceipt.hash,
        block_number: blockchainReceipt.blockNumber,
      };

    } catch (dbError: any) {
      // ... (Error handling DB tetap sama) ...
      throw new InternalServerError(`Blockchain renew succeeded (TX: ${blockchainReceipt.hash}), but database save failed. Please contact support. Error: ${dbError.message}`);
    }
  }

  async claimIssuerInitiatedVCsBatch(
    holderDid: string, 
    limit: number = 10
  ): Promise<ClaimIssuerInitiatedVCsResponseDTO> {
    logger.info(`Attempting to claim batch of ISSUER-INITIATED VCs (limit: ${limit}) for holder DID: ${holderDid}`);

    // Gunakan batas aman yang sama
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    // Gunakan kueri raw, GANTI "VCResponse" menjadi "VCinitiatedByIssuer"
    const result = await this.db.$queryRaw<any[]>`
      UPDATE "VCinitiatedByIssuer"
      SET status = 'PROCESSING'::"VCResponseStatus",
          processing_at = NOW(),
          "updatedAt" = NOW()
      WHERE id IN (
        SELECT id
        FROM "VCinitiatedByIssuer"
        WHERE holder_did = ${holderDid}
          AND "deletedAt" IS NULL
          AND (
            status = 'PENDING'::"VCResponseStatus"
            OR (
              status = 'PROCESSING'::"VCResponseStatus"
              AND processing_at < NOW() - INTERVAL '5 minutes'
            )
          )
        ORDER BY "createdAt" ASC
        LIMIT ${safeLimit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *;
    `;

    if (!result || result.length === 0) {
      logger.info(`No claimable ISSUER-INITIATED VCs found for holder DID: ${holderDid}`);
      return {
        claimed_vcs: [],
        claimed_count: 0,
        remaining_count: 0,
        has_more: false,
      };
    }

    // Periksa sisa VC, GANTI target ke vCinitiatedByIssuer
    const remainingCount = await this.db.vCinitiatedByIssuer.count({
      where: {
        holder_did: holderDid,
        deletedAt: null,
        OR: [
          { status: "PENDING" },
          {
            status: "PROCESSING",
            processing_at: {
              lt: new Date(Date.now() - 5 * 60 * 1000), // 5 menit lalu
            },
          },
        ],
      },
    });

    logger.success(`Batch claimed ${result.length} ISSUER-INITIATED VCs for holder DID: ${holderDid}`);

    return {
      claimed_vcs: result,
      claimed_count: result.length,
      remaining_count: remainingCount,
      has_more: remainingCount > 0,
    };
  }

  /**
   * Phase 2 Batch (Issuer-Initiated): Confirm multiple VCs and soft-delete them
   */
  async confirmIssuerInitiatedVCsBatch(
    vcIds: string[], 
    holderDid: string
  ): Promise<ConfirmIssuerInitiatedVCsResponseDTO> {
    logger.info(`Confirming batch of ${vcIds.length} ISSUER-INITIATED VCs for holder DID: ${holderDid}`);

    // Update multiple VCs, GANTI target ke vCinitiatedByIssuer
    const updatedVCs = await this.db.vCinitiatedByIssuer.updateMany({
      where: {
        id: { in: vcIds },
        holder_did: holderDid,
        status: "PROCESSING", // Hanya konfirmasi jika statusnya PROCESSING
      },
      data: {
        status: "CLAIMED",
        deletedAt: new Date(),
      },
    });

    if (updatedVCs.count === 0) {
      logger.warn(`Batch VC confirmation failed (ISSUER-INITIATED): No VCs found in PROCESSING state for holder ${holderDid}`);
      throw new NotFoundError(`No VCs (issuer-initiated) found in PROCESSING state for confirmation.`);
    }

    if (updatedVCs.count < vcIds.length) {
      logger.warn(`Partial batch confirmation (ISSUER-INITIATED): ${updatedVCs.count}/${vcIds.length} VCs confirmed for holder ${holderDid}`);
    }

    logger.success(`Batch confirmed and soft-deleted ${updatedVCs.count} ISSUER-INITIATED VCs`);

    return {
      message: `Successfully confirmed ${updatedVCs.count} issuer-initiated VCs.`,
      confirmed_count: updatedVCs.count,
      requested_count: vcIds.length,
    };
  }

}

// Export singleton instance for backward compatibility
export default new CredentialService();

// Export class for testing and custom instantiation
export { CredentialService };
