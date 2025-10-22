/**
 * Schema-specific Type Definitions
 */

import { VCSchema } from "@prisma/client";

/**
 * Schema with transaction hash
 */
export interface SchemaWithTransaction {
  schema: VCSchema;
  transactionHash: string;
}

/**
 * Schema version info
 */
export interface SchemaVersionInfo {
  id: string;
  version: number;
  isActive: boolean;
  createdAt: Date;
}

/**
 * Blockchain transaction result
 */
export interface BlockchainTransactionResult {
  hash: string;
  blockNumber?: number;
  gasUsed?: string;
}
