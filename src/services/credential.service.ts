import { PrismaClient, RequestType, RequestStatus } from "@prisma/client"; // Removed Prisma import
import { prisma } from "../config/database";
import { BadRequestError, NotFoundError } from "../utils/errors/AppError";
import logger from "../config/logger";
import { ProcessIssuanceVCDTO, ProcessIssuanceVCResponseDTO } from "../dtos";
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
  async getCredentialRequestsByType(type: RequestType, issuerDid?: string) {
    const whereClause: { issuer_did?: string } = {};
    if (issuerDid) {
      whereClause.issuer_did = issuerDid;
    }

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
  async requestCredentialRevocation(data: {
    issuer_did: string;
    holder_did: string;
    encrypted_body: string;
  }) {
    const newRevokeRequest = await this.db.vCRevokeRequest.create({
      data: {
        issuer_did: data.issuer_did,
        holder_did: data.holder_did,
        encrypted_body: data.encrypted_body,
        status: "PENDING",
      },
    });

    logger.success(`VC Revocation request created: ${newRevokeRequest.id}`);

    return {
      message: "Verifiable Credential revocation request submitted successfully.",
      request_id: newRevokeRequest.id,
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
  async getVCStatus(vcId: string, issuerDid: string, holderDid: string) {
    // TODO: Implement blockchain query for VC status
    logger.info(`Checking VC status: ${vcId}`);

    // Placeholder response
    const placeholderStatus = {
      vc_id: vcId,
      status: "active",
      revoked: false,
      issuer_did: issuerDid,
      holder_did: holderDid,
    };

    return placeholderStatus;
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
          // How to handle this? Log it? Return a specific error?
          // For now, we'll return success but note the DB issue might need manual fixing.
          // Consider implementing a retry mechanism or a background job for failed DB updates.
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

}

// Export singleton instance for backward compatibility
export default new CredentialService();

// Export class for testing and custom instantiation
export { CredentialService };
