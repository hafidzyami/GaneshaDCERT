/**
 * Presentation DTOs
 */

export interface RequestVPDTO {
  holder_did: string;
  verifier_did: string;
  list_schema_id: string[];
}

export interface StoreVPDTO {
  holder_did: string;
  vp: any; // VP object structure
}

export interface VPResponseDTO {
  vp: any;
}

export interface VPRequestResponseDTO {
  vp_request_id: string;
  message: string;
}

export interface VPRequestDetailsDTO {
  verifier_did: string;
  list_schema_id: string[];
}
