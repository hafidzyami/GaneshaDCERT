/**
 * Selective Disclosure Types for ZKP-based Verifiable Presentations
 * Uses BBS+ signatures for selective attribute disclosure
 * Based on W3C VC Data Integrity BBS Cryptosuites
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
  attributeName: string;
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
 * BBS+ selective disclosure proof
 */
export interface BBSSelectiveDisclosureProof {
  type: "BBS+SelectiveDisclosure2023";
  created: string;
  verificationMethod: string;
  proofPurpose: string;
  challenge: string;
  domain: string;
  /** BBS+ derived proof value (multibase encoded) */
  proofValue: string;
  /** Nonce used in proof generation */
  nonce?: string;
}

/**
 * Credential with selective disclosure
 * Contains only revealed attributes and predicate proofs
 */
export interface SelectiveDisclosureCredential {
  "@context": JsonLdContext;
  type: JsonLdType;
  issuer: string | { id: string; name?: string };
  issuanceDate: string;
  expirationDate?: string;
  /** Contains ONLY revealed attributes */
  credentialSubject: {
    id?: string;
    [key: string]: any;
  };
  /** Predicate proofs for hidden attributes */
  predicateProofs?: PredicateProofResult[];
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
  proof: BBSSelectiveDisclosureProof;
}

// ============================================
// VERIFICATION TYPES
// ============================================

/**
 * Individual verification check results
 */
export interface VerificationChecks {
  /** BBS+ derived proof is valid */
  bbsProofValid: boolean;
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
// BBS+ KEY TYPES
// ============================================

/**
 * BBS+ public key for verification
 */
export interface BBSPublicKey {
  /** Key ID from DID document */
  id: string;
  /** Public key in multibase format */
  publicKeyMultibase: string;
  /** Controller DID */
  controller: string;
}

/**
 * BBS+ verification context
 */
export interface BBSVerificationContext {
  /** Issuer's BBS+ public key */
  publicKey: BBSPublicKey;
  /** Original credential schema/structure */
  credentialSchema?: any;
  /** Challenge from request */
  challenge: string;
  /** Domain from request */
  domain: string;
}

// ============================================
// CONSTANTS
// ============================================

/**
 * BBS+ Proof Types
 */
export const BBS_PROOF_TYPES = {
  BBS_SIGNATURE_2023: "BBS+Signature2023",
  BBS_SELECTIVE_DISCLOSURE_2023: "BBS+SelectiveDisclosure2023",
  BBS_PROOF_2023: "BBS+Proof2023",
} as const;

/**
 * BBS+ Contexts
 */
export const BBS_CONTEXTS = {
  BBS_V1: "https://w3id.org/security/bbs/v1",
  DATA_INTEGRITY_V2: "https://w3id.org/security/data-integrity/v2",
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
