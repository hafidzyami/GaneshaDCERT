import { RequestType, RequestStatus } from "@prisma/client";

/**
 * Credential DTOs
 */

export interface CredentialIssuanceRequestDTO {
  encrypted_body: string;
  issuer_did: string;
  holder_did: string;
}

export interface CredentialResponseDTO {
  request_id: string;
  issuer_did: string;
  holder_did: string;
  encrypted_body: string;
  request_type: RequestType;
}

export interface CredentialUpdateRequestDTO {
  issuer_did: string;
  holder_did: string;
  encrypted_body: string;
}

export interface CredentialRenewalRequestDTO {
  issuer_did: string;
  holder_did: string;
  encrypted_body: string;
}

export interface CredentialRevocationRequestDTO {
  // Renamed back
  encrypted_body: string; // Contains VC ID and reason (encrypted)
  issuer_did: string;
  holder_did: string;
}

// REVERTED: Response body DTO for POST /credentials/revoke-request (now CREATING a request)
export interface CredentialRevocationResponseDTO {
  // Renamed back
  message: string;
  request_id: string; // The ID of the newly created VCRevokeRequest record
}

export interface VCStatusBlockDTO {
  vc_id: string;
  issuer_did: string;
  holder_did: string;
  status: boolean;
  hash: string;
}

export interface VCStatusResponseDTO {
  vc_id: string;
  issuer_did: string;
  holder_did: string;
  vc_type: string;
  schema_id: string;
  schema_version: number;
  status: boolean;
  hash: string;
}

export interface ProcessIssuanceVCDTO {
  request_id: string; // ID of the VCIssuanceRequest
  // issuer_did: string; DIHAPUS
  // holder_did: string; DIHAPUS
  action: "APPROVED" | "REJECTED";
  // request_type: RequestType; DIHAPUS (Selalu ISSUANCE untuk endpoint ini)

  // Fields required only when action is APPROVED
  vc_id?: string; // The unique ID for the new VC itself
  schema_id?: string; // ID of the schema used
  schema_version?: number; // Version of the schema used
  vc_hash?: string; // Hash of the credential data (before encryption)
  encrypted_body?: string; // Encrypted VC data
  expired_at?: string; // Expiration date and time (ISO 8601 format, Required only if action is APPROVED)
}

export interface ProcessIssuanceVCResponseDTO {
  message: string;
  request_id: string;
  status: RequestStatus;
  vc_response_id?: string; // Only present if approved
  transaction_hash?: string; // Blockchain transaction hash, only if approved
  block_number?: number; // Blockchain block number, only if approved
}

export interface HolderCredentialDTO {
  id: string;
  order_id: string;
  request_id: string;
  request_type: RequestType;
  issuer_did: string;
  holder_did: string;
  encrypted_body: string;
}

export interface RevokeVCDTO {
  request_id: string; // ID of the VCRevokeRequest record
  action: "APPROVED" | "REJECTED"; // Action to perform
  vc_id?: string; // VC ID to revoke (Required only if action is APPROVED)
}

// Response body after successful revocation
export interface RevokeVCResponseDTO {
  message: string;
  request_id: string; // ID of the VCRevokeRequest processed
  status: RequestStatus; // Final status of the VCRevokeRequest
  transaction_hash?: string; // Blockchain TX hash if approved & successful
  block_number?: number; // Blockchain block number if approved & successful
}

export interface ProcessRenewalVCDTO {
  request_id: string; // ID of the VCRenewalRequest record
  action: "APPROVED" | "REJECTED";
  vc_id?: string; // VC ID to renew (Required only if action is APPROVED)
  encrypted_body?: string; // Newly issued/renewed encrypted VC body (Required only if action is APPROVED)
  expired_at?: string; // Expiration date and time (ISO 8601 format, Required only if action is APPROVED)
}

// Response body DTO for POST /credentials/renew-vc
export interface ProcessRenewalVCResponseDTO {
  message: string;
  request_id: string;
  status: RequestStatus;
  vc_response_id?: string;
  transaction_hash?: string;
  block_number?: number;
}

export interface ProcessUpdateVCDTO {
  request_id: string; // ID of the VCUpdateRequest record
  action: "APPROVED" | "REJECTED";
  vc_id?: string; // Original VC ID to update on blockchain (Required if action is APPROVED)
  new_vc_id?: string; // New VC ID (Required if action is APPROVED)
  vc_type?: string; // VC type (Required if action is APPROVED)
  schema_id?: string; // Schema ID (Required if action is APPROVED)
  schema_version?: number; // Schema version (Required if action is APPROVED)
  new_vc_hash?: string; // New hash for the updated VC (Required if action is APPROVED)
  encrypted_body?: string; // New encrypted body for the updated VC (Required if action is APPROVED)
  expired_at?: string; // Expiration date and time (ISO 8601 format, Required only if action is APPROVED)
}

// Response body DTO for POST /credentials/update-vc
export interface ProcessUpdateVCResponseDTO {
  message: string;
  request_id: string; // ID of the VCUpdateRequest processed
  status: RequestStatus; // Final status of the VCUpdateRequest
  vc_response_id?: string; // ID of the new VCResponse record if approved
  transaction_hash?: string; // Blockchain TX hash if approved & successful
  block_number?: number; // Blockchain block number if approved & successful
}

export interface AggregatedRequestDTO {
  id: string;
  request_type: RequestType;
  issuer_did: string;
  holder_did: string | null; // Dibuat nullable (karena log mungkin tidak punya holder_did)
  status: RequestStatus | null; // Dibuat nullable (karena log tidak punya status PENDING/APPROVED)
  encrypted_body: string | null; // Dibuat nullable (karena log tidak punya encrypted_body)
  vc_id: string | null;
  new_vc_id: string | null; // Ditambahkan untuk log UPDATE
  transaction_hash: string | null; // Ditambahkan untuk log
  createdAt: Date;
  history_type: 'REQUEST' | 'DIRECT_ACTION'; // Field baru untuk membedakan
}

// Response DTO for the new endpoint
export interface AllIssuerRequestsResponseDTO {
  count: number;
  requests: AggregatedRequestDTO[];
}

export interface IssuerIssueVCDTO {
  issuer_did: string;
  holder_did: string;
  vc_id: string;
  vc_type: string;
  schema_id: string;
  schema_version: number;
  vc_hash: string;
  encrypted_body: string;
  expiredAt: string; // <-- TAMBAHKAN BARIS INI
}

export interface IssuerUpdateVCDTO {
  issuer_did: string;
  holder_did: string;

  old_vc_id: string; // ID VC lama yang akan diganti

  // Detail VC baru
  new_vc_id: string; // ID unik untuk VC yang baru (diperbarui)
  vc_type: string;
  schema_id: string;
  schema_version: number;
  new_vc_hash: string; // Hash dari data VC yang baru
  encrypted_body: string; // Body VC baru yang dienkripsi
  expiredAt: string; // Tanggal kedaluwarsa baru
}

// Response body DTO for POST /credentials/issuer/update-vc
export interface IssuerUpdateVCResponseDTO {
  message: string;
  record_id: string; // ID dari record baru di tabel VCinitiatedByIssuer
  transaction_hash: string;
  block_number: number;
}

// Response body DTO for POST /credentials/issuer/issue-vc
export interface IssuerIssueVCResponseDTO {
  message: string;
  record_id: string; // ID dari record baru di tabel VCinitiatedByIssuer
  transaction_hash: string;
  block_number: number;
}

export interface IssuerRevokeVCDTO {
  issuer_did: string; // DID Issuer yang diautentikasi
  vc_id: string; // ID VC yang akan dicabut
}

// Response body DTO for POST /credentials/issuer/revoke-vc
export interface IssuerRevokeVCResponseDTO {
  message: string;
  vc_id: string;
  transaction_hash: string;
  block_number: number;
}

export interface IssuerRenewVCDTO {
  issuer_did: string;
  holder_did: string;
  vc_id: string; // ID dari VC on-chain yang akan diperbarui (renew)
  encrypted_body: string; // Body VC BARU (sudah dienkripsi) yang akan disimpan di DB
  expiredAt: string; // <-- TAMBAHKAN BARIS INI
}

// Response body DTO for POST /credentials/issuer/renew-vc
export interface IssuerRenewVCResponseDTO {
  message: string;
  record_id: string; // ID dari record baru di tabel VCinitiatedByIssuer
  transaction_hash: string;
  block_number: number;
}

export interface ClaimIssuerInitiatedVCsDTO {
  holder_did: string;
  limit?: number;
}

// Response body DTO for POST /claim-vc/issuer-init
export interface ClaimIssuerInitiatedVCsResponseDTO {
  claimed_vcs: any[]; // Data VC yang diklaim
  claimed_count: number;
  remaining_count: number;
  has_more: boolean;
}

// Request body DTO for POST /confirm-vc/issuer-init
export interface ConfirmIssuerInitiatedVCsDTO {
  vc_ids: string[]; // Array of VCinitiatedByIssuer record IDs
  holder_did: string;
}

// Response body DTO for POST /confirm-vc/issuer-init
export interface ConfirmIssuerInitiatedVCsResponseDTO {
  message: string;
  confirmed_count: number;
  requested_count: number;
}

// VC Validation DTOs
export interface ValidateVCDTO {
  vc_json: any; // The complete VC JSON object
  vc_hash: string; // Hash calculated by frontend (Keccak256)
  holder_did: string; // DID of the institution uploading (for validation)
}

export interface VCValidationResult {
  is_valid: boolean;
  did_valid: boolean;
  expiration_valid: boolean;
  hash_valid: boolean;
  errors: string[];
  vc_id?: string;
  holder_did?: string;
  issuer_did?: string;
  expired_at?: string | null;
  is_expired?: boolean;
}

/**
 * DTO for uploading VC document file
 */
export interface UploadVCDocumentResponseDTO {
  message: string;
  file_id: string; // UUID generated for the file
  file_url: string;
  size: number;
}

/**
 * DTO for deleting VC document file
 */
export interface DeleteVCDocumentDTO {
  file_id: string; // UUID of the file to delete
}

export interface DeleteVCDocumentResponseDTO {
  message: string;
  file_id: string;
}
