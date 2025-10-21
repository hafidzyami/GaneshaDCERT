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
  issuer_did: string;
  holder_did: string;
  encrypted_body: string;
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
  status: string;
  revoked: boolean;
  issuer_did: string;
  holder_did: string;
}


export interface ProcessIssuanceVCDTO {
  request_id: string; // ID of the VCIssuanceRequest
  issuer_did: string;
  holder_did: string;
  action: "APPROVED" | "REJECTED";
  request_type: RequestType; // Should always be ISSUANCE

  // Fields required only when action is APPROVED
  vc_id?: string; // The unique ID for the new VC itself
  vc_type?: string; // e.g., "VerifiableCredential", "UniversityDegreeCredential"
  schema_id?: string; // ID of the schema used
  schema_version?: number; // Version of the schema used
  vc_hash?: string; // Hash of the credential data (before encryption)
  encrypted_body?: string; // Encrypted VC data
}

export interface ProcessIssuanceVCResponseDTO {
  message: string;
  request_id: string;
  status: RequestStatus;
  vc_response_id?: string; // Only present if approved
  transaction_hash?: string; // Blockchain transaction hash, only if approved
  block_number?: number; // Blockchain block number, only if approved
}