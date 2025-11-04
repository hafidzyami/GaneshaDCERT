import { Request, Response } from "express";
import { validationResult } from "express-validator";
// Make sure RequestType and RequestStatus are imported if used directly (though DTOs are preferred)
import { RequestType, RequestStatus } from "@prisma/client";
import { CredentialService } from "../services";
import { ValidationError } from "../utils";
import { asyncHandler, RequestWithDID } from "../middlewares";
import { ResponseHelper } from "../utils/helpers";
import { ProcessUpdateVCDTO, IssuerIssueVCDTO,ProcessIssuanceVCDTO, RevokeVCDTO, CredentialRevocationRequestDTO, ProcessRenewalVCDTO } from "../dtos";
import { BadRequestError} from "../utils/errors/AppError";
/**
 * Request Credential Issuance Controller
 */

export const getHolderCredentialsFromDB = asyncHandler(async (req: Request, res: Response) => {
  // Validate query parameters
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  // Extract holder_did from query parameters
  const holderDid = req.query.holder_did as string;

  // Call the service function
  const credentials = await CredentialService.getHolderCredentialsFromDB(holderDid);

  // Send success response
  return ResponseHelper.success(
    res,
    credentials,
    `Successfully retrieved ${credentials.length} credentials for holder ${holderDid}.`
  );
});

export const processIssuanceVC = asyncHandler(async (req: Request, res: Response) => {
  // Validate request using the defined validator
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  // Cast req.body to the DTO for type safety
  const requestData: ProcessIssuanceVCDTO = req.body;

  // Call the service method with the validated data
  const result = await CredentialService.processIssuanceVC(requestData);

  // Send a standardized success response
  return ResponseHelper.success(res, result, result.message);
});

export const requestCredential = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { encrypted_body, issuer_did, holder_did } = req.body;

  const result = await CredentialService.requestCredentialIssuance({
    encrypted_body,
    issuer_did,
    holder_did,
  });

  return ResponseHelper.created(res, result, "Credential issuance request created successfully");
});

/**
 * Get Credential Requests by Type Controller
 */
export const getCredentialRequestsByType = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { type, issuer_did } = req.query;

  const result = await CredentialService.getCredentialRequestsByType(
    type as RequestType,
    issuer_did as string | undefined
  );

  return ResponseHelper.success(res, result, "Credential requests retrieved successfully");
});

/**
 * Process Credential Response Controller
 */
export const processCredentialResponse = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { request_id, issuer_did, holder_did, encrypted_body, request_type } = req.body;

  const result = await CredentialService.processCredentialResponse({
    request_id,
    issuer_did,
    holder_did,
    encrypted_body,
    request_type,
  });

  return ResponseHelper.created(res, result, "Credential response processed successfully");
});

/**
 * Get Holder VCs Controller
 */
export const getHolderVCs = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { holderDid } = req.query;

  const result = await CredentialService.getHolderVCs(holderDid as string);

  return ResponseHelper.success(res, result, "Holder VCs retrieved successfully");
});

/**
 * Request Credential Update Controller
 */
export const requestCredentialUpdate = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { issuer_did, holder_did, encrypted_body } = req.body;

  const result = await CredentialService.requestCredentialUpdate({
    issuer_did,
    holder_did,
    encrypted_body,
  });

  return ResponseHelper.created(res, result, "Credential update request created successfully");
});

/**
 * Request Credential Renewal Controller
 */
export const requestCredentialRenewal = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { issuer_did, holder_did, encrypted_body } = req.body;

  const result = await CredentialService.requestCredentialRenewal({
    issuer_did,
    holder_did,
    encrypted_body,
  });

  return ResponseHelper.created(res, result, "Credential renewal request created successfully");
});

/**
 * Request Credential Revocation Controller
 */
export const requestCredentialRevocation = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  // Cast body to the appropriate DTO for creating a request
  const requestData: CredentialRevocationRequestDTO = req.body;

  // Call the REVERTED service function to create the request
  const result = await CredentialService.requestCredentialRevocation(requestData);

  // Send success response (use CREATED status code 201)
  return ResponseHelper.created(res, { request_id: result.request_id }, result.message);
});

/**
 * Add VC Status Block Controller
 */
export const addVCStatusBlock = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { vc_id, issuer_did, holder_did, status, hash } = req.body;

  const result = await CredentialService.addVCStatusBlock({
    vc_id,
    issuer_did,
    holder_did,
    status,
    hash,
  });

  return ResponseHelper.created(res, result, "VC status block added successfully");
});

/**
 * Get VC Status Controller
 */
export const getVCStatus = asyncHandler(async (req: Request, res: Response) => {
  // Validator now only checks param('vcId')
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  // Extract vcId from URL parameters
  const { vcId } = req.params;
  // REMOVED extraction of issuerDid and holderDid from query

  // Call the updated service method (only requires vcId)
  const result = await CredentialService.getVCStatus(vcId);

  return ResponseHelper.success(res, result, `Successfully retrieved status for VC ${vcId}.`);
});

export const revokeVC = asyncHandler(async (req: Request, res: Response) => {
  // Validate request body using the modified validator
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  // Cast body to the updated DTO
  const requestData: RevokeVCDTO = req.body;

  // Call the MODIFIED service function (which now processes the request)
  const result = await CredentialService.revokeVC(requestData); // The service method name might be kept or changed

  // Send success response
  return ResponseHelper.success(res, result, result.message);
});

export const processRenewalVC = asyncHandler(async (req: Request, res: Response) => {
  // Validate request body
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  // Cast body to DTO
  const requestData: ProcessRenewalVCDTO = req.body;

  // Call the service function
  const result = await CredentialService.processRenewalVC(requestData);

  // Send success response
  return ResponseHelper.success(res, result, result.message);
});

export const processUpdateVC = asyncHandler(async (req: Request, res: Response) => {
  // Validate request body
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  // Cast body to DTO
  const requestData: ProcessUpdateVCDTO = req.body;

  // Call the service function
  const result = await CredentialService.processUpdateVC(requestData);

  // Send success response
  return ResponseHelper.success(res, result, result.message);
});

/**
 * Phase 1: Claim VC Controller
 * Atomically claims a pending VC for the holder
 */
export const claimVC = asyncHandler(async (req: Request, res: Response) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  // Extract holder_did from query or body
  const holderDid = (req.query.holder_did || req.body.holder_did) as string;

  // Call the service function
  const vcResponse = await CredentialService.claimVC(holderDid);

  // If no VC found, return appropriate response
  if (!vcResponse) {
    return ResponseHelper.success(res, null, "No pending VCs available for claim.");
  }

  // Send success response with the claimed VC
  return ResponseHelper.success(res, vcResponse, "VC claimed successfully. Please save it and confirm.");
});

/**
 * Phase 2: Confirm VC Controller
 * Confirms a claimed VC and soft-deletes it
 */
export const confirmVC = asyncHandler(async (req: Request, res: Response) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  // Extract vc_id and holder_did from body
  const { vc_id, holder_did } = req.body;

  // Call the service function
  const result = await CredentialService.confirmVC(vc_id, holder_did);

  // Send success response
  return ResponseHelper.success(res, result, result.message);
});

/**
 * Phase 1 Batch: Claim multiple VCs Controller
 * Atomically claims multiple pending VCs for the holder
 */
export const claimVCsBatch = asyncHandler(async (req: Request, res: Response) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  // Extract holder_did and limit from body
  const { holder_did, limit } = req.body;

  // Call the service function
  const result = await CredentialService.claimVCsBatch(holder_did, limit || 10);

  // Determine message based on results
  let message = "No pending VCs available for claim.";
  if (result.claimed_count > 0) {
    message = `Successfully claimed ${result.claimed_count} VCs. ${result.has_more ? `${result.remaining_count} more pending.` : 'No more pending VCs.'}`;
  }

  // Send success response
  return ResponseHelper.success(res, result, message);
});

/**
 * Phase 2 Batch: Confirm multiple VCs Controller
 * Confirms multiple claimed VCs and soft-deletes them
 */
export const confirmVCsBatch = asyncHandler(async (req: Request, res: Response) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  // Extract vc_ids and holder_did from body
  const { vc_ids, holder_did } = req.body;

  // Call the service function
  const result = await CredentialService.confirmVCsBatch(vc_ids, holder_did);

  // Send success response
  return ResponseHelper.success(res, result, result.message);
});

/**
 * Admin: Manual cleanup of stuck PROCESSING VCs
 * Resets VCs stuck in PROCESSING status back to PENDING
 *
 * Requires admin authentication
 */
export const resetStuckVCs = asyncHandler(async (req: Request, res: Response) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  // Extract timeout_minutes from body (optional, defaults to 15)
  const { timeout_minutes } = req.body;

  // Call the service function
  const result = await CredentialService.resetStuckProcessingVCs(timeout_minutes || 15);

  // Prepare message
  const message = result.reset_count > 0
    ? `Successfully reset ${result.reset_count} stuck VCs back to PENDING`
    : "No stuck VCs found to reset";

  // Send success response
  return ResponseHelper.success(res, result, message);
});

export const getAllIssuerRequests = asyncHandler(async (req: Request, res: Response) => {
  //
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  // Ekstrak query params
  const issuerDid = req.query.issuer_did as string;
  // Perbarui tipe cast untuk menyertakan 'ALL'
  const status = req.query.status as (RequestStatus | 'ALL') | undefined;

  // Panggil metode service yang telah diperbarui
  const result = await CredentialService.getAllIssuerRequests(issuerDid, status);

  // Kirim respons sukses
  return ResponseHelper.success(
    res,
    result,
    `Successfully retrieved ${result.count} requests for issuer.`
  );
});

export const issuerIssueVC = asyncHandler(async (req: RequestWithDID, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  // Dapatkan DID yang diautentikasi dari middleware
  const authenticatedDid = req.holderDID; // Diambil dari token JWT issuer
  if (!authenticatedDid) {
    // Ini seharusnya tidak terjadi jika middleware auth berjalan
    throw new BadRequestError("Authenticated issuer DID not found in request. Make sure JWT token is valid.");
  }

  const requestData: IssuerIssueVCDTO = req.body;

  // Panggil service, teruskan data dan DID yang diautentikasi
  const result = await CredentialService.issuerIssueVC(requestData, authenticatedDid);

  // Kirim respons 'Created' (201)
  return ResponseHelper.created(res, result, result.message);
});