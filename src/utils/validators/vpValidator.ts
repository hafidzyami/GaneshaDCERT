/**
 * VP (Verifiable Presentation) Validator
 * Validates VP and VC structures according to W3C VC Data Model specification
 * Reference: https://www.w3.org/TR/vc-data-model/
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  details?: any;
}

/**
 * Validates VP structure according to W3C VC Data Model
 * 
 * Required fields:
 * - @context (must include https://www.w3.org/2018/credentials/v1)
 * - type (must include VerifiablePresentation)
 * - verifiableCredential (array of VCs)
 * - proof (cryptographic proof)
 * 
 * @param vp - The VP object to validate
 * @returns Validation result
 */
export function validateVPStructure(vp: any): ValidationResult {
  // Check if VP exists
  if (!vp || typeof vp !== "object") {
    return {
      isValid: false,
      error: "VP must be an object",
    };
  }

  // Validate @context
  if (!vp["@context"]) {
    return {
      isValid: false,
      error: "VP must have @context property",
    };
  }

  const contexts = Array.isArray(vp["@context"])
    ? vp["@context"]
    : [vp["@context"]];

  if (!contexts.includes("https://www.w3.org/2018/credentials/v1")) {
    return {
      isValid: false,
      error: "@context must include https://www.w3.org/2018/credentials/v1",
    };
  }

  // Validate type
  if (!vp.type) {
    return {
      isValid: false,
      error: "VP must have type property",
    };
  }

  const types = Array.isArray(vp.type) ? vp.type : [vp.type];

  if (!types.includes("VerifiablePresentation")) {
    return {
      isValid: false,
      error: "VP type must include VerifiablePresentation",
    };
  }

  // Validate verifiableCredential
  if (!vp.verifiableCredential) {
    return {
      isValid: false,
      error: "VP must have verifiableCredential property",
    };
  }

  if (!Array.isArray(vp.verifiableCredential)) {
    return {
      isValid: false,
      error: "verifiableCredential must be an array",
    };
  }

  if (vp.verifiableCredential.length === 0) {
    return {
      isValid: false,
      error: "VP must contain at least one verifiable credential",
    };
  }

  // Validate proof (optional but recommended for verification)
  if (vp.proof) {
    const proofValidation = validateProof(vp.proof);
    if (!proofValidation.isValid) {
      return {
        isValid: false,
        error: `VP proof validation failed: ${proofValidation.error}`,
        details: proofValidation.details,
      };
    }
  }

  // Validate holder (optional but recommended)
  if (vp.holder) {
    if (typeof vp.holder !== "string") {
      return {
        isValid: false,
        error: "holder must be a string (DID)",
      };
    }
  }

  return {
    isValid: true,
  };
}

/**
 * Validates VC structure according to W3C VC Data Model
 * 
 * @param vc - The VC object to validate
 * @returns Validation result
 */
export function validateVCStructure(vc: any): ValidationResult {
  // Check if VC exists
  if (!vc || typeof vc !== "object") {
    return {
      isValid: false,
      error: "VC must be an object",
    };
  }

  // Validate @context
  if (!vc["@context"]) {
    return {
      isValid: false,
      error: "VC must have @context property",
    };
  }

  const contexts = Array.isArray(vc["@context"])
    ? vc["@context"]
    : [vc["@context"]];

  if (!contexts.includes("https://www.w3.org/2018/credentials/v1")) {
    return {
      isValid: false,
      error: "@context must include https://www.w3.org/2018/credentials/v1",
    };
  }

  // Validate type
  if (!vc.type) {
    return {
      isValid: false,
      error: "VC must have type property",
    };
  }

  const types = Array.isArray(vc.type) ? vc.type : [vc.type];

  if (!types.includes("VerifiableCredential")) {
    return {
      isValid: false,
      error: "VC type must include VerifiableCredential",
    };
  }

  // Validate credentialSubject
  if (!vc.credentialSubject) {
    return {
      isValid: false,
      error: "VC must have credentialSubject property",
    };
  }

  if (typeof vc.credentialSubject !== "object") {
    return {
      isValid: false,
      error: "credentialSubject must be an object",
    };
  }

  // Validate issuer
  if (!vc.issuer) {
    return {
      isValid: false,
      error: "VC must have issuer property",
    };
  }

  if (typeof vc.issuer !== "string" && typeof vc.issuer !== "object") {
    return {
      isValid: false,
      error: "issuer must be a string (DID) or object",
    };
  }

  // Validate issuanceDate
  if (!vc.issuanceDate) {
    return {
      isValid: false,
      error: "VC must have issuanceDate property",
    };
  }

  if (!isValidDateString(vc.issuanceDate)) {
    return {
      isValid: false,
      error: "issuanceDate must be a valid ISO 8601 date string",
    };
  }

  // Validate expirationDate (optional)
  if (vc.expirationDate && !isValidDateString(vc.expirationDate)) {
    return {
      isValid: false,
      error: "expirationDate must be a valid ISO 8601 date string",
    };
  }

  // Validate proof
  if (vc.proof) {
    const proofValidation = validateProof(vc.proof);
    if (!proofValidation.isValid) {
      return {
        isValid: false,
        error: `VC proof validation failed: ${proofValidation.error}`,
        details: proofValidation.details,
      };
    }
  }

  return {
    isValid: true,
  };
}

/**
 * Validates all VCs within a VP
 * 
 * @param vcs - Array of VC objects
 * @returns Validation result
 */
export function validateVCsInVP(vcs: any[]): ValidationResult {
  if (!Array.isArray(vcs)) {
    return {
      isValid: false,
      error: "VCs must be an array",
    };
  }

  if (vcs.length === 0) {
    return {
      isValid: false,
      error: "VP must contain at least one VC",
    };
  }

  const invalidVCs: any[] = [];

  for (let i = 0; i < vcs.length; i++) {
    const vcValidation = validateVCStructure(vcs[i]);
    if (!vcValidation.isValid) {
      invalidVCs.push({
        index: i,
        error: vcValidation.error,
        vcId: vcs[i].id || `VC at index ${i}`,
      });
    }
  }

  if (invalidVCs.length > 0) {
    return {
      isValid: false,
      error: `${invalidVCs.length} VC(s) failed validation`,
      details: { invalidVCs },
    };
  }

  return {
    isValid: true,
  };
}

/**
 * Validates that VP holder matches the expected DID
 * 
 * @param vp - The VP object
 * @param expectedHolderDID - The expected holder DID
 * @returns Validation result
 */
export function validateVPHolder(
  vp: any,
  expectedHolderDID: string
): ValidationResult {
  if (!vp.holder) {
    return {
      isValid: false,
      error: "VP does not have a holder property",
    };
  }

  if (vp.holder !== expectedHolderDID) {
    return {
      isValid: false,
      error: "VP holder does not match expected holder DID",
      details: {
        expected: expectedHolderDID,
        actual: vp.holder,
      },
    };
  }

  return {
    isValid: true,
  };
}

/**
 * Validates that VP contains the requested schemas
 * 
 * @param vp - The VP object
 * @param requestedSchemas - Array of requested schema IDs
 * @returns Validation result
 */
export function validateRequestedSchemas(
  vp: any,
  requestedSchemas: string[]
): ValidationResult {
  if (!vp.verifiableCredential || vp.verifiableCredential.length === 0) {
    return {
      isValid: false,
      error: "VP contains no verifiable credentials",
    };
  }

  // Extract schema IDs from VCs
  const vcSchemas = new Set<string>();
  for (const vc of vp.verifiableCredential) {
    // Schema could be in credentialSchema or in type
    if (vc.credentialSchema) {
      const schemaId = typeof vc.credentialSchema === "string"
        ? vc.credentialSchema
        : vc.credentialSchema.id;
      if (schemaId) {
        vcSchemas.add(schemaId);
      }
    }

    // Also check types (excluding VerifiableCredential)
    if (vc.type) {
      const types = Array.isArray(vc.type) ? vc.type : [vc.type];
      types
        .filter((t: string) => t !== "VerifiableCredential")
        .forEach((t: string) => vcSchemas.add(t));
    }
  }

  // Check if all requested schemas are present
  const missingSchemas: string[] = [];
  for (const requestedSchema of requestedSchemas) {
    if (!vcSchemas.has(requestedSchema)) {
      missingSchemas.push(requestedSchema);
    }
  }

  if (missingSchemas.length > 0) {
    return {
      isValid: false,
      error: "VP is missing required credential types",
      details: {
        missingSchemas,
        presentSchemas: Array.from(vcSchemas),
      },
    };
  }

  return {
    isValid: true,
  };
}

/**
 * Validates proof structure
 * 
 * @param proof - The proof object
 * @returns Validation result
 */
function validateProof(proof: any): ValidationResult {
  if (!proof || typeof proof !== "object") {
    return {
      isValid: false,
      error: "Proof must be an object",
    };
  }

  // Validate type
  if (!proof.type) {
    return {
      isValid: false,
      error: "Proof must have type property",
    };
  }

  if (typeof proof.type !== "string") {
    return {
      isValid: false,
      error: "Proof type must be a string",
    };
  }

  // Validate created
  if (!proof.created) {
    return {
      isValid: false,
      error: "Proof must have created property",
    };
  }

  if (!isValidDateString(proof.created)) {
    return {
      isValid: false,
      error: "Proof created must be a valid ISO 8601 date string",
    };
  }

  // Validate verificationMethod
  if (!proof.verificationMethod) {
    return {
      isValid: false,
      error: "Proof must have verificationMethod property",
    };
  }

  if (typeof proof.verificationMethod !== "string") {
    return {
      isValid: false,
      error: "verificationMethod must be a string",
    };
  }

  // Validate proof value (at least one should be present)
  const hasProofValue =
    proof.proofValue || proof.jws || proof.signature || proof.signatureValue;

  if (!hasProofValue) {
    return {
      isValid: false,
      error:
        "Proof must have at least one of: proofValue, jws, signature, or signatureValue",
    };
  }

  return {
    isValid: true,
  };
}

/**
 * Checks if a string is a valid ISO 8601 date
 * 
 * @param dateString - The date string to validate
 * @returns Boolean indicating validity
 */
function isValidDateString(dateString: string): boolean {
  if (typeof dateString !== "string") {
    return false;
  }

  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Validates VP for selective disclosure requirements
 * Ensures VP doesn't expose more information than requested
 * 
 * @param vp - The VP object
 * @param requestedAttributes - Optional array of requested attribute names
 * @returns Validation result
 */
export function validateSelectiveDisclosure(
  vp: any,
  requestedAttributes?: string[]
): ValidationResult {
  if (!requestedAttributes || requestedAttributes.length === 0) {
    // No selective disclosure requirements
    return {
      isValid: true,
    };
  }

  // Check each VC in the VP
  for (const vc of vp.verifiableCredential) {
    if (!vc.credentialSubject) {
      continue;
    }

    const exposedAttributes = Object.keys(vc.credentialSubject).filter(
      (key) => key !== "id"
    );

    // Check if any exposed attributes are not in requested list
    const unexposedAttributes = exposedAttributes.filter(
      (attr) => !requestedAttributes.includes(attr)
    );

    if (unexposedAttributes.length > 0) {
      return {
        isValid: false,
        error: "VP exposes attributes that were not requested",
        details: {
          unexposedAttributes,
          requestedAttributes,
        },
      };
    }
  }

  return {
    isValid: true,
  };
}
