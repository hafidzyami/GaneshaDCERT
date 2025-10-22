/**
 * JSON-LD Verifiable Credential Utilities
 * Helper functions for working with W3C VC Data Model
 */

import {
  JsonLdVerifiableCredential,
  UnsignedCredential,
  CredentialSubject,
  W3C_VC_CONTEXTS,
  VC_TYPES,
  PROOF_PURPOSES,
} from "../../types/jsonld.types";
import { v4 as uuidv4 } from "uuid";

/**
 * JSON-LD VC Helper Class
 */
export class JsonLdVCHelper {
  /**
   * Create default context array
   */
  static createDefaultContext(
    additionalContexts: (string | object)[] = []
  ): any[] {
    return [W3C_VC_CONTEXTS.CREDENTIALS_V1, ...additionalContexts];
  }

  /**
   * Create credential ID (URI)
   */
  static createCredentialId(prefix: string = "urn:uuid"): string {
    return `${prefix}:${uuidv4()}`;
  }

  /**
   * Format date to ISO 8601
   */
  static formatDate(date: Date = new Date()): string {
    return date.toISOString();
  }

  /**
   * Create unsigned credential
   */
  static createUnsignedCredential(params: {
    type: string | string[];
    issuer: string;
    credentialSubject: CredentialSubject | CredentialSubject[];
    additionalContexts?: (string | object)[];
    expirationDate?: Date;
    credentialStatus?: any;
    evidence?: any;
  }): UnsignedCredential {
    const types = Array.isArray(params.type)
      ? [VC_TYPES.VERIFIABLE_CREDENTIAL, ...params.type]
      : [VC_TYPES.VERIFIABLE_CREDENTIAL, params.type];

    const credential: UnsignedCredential = {
      "@context": this.createDefaultContext(params.additionalContexts || []),
      id: this.createCredentialId(),
      type: types,
      issuer: params.issuer,
      issuanceDate: this.formatDate(),
      credentialSubject: params.credentialSubject,
    };

    // Add optional fields
    if (params.expirationDate) {
      credential.expirationDate = this.formatDate(params.expirationDate);
    }

    if (params.credentialStatus) {
      credential.credentialStatus = params.credentialStatus;
    }

    if (params.evidence) {
      credential.evidence = params.evidence;
    }

    return credential;
  }

  /**
   * Validate credential structure
   */
  static validateCredentialStructure(credential: any): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Required fields
    if (!credential["@context"]) {
      errors.push("Missing required field: @context");
    }

    if (!credential.type) {
      errors.push("Missing required field: type");
    } else if (
      Array.isArray(credential.type) &&
      !credential.type.includes(VC_TYPES.VERIFIABLE_CREDENTIAL)
    ) {
      errors.push("type must include 'VerifiableCredential'");
    }

    if (!credential.issuer) {
      errors.push("Missing required field: issuer");
    }

    if (!credential.issuanceDate) {
      errors.push("Missing required field: issuanceDate");
    }

    if (!credential.credentialSubject) {
      errors.push("Missing required field: credentialSubject");
    }

    // Validate date format
    if (credential.issuanceDate) {
      try {
        new Date(credential.issuanceDate);
      } catch (e) {
        errors.push("Invalid issuanceDate format");
      }
    }

    if (credential.expirationDate) {
      try {
        const expDate = new Date(credential.expirationDate);
        const issueDate = new Date(credential.issuanceDate);
        if (expDate <= issueDate) {
          errors.push("expirationDate must be after issuanceDate");
        }
      } catch (e) {
        errors.push("Invalid expirationDate format");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if credential is expired
   */
  static isExpired(credential: JsonLdVerifiableCredential): boolean {
    if (!credential.expirationDate) {
      return false; // No expiration date means never expires
    }

    const now = new Date();
    const expDate = new Date(credential.expirationDate);
    return now > expDate;
  }

  /**
   * Extract credential subject DID
   */
  static getSubjectDID(credential: JsonLdVerifiableCredential): string | null {
    const subject = Array.isArray(credential.credentialSubject)
      ? credential.credentialSubject[0]
      : credential.credentialSubject;

    return subject.id || null;
  }

  /**
   * Extract issuer DID
   */
  static getIssuerDID(credential: JsonLdVerifiableCredential): string {
    return typeof credential.issuer === "string"
      ? credential.issuer
      : credential.issuer.id;
  }

  /**
   * Create credential status (for revocation)
   */
  static createCredentialStatus(params: {
    statusListCredential: string;
    statusListIndex: number;
  }): any {
    return {
      id: `${params.statusListCredential}#${params.statusListIndex}`,
      type: "StatusList2021Entry",
      statusPurpose: "revocation",
      statusListIndex: params.statusListIndex.toString(),
      statusListCredential: params.statusListCredential,
    };
  }

  /**
   * Prepare credential for blockchain storage
   * (Remove proof, keep only essential data)
   */
  static prepareForBlockchain(credential: JsonLdVerifiableCredential): {
    id: string;
    type: string[];
    issuer: string;
    subject: string;
    issuanceDate: string;
    expirationDate?: string;
    hash: string; // Hash of the entire credential
  } {
    return {
      id: credential.id || "",
      type: Array.isArray(credential.type)
        ? credential.type
        : [credential.type],
      issuer: this.getIssuerDID(credential),
      subject: this.getSubjectDID(credential) || "",
      issuanceDate: credential.issuanceDate,
      expirationDate: credential.expirationDate,
      hash: this.hashCredential(credential),
    };
  }

  /**
   * Hash credential for integrity verification
   * Note: In production, use proper hashing library
   */
  static hashCredential(credential: JsonLdVerifiableCredential): string {
    const crypto = require("crypto");
    const credentialString = JSON.stringify(credential, null, 0);
    return crypto.createHash("sha256").update(credentialString).digest("hex");
  }

  /**
   * Compare two credentials for equality
   */
  static areCredentialsEqual(
    cred1: JsonLdVerifiableCredential,
    cred2: JsonLdVerifiableCredential
  ): boolean {
    return this.hashCredential(cred1) === this.hashCredential(cred2);
  }

  /**
   * Filter credential by type
   */
  static hasType(
    credential: JsonLdVerifiableCredential,
    type: string
  ): boolean {
    const types = Array.isArray(credential.type)
      ? credential.type
      : [credential.type];
    return types.includes(type);
  }

  /**
   * Get credential age in days
   */
  static getAgeInDays(credential: JsonLdVerifiableCredential): number {
    const now = new Date();
    const issuanceDate = new Date(credential.issuanceDate);
    const diffTime = Math.abs(now.getTime() - issuanceDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
}

/**
 * Example credential templates
 */
export const CREDENTIAL_TEMPLATES = {
  /**
   * University Diploma Credential
   */
  DIPLOMA: (params: {
    issuerDID: string;
    holderDID: string;
    studentName: string;
    degree: string;
    major: string;
    graduationDate: string;
    gpa: number;
  }) => {
    return JsonLdVCHelper.createUnsignedCredential({
      type: "UniversityDegreeCredential",
      issuer: params.issuerDID,
      credentialSubject: {
        id: params.holderDID,
        degree: {
          type: params.degree,
          name: `${params.degree} of ${params.major}`,
        },
        studentName: params.studentName,
        major: params.major,
        graduationDate: params.graduationDate,
        gpa: params.gpa,
      },
      additionalContexts: [
        {
          UniversityDegreeCredential:
            "https://example.edu/contexts/degree-v1.jsonld",
        },
      ],
    });
  },

  /**
   * Employment Credential
   */
  EMPLOYMENT: (params: {
    issuerDID: string;
    holderDID: string;
    employeeName: string;
    position: string;
    startDate: string;
    endDate?: string;
    department: string;
  }) => {
    return JsonLdVCHelper.createUnsignedCredential({
      type: "EmploymentCredential",
      issuer: params.issuerDID,
      credentialSubject: {
        id: params.holderDID,
        employeeName: params.employeeName,
        position: params.position,
        startDate: params.startDate,
        ...(params.endDate && { endDate: params.endDate }),
        department: params.department,
      },
      additionalContexts: [
        {
          EmploymentCredential:
            "https://example.com/contexts/employment-v1.jsonld",
        },
      ],
    });
  },

  /**
   * Certificate of Achievement
   */
  CERTIFICATE: (params: {
    issuerDID: string;
    holderDID: string;
    recipientName: string;
    achievementName: string;
    achievementDate: string;
    description: string;
  }) => {
    return JsonLdVCHelper.createUnsignedCredential({
      type: "CertificateOfAchievement",
      issuer: params.issuerDID,
      credentialSubject: {
        id: params.holderDID,
        recipientName: params.recipientName,
        achievement: {
          name: params.achievementName,
          description: params.description,
          achievementDate: params.achievementDate,
        },
      },
    });
  },
};
