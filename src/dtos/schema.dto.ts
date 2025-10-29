import { Prisma } from "@prisma/client";

/**
 * Schema DTOs (Data Transfer Objects)
 * Clean separation between request/response structures
 */

// ============================================
// 🔹 REQUEST DTOs
// ============================================

/**
 * DTO for creating a new VC Schema
 */
export interface CreateVCSchemaDTO {
  name: string;
  schema: Prisma.JsonValue;
  issuer_did: string;
}

/**
 * DTO for updating an existing VC Schema
 */
export interface UpdateVCSchemaDTO {
  schema: Prisma.JsonValue;
}

/**
 * DTO for filtering schemas
 */
export interface SchemaFilterDTO {
  issuerDid?: string;
  isActive?: boolean;
}

/**
 * DTO for getting schema by name
 */
export interface SchemaByNameDTO {
  name: string;
  issuerDid: string;
}

// ============================================
// 🔹 RESPONSE DTOs
// ============================================

/**
 * DTO for schema response (matches Prisma model)
 */
export interface VCSchemaDTO {
  id: string;
  name: string;
  schema: Prisma.JsonValue;
  issuer_did: string;
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DTO for schema operation response with blockchain info
 */
export interface VCSchemaOperationResponseDTO {
  message: string;
  schema: VCSchemaDTO;
  transaction_hash?: string;
}

/**
 * DTO for schema list response
 */
export interface VCSchemaListResponseDTO {
  count: number;
  data: VCSchemaDTO[];
}

/**
 * DTO for schema active status check
 */
export interface SchemaActiveStatusDTO {
  id: string;
  version: number;
  isActive: boolean;
}

/**
 * DTO for delete operation response
 */
export interface SchemaDeleteResponseDTO {
  message: string;
  transaction_hash?: string;
}
