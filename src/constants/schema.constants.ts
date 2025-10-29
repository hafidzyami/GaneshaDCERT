/**
 * Schema-related Constants
 */

export const SCHEMA_CONSTANTS = {
  // Schema name constraints
  NAME_MIN_LENGTH: 3,
  NAME_MAX_LENGTH: 255,

  // Version constraints
  INITIAL_VERSION: 1,
  MIN_VERSION: 1,

  // Validation messages
  MESSAGES: {
    CREATED: "VC Schema created successfully in database and blockchain",
    UPDATED: "VC Schema updated successfully in database and blockchain",
    DEACTIVATED: "VC Schema deactivated successfully",
    REACTIVATED: "VC Schema reactivated successfully",
    DELETED: "VC Schema deleted (deactivated) successfully",
    NOT_FOUND: "Schema not found",
    ALREADY_EXISTS: "Schema already exists",
    ALREADY_ACTIVE: "Schema is already active",
    ALREADY_INACTIVE: "Schema is already deactivated",
    BLOCKCHAIN_FAILED: "Blockchain operation failed",
  },

  // DID format
  DID_REGEX:
    /^(?:(?:did:dcert:[iu][a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})|[a-zA-Z0-9_-]{87})$/,
  DID_FORMAT_MESSAGE:
    "Invalid issuer DID format. Expected format: did:method:identifier",
} as const;

export const SCHEMA_ERRORS = {
  VALIDATION: {
    NAME_REQUIRED: "Schema name is required",
    NAME_LENGTH: `Schema name must be between ${SCHEMA_CONSTANTS.NAME_MIN_LENGTH} and ${SCHEMA_CONSTANTS.NAME_MAX_LENGTH} characters`,
    SCHEMA_REQUIRED: "Schema object is required",
    SCHEMA_MUST_BE_OBJECT: "Schema must be a valid JSON object",
    SCHEMA_TYPE_REQUIRED: "Schema must have a 'type' property",
    SCHEMA_PROPERTIES_REQUIRED:
      "Schema with type 'object' must have 'properties'",
    ISSUER_DID_REQUIRED: "Issuer DID is required",
    ISSUER_DID_INVALID: SCHEMA_CONSTANTS.DID_FORMAT_MESSAGE,
    ID_REQUIRED: "Schema ID is required",
    ID_INVALID_UUID: "Schema ID must be a valid UUID",
  },
  QUERY: {
    NAME_REQUIRED: "Schema name is required",
    ISSUER_DID_REQUIRED: "Issuer DID is required",
    ACTIVE_ONLY_INVALID: "activeOnly must be a boolean value (true or false)",
  },
} as const;
