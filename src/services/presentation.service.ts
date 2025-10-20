import { VPRequest, VPSharing, PrismaClient } from "@prisma/client";
import { prisma } from "../config/database";
import { NotFoundError } from "../utils/errors/AppError";
import logger from "../config/logger";

/**
 * Presentation Service with Dependency Injection
 * Handles Verifiable Presentation (VP) request and sharing operations
 */
class PresentationService {
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
   * Verifier requests a VP from holder
   */
  async requestVP(data: {
    holder_did: string;
    verifier_did: string;
    list_schema_id: string[];
  }): Promise<{ vp_request_id: string; message: string }> {
    const vpRequest = await this.db.vPRequest.create({
      data: {
        holder_did: data.holder_did,
        verifier_did: data.verifier_did,
        list_schema_id: data.list_schema_id,
      },
    });

    // TODO: Add Message Queue using RabbitMQ to notify holder
    logger.success(`VP request created: ${vpRequest.id}`);
    logger.info(`From: ${data.verifier_did}`);
    logger.info(`To: ${data.holder_did}`);

    return {
      vp_request_id: vpRequest.id,
      message: "VP request sent successfully. Awaiting Holder's response.",
    };
  }

  /**
   * Get VP request details
   */
  async getVPRequestDetails(vpReqId: string): Promise<{
    verifier_did: string;
    list_schema_id: string[];
  }> {
    const vpRequest = await this.db.vPRequest.findUnique({
      where: { id: vpReqId },
    });

    if (!vpRequest) {
      throw new NotFoundError("VP Request not found");
    }

    return {
      verifier_did: vpRequest.verifier_did,
      list_schema_id: vpRequest.list_schema_id,
    };
  }

  /**
   * Store VP for sharing
   */
  async storeVP(data: {
    holder_did: string;
    vp: any;
  }): Promise<{ vp_id: string; message: string }> {
    const sharedVp = await this.db.vPSharing.create({
      data: {
        holder_did: data.holder_did,
        VP: data.vp,
      },
    });

    logger.success(`VP stored: ${sharedVp.id}`);
    logger.info(`Holder: ${data.holder_did}`);

    return {
      vp_id: sharedVp.id,
      message: "VP stored successfully and is available for retrieval.",
    };
  }

  /**
   * Get and delete VP (one-time retrieval)
   */
  async getVP(vpId: string): Promise<{ vp: any }> {
    // Find VP in VPSharing
    const sharedVp = await this.db.vPSharing.findUnique({
      where: { id: vpId },
    });

    if (!sharedVp) {
      throw new NotFoundError(
        "VP not found. It may have expired or already been used."
      );
    }

    // Delete VP after retrieval (one-time use)
    await this.db.vPSharing.delete({
      where: { id: vpId },
    });

    logger.success(`VP retrieved and deleted: ${vpId}`);

    return {
      vp: sharedVp.VP,
    };
  }
}

// Export singleton instance for backward compatibility
export default new PresentationService();

// Export class for testing and custom instantiation
export { PresentationService };
