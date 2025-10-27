import { Request, Response } from "express";
import { validationResult } from "express-validator";
// Make sure RequestType and RequestStatus are imported if used directly (though DTOs are preferred)
import { RequestType, RequestStatus } from "@prisma/client";
import { CredentialService } from "../services";
import { ValidationError } from "../utils";
import { asyncHandler } from "../middlewares";
import { ResponseHelper } from "../utils/helpers";
import { ProcessIssuanceVCDTO, RevokeVCDTO, CredentialRevocationRequestDTO } from "../dtos";

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

  res.status(201).json(result);
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

  res.status(200).json(result);
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

  res.status(201).json(result);
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

  res.status(200).json(result);
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

  res.status(201).json(result);
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

  res.status(201).json(result);
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

  res.status(201).json(result);
});

/**
 * Get VC Status Controller
 */
export const getVCStatus = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { vcId } = req.params;
  const { issuerDid, holderDid } = req.query;

  const result = await CredentialService.getVCStatus(
    vcId,
    issuerDid as string,
    holderDid as string
  );

  res.status(200).json(result);
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
