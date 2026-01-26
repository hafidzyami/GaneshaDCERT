/**
 * W3C DID Core Specification Types
 * Based on https://www.w3.org/TR/did-core/
 */

/**
 * Verification Method Types
 * https://www.w3.org/TR/did-spec-registries/#verification-method-types
 */
export type VerificationMethodType =
  | "EcdsaSecp256k1VerificationKey2019"
  | "Ed25519VerificationKey2018"
  | "Ed25519VerificationKey2020"
  | "Multikey"
  | "JsonWebKey2020";

/**
 * JSON Web Key
 * https://datatracker.ietf.org/doc/html/rfc7517
 */
export interface JWK {
  kty: string;
  crv?: string;
  x?: string;
  y?: string;
  n?: string;
  e?: string;
  kid?: string;
  use?: string;
  alg?: string;
}

/**
 * Verification Method
 * https://www.w3.org/TR/did-core/#verification-methods
 */
export interface VerificationMethod {
  id: string;
  type: VerificationMethodType;
  controller: string;
  publicKeyHex?: string;
  publicKeyMultibase?: string;
  publicKeyJwk?: JWK;
}

/**
 * Service Endpoint
 * https://www.w3.org/TR/did-core/#services
 */
export interface ServiceEndpoint {
  id: string;
  type: string;
  serviceEndpoint: string | string[] | Record<string, any>;
}

/**
 * W3C DID Document
 * https://www.w3.org/TR/did-core/#did-document-properties
 */
export interface DIDDocument {
  "@context": string | string[];
  id: string;
  controller?: string | string[];
  alsoKnownAs?: string[];
  verificationMethod?: VerificationMethod[];
  authentication?: (string | VerificationMethod)[];
  assertionMethod?: (string | VerificationMethod)[];
  keyAgreement?: (string | VerificationMethod)[];
  capabilityInvocation?: (string | VerificationMethod)[];
  capabilityDelegation?: (string | VerificationMethod)[];
  service?: ServiceEndpoint[];
}

/**
 * DID Document Metadata
 * https://www.w3.org/TR/did-core/#did-document-metadata
 */
export interface DIDDocumentMetadata {
  created?: string;
  updated?: string;
  deactivated?: boolean;
  versionId?: string;
  nextUpdate?: string;
  nextVersionId?: string;
  equivalentId?: string[];
  canonicalId?: string;
}

/**
 * DID Resolution Metadata
 * https://www.w3.org/TR/did-core/#did-resolution-metadata
 */
export interface DIDResolutionMetadata {
  contentType?: string;
  error?: string;
  retrieved?: string;
}

/**
 * DID Resolution Result
 * https://www.w3.org/TR/did-core/#did-resolution
 */
export interface DIDResolutionResult {
  didDocument: DIDDocument | null;
  didDocumentMetadata: DIDDocumentMetadata;
  didResolutionMetadata: DIDResolutionMetadata;
}

/**
 * Extended DID Document for DCert
 * Includes institutional details as service endpoints
 */
export interface DCertDIDDocument extends DIDDocument {
  // Institutional details stored as service endpoint
}

/**
 * DID Document Response (for API)
 */
export interface DIDDocumentResponse {
  success: boolean;
  didDocument: DIDDocument | null;
  didDocumentMetadata: DIDDocumentMetadata;
  didResolutionMetadata: DIDResolutionMetadata;
}

/**
 * DID Document Not Found Response
 */
export interface DIDDocumentNotFoundResponse {
  success: boolean;
  didDocument: null;
  didDocumentMetadata: DIDDocumentMetadata;
  didResolutionMetadata: {
    error: "notFound";
    retrieved: string;
  };
}

/**
 * JSON-LD Context for DID Documents
 */
export const DID_CONTEXT = {
  W3C_DID_V1: "https://www.w3.org/ns/did/v1",
  W3C_DID_V1_1: "https://www.w3.org/ns/did/v1.1",
  SECP256K1_2019: "https://w3id.org/security/suites/secp256k1-2019/v1",
  ED25519_2018: "https://w3id.org/security/suites/ed25519-2018/v1",
  ED25519_2020: "https://w3id.org/security/suites/ed25519-2020/v1",
  JWS_2020: "https://w3id.org/security/suites/jws-2020/v1",
} as const;
