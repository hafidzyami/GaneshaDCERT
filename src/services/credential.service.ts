import { PrismaClient, RequestType } from "@prisma/client";
import { prisma } from "../config/database";
import { BadRequestError } from "../utils/errors/AppError";

/**
 * Credential Service
 * Handles VC issuance, renewal, update, and revocation requests
 */
class CredentialService {
  /**
   * Request credential issuance
   */
  async requestCredentialIssuance(data: {
    encrypted_body: string;
    issuer_did: string;
    holder_did: string;
  }) {
    const newRequest = await prisma.vCIssuanceRequest.create({
      data: {
        encrypted_body: data.encrypted_body,
        issuer_did: data.issuer_did,
        holder_did: data.holder_did,
      },
    });

    console.log(`✅ VC Issuance request created: ${newRequest.id}`);

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
        requests = await prisma.vCIssuanceRequest.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
        });
        break;

      case RequestType.RENEWAL:
        requests = await prisma.vCRenewalRequest.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
        });
        break;

      case RequestType.UPDATE:
        requests = await prisma.vCUpdateRequest.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
        });
        break;

      case RequestType.REVOKE:
        requests = await prisma.vCRevokeRequest.findMany({
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
    const newVCResponse = await prisma.vCResponse.create({
      data: {
        request_id: data.request_id,
        request_type: data.request_type,
        issuer_did: data.issuer_did,
        holder_did: data.holder_did,
        encrypted_body: data.encrypted_body,
      },
    });

    console.log(`✅ VC Response created: ${newVCResponse.id}`);

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
    console.log(`📋 Fetching VCs for holder DID: ${holderDid}`);

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
    const newUpdateRequest = await prisma.vCUpdateRequest.create({
      data: {
        issuer_did: data.issuer_did,
        holder_did: data.holder_did,
        encrypted_body: data.encrypted_body,
        status: "PENDING",
      },
    });

    console.log(`✅ VC Update request created: ${newUpdateRequest.id}`);

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
    const newRenewalRequest = await prisma.vCRenewalRequest.create({
      data: {
        issuer_did: data.issuer_did,
        holder_did: data.holder_did,
        encrypted_body: data.encrypted_body,
        status: "PENDING",
      },
    });

    console.log(`✅ VC Renewal request created: ${newRenewalRequest.id}`);

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
    const newRevokeRequest = await prisma.vCRevokeRequest.create({
      data: {
        issuer_did: data.issuer_did,
        holder_did: data.holder_did,
        encrypted_body: data.encrypted_body,
        status: "PENDING",
      },
    });

    console.log(`✅ VC Revocation request created: ${newRevokeRequest.id}`);

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
    console.log(`📝 Submitting VC status block for: ${data.vc_id}`);

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
    console.log(`🔍 Checking VC status: ${vcId}`);

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
}

export default new CredentialService();
