import { BadRequestError } from "./errors/AppError";
import logger from "../config/logger";

/**
 * Interface for parsed VCID components
 */
export interface ParsedVCID {
  schemaId: string;
  version: string;
  holderDid: string;
  timestamp: string;
}

/**
 * Extract components from VCID
 * @param vcId - VCID in format: schema_id:version:holder_did:timestamp
 * @returns Object containing schemaId, version, holderDid, and timestamp
 * @throws BadRequestError if VCID format is invalid
 * 
 * @example
 * const result = extractVCID("schema123:v1.0:did:example:123:1234567890");
 * // Returns: { schemaId: "schema123", version: "v1.0", holderDid: "did:example:123", timestamp: "1234567890" }
 */
export function extractVCID(vcId: string): ParsedVCID {
  logger.info(`Extracting components from VCID: ${vcId}`);

  const parts = vcId.split(":");

  if (parts.length < 4) {
    logger.error(
      `Invalid VCID format: ${vcId}. Expected format: schema_id:version:holder_did:timestamp`
    );
    throw new BadRequestError(
      `Invalid VCID format. Expected format: schema_id:version:holder_did:timestamp`
    );
  }

  const schemaId = parts[0];
  const version = parts[1];
  const holderDid = parts[2];
  const timestamp = parts[3];

  logger.info(
    `Extracted from VCID - Schema ID: ${schemaId}, Version: ${version}, Holder DID: ${holderDid}, Timestamp: ${timestamp}`
  );

  return {
    schemaId,
    version,
    holderDid,
    timestamp,
  };
}

/**
 * Extract only schemaId and holderDid from VCID (backward compatibility)
 * @param vcId - VCID in format: schema_id:version:holder_did:timestamp
 * @returns Object containing schemaId and holderDid
 */
export function extractSchemaAndHolder(
  vcId: string
): { schemaId: string; holderDid: string } {
  const { schemaId, holderDid } = extractVCID(vcId);
  return { schemaId, holderDid };
}
