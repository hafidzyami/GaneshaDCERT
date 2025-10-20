import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { RequestType } from "@prisma/client";
import CredentialService from "../services/credential.service";
import { ValidationError } from "../utils/errors/AppError";
import { asyncHandler } from "../middlewares/errorHandler.middleware";

/**
 * Request Credential Issuance Controller
 */
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

  const { issuer_did, holder_did, encrypted_body } = req.body;

  const result = await CredentialService.requestCredentialRevocation({
    issuer_did,
    holder_did,
    encrypted_body,
  });

  res.status(201).json(result);
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
