/**
 * Blockchain Helper Utilities
 * Conversion functions for optimized PaymentManager.sol contract
 *
 * Converts between:
 * - string ↔ bytes32
 * - number ↔ uint248
 * - string[] ↔ bytes32[]
 */

import { ethers } from 'ethers';
import logger from '../config/logger';

/**
 * Convert short string to bytes32 (padded with zeros)
 * Max 31 characters for UTF-8 strings
 *
 * @param str - String to convert (max 31 bytes)
 * @returns bytes32 hex string
 * @throws Error if string is too long
 *
 * @example
 * stringToBytes32("IDR") // "0x4944520000000000000000000000000000000000000000000000000000000000"
 */
export function stringToBytes32(str: string): string {
  try {
    // Check length in bytes
    const byteLength = Buffer.from(str, 'utf-8').length;
    if (byteLength > 31) {
      throw new Error(`String too long: "${str}" (${byteLength} bytes, max 31 bytes)`);
    }

    // Convert to bytes32
    return ethers.encodeBytes32String(str);
  } catch (error: any) {
    logger.error(`[BlockchainHelper] Failed to convert string to bytes32:`, {
      str,
      error: error.message
    });
    throw error;
  }
}

/**
 * Convert bytes32 back to string (removes padding)
 *
 * @param bytes32 - bytes32 hex string
 * @returns Original string (trimmed)
 *
 * @example
 * bytes32ToString("0x4944520000...") // "IDR"
 */
export function bytes32ToString(bytes32: string): string {
  try {
    return ethers.decodeBytes32String(bytes32);
  } catch (error: any) {
    logger.error(`[BlockchainHelper] Failed to convert bytes32 to string:`, {
      bytes32,
      error: error.message
    });
    throw error;
  }
}

/**
 * Convert invoice/order ID to bytes32
 * For IDs longer than 31 chars, uses keccak256 hash
 * For short IDs, uses padding
 *
 * @param id - Invoice or order ID
 * @param forceHash - Force hashing even for short strings
 * @returns bytes32 hex string
 *
 * @example
 * // Short ID - uses padding
 * invoiceToBytes32("INV-12345") // Padded bytes32
 *
 * // Long ID - uses hash
 * invoiceToBytes32("INV-550e8400-e29b-41d4-a716-446655440000-1234567890") // keccak256 hash
 */
export function invoiceToBytes32(id: string, forceHash: boolean = false): string {
  try {
    const byteLength = Buffer.from(id, 'utf-8').length;

    // For long IDs or forced hash, use keccak256
    if (byteLength > 31 || forceHash) {
      const hash = ethers.keccak256(ethers.toUtf8Bytes(id));
      logger.debug(`[BlockchainHelper] Hashed ID: ${id} -> ${hash}`);
      return hash;
    }

    // For short IDs, use padding
    return stringToBytes32(id);
  } catch (error: any) {
    logger.error(`[BlockchainHelper] Failed to convert invoice to bytes32:`, {
      id,
      error: error.message
    });
    throw error;
  }
}

/**
 * Convert DID to bytes32
 * DIDs are usually long, so we always hash them
 *
 * @param did - Decentralized Identifier (e.g., "did:dcert:holder123")
 * @returns bytes32 keccak256 hash
 *
 * @example
 * didToBytes32("did:dcert:uABCD1234567890-xyz_12345678901234567890abcd")
 * // "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb27"
 */
export function didToBytes32(did: string): string {
  try {
    // Always hash DIDs (they're usually long)
    const hash = ethers.keccak256(ethers.toUtf8Bytes(did));
    logger.debug(`[BlockchainHelper] Hashed DID: ${did.substring(0, 30)}... -> ${hash}`);
    return hash;
  } catch (error: any) {
    logger.error(`[BlockchainHelper] Failed to convert DID to bytes32:`, {
      did,
      error: error.message
    });
    throw error;
  }
}

/**
 * Convert VC ID to bytes32
 * Format: schema_id:version:holder_did:timestamp
 *
 * @param vcID - Verifiable Credential ID
 * @param forceHash - Force hashing even for short strings
 * @returns bytes32 hex string
 *
 * @example
 * vcIDToBytes32("schema123:1:did:dcert:holder:1234567890")
 */
export function vcIDToBytes32(vcID: string, forceHash: boolean = false): string {
  try {
    const byteLength = Buffer.from(vcID, 'utf-8').length;

    // VC IDs are usually long, prefer hashing
    if (byteLength > 31 || forceHash) {
      return ethers.keccak256(ethers.toUtf8Bytes(vcID));
    }

    return stringToBytes32(vcID);
  } catch (error: any) {
    logger.error(`[BlockchainHelper] Failed to convert VC ID to bytes32:`, {
      vcID,
      error: error.message
    });
    throw error;
  }
}

/**
 * Convert VC hash to bytes32
 * Usually already a hash string
 *
 * @param vcHash - VC hash (hex string or regular string)
 * @returns bytes32 hex string
 *
 * @example
 * vcHashToBytes32("0x1234567890abcdef...") // Already hex
 * vcHashToBytes32("some-hash-string")      // Will hash it
 */
export function vcHashToBytes32(vcHash: string): string {
  try {
    // If already a valid hex string (0x...), validate and return
    if (vcHash.startsWith('0x')) {
      if (ethers.isHexString(vcHash, 32)) {
        return vcHash;
      }
      // If hex but not 32 bytes, hash it
      return ethers.keccak256(vcHash);
    }

    // If not hex, hash it
    return ethers.keccak256(ethers.toUtf8Bytes(vcHash));
  } catch (error: any) {
    logger.error(`[BlockchainHelper] Failed to convert VC hash to bytes32:`, {
      vcHash,
      error: error.message
    });
    throw error;
  }
}

/**
 * Convert array of string IDs to bytes32 array
 *
 * @param arr - Array of string IDs
 * @param forceHash - Force hashing for all items
 * @returns Array of bytes32 hex strings
 *
 * @example
 * stringArrayToBytes32Array(["item1", "item2", "item3"])
 */
export function stringArrayToBytes32Array(arr: string[], forceHash: boolean = false): string[] {
  try {
    return arr.map(item => invoiceToBytes32(item, forceHash));
  } catch (error: any) {
    logger.error(`[BlockchainHelper] Failed to convert array:`, {
      arrayLength: arr.length,
      error: error.message
    });
    throw error;
  }
}

/**
 * Convert bytes32 array back to string array
 * Note: Only works if original strings were padded (not hashed)
 *
 * @param arr - Array of bytes32 hex strings
 * @returns Array of strings
 */
export function bytes32ArrayToStringArray(arr: string[]): string[] {
  try {
    return arr.map(item => bytes32ToString(item));
  } catch (error: any) {
    logger.warn(`[BlockchainHelper] Failed to decode bytes32 array (probably hashed):`, {
      arrayLength: arr.length,
      error: error.message
    });
    // Return original array if decode fails (was hashed)
    return arr;
  }
}

/**
 * Convert uint248 BigInt to JavaScript number
 * Safe for values up to Number.MAX_SAFE_INTEGER (2^53 - 1)
 *
 * @param value - BigInt value from blockchain
 * @returns JavaScript number
 * @throws Error if value exceeds safe integer range
 *
 * @example
 * uint248ToNumber(10000n) // 10000
 */
export function uint248ToNumber(value: bigint): number {
  try {
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(
        `Value ${value} exceeds JavaScript MAX_SAFE_INTEGER (${Number.MAX_SAFE_INTEGER}). ` +
        `Use BigInt or string representation for large numbers.`
      );
    }
    return Number(value);
  } catch (error: any) {
    logger.error(`[BlockchainHelper] Failed to convert uint248 to number:`, {
      value: value.toString(),
      error: error.message
    });
    throw error;
  }
}

/**
 * Convert JavaScript number to uint248 BigInt
 *
 * @param value - JavaScript number (max 2^53 - 1)
 * @returns BigInt for blockchain transaction
 *
 * @example
 * numberToUint248(10000) // 10000n
 */
export function numberToUint248(value: number): bigint {
  try {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid value: ${value}. Must be a positive finite number.`);
    }
    if (value > Number.MAX_SAFE_INTEGER) {
      throw new Error(
        `Value ${value} exceeds JavaScript MAX_SAFE_INTEGER (${Number.MAX_SAFE_INTEGER}). ` +
        `Pass as BigInt directly.`
      );
    }
    return BigInt(Math.floor(value));
  } catch (error: any) {
    logger.error(`[BlockchainHelper] Failed to convert number to uint248:`, {
      value,
      error: error.message
    });
    throw error;
  }
}

/**
 * Convert uint40 timestamp to JavaScript Date
 *
 * @param timestamp - uint40 timestamp from blockchain (seconds)
 * @returns Date object
 *
 * @example
 * uint40ToDate(1705123456n) // Date object
 */
export function uint40ToDate(timestamp: bigint | number): Date {
  try {
    const seconds = typeof timestamp === 'bigint' ? Number(timestamp) : timestamp;
    return new Date(seconds * 1000); // Convert to milliseconds
  } catch (error: any) {
    logger.error(`[BlockchainHelper] Failed to convert timestamp to Date:`, {
      timestamp: timestamp.toString(),
      error: error.message
    });
    throw error;
  }
}

/**
 * Create ID mapping for database storage
 * Stores both original string ID and bytes32 hash for lookup
 *
 * @param originalId - Original string ID (e.g., "INV-12345-67890")
 * @returns Object with both formats
 *
 * @example
 * const mapping = createIdMapping("INV-550e8400-1234567890");
 * // {
 * //   originalId: "INV-550e8400-1234567890",
 * //   bytes32Hash: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb27",
 * //   isHashed: true
 * // }
 */
export function createIdMapping(originalId: string): {
  originalId: string;
  bytes32Hash: string;
  isHashed: boolean;
} {
  const byteLength = Buffer.from(originalId, 'utf-8').length;
  const isHashed = byteLength > 31;

  return {
    originalId,
    bytes32Hash: invoiceToBytes32(originalId),
    isHashed
  };
}

/**
 * Validate bytes32 hex string
 *
 * @param value - Value to check
 * @returns true if valid bytes32 hex string
 *
 * @example
 * isValidBytes32("0x1234...") // true
 * isValidBytes32("not-hex")   // false
 */
export function isValidBytes32(value: string): boolean {
  try {
    return ethers.isHexString(value, 32);
  } catch {
    return false;
  }
}

/**
 * Format bytes32 for display (show first 8 and last 4 chars)
 *
 * @param bytes32 - bytes32 hex string
 * @returns Shortened display string
 *
 * @example
 * formatBytes32("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb27")
 * // "0x742d35...bEb27"
 */
export function formatBytes32(bytes32: string): string {
  if (!bytes32 || bytes32.length < 10) return bytes32;
  return `${bytes32.substring(0, 10)}...${bytes32.substring(bytes32.length - 6)}`;
}

/**
 * Batch convert multiple IDs for efficient processing
 *
 * @param ids - Object with ID fields
 * @returns Object with converted bytes32 fields
 *
 * @example
 * const converted = batchConvertIds({
 *   orderId: "INV-12345",
 *   holderDID: "did:dcert:holder",
 *   items: ["item1", "item2"]
 * });
 */
export function batchConvertIds(ids: {
  orderId?: string;
  holderDID?: string;
  issuerDID?: string;
  vcID?: string;
  items?: string[];
  [key: string]: any;
}): {
  [key: string]: string | string[];
} {
  const result: { [key: string]: string | string[] } = {};

  if (ids.orderId) result.orderIdBytes32 = invoiceToBytes32(ids.orderId);
  if (ids.holderDID) result.holderDIDBytes32 = didToBytes32(ids.holderDID);
  if (ids.issuerDID) result.issuerDIDBytes32 = didToBytes32(ids.issuerDID);
  if (ids.vcID) result.vcIDBytes32 = vcIDToBytes32(ids.vcID);
  if (ids.items) result.itemsBytes32 = stringArrayToBytes32Array(ids.items);

  return result;
}

/**
 * Log conversion for debugging
 *
 * @param label - Description label
 * @param original - Original value
 * @param converted - Converted value
 */
export function logConversion(label: string, original: any, converted: any): void {
  logger.debug(`[BlockchainHelper] ${label}:`, {
    original: typeof original === 'string' && original.length > 50
      ? `${original.substring(0, 50)}...`
      : original,
    converted: typeof converted === 'string'
      ? formatBytes32(converted)
      : converted,
    type: typeof original
  });
}

// Export all utilities
export default {
  stringToBytes32,
  bytes32ToString,
  invoiceToBytes32,
  didToBytes32,
  vcIDToBytes32,
  vcHashToBytes32,
  stringArrayToBytes32Array,
  bytes32ArrayToStringArray,
  uint248ToNumber,
  numberToUint248,
  uint40ToDate,
  createIdMapping,
  isValidBytes32,
  formatBytes32,
  batchConvertIds,
  logConversion
};
