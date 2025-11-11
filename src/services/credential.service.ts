import {
  PrismaClient,
  RequestType,
  RequestStatus,
  VCResponseStatus,
} from "@prisma/client"; // Removed Prisma import
import { prisma } from "../config/database";
import {
  BadRequestError,
  NotFoundError,
  BlockchainError,
  ForbiddenError,
  InternalServerError,
} from "../utils/errors/AppError";
import logger from "../config/logger";
import {
  ProcessUpdateVCDTO,
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
  ConfirmIssuerInitiatedVCsResponseDTO,
  ValidateVCDTO,
  VCValidationResult,
  CombinedClaimVCDTO,
  CombinedClaimVCsResponseDTO,
  CombinedClaimConfirmationItemDTO,
  CombinedConfirmVCsBatchDTO,
  CombinedConfirmVCsResponseDTO,
} from "../dtos";
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
  constructor(dependencies?: { db?: PrismaClient }) {
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
  async getCredentialRequestsByType(
    type: RequestType | "ALL", // <-- PERBAIKI BARIS INI
    issuerDid?: string,
    holderDid?: string
  ) {
    
    interface WhereClause {
        issuer_did?: string;
        holder_did?: string;
    }

    const whereClause: WhereClause = {};
    if (issuerDid) {
      whereClause.issuer_did = issuerDid;
    }
    if (holderDid) { 
      whereClause.holder_did = holderDid;
    }

    logger.info(`Fetching ${type} requests with filters:`, whereClause);

    let requests: any[]; // Ubah ke any[] untuk menampung agregat

    // --- Handle "ALL" ---
    if (type === "ALL") {
      const [
        issuanceRequests,
        renewalRequests,
        updateRequests,
        revokeRequests,
      ] = await Promise.all([
        this.db.vCIssuanceRequest.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
        }),
        this.db.vCRenewalRequest.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
        }),
        this.db.vCUpdateRequest.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
        }),
        this.db.vCRevokeRequest.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
        }),
      ]);

      // Agregasi hasil
      requests = [
        ...issuanceRequests.map(req => ({ ...req, request_type: RequestType.ISSUANCE })),
        ...renewalRequests.map(req => ({ ...req, request_type: RequestType.RENEWAL })),
        ...updateRequests.map(req => ({ ...req, request_type: RequestType.UPDATE })),
        ...revokeRequests.map(req => ({ ...req, request_type: RequestType.REVOKE })),
      ];

      // Urutkan berdasarkan tanggal (terbaru dulu)
      requests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
    } else {
      // --- Logika switch yang sudah ada ---
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
    }
    // ------------------------------------

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
  async requestCredentialRevocation(
    data: CredentialRevocationRequestDTO
  ): Promise<CredentialRevocationResponseDTO> {
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
      message:
        "Verifiable Credential revocation request submitted successfully.",
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
      const blockchainStatus =
        await VCBlockchainService.getVCStatusFromBlockchain(vcId);

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
      logger.error(
        `Failed to get VC status from blockchain for ${vcId}:`,
        error
      );
      // Rethrow specific errors or wrap them
      if (error instanceof NotFoundError) {
        throw new NotFoundError(
          `VC with ID ${vcId} not found on the blockchain.`
        );
      }
      throw new BlockchainError(
        `Failed to retrieve VC status from blockchain: ${error.message}`
      );
    }
  }

  async processIssuanceVC(
    data: ProcessIssuanceVCDTO
  ): Promise<ProcessIssuanceVCResponseDTO> {
    const {
      request_id,
      action,
      // Fields for approval
      vc_id,
      schema_id,
      schema_version,
      vc_hash,
      encrypted_body,
      expired_at,
    } = data;

    // 1. Find the original issuance request
    const issuanceRequest = await this.db.vCIssuanceRequest.findUnique({
      where: { id: request_id },
    });

    if (!issuanceRequest) {
      throw new NotFoundError(
        `Issuance request with ID ${request_id} not found.`
      );
    }

    if (issuanceRequest.status !== RequestStatus.PENDING) {
      throw new BadRequestError(
        `Issuance request ${request_id} has already been processed (Status: ${issuanceRequest.status}).`
      );
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

      // Send push notification to holder
      try {
        await NotificationService.sendVCStatusNotification(
          holder_did,
          "Credential Request Declined",
          "Your credential issuance request has been declined by the issuer.",
          {
            type: "VC_ISSUANCE_REJECTED",
            request_id: request_id,
            request_type: RequestType.ISSUANCE,
          }
        );
        logger.success(`Push notification sent to holder: ${holder_did}`);
      } catch (notifError: any) {
        logger.error(
          `Failed to send push notification to ${holder_did}:`,
          notifError
        );
      }

      return {
        message: "Verifiable Credential issuance request rejected.",
        request_id: updatedRequest.id,
        status: updatedRequest.status,
      };
    } else if (action === RequestStatus.APPROVED) {
      if (
        !encrypted_body ||
        !vc_id ||
        !schema_id ||
        !schema_version ||
        !vc_hash
      ) {
        throw new BadRequestError(
          "When action is APPROVED, vc_id, schema_id, schema_version, vc_hash, and encrypted_body are required."
        );
      }

      // Query VCSchema to get the name (vc_type) based on schema_id and schema_version
      const vcSchema = await this.db.vCSchema.findUnique({
        where: {
          id_version: {
            id: schema_id,
            version: schema_version,
          },
        },
        select: { name: true },
      });

      if (!vcSchema) {
        throw new NotFoundError(
          `VCSchema with ID ${schema_id} and version ${schema_version} not found.`
        );
      }

      const vc_type = vcSchema.name;

      // --- Check and Revoke Existing VCs with Same Criteria ---
      try {
        logger.info(
          `Checking for existing VCs with holderDID: ${holder_did}, schemaID: ${schema_id}, schemaVersion: ${schema_version}`
        );

        const allVCs = await VCBlockchainService.getAllVCsFromBlockchain();

        // Filter VCs that match the criteria and are still active
        const existingVCs = allVCs.filter((vc: any) => {
          return (
            vc.holderDID === holder_did &&
            vc.schemaID === schema_id &&
            vc.schemaVersion === schema_version &&
            vc.isActive === true
          );
        });

        // Revoke each matching VC
        if (existingVCs.length > 0) {
          logger.info(
            `Found ${existingVCs.length} existing active VC(s) to revoke`
          );

          for (const existingVC of existingVCs) {
            try {
              const revokeReceipt = await VCBlockchainService.revokeVCInBlockchain(
                existingVC.id
              );
              logger.info(
                `✅ Revoked existing VC ${existingVC.id}. TX: ${revokeReceipt.hash}`
              );
            } catch (revokeError: any) {
              logger.error(
                `Failed to revoke existing VC ${existingVC.id}:`,
                revokeError
              );
              // Continue with other VCs even if one fails
            }
          }
        } else {
          logger.info(
            `No existing active VCs found for this holder with the same schema`
          );
        }
      } catch (checkError: any) {
        logger.error(
          "Error checking/revoking existing VCs (non-critical):",
          checkError
        );
        // Don't fail the issuance if checking/revoking fails
        // The new VC can still be issued
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
          expired_at,
          vc_hash
        );
        logger.info(
          `Blockchain issuance successful for ${vc_id}. TX: ${blockchainReceipt?.hash}`
        );
      } catch (blockchainError: any) {
        logger.error("Blockchain issuance failed:", blockchainError);
        // Decide how to handle this: rethrow or just log and potentially skip DB updates?
        // Rethrowing is safer to indicate the overall operation failed.
        throw new BadRequestError(
          `Blockchain issuance failed: ${blockchainError.message}`
        );
      }
      // ----------------------------------------------------------------

      // --- Database Updates (Perform AFTER successful blockchain call) ---
      // !! Note: If these fail, the blockchain entry exists but DB is inconsistent !!
      let updatedRequest;
      let newVCResponse;
      try {
        updatedRequest = await this.db.vCIssuanceRequest.update({
          where: { id: request_id },
          data: { 
            status: RequestStatus.APPROVED,
            vc_id: vc_id // <-- SIMPAN VC_ID DI SINI
          },
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
        logger.success(
          `Database updated for approved request: ${request_id}. VCResponse created: ${newVCResponse.id}`
        );

        // Send push notification to holder
        try {
          await NotificationService.sendVCStatusNotification(
            holder_did,
            "Credential Issued Successfully",
            "Your verifiable credential has been issued and is now available for use.",
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
          logger.error(
            `Failed to send push notification to ${holder_did}:`,
            notifError
          );
        }
      } catch (dbError: any) {
        logger.error(
          `Database update failed for approved request ${request_id} after successful blockchain TX ${blockchainReceipt?.hash}:`,
          dbError
        );
        return {
          message:
            "Blockchain issuance succeeded, but database update failed. Please check logs.",
          request_id: request_id, // Return original request ID
          status: RequestStatus.APPROVED, // Reflect intended status
          vc_response_id: undefined, // Indicate DB write failure
          transaction_hash: blockchainReceipt?.hash,
          block_number: blockchainReceipt?.blockNumber,
        };
      }
      // ------------------------------------------------------------------

      return {
        message:
          "Verifiable Credential issued successfully on blockchain and database.",
        request_id: updatedRequest.id,
        status: updatedRequest.status,
        vc_response_id: newVCResponse.id,
        transaction_hash: blockchainReceipt?.hash,
        block_number: blockchainReceipt?.blockNumber,
      };
    } else {
      throw new BadRequestError(
        `Invalid action: ${action}. Must be APPROVED or REJECTED.`
      );
    }
  }

  async getHolderCredentialsFromDB(
    holderDid: string
  ): Promise<HolderCredentialDTO[]> {
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
        request_id: "desc", // Example sort, consider adding createdAt
      },
    });

    if (vcResponses.length === 0) {
      logger.info(`No credentials found in DB for holder DID: ${holderDid}`);
    } else {
      logger.info(
        `Found ${vcResponses.length} credential responses in DB for holder DID: ${holderDid}`
      );
    }

    // Map the Prisma results directly (DTO now matches the model)
    // No explicit mapping needed if DTO field names match model field names
    const credentials: HolderCredentialDTO[] = vcResponses; // Direct assignment works if DTO matches

    return credentials;
  }

  async revokeVC(data: RevokeVCDTO): Promise<RevokeVCResponseDTO> {
    const { request_id, action, vc_id } = data;

    // 1. Find the original revocation request in the database
    const revokeRequest = await this.db.vCRevokeRequest.findUnique({
      where: { id: request_id },
    });

    if (!revokeRequest) {
      throw new NotFoundError(
        `Revocation request with ID ${request_id} not found.`
      );
    }

    // 2. Get issuer_did and holder_did from database
    const issuer_did = revokeRequest.issuer_did;
    const holder_did = revokeRequest.holder_did;

    // 3. Check if already processed
    if (revokeRequest.status !== RequestStatus.PENDING) {
      throw new BadRequestError(
        `Revocation request ${request_id} has already been processed (Status: ${revokeRequest.status}).`
      );
    }

    // 4. Process based on action (Logika ini tetap sama)
    if (action === RequestStatus.REJECTED) {
      // ... (logika REJECTED tidak berubah)
      const updatedRequest = await this.db.vCRevokeRequest.update({
        where: { id: request_id },
        data: { status: RequestStatus.REJECTED },
      });

      logger.warn(`VC Revocation request rejected: ${request_id}`);

      // Send push notification to holder
      try {
        await NotificationService.sendVCStatusNotification(
          holder_did,
          "Revocation Request Declined",
          "Your credential revocation request has been declined by the issuer.",
          {
            type: "VC_REVOKE_REJECTED",
            request_id: request_id,
            request_type: RequestType.REVOKE,
          }
        );
        logger.success(`Push notification sent to holder: ${holder_did}`);
      } catch (notifError: any) {
        logger.error(
          `Failed to send push notification to ${holder_did}:`,
          notifError
        );
      }

      return {
        message: "Verifiable Credential revocation request rejected.",
        request_id: updatedRequest.id,
        status: updatedRequest.status,
      };
    } else if (action === RequestStatus.APPROVED) {
      // ... (logika APPROVED tidak berubah)
      if (!vc_id) {
        throw new BadRequestError("vc_id is required when action is APPROVED.");
      }

      logger.info(
        `Processing approval for revocation request ${request_id} targeting VC ${vc_id}`
      );

      // --- Pre-Revocation Blockchain Check ---
      try {
        const currentVcStatus =
          await VCBlockchainService.getVCStatusFromBlockchain(vc_id);
        if (currentVcStatus && currentVcStatus.status === false) {
          logger.warn(
            `Attempted to approve revocation for an already revoked VC: ${vc_id}`
          );
          await this.db.vCRevokeRequest.update({
            // Still update request status
            where: { id: request_id },
            data: { 
              status: RequestStatus.APPROVED,
              vc_id: vc_id // <-- SIMPAN VC_ID DI SINI
            },
          });
          throw new BadRequestError(
            `VC with ID ${vc_id} is already revoked on the blockchain.`
          );
        }
        logger.info(
          `VC ${vc_id} found and is currently active. Proceeding with blockchain revocation.`
        );
      } catch (error: any) {
        logger.error(`Pre-revocation check failed for VC ${vc_id}:`, error);
        if (error instanceof NotFoundError) {
          throw new NotFoundError(
            `VC with ID ${vc_id} not found on the blockchain. Cannot approve revocation request ${request_id}.`
          );
        }
        if (error instanceof BadRequestError) {
          throw error;
        }
        throw new BadRequestError(
          `Failed to verify VC status before revocation: ${error.message}`
        );
      }
      // ------------------------------------

      // --- Blockchain Revocation Call ---
      let blockchainReceipt: any;
      try {
        blockchainReceipt = await VCBlockchainService.revokeVCInBlockchain(
          vc_id
        );
        logger.success(
          `VC ${vc_id} revoked successfully on blockchain. TX: ${blockchainReceipt?.hash}`
        );
      } catch (blockchainError: any) {
        logger.error(
          `Blockchain revocation failed during approval for request ${request_id} (VC ${vc_id}):`,
          blockchainError
        );
        throw new BadRequestError(
          `Blockchain revocation failed: ${blockchainError.message}`
        );
      }
      // ---------------------------------

      // --- Update DB Status ---
      const updatedRequest = await this.db.vCRevokeRequest.update({
        where: { id: request_id },
        data: { 
          status: RequestStatus.APPROVED,
          vc_id: vc_id // <-- SIMPAN VC_ID DI SINI
        },
      });
      logger.info(
        `Revocation request ${request_id} status updated to APPROVED in DB.`
      );
      // ------------------------

      // Send push notification to holder
      try {
        await NotificationService.sendVCStatusNotification(
          holder_did,
          "Credential Revoked",
          "Your verifiable credential has been revoked and is no longer valid.",
          {
            type: "VC_REVOKED",
            request_id: request_id,
            request_type: RequestType.REVOKE,
            transaction_hash: blockchainReceipt?.hash,
          }
        );
        logger.success(`Push notification sent to holder: ${holder_did}`);
      } catch (notifError: any) {
        logger.error(
          `Failed to send push notification to ${holder_did}:`,
          notifError
        );
      }

      return {
        message:
          "Verifiable Credential revocation request approved and VC revoked on blockchain.",
        request_id: updatedRequest.id,
        status: updatedRequest.status,
        transaction_hash: blockchainReceipt?.hash,
        block_number: blockchainReceipt?.blockNumber,
      };
    } else {
      throw new BadRequestError(`Invalid action specified: ${action}.`);
    }
  }

  async processRenewalVC(
    data: ProcessRenewalVCDTO
  ): Promise<ProcessRenewalVCResponseDTO> {
    const { request_id, action, vc_id, encrypted_body, expired_at } = data;

    // 1. Find the original renewal request
    const renewalRequest = await this.db.vCRenewalRequest.findUnique({
      where: { id: request_id },
    });

    if (!renewalRequest) {
      throw new NotFoundError(
        `Renewal request with ID ${request_id} not found.`
      );
    }

    // 2. Get issuer_did and holder_did from database
    const issuer_did = renewalRequest.issuer_did;
    const holder_did = renewalRequest.holder_did;

    // 3. Check if already processed
    if (renewalRequest.status !== RequestStatus.PENDING) {
      throw new BadRequestError(
        `Renewal request ${request_id} has already been processed (Status: ${renewalRequest.status}).`
      );
    }

    // 4. Process based on action
    if (action === RequestStatus.REJECTED) {
      // Update DB status to REJECTED
      const updatedRequest = await this.db.vCRenewalRequest.update({
        where: { id: request_id },
        data: { status: RequestStatus.REJECTED },
      });

      logger.warn(`VC Renewal request rejected: ${request_id}`);

      // Send push notification to holder
      try {
        await NotificationService.sendVCStatusNotification(
          holder_did,
          "Renewal Request Declined",
          "Your credential renewal request has been declined by the issuer.",
          {
            type: "VC_RENEWAL_REJECTED",
            request_id: request_id,
            request_type: RequestType.RENEWAL,
          }
        );
        logger.success(`Push notification sent to holder: ${holder_did}`);
      } catch (notifError: any) {
        logger.error(
          `Failed to send push notification to ${holder_did}:`,
          notifError
        );
      }

      return {
        message: "Verifiable Credential renewal request rejected.",
        request_id: updatedRequest.id,
        status: updatedRequest.status,
      };
    } else if (action === RequestStatus.APPROVED) {
      // Ensure required fields for approval are present
      if (!vc_id || !encrypted_body) {
        throw new BadRequestError(
          "vc_id, encrypted_body, and expired_at are required when action is APPROVED."
        );
      }

      logger.info(
        `Processing approval for renewal request ${request_id} targeting VC ${vc_id}`
      );

      // --- Blockchain Call ---
      let blockchainReceipt: any;
      try {
        // Call the renew function on the blockchain
        blockchainReceipt = await VCBlockchainService.renewVCInBlockchain(
          vc_id,
          expired_at
        );
        logger.success(
          `VC ${vc_id} renewed successfully on blockchain. TX: ${blockchainReceipt?.hash}`
        );
      } catch (blockchainError: any) {
        logger.error(
          `Blockchain renewal failed during approval for request ${request_id} (VC ${vc_id}):`,
          blockchainError
        );
        // Handle specific errors like NotFoundError if the service throws them
        if (blockchainError instanceof NotFoundError) {
          throw new NotFoundError(
            `VC with ID ${vc_id} not found on the blockchain. Cannot process renewal request ${request_id}.`
          );
        }
        throw new BadRequestError(
          `Blockchain renewal failed: ${blockchainError.message}`
        );
      }
      // -------------------------

      // --- Database Updates ---
      // Use a transaction for atomicity
      const result = await this.db.$transaction(async (tx) => {
        // Update renewal request status
        const updatedRequest = await tx.vCRenewalRequest.update({
          where: { id: request_id },
          data: { 
            status: RequestStatus.APPROVED,
            vc_id: vc_id // <-- SIMPAN VC_ID DI SINI
          },
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

        logger.info(
          `Renewal request ${request_id} status updated to APPROVED. New VCResponse created: ${newVCResponse.id}`
        );
        return { updatedRequest, newVCResponse };
      });
      // ------------------------

      // Send push notification to holder
      try {
        await NotificationService.sendVCStatusNotification(
          holder_did,
          "Credential Renewed Successfully",
          "Your verifiable credential has been renewed and is ready for continued use.",
          {
            type: "VC_RENEWED",
            vc_response_id: result.newVCResponse.id,
            request_id: request_id,
            request_type: RequestType.RENEWAL,
            transaction_hash: blockchainReceipt?.hash,
          }
        );
        logger.success(`Push notification sent to holder: ${holder_did}`);
      } catch (notifError: any) {
        logger.error(
          `Failed to send push notification to ${holder_did}:`,
          notifError
        );
      }

      return {
        message:
          "Verifiable Credential renewal request approved and VC renewed on blockchain.",
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

  async processUpdateVC(
    data: ProcessUpdateVCDTO
  ): Promise<ProcessUpdateVCResponseDTO> {
    const {
      request_id,
      action,
      vc_id,
      new_vc_id,
      vc_type,
      schema_id,
      schema_version,
      new_vc_hash,
      encrypted_body,
      expired_at,
    } = data;

    // 1. Find the original update request
    const updateRequest = await this.db.vCUpdateRequest.findUnique({
      where: { id: request_id },
    });

    if (!updateRequest) {
      throw new NotFoundError(
        `Update request with ID ${request_id} not found.`
      );
    }

    // 2. Get issuer_did and holder_did from database
    const issuer_did = updateRequest.issuer_did;
    const holder_did = updateRequest.holder_did;

    // 3. Check if already processed
    if (updateRequest.status !== RequestStatus.PENDING) {
      throw new BadRequestError(
        `Update request ${request_id} has already been processed (Status: ${updateRequest.status}).`
      );
    }

    // 4. Process based on action
    if (action === RequestStatus.REJECTED) {
      // Update DB status to REJECTED
      const updatedRequest = await this.db.vCUpdateRequest.update({
        where: { id: request_id },
        data: { status: RequestStatus.REJECTED },
      });

      logger.warn(`VC Update request rejected: ${request_id}`);

      // Send push notification to holder
      try {
        await NotificationService.sendVCStatusNotification(
          holder_did,
          "Update Request Declined",
          "Your credential update request has been declined by the issuer.",
          {
            type: "VC_UPDATE_REJECTED",
            request_id: request_id,
            request_type: RequestType.UPDATE,
          }
        );
        logger.success(`Push notification sent to holder: ${holder_did}`);
      } catch (notifError: any) {
        logger.error(
          `Failed to send push notification to ${holder_did}:`,
          notifError
        );
      }

      return {
        message: "Verifiable Credential update request rejected.",
        request_id: updatedRequest.id,
        status: updatedRequest.status,
      };
    } else if (action === RequestStatus.APPROVED) {
      // Ensure required fields for approval are present
      if (
        !vc_id ||
        !new_vc_id ||
        !vc_type ||
        !schema_id ||
        !schema_version ||
        !new_vc_hash ||
        !encrypted_body
      ) {
        throw new BadRequestError(
          "vc_id, new_vc_id, vc_type, schema_id, schema_version, new_vc_hash, encrypted_body, and expired_at are required when action is APPROVED."
        );
      }

      logger.info(
        `Processing approval for update request ${request_id} targeting VC ${vc_id}`
      );

      // --- Pre-Update Blockchain Check ---
      try {
        const currentVcStatus =
          await VCBlockchainService.getVCStatusFromBlockchain(vc_id);
        if (currentVcStatus && currentVcStatus.status === false) {
          logger.warn(
            `Attempted to approve update for an inactive/revoked VC: ${vc_id}`
          );
          // Decide if you should allow updating a revoked VC. Usually not.
          throw new BadRequestError(
            `Cannot approve update for VC ${vc_id} because it is currently inactive/revoked on the blockchain.`
          );
        }
        logger.info(
          `VC ${vc_id} found and is active. Proceeding with blockchain update.`
        );
      } catch (error: any) {
        logger.error(`Pre-update check failed for VC ${vc_id}:`, error);
        if (error instanceof NotFoundError) {
          throw new NotFoundError(
            `Original VC with ID ${vc_id} not found on the blockchain. Cannot approve update request ${request_id}.`
          );
        }
        if (error instanceof BadRequestError) {
          throw error;
        } // Rethrow specific errors
        throw new BadRequestError(
          `Failed to verify VC status before update: ${error.message}`
        );
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
        logger.success(
          `VC ${vc_id} updated successfully on blockchain with new hash. TX: ${blockchainReceipt?.hash}`
        );
      } catch (blockchainError: any) {
        logger.error(
          `Blockchain update failed during approval for request ${request_id} (VC ${vc_id}):`,
          blockchainError
        );
        throw new BadRequestError(
          `Blockchain update failed: ${blockchainError.message}`
        );
      }
      // -----------------------------

      // --- Database Updates ---
      const result = await this.db.$transaction(async (tx) => {
        // Update update request status
        const updatedRequest = await tx.vCUpdateRequest.update({
          where: { id: request_id },
          data: { 
            status: RequestStatus.APPROVED,
            vc_id: new_vc_id // <-- SIMPAN NEW_VC_ID DI SINI
          },
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

        logger.info(
          `Update request ${request_id} status updated to APPROVED. New VCResponse created: ${newVCResponse.id}`
        );
        return { updatedRequest, newVCResponse };
      });
      // ------------------------

      // Send push notification to holder
      try {
        await NotificationService.sendVCStatusNotification(
          holder_did,
          "Credential Updated Successfully",
          "Your verifiable credential has been updated with the latest information.",
          {
            type: "VC_UPDATED",
            vc_response_id: result.newVCResponse.id,
            request_id: request_id,
            request_type: RequestType.UPDATE,
            transaction_hash: blockchainReceipt?.hash,
          }
        );
        logger.success(`Push notification sent to holder: ${holder_did}`);
      } catch (notifError: any) {
        logger.error(
          `Failed to send push notification to ${holder_did}:`,
          notifError
        );
      }

      return {
        message:
          "Verifiable Credential update request approved and VC updated on blockchain.",
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
    logger.success(
      `VC claimed successfully: ${vcResponse.id} for holder DID: ${holderDid}`
    );

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
      logger.warn(
        `VC confirmation failed: VC ${vcId} not found or not in PROCESSING state for holder ${holderDid}`
      );
      throw new NotFoundError(
        `VC with ID ${vcId} not found or not in PROCESSING state.`
      );
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
    logger.info(
      `Attempting to claim batch of VCs (limit: ${limit}) for holder DID: ${holderDid}`
    );

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

    logger.success(
      `Batch claimed ${result.length} VCs for holder DID: ${holderDid} (includes re-claims)`
    );

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
  async confirmVCsBatch(requestIds: string[], holderDid: string) {
    logger.info(
      `Confirming batch of ${requestIds.length} VCs for holder DID: ${holderDid}`
    );

    // Update multiple VCs to CLAIMED status and set deletedAt
    const updatedVCs = await this.db.vCResponse.updateMany({
      where: {
        request_id: { in: requestIds },
        holder_did: holderDid,
        status: "PROCESSING", // Only confirm if currently in PROCESSING state
      },
      data: {
        status: "CLAIMED",
        deletedAt: new Date(),
      },
    });

    if (updatedVCs.count === 0) {
      logger.warn(
        `Batch VC confirmation failed: No VCs found in PROCESSING state for holder ${holderDid}`
      );
      throw new NotFoundError(
        `No VCs found in PROCESSING state for confirmation.`
      );
    }

    if (updatedVCs.count < requestIds.length) {
      logger.warn(
        `Partial batch confirmation: ${updatedVCs.count}/${requestIds.length} VCs confirmed for holder ${holderDid}`
      );
    }

    logger.success(`Batch confirmed and soft-deleted ${updatedVCs.count} VCs`);

    return {
      message: `Successfully confirmed ${updatedVCs.count} VCs.`,
      confirmed_count: updatedVCs.count,
      requested_count: requestIds.length,
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
    logger.info(
      `Running cleanup job: resetting VCs stuck in PROCESSING for >${timeoutMinutes} minutes from all sources`
    );

    const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    // [NEW] Create a promise for the VCResponse table
    const resetVCResponsePromise = this.db.$queryRaw<any[]>`
      UPDATE "VCResponse"
      SET status = 'PENDING'::"VCResponseStatus",
          processing_at = NULL,
          "updatedAt" = NOW()
      WHERE status = 'PROCESSING'::"VCResponseStatus"
        AND processing_at < ${cutoffTime}
        AND "deletedAt" IS NULL
      RETURNING id, holder_did, processing_at;
    `;

    // [NEW] Create a promise for the VCinitiatedByIssuer table
    const resetVCinitiatedPromise = this.db.$queryRaw<any[]>`
      UPDATE "VCinitiatedByIssuer"
      SET status = 'PENDING'::"VCResponseStatus",
          processing_at = NULL,
          "updatedAt" = NOW()
      WHERE status = 'PROCESSING'::"VCResponseStatus"
        AND processing_at < ${cutoffTime}
        AND "deletedAt" IS NULL
      RETURNING id, holder_did, processing_at;
    `;

    // [NEW] Execute both cleanup queries in parallel
    const [resultVCResponse, resultVCinitiated] = await Promise.all([
      resetVCResponsePromise,
      resetVCinitiatedPromise,
    ]);

    const resetCountVCResponse = resultVCResponse?.length || 0;
    const resetCountVCinitiated = resultVCinitiated?.length || 0;
    const totalResetCount = resetCountVCResponse + resetCountVCinitiated;

    // [NEW] Updated logging for combined results
    if (totalResetCount > 0) {
      logger.warn(
        `[Scheduler] Cleanup job reset ${totalResetCount} total stuck PROCESSING VCs back to PENDING`
      );

      // Log details for VCResponse
      if (resetCountVCResponse > 0) {
        logger.debug(
          `  - Reset ${resetCountVCResponse} VCs from VCResponse (holder-initiated)`
        );
        resultVCResponse.forEach((vc: any) => {
          logger.debug(
            `    - Reset VCResponse ${vc.id} for holder ${vc.holder_did}, stuck since ${vc.processing_at}`
          );
        });
      }

      // Log details for VCinitiatedByIssuer
      if (resetCountVCinitiated > 0) {
        logger.debug(
          `  - Reset ${resetCountVCinitiated} VCs from VCinitiatedByIssuer (issuer-initiated)`
        );
        resultVCinitiated.forEach((vc: any) => {
          logger.debug(
            `    - Reset VCinitiated ${vc.id} for holder ${vc.holder_did}, stuck since ${vc.processing_at}`
          );
        });
      }
    } else {
      logger.info(
        `[Scheduler] Cleanup job completed: no stuck PROCESSING VCs found in either table`
      );
    }

    // [NEW] Return a more detailed object with the breakdown
    return {
      total_reset_count: totalResetCount,
      vc_response_reset_count: resetCountVCResponse,
      vc_initiated_reset_count: resetCountVCinitiated,
      timeout_minutes: timeoutMinutes,
      cutoff_time: cutoffTime,
    };
  }

  async getAllIssuerRequests(
    issuerDid: string,
    status?: RequestStatus | 'ALL'
  ): Promise<AllIssuerRequestsResponseDTO> {
    
    logger.info(`Fetching all requests for issuer: ${issuerDid}, status: ${status || 'ALL'}`);

    // 1. Definisikan klausa 'where' untuk tabel Request
    const whereClauseRequests: { issuer_did: string; status?: RequestStatus } = {
      issuer_did: issuerDid,
    };

    if (status && status !== 'ALL') {
      whereClauseRequests.status = status;
    }

    const selectFieldsRequests = {
      id: true,
      issuer_did: true,
      holder_did: true,
      status: true,
      encrypted_body: true,
      vc_id: true,
      createdAt: true,
    };
    
    // 2. Definisikan klausa 'where' untuk tabel Log
    const whereClauseLogs: { issuer_did: string } = {
      issuer_did: issuerDid,
    };
    
    const selectFieldsLogs = {
      id: true,
      action_type: true,
      issuer_did: true,
      holder_did: true,
      vc_id: true,
      new_vc_id: true,
      transaction_hash: true,
      createdAt: true,
    };

    // 3. Ambil data dari 5 tabel secara paralel
    const [
      issuanceRequests,
      renewalRequests,
      updateRequests,
      revokeRequests,
      issuerLogs
    ] = await Promise.all([
      this.db.vCIssuanceRequest.findMany({ where: whereClauseRequests, select: selectFieldsRequests }),
      this.db.vCRenewalRequest.findMany({ where: whereClauseRequests, select: selectFieldsRequests }),
      this.db.vCUpdateRequest.findMany({ where: whereClauseRequests, select: selectFieldsRequests }),
      this.db.vCRevokeRequest.findMany({ where: whereClauseRequests, select: selectFieldsRequests }),
      
      (status === 'ALL' || !status)
        ? this.db.issuerActionLog.findMany({ where: whereClauseLogs, select: selectFieldsLogs, orderBy: { createdAt: "desc" } })
        : Promise.resolve([]) 
    ]);

    // 4. Petakan (map) hasil query Request ke DTO
    //    --- PERUBAHAN UTAMA ADA DI SINI: "as 'REQUEST'" ---
    const mappedRequests: AggregatedRequestDTO[] = [
      ...issuanceRequests.map(req => ({ 
        ...req, 
        request_type: RequestType.ISSUANCE, 
        history_type: 'REQUEST' as 'REQUEST', // <-- PERBAIKAN
        new_vc_id: null,
        transaction_hash: null,
        holder_did: req.holder_did 
      })),
      ...renewalRequests.map(req => ({ 
        ...req, 
        request_type: RequestType.RENEWAL, 
        history_type: 'REQUEST' as 'REQUEST', // <-- PERBAIKAN
        new_vc_id: null,
        transaction_hash: null,
        holder_did: req.holder_did
      })),
      ...updateRequests.map(req => ({ 
        ...req, 
        request_type: RequestType.UPDATE, 
        history_type: 'REQUEST' as 'REQUEST', // <-- PERBAIKAN
        new_vc_id: req.vc_id, 
        transaction_hash: null,
        holder_did: req.holder_did
      })),
      ...revokeRequests.map(req => ({ 
        ...req, 
        request_type: RequestType.REVOKE, 
        history_type: 'REQUEST' as 'REQUEST', // <-- PERBAIKAN
        new_vc_id: null,
        transaction_hash: null,
        holder_did: req.holder_did
      })),
    ];

    // 5. Petakan (map) hasil query Log ke DTO
    //    --- "as 'DIRECT_ACTION'" ---
    const mappedLogs: AggregatedRequestDTO[] = issuerLogs.map(log => ({
      id: log.id,
      request_type: log.action_type,
      issuer_did: log.issuer_did,
      holder_did: log.holder_did,
      status: null, 
      encrypted_body: null, 
      vc_id: log.vc_id,
      new_vc_id: log.new_vc_id,
      transaction_hash: log.transaction_hash,
      createdAt: log.createdAt,
      history_type: 'DIRECT_ACTION' as 'DIRECT_ACTION', // <-- PERBAIKAN
    }));

    // 6. Gabungkan dan urutkan
    const allHistory = [...mappedRequests, ...mappedLogs];
    allHistory.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    logger.success(`Found ${allHistory.length} total history items for issuer: ${issuerDid}`);

    return {
      count: allHistory.length,
      requests: allHistory,
    };
  }

  async issuerIssueVC(
    data: IssuerIssueVCDTO,
    authenticatedDid: string // DID dari token JWT
  ): Promise<IssuerIssueVCResponseDTO> {
    // Validasi Keamanan: Pastikan DID yang diautentikasi adalah issuer yang sebenarnya
    if (data.issuer_did !== authenticatedDid) {
      logger.warn(
        `Auth mismatch: Token DID (${authenticatedDid}) != Issuer DID (${data.issuer_did})`
      );
      // --- MENGGUNAKAN ForbiddenError YANG DIIMPOR ---
      throw new ForbiddenError(
        "Authenticated DID does not match the issuer_did in the request body."
      );
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
      expiredAt,
    } = data;

    logger.info(
      `Attempting direct issue by issuer ${issuer_did} for VC ${vc_id}`
    );

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
      logger.info(
        `Blockchain issue successful for ${vc_id}. TX: ${blockchainReceipt?.hash}`
      );
    } catch (blockchainError: any) {
      logger.error(
        `Blockchain direct issue failed for ${vc_id}:`,
        blockchainError
      );
      throw new BadRequestError(
        `Blockchain issuance failed: ${blockchainError.message}`
      );
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
      await this.db.issuerActionLog.create({
        data: {
          action_type: RequestType.ISSUANCE,
          issuer_did: issuer_did,
          holder_did: holder_did,
          vc_id: vc_id, // Log VC ID yang baru
          transaction_hash: blockchainReceipt.hash,
        }
      });

      logger.success(
        `New VC record created in VCinitiatedByIssuer: ${newRecord.id}`
      );

      // (Opsional) Kirim notifikasi push ke holder
      try {
        await NotificationService.sendVCStatusNotification(
          holder_did,
          "New Credential Issued",
          "A new verifiable credential has been issued to you and is ready to be claimed.",
          {
            type: "VC_ISSUED_BY_ISSUER",
            record_id: newRecord.id,
            request_type: RequestType.ISSUANCE,
          }
        );
        logger.success(
          `Push notification sent to holder (direct issue): ${holder_did}`
        );
      } catch (notifError: any) {
        logger.error(
          `Failed to send push notification (direct issue) to ${holder_did}:`,
          notifError
        );
      }

      return {
        message:
          "VC issued directly to blockchain and stored for holder claim.",
        record_id: newRecord.id,
        transaction_hash: blockchainReceipt.hash,
        block_number: blockchainReceipt.blockNumber,
      };
    } catch (dbError: any) {
      logger.error(
        `Database storage failed for VCinitiatedByIssuer (VC ${vc_id}) after successful TX ${blockchainReceipt?.hash}:`,
        dbError
      );
      // Ini adalah error kritis. Blockchain berhasil tapi DB gagal.
      // --- MENGGUNAKAN InternalServerError YANG DIIMPOR ---
      throw new InternalServerError(
        `Blockchain succeeded (TX: ${blockchainReceipt.hash}), but database save failed. Please contact support. Error: ${dbError.message}`
      );
    }
  }

  async issuerUpdateVC(
    data: IssuerUpdateVCDTO,
    authenticatedDid: string
  ): Promise<IssuerUpdateVCResponseDTO> {
    // 1. Validasi Keamanan
    if (data.issuer_did !== authenticatedDid) {
      logger.warn(
        `Auth mismatch: Token DID (${authenticatedDid}) != Issuer DID (${data.issuer_did})`
      );
      throw new ForbiddenError(
        "Authenticated DID does not match the issuer_did in the request body."
      );
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
      expiredAt,
    } = data;

    logger.info(
      `Attempting direct update by issuer ${issuer_did} for old VC ${old_vc_id} -> new VC ${new_vc_id}`
    );

    // 2. Pre-Check: Pastikan VC lama ada dan aktif
    try {
      const currentVcStatus =
        await VCBlockchainService.getVCStatusFromBlockchain(old_vc_id);
      if (currentVcStatus && currentVcStatus.status === false) {
        logger.warn(`Attempted to update an inactive/revoked VC: ${old_vc_id}`);
        throw new BadRequestError(
          `Cannot update VC ${old_vc_id} because it is currently inactive/revoked on the blockchain.`
        );
      }
      logger.info(
        `VC ${old_vc_id} found and is active. Proceeding with blockchain update.`
      );
    } catch (error: any) {
      logger.error(`Pre-update check failed for VC ${old_vc_id}:`, error);
      if (error instanceof NotFoundError) {
        throw new NotFoundError(
          `Original VC with ID ${old_vc_id} not found on the blockchain. Cannot process update.`
        );
      }
      if (error instanceof BadRequestError) {
        throw error;
      }
      throw new BadRequestError(
        `Failed to verify VC status before update: ${error.message}`
      );
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
      logger.info(
        `Blockchain update successful for ${new_vc_id}. TX: ${blockchainReceipt?.hash}`
      );
    } catch (blockchainError: any) {
      logger.error(
        `Blockchain direct update failed for ${old_vc_id} -> ${new_vc_id}:`,
        blockchainError
      );
      throw new BadRequestError(
        `Blockchain update failed: ${blockchainError.message}`
      );
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

      await this.db.issuerActionLog.create({
        data: {
          action_type: RequestType.UPDATE,
          issuer_did: issuer_did,
          holder_did: holder_did,
          vc_id: old_vc_id,     // Log VC ID lama
          new_vc_id: new_vc_id, // Log VC ID baru
          transaction_hash: blockchainReceipt.hash,
        }
      });

      logger.success(
        `New VC record (from update) created in VCinitiatedByIssuer: ${newRecord.id}`
      );

      // (Opsional) Kirim notifikasi push ke holder
      try {
        await NotificationService.sendVCStatusNotification(
          holder_did,
          "Credential Updated",
          "Your verifiable credential has been updated by the issuer and is ready to be claimed.",
          {
            type: "VC_UPDATED_BY_ISSUER",
            record_id: newRecord.id,
            request_type: RequestType.UPDATE,
          }
        );
        logger.success(
          `Push notification sent to holder (direct update): ${holder_did}`
        );
      } catch (notifError: any) {
        logger.error(
          `Failed to send push notification (direct update) to ${holder_did}:`,
          notifError
        );
      }

      return {
        message:
          "VC updated directly on blockchain and new VC stored for holder claim.",
        record_id: newRecord.id,
        transaction_hash: blockchainReceipt.hash,
        block_number: blockchainReceipt.blockNumber,
      };
    } catch (dbError: any) {
      logger.error(
        `Database storage failed for VCinitiatedByIssuer (VC ${new_vc_id}) after successful TX ${blockchainReceipt?.hash}:`,
        dbError
      );
      throw new InternalServerError(
        `Blockchain update succeeded (TX: ${blockchainReceipt.hash}), but database save failed. Please contact support. Error: ${dbError.message}`
      );
    }
  }

  async issuerRevokeVC(
    data: IssuerRevokeVCDTO,
    authenticatedDid: string
  ): Promise<IssuerRevokeVCResponseDTO> {
    // 1. Validasi Keamanan
    if (data.issuer_did !== authenticatedDid) {
      logger.warn(
        `Auth mismatch: Token DID (${authenticatedDid}) != Issuer DID (${data.issuer_did})`
      );
      throw new ForbiddenError(
        "Authenticated DID does not match the issuer_did in the request body."
      );
    }
    const { issuer_did, vc_id } = data;

    logger.info(
      `Attempting direct revoke by issuer ${issuer_did} for VC ${vc_id}`
    );

    // 2. Pre-Check: Pastikan VC ada dan aktif
    let holder_did: string | undefined;
    try {
      const currentVcStatus =
        await VCBlockchainService.getVCStatusFromBlockchain(vc_id);

      // Simpan holder_did untuk notifikasi
      holder_did = currentVcStatus.holderDID;

      // Periksa apakah issuer-nya cocok
      if (currentVcStatus.issuerDID !== issuer_did) {
        logger.warn(
          `Revoke attempt failed: VC ${vc_id} was not issued by ${issuer_did}.`
        );
        throw new ForbiddenError(
          `Authenticated issuer (${issuer_did}) did not issue this VC.`
        );
      }

      if (currentVcStatus && currentVcStatus.status === false) {
        logger.warn(`Attempted to revoke an already revoked VC: ${vc_id}`);
        throw new BadRequestError(
          `VC with ID ${vc_id} is already revoked on the blockchain.`
        );
      }
      logger.info(
        `VC ${vc_id} found, is active, and matches issuer. Proceeding with blockchain revocation.`
      );
    } catch (error: any) {
      logger.error(`Pre-revocation check failed for VC ${vc_id}:`, error);
      if (error instanceof NotFoundError) {
        throw new NotFoundError(
          `VC with ID ${vc_id} not found on the blockchain.`
        );
      }
      if (error instanceof BadRequestError || error instanceof ForbiddenError) {
        throw error; // Lemparkan kembali error yang sudah spesifik
      }
      throw new BadRequestError(
        `Failed to verify VC status before revocation: ${error.message}`
      );
    }

    // 3. Panggil Blockchain (RevokeVC)
    let blockchainReceipt: any;
    try {
      blockchainReceipt = await VCBlockchainService.revokeVCInBlockchain(vc_id);
      logger.success(
        `VC ${vc_id} revoked successfully on blockchain. TX: ${blockchainReceipt?.hash}`
      );
    } catch (blockchainError: any) {
      logger.error(
        `Blockchain direct revoke failed for ${vc_id}:`,
        blockchainError
      );
      throw new BadRequestError(
        `Blockchain revocation failed: ${blockchainError.message}`
      );
    }

    // 4. Kirim notifikasi push ke holder
    if (holder_did) {
      try {
        await NotificationService.sendVCStatusNotification(
          holder_did,
          "Credential Revoked",
          "Your verifiable credential has been revoked by the issuer and is no longer valid.",
          {
            type: "VC_REVOKED_BY_ISSUER",
            vc_id: vc_id,
            request_type: RequestType.REVOKE,
            transaction_hash: blockchainReceipt?.hash,
          }
        );
        logger.success(
          `Push notification sent to holder (direct revoke): ${holder_did}`
        );
      } catch (notifError: any) {
        logger.error(
          `Failed to send push notification (direct revoke) to ${holder_did}:`,
          notifError
        );
      }
      try {
      await this.db.issuerActionLog.create({
        data: {
          action_type: RequestType.REVOKE,
          issuer_did: issuer_did,
          holder_did: holder_did, // Gunakan holder_did yang didapat dari pre-check
          vc_id: vc_id,
          transaction_hash: blockchainReceipt.hash,
        }
      });
      logger.success(`Issuer action REVOKE logged for VC: ${vc_id}`);
    } catch (logError: any) {
      // Jangan gagalkan seluruh proses jika logging error
      logger.error(`Failed to log issuer action for REVOKE VC ${vc_id}:`, logError);
    }
    // --- AKHIR LOGGING AUDIT ---

    // 5. Kirim respons
    return {
      message: "VC revoked directly on blockchain.",
      vc_id: vc_id,
      transaction_hash: blockchainReceipt.hash,
      block_number: blockchainReceipt.blockNumber,
    };
    }

    // 5. Kirim respons
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
      logger.warn(
        `Auth mismatch: Token DID (${authenticatedDid}) != Issuer DID (${data.issuer_did})`
      );
      throw new ForbiddenError(
        "Authenticated DID does not match the issuer_did in the request body."
      );
    }

    // Destrukturisasi data, termasuk expiredAt
    const { issuer_did, holder_did, vc_id, encrypted_body, expiredAt } = data; // <-- TAMBAHKAN expiredAt

    logger.info(
      `Attempting direct renew by issuer ${issuer_did} for VC ${vc_id}`
    );

    // 2. Pre-Check: Pastikan VC ada dan milik issuer
    try {
      // ... (Logika pre-check tetap sama) ...
      const currentVcStatus =
        await VCBlockchainService.getVCStatusFromBlockchain(vc_id);
      if (currentVcStatus.issuerDID !== issuer_did) {
        throw new ForbiddenError(
          `Authenticated issuer (${issuer_did}) did not issue this VC.`
        );
      }
      logger.info(
        `VC ${vc_id} found and matches issuer. Proceeding with blockchain renewal.`
      );
    } catch (error: any) {
      // ... (Error handling pre-check tetap sama) ...
      if (error instanceof NotFoundError) {
        throw new NotFoundError(
          `VC with ID ${vc_id} not found on the blockchain.`
        );
      }
      if (error instanceof ForbiddenError) {
        throw error;
      }
      throw new BadRequestError(
        `Failed to verify VC status before renewal: ${error.message}`
      );
    }

    // 3. Panggil Blockchain (RenewVC)
    let blockchainReceipt: any;
    try {
      // --- PERBAIKAN: Teruskan expiredAt ke fungsi blockchain ---
      blockchainReceipt = await VCBlockchainService.renewVCInBlockchain(
        vc_id,
        expiredAt
      );
      logger.success(
        `VC ${vc_id} renewed successfully on blockchain. TX: ${blockchainReceipt?.hash}`
      );
    } catch (blockchainError: any) {
      logger.error(
        `Blockchain direct renew failed for ${vc_id}:`,
        blockchainError
      );
      throw new BadRequestError(
        `Blockchain renewal failed: ${blockchainError.message}`
      );
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
      await this.db.issuerActionLog.create({
        data: {
          action_type: RequestType.RENEWAL,
          issuer_did: issuer_did,
          holder_did: holder_did,
          vc_id: vc_id, // Log VC ID yang diperbarui
          transaction_hash: blockchainReceipt.hash,
        }
      });

      logger.success(
        `New VC record (from renew) created in VCinitiatedByIssuer: ${newRecord.id}`
      );

      // (Opsional) Kirim notifikasi push ke holder
      try {
        await NotificationService.sendVCStatusNotification(
          holder_did,
          "Credential Renewed",
          "Your verifiable credential has been renewed by the issuer and is ready to be claimed.",
          {
            type: "VC_RENEWED_BY_ISSUER",
            record_id: newRecord.id,
            request_type: RequestType.RENEWAL,
          }
        );
        logger.success(
          `Push notification sent to holder (direct renew): ${holder_did}`
        );
      } catch (notifError: any) {
        logger.error(
          `Failed to send push notification (direct renew) to ${holder_did}:`,
          notifError
        );
      }

      return {
        message:
          "VC renewed directly on blockchain and new VC stored for holder claim.",
        record_id: newRecord.id,
        transaction_hash: blockchainReceipt.hash,
        block_number: blockchainReceipt.blockNumber,
      };
    } catch (dbError: any) {
      // ... (Error handling DB tetap sama) ...
      throw new InternalServerError(
        `Blockchain renew succeeded (TX: ${blockchainReceipt.hash}), but database save failed. Please contact support. Error: ${dbError.message}`
      );
    }
  }

  async claimIssuerInitiatedVCsBatch(
    holderDid: string,
    limit: number = 10
  ): Promise<ClaimIssuerInitiatedVCsResponseDTO> {
    logger.info(
      `Attempting to claim batch of ISSUER-INITIATED VCs (limit: ${limit}) for holder DID: ${holderDid}`
    );

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
      logger.info(
        `No claimable ISSUER-INITIATED VCs found for holder DID: ${holderDid}`
      );
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

    logger.success(
      `Batch claimed ${result.length} ISSUER-INITIATED VCs for holder DID: ${holderDid}`
    );

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
    logger.info(
      `Confirming batch of ${vcIds.length} ISSUER-INITIATED VCs for holder DID: ${holderDid}`
    );

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
      logger.warn(
        `Batch VC confirmation failed (ISSUER-INITIATED): No VCs found in PROCESSING state for holder ${holderDid}`
      );
      throw new NotFoundError(
        `No VCs (issuer-initiated) found in PROCESSING state for confirmation.`
      );
    }

    if (updatedVCs.count < vcIds.length) {
      logger.warn(
        `Partial batch confirmation (ISSUER-INITIATED): ${updatedVCs.count}/${vcIds.length} VCs confirmed for holder ${holderDid}`
      );
    }

    logger.success(
      `Batch confirmed and soft-deleted ${updatedVCs.count} ISSUER-INITIATED VCs`
    );

    return {
      message: `Successfully confirmed ${updatedVCs.count} issuer-initiated VCs.`,
      confirmed_count: updatedVCs.count,
      requested_count: vcIds.length,
    };
  }

  /**
   * Validate VC JSON uploaded by institution
   * Validates DID ownership, expiration, and hash against blockchain
   */
  async validateVC(data: ValidateVCDTO): Promise<VCValidationResult> {
    const { vc_json, vc_hash, holder_did } = data;

    const errors: string[] = [];
    let did_valid = false;
    let expiration_valid = false;
    let hash_valid = false;
    let is_expired = false;
    let vcHolderDid = undefined;

    // Extract VC ID from the composite id field
    // Format: "uuid:version:did:timestamp" or similar
    const vcId = vc_json.id;
    const vcIssuerDid = vc_json.issuer;
    const expiredAt = vc_json.expiredAt;

    logger.info(`Validating VC: ${vcId} for holder: ${holder_did}`);

    // 3. Validate Hash - Query blockchain and compare
    try {
      // Use the full VC ID (composite format: uuid:version:did:timestamp)
      // No need to split - blockchain uses the full ID
      logger.info(`Querying blockchain for VC: ${vcId}`);

      const vcStatusOnChain =
        await VCBlockchainService.getVCStatusFromBlockchain(vcId);

      vcHolderDid = vcStatusOnChain.holderDID
        ? vcStatusOnChain.holderDID
        : undefined;

      // 1. Validate DID - Check if holder_did matches credentialSubject.id
      if (vcHolderDid === holder_did) {
        did_valid = true;
        logger.info(`✅ DID validation passed: ${holder_did}`);
      } else {
        did_valid = false;
        errors.push(
          `DID mismatch: VC belongs to ${vcHolderDid}, but you provided ${holder_did}`
        );
        logger.warn(
          `❌ DID validation failed: Expected ${holder_did}, got ${vcHolderDid}`
        );
      }

      // 2. Validate Expiration - Check if VC is not expired (skip if expiredAt is null)
      if (!expiredAt || expiredAt === null) {
        // No expiration date - VC has lifetime validity
        expiration_valid = true;
        logger.info(
          `✅ Expiration validation skipped: VC has lifetime validity (no expiration)`
        );
      } else {
        const now = new Date();
        const expirationDate = new Date(expiredAt);
        is_expired = now > expirationDate;

        if (!is_expired) {
          expiration_valid = true;
          logger.info(
            `✅ Expiration validation passed: VC valid until ${expiredAt}`
          );
        } else {
          expiration_valid = false;
          errors.push(`VC has expired on ${expiredAt}`);
          logger.warn(
            `❌ Expiration validation failed: VC expired on ${expiredAt}`
          );
        }
      }

      if (vcStatusOnChain) {
        const blockchainHash = vcStatusOnChain.hash;

        // Compare hashes (remove 0x prefix if present)
        const normalizedVcHash = vc_hash.toLowerCase().replace(/^0x/, "");
        const normalizedBlockchainHash = blockchainHash
          .toLowerCase()
          .replace(/^0x/, "");

        if (normalizedVcHash === normalizedBlockchainHash) {
          hash_valid = true;
          logger.info(`✅ Hash validation passed: ${normalizedVcHash}`);
        } else {
          hash_valid = false;
          errors.push(
            `Hash mismatch: Provided hash ${normalizedVcHash} does not match blockchain hash`
          );
          logger.warn(
            `❌ Hash validation failed: Expected ${normalizedBlockchainHash}, got ${normalizedVcHash}`
          );
        }
      } else {
        hash_valid = false;
        errors.push(`VC not found on blockchain`);
        logger.warn(`❌ VC ${vcId} not found on blockchain`);
      }
    } catch (error: any) {
      hash_valid = false;
      errors.push(`Blockchain query failed: ${error.message}`);
      logger.error(`❌ Blockchain query error:`, error);
    }

    // Overall validation result
    const is_valid = did_valid && expiration_valid && hash_valid;

    const result: VCValidationResult = {
      is_valid,
      did_valid,
      expiration_valid,
      hash_valid,
      errors,
      vc_id: vcId,
      holder_did: vcHolderDid,
      issuer_did: vcIssuerDid,
      expired_at: expiredAt,
      is_expired,
    };

    if (is_valid) {
      logger.success(`✅ VC validation successful: ${vcId}`);
    } else {
      logger.warn(
        `❌ VC validation failed: ${vcId}. Errors: ${errors.join(", ")}`
      );
    }

    return result;
  }

  async claimCombinedVCsBatch(
    holderDid: string,
    limit: number = 10
  ): Promise<CombinedClaimVCsResponseDTO> {
    logger.info(
      `Attempting to claim combined batch of VCs (limit: ${limit}) for holder DID: ${holderDid}`
    );

    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const combinedClaims: CombinedClaimVCDTO[] = [];

    // 1. Try claiming from VCResponse (holder-initiated) first
    const holderRequestVCs = await this.db.$queryRaw<any[]>`
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
      RETURNING request_id, encrypted_body, request_type, processing_at;
    `;

    // Map results
    for (const vc of holderRequestVCs) {
      combinedClaims.push({
        source: 'HOLDER_REQUEST',
        claimId: vc.request_id, // Use request_id for confirmation
        encrypted_body: vc.encrypted_body,
        request_type: vc.request_type,
        processing_at: vc.processing_at,
      });
    }

    logger.info(`Claimed ${combinedClaims.length} VCs from HOLDER_REQUEST source`);

    // 2. Try claiming from VCinitiatedByIssuer (issuer-initiated) if limit not reached
    const remainingLimit = safeLimit - combinedClaims.length;
    if (remainingLimit > 0) {
      const issuerInitiatedVCs = await this.db.$queryRaw<any[]>`
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
          LIMIT ${remainingLimit}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, encrypted_body, request_type, processing_at;
      `;

      // Map results
      for (const vc of issuerInitiatedVCs) {
        combinedClaims.push({
          source: 'ISSUER_INITIATED',
          claimId: vc.id, // Use id for confirmation
          encrypted_body: vc.encrypted_body,
          request_type: vc.request_type,
          processing_at: vc.processing_at,
        });
      }
      logger.info(`Claimed ${issuerInitiatedVCs.length} VCs from ISSUER_INITIATED source`);
    }

    // 3. Check for remaining VCs
    const remainingHolderVCs = await this.db.vCResponse.count({
      where: {
        holder_did: holderDid,
        deletedAt: null,
        OR: [
          { status: 'PENDING' },
          { status: 'PROCESSING', processing_at: { lt: new Date(Date.now() - 5 * 60 * 1000) } },
        ],
      },
    });

    const remainingIssuerVCs = await this.db.vCinitiatedByIssuer.count({
      where: {
        holder_did: holderDid,
        deletedAt: null,
        OR: [
          { status: 'PENDING' },
          { status: 'PROCESSING', processing_at: { lt: new Date(Date.now() - 5 * 60 * 1000) } },
        ],
      },
    });

    const totalRemaining = remainingHolderVCs + remainingIssuerVCs;

    logger.success(
      `Combined batch claimed ${combinedClaims.length} VCs for holder DID: ${holderDid}`
    );

    return {
      claimed_vcs: combinedClaims,
      claimed_count: combinedClaims.length,
      remaining_count: totalRemaining,
      has_more: totalRemaining > 0,
    };
  }

  /**
   * [NEW] Phase 2 Batch (Combined): Confirm VCs from both sources
   *
   * This method accepts an array of items, each specifying its source,
   * and updates the correct table (VCResponse or VCinitiatedByIssuer).
   */
  async confirmCombinedVCsBatch(
    items: CombinedClaimConfirmationItemDTO[],
    holderDid: string
  ): Promise<CombinedConfirmVCsResponseDTO> {
    logger.info(
      `Confirming combined batch of ${items.length} VCs for holder DID: ${holderDid}`
    );

    // 1. Separate IDs based on source
    const holderRequestIds = items
      .filter((item) => item.source === 'HOLDER_REQUEST')
      .map((item) => item.claimId);

    const issuerInitiatedIds = items
      .filter((item) => item.source === 'ISSUER_INITIATED')
      .map((item) => item.claimId);

    let confirmedHolderCount = 0;
    let confirmedIssuerCount = 0;

    // 2. Confirm VCs from VCResponse (using request_id)
    if (holderRequestIds.length > 0) {
      const updatedHolderVCs = await this.db.vCResponse.updateMany({
        where: {
          request_id: { in: holderRequestIds },
          holder_did: holderDid,
          status: 'PROCESSING',
        },
        data: {
          status: 'CLAIMED',
          deletedAt: new Date(),
        },
      });
      confirmedHolderCount = updatedHolderVCs.count;
      logger.info(`Confirmed ${confirmedHolderCount}/${holderRequestIds.length} VCs from HOLDER_REQUEST`);
    }

    // 3. Confirm VCs from VCinitiatedByIssuer (using id)
    if (issuerInitiatedIds.length > 0) {
      const updatedIssuerVCs = await this.db.vCinitiatedByIssuer.updateMany({
        where: {
          id: { in: issuerInitiatedIds },
          holder_did: holderDid,
          status: 'PROCESSING',
        },
        data: {
          status: 'CLAIMED',
          deletedAt: new Date(),
        },
      });
      confirmedIssuerCount = updatedIssuerVCs.count;
      logger.info(`Confirmed ${confirmedIssuerCount}/${issuerInitiatedIds.length} VCs from ISSUER_INITIATED`);
    }

    const totalConfirmed = confirmedHolderCount + confirmedIssuerCount;

    if (totalConfirmed === 0 && items.length > 0) {
      logger.warn(
        `Combined VC confirmation failed: No VCs found in PROCESSING state for holder ${holderDid}`
      );
      throw new NotFoundError(
        `No VCs found in PROCESSING state for confirmation.`
      );
    }

    logger.success(`Combined batch confirmed and soft-deleted ${totalConfirmed} VCs`);

    return {
      message: `Successfully confirmed ${totalConfirmed} VCs.`,
      confirmed_count: totalConfirmed,
      requested_count: items.length,
    };
  }
}

// Export singleton instance for backward compatibility
export default new CredentialService();

// Export class for testing and custom instantiation
export { CredentialService };
