/**
 * Schema DTOs
 */

export interface CreateVCSchemaDTO {
  id: string;
  name: string;
  schema: any; // Schema object structure
  issuer_did: string;
  version: number;
}

export interface UpdateVCSchemaDTO {
  name: string;
  schema: any;
  issuer_did: string;
  version: number;
}

export interface VCSchemaResponseDTO {
  message: string;
  schema_id?: string;
  schema?: any;
}
