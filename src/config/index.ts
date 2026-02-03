/**
 * Config Index
 * Central export point for all configurations
 */

export { env } from "./env";
export { default as DatabaseService, prisma } from "./database";
export {
  default as DIDBlockchainConfig,
  contractABI,
  iface,
} from "./didblockchain";
export { default as VCBlockchainConfig } from "./vcblockchain";
export { default as CredentialsHistoryBlockchainConfig } from "./credentialsHistoryBlockchain";
export { default as PaymentBlockchainConfig } from "./paymentBlockchain";
export { default as logger } from "./logger";
export {
  default as redisClient,
  connectRedis,
  disconnectRedis,
  isRedisHealthy,
} from "./redis";
