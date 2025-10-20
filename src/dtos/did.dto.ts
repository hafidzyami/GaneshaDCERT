/**
 * DID DTOs
 */

export interface RegisterDIDDTO {
  did_string: string;
  public_key: string;
  role: 'individual' | 'institutional';
  // Institutional fields (optional)
  email?: string;
  name?: string;
  phone?: string;
  country?: string;
  website?: string;
  address?: string;
}

export interface KeyRotationDTO {
  did: string;
  old_public_key: string;
  new_public_key: string;
  iteration_number?: number;
}

export interface DIDDocumentResponseDTO {
  did_document: {
    id: string;
    controller: string;
    verificationMethod: any[];
    authentication: string[];
    assertionMethod: string[];
    [key: string]: any;
  };
}
