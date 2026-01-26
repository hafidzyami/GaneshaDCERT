/**
 * Selective Disclosure Types for Verifiable Presentations
 * Uses DataIntegrityProof with ecdsa-rdfc-2019 cryptosuite
 * and hash-based commitments for hidden attributes
 */

import { JsonLdContext, JsonLdType } from "./jsonld.types";

// ============================================
// PREDICATE TYPES
// ============================================

/**
 * Supported predicate operators for range proofs
 */
export type PredicateOperator = ">" | "<" | ">=" | "<=" | "==" | "!=";

/**
 * Predicate condition for proving attribute relationships
 * without revealing actual values
 */
export interface PredicateCondition {
  operator: PredicateOperator;
  value: string | number;
}

/**
 * Result of a predicate proof verification
 */
export interface PredicateProofResult {
  attributePath: string;
  attributeName?: string;
  predicate: PredicateCondition;
  satisfied: boolean;
  proofValue: string;
}

// ============================================
// PRESENTATION REQUEST TYPES
// ============================================

/**
 * Requested attribute specification
 */
export interface RequestedAttribute {
  /** JSON path to the attribute (e.g., "credentialSubject.dateOfBirth") */
  attributePath: string;
  /** Human-readable attribute name */
  attributeName?: string;
  /** Whether this attribute is required */
  required: boolean;
  /** If true, accept a predicate proof instead of revealed value */
  acceptPredicate?: boolean;
}

/**
 * Requested predicate specification
 */
export interface RequestedPredicate {
  /** JSON path to the attribute */
  attributePath: string;
  /** Human-readable attribute name */
  attributeName?: string;
  /** Comparison operator */
  operator: PredicateOperator;
  /** Value to compare against */
  value: string | number;
  /** Whether this predicate is required */
  required: boolean;
}

/**
 * Selective disclosure presentation request
 * Sent by verifier to holder
 */
export interface SelectiveDisclosurePresentationRequest {
  /** Unique request identifier */
  requestId: string;
  /** DID of the verifier making the request */
  verifierDID: string;
  /** DID of the holder to present credentials */
  holderDID: string;
  /** Types of credentials requested */
  credentialTypes: string[];
  /** Purpose of the presentation */
  purpose: string;
  /** Random challenge for replay protection */
  challenge: string;
  /** Domain for replay protection */
  domain: string;
  /** Request expiration timestamp (ISO 8601) */
  expiresAt: string;
  /** Specific attributes to reveal (optional) */
  requestedAttributes?: RequestedAttribute[];
  /** Predicate proofs requested (optional) */
  requestedPredicates?: RequestedPredicate[];
}

// ============================================
// SELECTIVE DISCLOSURE VP TYPES
// ============================================

/**
 * DataIntegrityProof with ecdsa-rdfc-2019 cryptosuite
 */
export interface DataIntegrityProof {
  type: "DataIntegrityProof";
  cryptosuite: "ecdsa-rdfc-2019";
  created: string;
  verificationMethod: string;
  proofPurpose: string;
  proofValue: string;
  challenge?: string;
  domain?: string;
}

/**
 * Commitment for a hidden attribute
 */
export interface AttributeCommitment {
  /** Hash algorithm used (e.g., "SHA256") */
  algorithm: string;
  /** Hash commitment value (base64) */
  commitment: string;
  /** Attribute key name */
  key: string;
  /** Salt hash (base64) */
  saltHash: string;
}

/**
 * Selective Disclosure Proof for each credential
 */
export interface SelectiveDisclosureProof2024 {
  type: "SelectiveDisclosureProof2024";
  created: string;
  verificationMethod: string;
  proofPurpose: string;
  commitments: AttributeCommitment[];
  /** Hash of the full original credential */
  credentialHash: string;
  /** Hash of the disclosed attributes */
  disclosedAttributeHash: string;
  /** ECDSA signature proving the selective disclosure */
  proofValue: string;
}

/**
 * Selective disclosure info for each credential
 */
export interface SelectiveDisclosureCredentialInfo {
  /** VC identifier */
  vcId: string;
  /** List of disclosed attribute names */
  disclosedAttributes: string[];
  /** List of hidden attribute names */
  hiddenAttributes: string[];
  /** Commitments for hidden attributes */
  commitments: AttributeCommitment[];
  /** Proof of selective disclosure */
  selectiveProof: SelectiveDisclosureProof2024;
}

/**
 * Selective disclosure metadata in the VP
 */
export interface SelectiveDisclosureMetadata {
  credentials: SelectiveDisclosureCredentialInfo[];
  created: string;
  holder: string;
}

/**
 * Credential in the selective disclosure VP
 * Contains only revealed attributes
 */
export interface SelectiveDisclosureCredential {
  "@context": JsonLdContext;
  id?: string;
  type: JsonLdType;
  issuer: string | { id: string; name?: string };
  issuerName?: string;
  validFrom?: string;
  issuanceDate?: string;
  expiredAt?: string | null;
  expirationDate?: string;
  imageLink?: string;
  fileId?: string;
  fileUrl?: string;
  /** Contains ONLY revealed attributes */
  credentialSubject: {
    id?: string;
    [key: string]: any;
  };
  /** Original credential proof (DataIntegrityProof by issuer) */
  proof: DataIntegrityProof;
  /** Original credential ID for revocation check */
  credentialId?: string;
}

/**
 * Selective Disclosure Verifiable Presentation
 * Contains derived credentials with only requested attributes
 */
export interface SelectiveDisclosureVP {
  "@context": JsonLdContext;
  type: JsonLdType;
  holder: string;
  verifiableCredential: SelectiveDisclosureCredential[];
  /** Selective disclosure metadata */
  selectiveDisclosure: SelectiveDisclosureMetadata;
  /** Predicate proofs for hidden attributes (optional, at VP level) */
  predicateProofs?: PredicateProofResult[];
  /** VP proof (DataIntegrityProof by holder with challenge/domain) */
  proof: DataIntegrityProof;
}

// ============================================
// VERIFICATION TYPES
// ============================================

/**
 * Individual verification check results
 */
export interface VerificationChecks {
  /** VP proof is valid (DataIntegrityProof by holder) */
  vpProofValid: boolean;
  /** VC proof is valid (DataIntegrityProof by issuer) */
  vcProofValid: boolean;
  /** Selective disclosure proof is valid */
  selectiveProofValid: boolean;
  /** Issuer is trusted/registered */
  issuerTrusted: boolean;
  /** Credential not revoked on blockchain */
  credentialNotRevoked: boolean;
  /** Credential not expired */
  credentialNotExpired: boolean;
  /** Challenge matches request */
  challengeMatches: boolean;
  /** Domain matches request */
  domainMatches: boolean;
  /** All predicate proofs valid */
  predicatesValid: boolean;
  /** All required attributes present */
  requiredAttributesPresent: boolean;
}

/**
 * Revealed attribute information
 */
export interface RevealedAttribute {
  /** Attribute path in credential */
  path: string;
  /** Attribute name */
  name: string;
  /** Revealed value */
  value: any;
  /** Source credential index */
  credentialIndex: number;
}

/**
 * Complete verification result for selective disclosure VP
 */
export interface SelectiveDisclosureVerificationResult {
  /** Overall verification status */
  valid: boolean;
  /** Individual check results */
  checks: VerificationChecks;
  /** List of revealed attributes */
  revealedAttributes: RevealedAttribute[];
  /** Predicate proof results */
  predicateResults: PredicateProofResult[];
  /** Issuer DID */
  issuer: string;
  /** Holder DID */
  holder: string;
  /** Error messages if any */
  errors: string[];
}

// ============================================
// DATABASE/API TYPES
// ============================================

/**
 * DTO for creating selective disclosure request
 */
export interface CreateSelectiveDisclosureRequestDTO {
  holderDID: string;
  verifierDID: string;
  verifierName: string;
  credentialTypes: string[];
  purpose: string;
  domain: string;
  expiresIn?: number; // seconds until expiration
  requestedAttributes?: RequestedAttribute[];
  requestedPredicates?: RequestedPredicate[];
}

/**
 * DTO for submitting selective disclosure VP
 */
export interface SubmitSelectiveDisclosureVPDTO {
  requestId: string;
  selectiveVP: string; // JSON stringified SelectiveDisclosureVP
}

/**
 * Response for selective disclosure request
 */
export interface SelectiveDisclosureRequestResponse {
  requestId: string;
  challenge: string;
  domain: string;
  expiresAt: string;
  status: "PENDING" | "ACCEPT" | "DECLINE" | "EXPIRED";
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Supported proof types
 */
export const SD_PROOF_TYPES = {
  DATA_INTEGRITY_PROOF: "DataIntegrityProof",
  SELECTIVE_DISCLOSURE_PROOF_2024: "SelectiveDisclosureProof2024",
} as const;

/**
 * Supported cryptosuites
 */
export const CRYPTOSUITES = {
  ECDSA_RDFC_2019: "ecdsa-rdfc-2019",
} as const;

/**
 * Selective Disclosure VP Type
 */
export const SELECTIVE_DISCLOSURE_VP_TYPE = [
  "VerifiablePresentation",
  "SelectiveDisclosurePresentation",
] as const;

/**
 * Default expiration time for requests (15 minutes)
 */
export const DEFAULT_REQUEST_EXPIRATION_SECONDS = 900;

/**
 * Maximum expiration time for requests (1 hour)
 */
export const MAX_REQUEST_EXPIRATION_SECONDS = 3600;
