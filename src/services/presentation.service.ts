import { VPRequest, VPSharing } from "@prisma/client";
import { prisma } from "../config/database";
import { NotFoundError } from "../utils/errors/AppError";

/**
 * Presentation Service
 * Handles Verifiable Presentation (VP) request and sharing operations
 */
class PresentationService {
  /**
   * Verifier requests a VP from holder
   */
  async requestVP(data: {
    holder_did: string;
    verifier_did: string;
    list_schema_id: string[];
  }): Promise<{ vp_request_id: string; message: string }> {
    const vpRequest = await prisma.vPRequest.create({
      data: {
        holder_did: data.holder_did,
        verifier_did: data.verifier_did,
        list_schema_id: data.list_schema_id,
      },
    });

    // TODO: Add Message Queue using RabbitMQ to notify holder
    console.log(`✅ VP request created: ${vpRequest.id}`);
    console.log(`   From: ${data.verifier_did}`);
    console.log(`   To: ${data.holder_did}`);

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
    const vpRequest = await prisma.vPRequest.findUnique({
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
    const sharedVp = await prisma.vPSharing.create({
      data: {
        holder_did: data.holder_did,
        VP: data.vp,
      },
    });

    console.log(`✅ VP stored: ${sharedVp.id}`);
    console.log(`   Holder: ${data.holder_did}`);

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
    const sharedVp = await prisma.vPSharing.findUnique({
      where: { id: vpId },
    });

    if (!sharedVp) {
      throw new NotFoundError(
        "VP not found. It may have expired or already been used."
      );
    }

    // Delete VP after retrieval (one-time use)
    await prisma.vPSharing.delete({
      where: { id: vpId },
    });

    console.log(`✅ VP retrieved and deleted: ${vpId}`);

    return {
      vp: sharedVp.VP,
    };
  }
}

export default new PresentationService();
