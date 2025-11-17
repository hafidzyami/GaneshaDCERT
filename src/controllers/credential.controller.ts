import { Request, Response } from "express";
import { validationResult } from "express-validator";
// Make sure RequestType and RequestStatus are imported if used directly (though DTOs are preferred)
import { RequestType, RequestStatus } from "@prisma/client";
import { CredentialService } from "../services";
import { ValidationError } from "../utils";
import { asyncHandler, RequestWithDID } from "../middlewares";
import { ResponseHelper } from "../utils/helpers";
import {
  CombinedConfirmVCsBatchDTO,
  ClaimIssuerInitiatedVCsDTO,
  ConfirmIssuerInitiatedVCsDTO,
  IssuerRenewVCDTO,
  IssuerRevokeVCDTO,
  IssuerUpdateVCDTO,
  ProcessUpdateVCDTO,
  IssuerIssueVCDTO,
  ProcessIssuanceVCDTO,
  RevokeVCDTO,
  CredentialRevocationRequestDTO,
  ProcessRenewalVCDTO,
  ValidateVCDTO,
} from "../dtos";
import { BadRequestError } from "../utils/errors/AppError";
/**
 * Request Credential Issuance Controller
 */

export const getHolderCredentialsFromDB = asyncHandler(
  async (req: Request, res: Response) => {
    // Validate query parameters
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    // Extract holder_did from query parameters
    const holderDid = req.query.holder_did as string;

    // Call the service function
    const credentials = await CredentialService.getHolderCredentialsFromDB(
      holderDid
    );

    // Send success response
    return ResponseHelper.success(
      res,
      credentials,
      `Successfully retrieved ${credentials.length} credentials for holder ${holderDid}.`
    );
  }
);

export const processIssuanceVC = asyncHandler(
  async (req: Request, res: Response) => {
    // Validate request using the defined validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    // Cast req.body to the DTO for type safety
    // DTO 'ProcessIssuanceVCDTO' sekarang sudah diperbarui (lebih ramping)
    const requestData: ProcessIssuanceVCDTO = req.body;

    // Call the service method with the validated data
    // Service akan diubah di langkah berikutnya untuk menangani DTO baru
    const result = await CredentialService.processIssuanceVC(requestData);

    // Send a standardized success response
    return ResponseHelper.success(res, result, result.message);
  }
);

export const requestCredential = asyncHandler(
  async (req: Request, res: Response) => {
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

    return ResponseHelper.created(
      res,
      result,
      "Credential issuance request created successfully"
    );
  }
);

/**
 * Get Credential Requests by Type Controller
 */
export const getCredentialRequestsByType = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    // --- PERBAIKAN DI SINI ---
    // Ambil 'holder_did' dari query
    const { type, issuer_did, holder_did } = req.query;

    const result = await CredentialService.getCredentialRequestsByType(
      type as RequestType | "ALL",
      issuer_did as string | undefined,
      holder_did as string | undefined // <-- Teruskan 'holder_did' ke service
    );

    // --- PERBAIKAN DI SINI ---
    // Gunakan 'result.data' dan 'result.message' dari service
    return ResponseHelper.success(
      res,
      result,
      "Credential requests retrieved successfully"
    );
  }
);

/**
 * Process Credential Response Controller
 */
export const processCredentialResponse = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { request_id, issuer_did, holder_did, encrypted_body, request_type } =
      req.body;

    const result = await CredentialService.processCredentialResponse({
      request_id,
      issuer_did,
      holder_did,
      encrypted_body,
      request_type,
    });

    return ResponseHelper.created(
      res,
      result,
      "Credential response processed successfully"
    );
  }
);

/**
 * Get Holder VCs Controller
 */
export const getHolderVCs = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { holder_did } = req.query;

    const result = await CredentialService.getHolderVCs(holder_did as string);

    return ResponseHelper.success(
      res,
      result,
      "Holder VCs retrieved successfully"
    );
  }
);

/**
 * Request Credential Update Controller
 */
export const requestCredentialUpdate = asyncHandler(
  async (req: Request, res: Response) => {
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

    return ResponseHelper.created(
      res,
      result,
      "Credential update request created successfully"
    );
  }
);

/**
 * Request Credential Renewal Controller
 */
export const requestCredentialRenewal = asyncHandler(
  async (req: Request, res: Response) => {
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

    return ResponseHelper.created(
      res,
      result,
      "Credential renewal request created successfully"
    );
  }
);

/**
 * Request Credential Revocation Controller
 */
export const requestCredentialRevocation = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    // Cast body to the appropriate DTO for creating a request
    const requestData: CredentialRevocationRequestDTO = req.body;

    // Call the REVERTED service function to create the request
    const result = await CredentialService.requestCredentialRevocation(
      requestData
    );

    // Send success response (use CREATED status code 201)
    return ResponseHelper.created(
      res,
      { request_id: result.request_id },
      result.message
    );
  }
);

/**
 * Add VC Status Block Controller
 */
export const addVCStatusBlock = asyncHandler(
  async (req: Request, res: Response) => {
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

    return ResponseHelper.created(
      res,
      result,
      "VC status block added successfully"
    );
  }
);

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

  return ResponseHelper.success(
    res,
    result,
    `Successfully retrieved status for VC ${vcId}.`
  );
});

export const revokeVC = asyncHandler(async (req: Request, res: Response) => {
  // Validate request body using the modified validator
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  // Cast body to the updated DTO (RevokeVCDTO sekarang lebih ramping)
  const requestData: RevokeVCDTO = req.body;

  // Call the MODIFIED service function (which now processes the request)
  const result = await CredentialService.revokeVC(requestData); // Service akan diubah

  // Send success response
  return ResponseHelper.success(res, result, result.message);
});

export const processRenewalVC = asyncHandler(
  async (req: Request, res: Response) => {
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
  }
);

export const processUpdateVC = asyncHandler(
  async (req: Request, res: Response) => {
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
  }
);

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
    return ResponseHelper.success(
      res,
      null,
      "No pending VCs available for claim."
    );
  }

  // Send success response with the claimed VC
  return ResponseHelper.success(
    res,
    vcResponse,
    "VC claimed successfully. Please save it and confirm."
  );
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
export const claimVCsBatch = asyncHandler(
  async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    // Extract holder_did and limit from body
    const { holder_did, limit } = req.body;

    // Call the service function
    const result = await CredentialService.claimVCsBatch(
      holder_did,
      limit || 10
    );

    // Determine message based on results
    let message = "No pending VCs available for claim.";
    if (result.claimed_count > 0) {
      message = `Successfully claimed ${result.claimed_count} VCs. ${
        result.has_more
          ? `${result.remaining_count} more pending.`
          : "No more pending VCs."
      }`;
    }

    // Send success response
    return ResponseHelper.success(res, result, message);
  }
);

/**
 * Phase 2 Batch: Confirm multiple VCs Controller
 * Confirms multiple claimed VCs and soft-deletes them
 */
export const confirmVCsBatch = asyncHandler(
  async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    // Extract request_ids and holder_did from body
    const { request_ids, holder_did } = req.body;

    // Call the service function
    const result = await CredentialService.confirmVCsBatch(
      request_ids,
      holder_did
    );

    // Send success response
    return ResponseHelper.success(res, result, result.message);
  }
);

/**
 * Admin: Manual cleanup of stuck PROCESSING VCs
 * Resets VCs stuck in PROCESSING status back to PENDING
 *
 * Requires admin authentication
 */
export const resetStuckVCs = asyncHandler(
  async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    // Extract timeout_minutes from body (optional, defaults to 15)
    const { timeout_minutes } = req.body;

    // Call the service function
    const result = await CredentialService.resetStuckProcessingVCs(
      timeout_minutes || 15
    );

    // [FIXED] Use the new 'total_reset_count' for the message
    const message =
      result.total_reset_count > 0
        ? `Successfully reset ${result.total_reset_count} total stuck VCs back to PENDING`
        : "No stuck VCs found to reset";

    // The 'result' object now contains the full breakdown
    return ResponseHelper.success(res, result, message);
  }
);

export const getAllIssuerRequests = asyncHandler(
  async (req: Request, res: Response) => {
    //
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    // Ekstrak query params
    const issuerDid = req.query.issuer_did as string;
    // Perbarui tipe cast untuk menyertakan 'ALL'
    const status = req.query.status as (RequestStatus | "ALL") | undefined;

    // Panggil metode service yang telah diperbarui
    const result = await CredentialService.getAllIssuerRequests(
      issuerDid,
      status
    );

    // Kirim respons sukses
    return ResponseHelper.success(
      res,
      result,
      `Successfully retrieved ${result.count} requests for issuer.`
    );
  }
);

export const issuerIssueVC = asyncHandler(
  async (req: RequestWithDID, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    // Dapatkan DID yang diautentikasi dari middleware
    const authenticatedDid = req.holderDID; // Diambil dari token JWT issuer
    if (!authenticatedDid) {
      // Ini seharusnya tidak terjadi jika middleware auth berjalan
      throw new BadRequestError(
        "Authenticated issuer DID not found in request. Make sure JWT token is valid."
      );
    }

    const requestData: IssuerIssueVCDTO = req.body;

    // Panggil service, teruskan data dan DID yang diautentikasi
    const result = await CredentialService.issuerIssueVC(
      requestData,
      authenticatedDid
    );

    // Kirim respons 'Created' (201)
    return ResponseHelper.created(res, result, result.message);
  }
);

export const issuerUpdateVC = asyncHandler(
  async (req: RequestWithDID, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    // Dapatkan DID yang diautentikasi dari middleware
    const authenticatedDid = req.holderDID;
    if (!authenticatedDid) {
      throw new BadRequestError(
        "Authenticated issuer DID not found in request. Make sure JWT token is valid."
      );
    }

    const requestData: IssuerUpdateVCDTO = req.body;

    // Panggil service
    const result = await CredentialService.issuerUpdateVC(
      requestData,
      authenticatedDid
    );

    // Kirim respons 'Created' (201) karena VC baru dibuat
    return ResponseHelper.created(res, result, result.message);
  }
);

export const issuerRevokeVC = asyncHandler(
  async (req: RequestWithDID, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    // Dapatkan DID yang diautentikasi dari middleware
    const authenticatedDid = req.holderDID;
    if (!authenticatedDid) {
      throw new BadRequestError(
        "Authenticated issuer DID not found in request. Make sure JWT token is valid."
      );
    }

    const requestData: IssuerRevokeVCDTO = req.body;

    // Panggil service
    const result = await CredentialService.issuerRevokeVC(
      requestData,
      authenticatedDid
    );

    // Kirim respons 'OK' (200)
    return ResponseHelper.success(res, result, result.message);
  }
);

export const issuerRenewVC = asyncHandler(
  async (req: RequestWithDID, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const authenticatedDid = req.holderDID;
    if (!authenticatedDid) {
      throw new BadRequestError(
        "Authenticated issuer DID not found in request. Make sure JWT token is valid."
      );
    }

    const requestData: IssuerRenewVCDTO = req.body;

    // Panggil service
    const result = await CredentialService.issuerRenewVC(
      requestData,
      authenticatedDid
    );

    // Kirim respons 'Created' (201) karena record baru dibuat di DB
    return ResponseHelper.created(res, result, result.message);
  }
);

export const claimIssuerInitiatedVCsBatch = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    // --- PERBAIKAN: Gunakan DTO untuk type casting req.body ---
    const requestData: ClaimIssuerInitiatedVCsDTO = req.body;
    const { holder_did, limit } = requestData;

    // Panggil service function yang baru
    const result = await CredentialService.claimIssuerInitiatedVCsBatch(
      holder_did,
      limit || 10
    ); //

    let message = "No pending issuer-initiated VCs available for claim.";
    if (result.claimed_count > 0) {
      message = `Successfully claimed ${result.claimed_count} VCs. ${
        result.has_more
          ? `${result.remaining_count} more pending.`
          : "No more pending VCs."
      }`;
    }

    return ResponseHelper.success(res, result, message);
  }
);

/**
 * Phase 2 Batch (Issuer-Initiated): Confirm multiple VCs Controller
 */
export const confirmIssuerInitiatedVCsBatch = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    // --- PERBAIKAN: Gunakan DTO untuk type casting req.body ---
    const requestData: ConfirmIssuerInitiatedVCsDTO = req.body;
    const { vc_ids, holder_did } = requestData;

    // Panggil service function yang baru
    const result = await CredentialService.confirmIssuerInitiatedVCsBatch(
      vc_ids,
      holder_did
    ); //

    return ResponseHelper.success(res, result, result.message);
  }
);

/**
 * Validate VC JSON Controller
 * Validates uploaded VC JSON for DID ownership, expiration, and hash
 */
export const validateVC = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const requestData: ValidateVCDTO = req.body;

  // Call service validation
  const result = await CredentialService.validateVC(requestData);

  // Return appropriate message based on validation result
  const message = result.is_valid
    ? "VC validation successful. The credential is valid and belongs to you."
    : `VC validation failed: ${result.errors.join(", ")}`;

  return ResponseHelper.success(res, result, message);
});

/**
 * Upload VC document file
 * POST /credentials/file
 */
export const uploadVCDocumentFile = asyncHandler(
  async (req: Request, res: Response) => {
    // Check if file exists
    if (!req.file) {
      throw new BadRequestError("File is required");
    }

    const fileBuffer = req.file.buffer;
    const filename = req.file.originalname;
    const mimetype = req.file.mimetype;

    // Call service to upload file
    const result = await CredentialService.uploadVCDocumentFile(
      fileBuffer,
      filename,
      mimetype
    );

    return ResponseHelper.success(res, result, result.message);
  }
);

/**
 * Delete VC document file
 * DELETE /credentials/file
 */
export const deleteVCDocumentFile = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { file_id } = req.body;

    // Call service to delete file
    const result = await CredentialService.deleteVCDocumentFile(file_id);

    return ResponseHelper.success(res, result, result.message);
  }
);

export const claimCombinedVCsBatch = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { holder_did, limit } = req.body;

    const result = await CredentialService.claimCombinedVCsBatch(
      holder_did,
      limit || 10
    );

    let message = "No pending VCs available for claim.";
    if (result.claimed_count > 0) {
      message = `Successfully claimed ${result.claimed_count} VCs. ${
        result.has_more
          ? `${result.remaining_count} more pending.`
          : "No more pending VCs."
      }`;
    }

    return ResponseHelper.success(res, result, message);
  }
);

/**
 * [NEW] Phase 2 Batch (Combined): Confirm multiple VCs Controller
 */
export const confirmCombinedVCsBatch = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { items, holder_did } = req.body as CombinedConfirmVCsBatchDTO;

    const result = await CredentialService.confirmCombinedVCsBatch(
      items,
      holder_did
    );

    return ResponseHelper.success(res, result, result.message);
  }
);

/**
 * Store Issuer VC Data Controller
 */
export const storeIssuerVCData = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { issuer_did, encrypted_body } = req.body;

    const result = await CredentialService.storeIssuerVCData({
      issuer_did,
      encrypted_body,
    });

    return ResponseHelper.created(res, result.data, result.message);
  }
);

/**
 * Get Issuer VC Data Controller
 */
export const getIssuerVCData = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { issuer_did } = req.params;

    const result = await CredentialService.getIssuerVCData(issuer_did);

    return ResponseHelper.success(res, result, result.message);
  }
);

/**
 * Get Issuer VC Data by ID Controller
 */
export const getIssuerVCDataById = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { id } = req.params;

    const result = await CredentialService.getIssuerVCDataById(id);

    return ResponseHelper.success(res, result.data, result.message);
  }
);

/**
 * Update Issuer VC Data Controller
 */
export const updateIssuerVCData = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { issuer_did, old_encrypted_body, new_encrypted_body } = req.body;

    const result = await CredentialService.updateIssuerVCData({
      issuer_did,
      old_encrypted_body,
      new_encrypted_body,
    });

    return ResponseHelper.success(res, result.data, result.message);
  }
);
