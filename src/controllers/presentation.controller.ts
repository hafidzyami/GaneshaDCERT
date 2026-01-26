import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { PresentationService } from "../services";
import SelectiveDisclosureService from "../services/selectiveDisclosure.service";
import { ValidationError } from "../utils";
import { asyncHandler } from "../middlewares";
import { ResponseHelper } from "../utils/helpers";
import { RequestWithDID } from "../middlewares/didAuth.middleware";
import { prisma } from "../config/database";

/**
 * Request VP Controller (unified: full + selective)
 */
export const requestVP = asyncHandler(async (req: RequestWithDID, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { mode } = req.body;

  if (mode === "selective") {
    return createSelectiveRequest(req, res);
  }

  // Full mode
  const { holder_did, verifier_did, verifier_name, purpose, requested_credentials } = req.body;

  const result = await PresentationService.requestVP({
    holder_did,
    verifier_did,
    verifier_name,
    purpose,
    requested_credentials,
  });

  return ResponseHelper.created(res, {
    request_id: result.vp_request_id,
    mode: "full",
    message: result.message,
  }, "VP request created successfully");
});

/**
 * Internal: Create selective disclosure request
 */
async function createSelectiveRequest(req: RequestWithDID, res: Response) {
  const {
    holder_did,
    verifier_did,
    verifier_name,
    purpose,
    credential_types,
    domain,
    expires_in,
    requested_attributes,
    requested_predicates,
  } = req.body;

  const result = await SelectiveDisclosureService.createSelectiveDisclosureRequest({
    holderDID: holder_did,
    verifierDID: verifier_did,
    verifierName: verifier_name,
    credentialTypes: credential_types,
    purpose,
    domain,
    expiresIn: expires_in,
    requestedAttributes: (requested_attributes || []).map((attr: any) => ({
      attributePath: attr.attribute_path,
      attributeName: attr.attribute_name || attr.attribute_path,
      required: attr.required,
      acceptPredicate: attr.accept_predicate,
    })),
    requestedPredicates: (requested_predicates || []).map((pred: any) => ({
      attributePath: pred.attribute_path,
      attributeName: pred.attribute_name || pred.attribute_path,
      operator: pred.operator,
      value: pred.value,
      required: pred.required,
    })),
  });

  return ResponseHelper.created(res, {
    request_id: result.requestId,
    mode: "selective",
    challenge: result.challenge,
    domain: result.domain,
    expires_at: result.expiresAt,
    status: result.status,
  }, "VP request created successfully");
}

/**
 * Get VP Request Details Controller
 */
export const getVPRequestDetails = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { id } = req.params;

  // Try full mode first
  const vpRequest = await prisma.vPRequest.findUnique({ where: { id } });
  if (vpRequest) {
    return ResponseHelper.success(res, {
      request_id: vpRequest.id,
      mode: "full",
      holder_did: vpRequest.holder_did,
      verifier_did: vpRequest.verifier_did,
      verifier_name: vpRequest.verifier_name,
      purpose: vpRequest.purpose,
      status: vpRequest.status,
      verify_status: vpRequest.verify_status,
      requested_credentials: vpRequest.requested_credentials,
      vp_id: vpRequest.vp_id,
      created_at: vpRequest.createdAt,
      updated_at: vpRequest.updatedAt,
    }, "VP request details retrieved successfully");
  }

  // Try selective mode
  const sdRequest = await prisma.selectiveDisclosureRequest.findUnique({ where: { id } });
  if (sdRequest) {
    const requestedAttributes = sdRequest.requestedAttributes
      ? JSON.parse(sdRequest.requestedAttributes as string)
      : [];
    const requestedPredicates = sdRequest.requestedPredicates
      ? JSON.parse(sdRequest.requestedPredicates as string)
      : [];

    return ResponseHelper.success(res, {
      request_id: sdRequest.id,
      mode: "selective",
      holder_did: sdRequest.holderDID,
      verifier_did: sdRequest.verifierDID,
      verifier_name: sdRequest.verifierName,
      purpose: sdRequest.purpose,
      status: sdRequest.status,
      verify_status: sdRequest.verifyStatus || "NOT_VERIFIED",
      credential_types: sdRequest.credentialTypes,
      challenge: sdRequest.challenge,
      domain: sdRequest.domain,
      expires_at: sdRequest.expiresAt,
      requested_attributes: requestedAttributes.map((attr: any) => ({
        attribute_path: attr.attributePath,
        attribute_name: attr.attributeName || attr.attributePath,
        required: attr.required,
        accept_predicate: attr.acceptPredicate,
      })),
      requested_predicates: requestedPredicates.map((pred: any) => ({
        attribute_path: pred.attributePath,
        attribute_name: pred.attributeName || pred.attributePath,
        operator: pred.operator,
        value: pred.value,
        required: pred.required,
      })),
      created_at: sdRequest.createdAt,
      updated_at: sdRequest.updatedAt,
    }, "VP request details retrieved successfully");
  }

  return ResponseHelper.notFound(res, "VP request not found");
});

/**
 * Get VP Requests with Filtering Controller (unified)
 */
export const getVPRequests = asyncHandler(async (req: Request, res: Response) => {
  const { verifier_did, holder_did, status, mode } = req.query;

  if (!verifier_did && !holder_did) {
    throw new ValidationError("Either verifier_did or holder_did must be provided", []);
  }

  const results: any[] = [];

  // Fetch full mode requests (unless mode=selective)
  if (!mode || mode === "full") {
    const fullRequests = await PresentationService.getVPRequests({
      verifier_did: verifier_did as string,
      holder_did: holder_did as string,
      status: status as string,
    });

    for (const r of fullRequests) {
      results.push({
        request_id: r.id,
        mode: "full",
        holder_did: r.holder_did,
        verifier_did: r.verifier_did,
        verifier_name: r.verifier_name,
        purpose: r.purpose,
        status: r.status,
        verify_status: r.verify_status,
        requested_credentials: r.requested_credentials,
        vp_id: r.vp_id,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
      });
    }
  }

  // Fetch selective mode requests (unless mode=full)
  if (!mode || mode === "selective") {
    const where: any = {};
    if (verifier_did) where.verifierDID = verifier_did;
    if (holder_did) where.holderDID = holder_did;
    if (status) where.status = status;

    const sdRequests = await prisma.selectiveDisclosureRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    for (const r of sdRequests) {
      const requestedAttributes = r.requestedAttributes
        ? JSON.parse(r.requestedAttributes as string)
        : [];
      const requestedPredicates = r.requestedPredicates
        ? JSON.parse(r.requestedPredicates as string)
        : [];

      results.push({
        request_id: r.id,
        mode: "selective",
        holder_did: r.holderDID,
        verifier_did: r.verifierDID,
        verifier_name: r.verifierName,
        purpose: r.purpose,
        status: r.status,
        verify_status: r.verifyStatus || "NOT_VERIFIED",
        credential_types: r.credentialTypes,
        challenge: r.challenge,
        domain: r.domain,
        expires_at: r.expiresAt,
        requested_attributes: requestedAttributes.map((attr: any) => ({
          attribute_path: attr.attributePath,
          attribute_name: attr.attributeName || attr.attributePath,
          required: attr.required,
          accept_predicate: attr.acceptPredicate,
        })),
        requested_predicates: requestedPredicates.map((pred: any) => ({
          attribute_path: pred.attributePath,
          attribute_name: pred.attributeName || pred.attributePath,
          operator: pred.operator,
          value: pred.value,
          required: pred.required,
        })),
        created_at: r.createdAt,
        updated_at: r.updatedAt,
      });
    }
  }

  // Sort all results by created_at desc
  results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return ResponseHelper.success(res, { requests: results }, "VP requests retrieved successfully");
});

/**
 * Accept VP Request Controller (unified, uses :id param)
 */
export const acceptVPRequest = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { id } = req.params;

  // Determine mode by checking which DB has the request
  const vpRequest = await prisma.vPRequest.findUnique({ where: { id } });
  if (vpRequest) {
    // Full mode accept
    const { vp_id, credentials } = req.body;
    if (!vp_id) {
      throw new ValidationError("vp_id is required for full mode", []);
    }
    if (!credentials || !Array.isArray(credentials) || credentials.length === 0) {
      throw new ValidationError("credentials is required for full mode", []);
    }

    const result = await PresentationService.acceptVPRequest({
      vpReqId: id,
      vpId: vp_id,
      credentials,
    });

    return ResponseHelper.success(res, result, "VP request accepted successfully");
  }

  // Try selective mode
  const sdRequest = await prisma.selectiveDisclosureRequest.findUnique({ where: { id } });
  if (sdRequest) {
    const { selective_vp } = req.body;
    if (!selective_vp) {
      throw new ValidationError("selective_vp is required for selective mode", []);
    }

    const result = await SelectiveDisclosureService.submitSelectiveDisclosureVP({
      requestId: id,
      selectiveVP: selective_vp,
    });

    return ResponseHelper.success(
      res,
      result,
      result.valid
        ? "Selective disclosure VP verified successfully"
        : "Selective disclosure VP verification failed"
    );
  }

  return ResponseHelper.notFound(res, "VP request not found");
});

/**
 * Decline VP Request Controller (unified, uses :id param)
 */
export const declineVPRequest = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { id } = req.params;

  // Try full mode first
  const vpRequest = await prisma.vPRequest.findUnique({ where: { id } });
  if (vpRequest) {
    const result = await PresentationService.declineVPRequest({ vpReqId: id });
    return ResponseHelper.success(res, result, "VP request declined successfully");
  }

  // Try selective mode
  const sdRequest = await prisma.selectiveDisclosureRequest.findUnique({ where: { id } });
  if (sdRequest) {
    if (sdRequest.status !== "PENDING") {
      throw new ValidationError(`Cannot decline request with status: ${sdRequest.status}`, []);
    }
    const updated = await prisma.selectiveDisclosureRequest.update({
      where: { id },
      data: { status: "DECLINE" },
    });
    return ResponseHelper.success(
      res,
      { request_id: updated.id, status: updated.status },
      "VP request declined successfully"
    );
  }

  return ResponseHelper.notFound(res, "VP request not found");
});

/**
 * Get Request Status Controller (verifier polls)
 */
export const getRequestStatus = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { id } = req.params;

  // Try full mode
  const vpRequest = await prisma.vPRequest.findUnique({ where: { id } });
  if (vpRequest) {
    return ResponseHelper.success(res, {
      request_id: vpRequest.id,
      mode: "full",
      status: vpRequest.status,
      verify_status: vpRequest.verify_status,
      updated_at: vpRequest.updatedAt,
    }, "Request status retrieved");
  }

  // Try selective mode
  const sdRequest = await prisma.selectiveDisclosureRequest.findUnique({ where: { id } });
  if (sdRequest) {
    // Check expiration
    let status = sdRequest.status;
    if (status === "PENDING" && new Date() > sdRequest.expiresAt) {
      status = "EXPIRED";
      await prisma.selectiveDisclosureRequest.update({
        where: { id },
        data: { status: "EXPIRED" },
      });
    }

    return ResponseHelper.success(res, {
      request_id: sdRequest.id,
      mode: "selective",
      status,
      verify_status: sdRequest.verifyStatus || "NOT_VERIFIED",
      expires_at: sdRequest.expiresAt,
      updated_at: sdRequest.updatedAt,
    }, "Request status retrieved");
  }

  return ResponseHelper.notFound(res, "VP request not found");
});

/**
 * Get Request Result Controller (verifier gets verification result)
 */
export const getRequestResult = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { id } = req.params;

  // Try full mode
  const vpRequest = await prisma.vPRequest.findUnique({ where: { id } });
  if (vpRequest) {
    return ResponseHelper.success(res, {
      request_id: vpRequest.id,
      mode: "full",
      status: vpRequest.status,
      verify_status: vpRequest.verify_status,
      vp_id: vpRequest.vp_id,
      credentials: vpRequest.credentials,
      updated_at: vpRequest.updatedAt,
    }, "Verification result retrieved");
  }

  // Try selective mode
  const sdRequest = await prisma.selectiveDisclosureRequest.findUnique({ where: { id } });
  if (sdRequest) {
    // Get the stored VP result if available
    const vp = await prisma.selectiveDisclosureVP.findFirst({
      where: { requestId: id },
    });

    let result = null;
    if (vp) {
      const revealedAttributes = JSON.parse(vp.revealedAttributes || "[]");
      const predicateResults = JSON.parse(vp.predicateResults || "[]");
      const vpData = JSON.parse(vp.vpData);
      const firstCredential = vpData.verifiableCredential?.[0];
      const issuer =
        typeof firstCredential?.issuer === "string"
          ? firstCredential.issuer
          : firstCredential?.issuer?.id || "unknown";

      result = {
        valid: sdRequest.verifyStatus === "VALID_VERIFICATION",
        revealed_attributes: revealedAttributes.map((attr: any) => ({
          attribute_path: attr.path?.replace("credentialSubject.", "") || attr.path,
          attribute_name: attr.name,
          value: attr.value,
        })),
        predicate_results: predicateResults.map((pred: any) => ({
          attribute_path: pred.attributePath,
          attribute_name: pred.attributeName || pred.attributePath,
          predicate: pred.predicate,
          satisfied: pred.satisfied,
        })),
        issuer,
        holder: vp.holderDID,
      };
    }

    return ResponseHelper.success(res, {
      request_id: sdRequest.id,
      mode: "selective",
      status: sdRequest.status,
      verify_status: sdRequest.verifyStatus || "NOT_VERIFIED",
      result,
      updated_at: sdRequest.updatedAt,
    }, "Verification result retrieved");
  }

  return ResponseHelper.notFound(res, "VP request not found");
});

/**
 * Cancel Request Controller (verifier cancels)
 */
export const cancelRequest = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { id } = req.params;

  // Try full mode
  const vpRequest = await prisma.vPRequest.findUnique({ where: { id } });
  if (vpRequest) {
    if (vpRequest.status !== "PENDING") {
      throw new ValidationError(`Cannot cancel request with status: ${vpRequest.status}`, []);
    }
    await prisma.vPRequest.update({
      where: { id },
      data: { status: "DECLINE" },
    });
    return ResponseHelper.success(res, { request_id: id }, "Request cancelled");
  }

  // Try selective mode
  const sdRequest = await prisma.selectiveDisclosureRequest.findUnique({ where: { id } });
  if (sdRequest) {
    if (sdRequest.status !== "PENDING") {
      throw new ValidationError(`Cannot cancel request with status: ${sdRequest.status}`, []);
    }
    await prisma.selectiveDisclosureRequest.update({
      where: { id },
      data: { status: "EXPIRED" },
    });
    return ResponseHelper.success(res, { request_id: id }, "Request cancelled");
  }

  return ResponseHelper.notFound(res, "VP request not found");
});

/**
 * Claim VP Controller (for Verifier - QR/barcode flow)
 */
export const claimVP = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { verifier_did } = req.body;

  if (!verifier_did) {
    throw new ValidationError("verifier_did is required", []);
  }

  const result = await PresentationService.claimVP({
    verifier_did,
  });

  return ResponseHelper.success(res, result, "VPs claimed successfully");
});

/**
 * Confirm VP Controller (QR/barcode flow)
 */
export const confirmVP = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { verifier_did, vp_ids } = req.body;

  const result = await PresentationService.confirmVP({
    verifier_did,
    vp_ids,
  });

  return ResponseHelper.success(res, result, result.message);
});

/**
 * Delete VP Controller (Soft Delete - QR/barcode flow)
 */
export const deleteVP = asyncHandler(async (req: RequestWithDID, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { vpId } = req.params;

  const holder_did = req.holderDID;
  if (!holder_did) {
    throw new ValidationError("Holder DID not found in authentication token", []);
  }

  const result = await PresentationService.deleteVP({
    vpId,
    holder_did,
  });

  return ResponseHelper.success(res, result, result.message);
});

/**
 * Store VP Controller (QR/barcode flow)
 */
export const storeVP = asyncHandler(async (req: RequestWithDID, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const holder_did = req.holderDID;
  if (!holder_did) {
    throw new ValidationError("Holder DID not found in authentication token", []);
  }

  const { vp, is_barcode } = req.body;

  const result = await PresentationService.storeVP({
    holder_did,
    vp,
    is_barcode,
  });

  return ResponseHelper.created(res, { vp_id: result.vp_id }, "VP stored successfully");
});

/**
 * Get VP Controller (QR/barcode flow)
 */
export const getVP = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { vpId } = req.params;

  const result = await PresentationService.getVP(vpId);

  return ResponseHelper.success(res, result, "VP retrieved successfully");
});

/**
 * Verify VP Controller (QR/barcode flow)
 */
export const verifyVP = asyncHandler(async (req: RequestWithDID, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { vpId } = req.params;

  const result = await PresentationService.verifyVP(vpId);

  return ResponseHelper.success(res, result, "VP verification completed");
});
