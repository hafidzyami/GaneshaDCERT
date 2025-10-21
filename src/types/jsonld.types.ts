/**
 * JSON-LD Verifiable Credential Types
 * Based on W3C Verifiable Credentials Data Model 1.1
 * https://www.w3.org/TR/vc-data-model/
 */

/**
 * JSON-LD Context
 */
export type JsonLdContext = string | object | (string | object)[];

/**
 * JSON-LD Type
 */
export type JsonLdType = string | string[];

/**
 * Proof options for JSON-LD signatures
 */
export interface JsonLdProofOptions {
  type: string; // e.g., "Ed25519Signature2020", "RsaSignature2018"
  created: string; // ISO 8601 datetime
  verificationMethod: string; // DID URL
  proofPurpose: string; // e.g., "assertionMethod", "authentication"
  jws?: string; // JSON Web Signature
  proofValue?: string; // Base64 encoded signature
}

/**
 * Credential Subject
 */
export interface CredentialSubject {
  id?: string; // DID of the subject
  [key: string]: any; // Claims about the subject
}

/**
 * Credential Status (for revocation)
 */
export interface CredentialStatus {
  id: string; // URL to check status
  type: string; // e.g., "CredentialStatusList2017", "RevocationList2020Status"
}

/**
 * Evidence (supporting information)
 */
export interface Evidence {
  id?: string;
  type: JsonLdType;
  [key: string]: any;
}

/**
 * Terms of Use
 */
export interface TermsOfUse {
  id?: string;
  type: JsonLdType;
  [key: string]: any;
}

/**
 * Refresh Service
 */
export interface RefreshService {
  id: string; // URL to refresh the credential
  type: string; // e.g., "ManualRefreshService2018"
}

/**
 * W3C Verifiable Credential (JSON-LD format)
 */
export interface JsonLdVerifiableCredential {
  "@context": JsonLdContext;
  id?: string; // URI identifier for the credential
  type: JsonLdType;
  issuer: string | { id: string; [key: string]: any };
  issuanceDate: string; // ISO 8601 datetime
  expirationDate?: string; // ISO 8601 datetime
  credentialSubject: CredentialSubject | CredentialSubject[];
  credentialStatus?: CredentialStatus;
  evidence?: Evidence | Evidence[];
  termsOfUse?: TermsOfUse | TermsOfUse[];
  refreshService?: RefreshService;
  proof?: JsonLdProofOptions | JsonLdProofOptions[];
  [key: string]: any; // Allow additional properties
}

/**
 * W3C Verifiable Presentation (JSON-LD format)
 */
export interface JsonLdVerifiablePresentation {
  "@context": JsonLdContext;
  id?: string;
  type: JsonLdType;
  holder?: string; // DID of the holder
  verifiableCredential: JsonLdVerifiableCredential | JsonLdVerifiableCredential[];
  proof?: JsonLdProofOptions | JsonLdProofOptions[];
  [key: string]: any;
}

/**
 * Unsigned Credential (before signing)
 */
export type UnsignedCredential = Omit<JsonLdVerifiableCredential, "proof">;

/**
 * Unsigned Presentation (before signing)
 */
export type UnsignedPresentation = Omit<JsonLdVerifiablePresentation, "proof">;

/**
 * Credential Options for issuance
 */
export interface IssueCredentialOptions {
  credential: UnsignedCredential;
  suite: string; // Cryptographic suite to use
  purpose?: string; // Proof purpose (default: "assertionMethod")
  verificationMethod: string; // DID verification method
}

/**
 * Presentation Options for creation
 */
export interface CreatePresentationOptions {
  verifiableCredential: JsonLdVerifiableCredential | JsonLdVerifiableCredential[];
  holder: string; // DID of the holder
  id?: string;
  type?: JsonLdType;
  suite: string;
  challenge?: string; // Challenge for preventing replay attacks
  domain?: string; // Domain for preventing replay attacks
}

/**
 * Verification Result
 */
export interface VerificationResult {
  verified: boolean;
  error?: string;
  results?: any[];
}

/**
 * Standard W3C VC Contexts
 */
export const W3C_VC_CONTEXTS = {
  CREDENTIALS_V1: "https://www.w3.org/2018/credentials/v1",
  CREDENTIALS_V2: "https://www.w3.org/ns/credentials/v2",
  DID_V1: "https://www.w3.org/ns/did/v1",
  SECURITY_V1: "https://w3id.org/security/v1",
  SECURITY_V2: "https://w3id.org/security/v2",
  ED25519_V1: "https://w3id.org/security/suites/ed25519-2020/v1",
} as const;

/**
 * Standard VC Types
 */
export const VC_TYPES = {
  VERIFIABLE_CREDENTIAL: "VerifiableCredential",
  VERIFIABLE_PRESENTATION: "VerifiablePresentation",
} as const;

/**
 * Proof Types
 */
export const PROOF_TYPES = {
  ED25519_SIGNATURE_2020: "Ed25519Signature2020",
  ED25519_SIGNATURE_2018: "Ed25519Signature2018",
  RSA_SIGNATURE_2018: "RsaSignature2018",
  ECDSA_SECP256K1_SIGNATURE_2019: "EcdsaSecp256k1Signature2019",
  JSON_WEB_SIGNATURE_2020: "JsonWebSignature2020",
} as const;

/**
 * Proof Purposes
 */
export const PROOF_PURPOSES = {
  ASSERTION_METHOD: "assertionMethod",
  AUTHENTICATION: "authentication",
  KEY_AGREEMENT: "keyAgreement",
  CAPABILITY_INVOCATION: "capabilityInvocation",
  CAPABILITY_DELEGATION: "capabilityDelegation",
} as const;
