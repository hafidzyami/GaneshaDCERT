/**
 * DID Validator
 * Validates DID strings according to W3C DID specification
 * Reference: https://www.w3.org/TR/did-core/
 */

export interface DIDValidationResult {
  isValid: boolean;
  error?: string;
  parsed?: {
    method: string;
    identifier: string;
    fragment?: string;
  };
}

/**
 * Validates a DID string format
 * Format: did:method:identifier or did:method:identifier#fragment
 * 
 * @param didString - The DID string to validate
 * @returns Validation result with parsed components
 */
export function validateDIDFormat(didString: string): DIDValidationResult {
  // Check if DID string is provided
  if (!didString || typeof didString !== "string") {
    return {
      isValid: false,
      error: "DID string is required and must be a string",
    };
  }

  // Trim whitespace
  const trimmedDID = didString.trim();

  // Check minimum length (did:x:y = 7 chars minimum)
  if (trimmedDID.length < 7) {
    return {
      isValid: false,
      error: "DID string is too short",
    };
  }

  // Must start with "did:"
  if (!trimmedDID.startsWith("did:")) {
    return {
      isValid: false,
      error: 'DID must start with "did:"',
    };
  }

  // Split by colon to get components
  const parts = trimmedDID.split(":");
  if (parts.length < 3) {
    return {
      isValid: false,
      error: "DID must have format: did:method:identifier",
    };
  }

  const method = parts[1];
  const identifierWithFragment = parts.slice(2).join(":");

  // Validate method name
  if (!method || method.length === 0) {
    return {
      isValid: false,
      error: "DID method cannot be empty",
    };
  }

  // Method name must be lowercase alphanumeric
  if (!/^[a-z0-9]+$/.test(method)) {
    return {
      isValid: false,
      error: "DID method must be lowercase alphanumeric",
    };
  }

  // Check for fragment
  let identifier = identifierWithFragment;
  let fragment: string | undefined;

  if (identifierWithFragment.includes("#")) {
    const fragmentParts = identifierWithFragment.split("#");
    identifier = fragmentParts[0];
    fragment = fragmentParts[1];

    if (!fragment || fragment.length === 0) {
      return {
        isValid: false,
        error: "Fragment cannot be empty if # is present",
      };
    }
  }

  // Validate identifier
  if (!identifier || identifier.length === 0) {
    return {
      isValid: false,
      error: "DID identifier cannot be empty",
    };
  }

  // Identifier can contain alphanumeric, dots, hyphens, underscores
  if (!/^[a-zA-Z0-9._-]+$/.test(identifier)) {
    return {
      isValid: false,
      error: "DID identifier contains invalid characters",
    };
  }

  return {
    isValid: true,
    parsed: {
      method,
      identifier,
      fragment,
    },
  };
}

/**
 * Validates a public key format (hex string)
 * 
 * @param publicKey - The public key to validate
 * @returns Boolean indicating if valid
 */
export function validatePublicKey(publicKey: string): boolean {
  if (!publicKey || typeof publicKey !== "string") {
    return false;
  }

  const trimmed = publicKey.trim();

  // Allow with or without 0x prefix
  const keyWithoutPrefix = trimmed.startsWith("0x")
    ? trimmed.slice(2)
    : trimmed;

  // Must be valid hex and reasonable length (64-132 chars for common keys)
  const isValidHex = /^[0-9a-fA-F]+$/.test(keyWithoutPrefix);
  const hasValidLength =
    keyWithoutPrefix.length >= 64 && keyWithoutPrefix.length <= 132;

  return isValidHex && hasValidLength;
}

/**
 * Validates a role string
 * 
 * @param role - The role to validate
 * @returns Boolean indicating if valid
 */
export function validateRole(role: string): boolean {
  const validRoles = ["holder", "issuer", "verifier"];
  return validRoles.includes(role.toLowerCase());
}

/**
 * Validates iteration number for key rotation
 * 
 * @param iteration - The iteration number
 * @returns Object with validation result and error message if invalid
 */
export function validateIterationNumber(iteration: number): {
  isValid: boolean;
  error?: string;
} {
  if (typeof iteration !== "number") {
    return {
      isValid: false,
      error: "Iteration number must be a number",
    };
  }

  if (!Number.isInteger(iteration)) {
    return {
      isValid: false,
      error: "Iteration number must be an integer",
    };
  }

  if (iteration < 1) {
    return {
      isValid: false,
      error: "Iteration number must be at least 1",
    };
  }

  if (iteration > 1000000) {
    return {
      isValid: false,
      error: "Iteration number is unreasonably large",
    };
  }

  return { isValid: true };
}
