import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

/**
 * Environment Variables Schema
 * Validates all required environment variables at startup
 */
const envSchema = z.object({
  // Server
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().default("3000").transform(Number),

  // Database
  DATABASE_URL: z.string(),

  // JWT
  JWT_SECRET: z.string(),

  // Blockchain
  BLOCKCHAIN_RPC_URL: z.string().url(),
  DID_CONTRACT_ADDRESS: z.string().length(42, "Invalid DID Ethereum address"),
  VC_CONTRACT_ADDRESS: z.string().length(42, "Invalid VC Ethereum address"),
  ACCOUNT_PRIVATE_KEY: z.string().min(64, "Invalid private key"),

  // Email
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.string().default("587").transform(Number),
  SMTP_USER: z.string().email(),
  SMTP_PASS: z.string().min(1),

  // Frontend
  FRONTEND_URL: z.string().url(),

  // MinIO
  MINIO_ENDPOINT: z.string().default("localhost"),
  MINIO_PORT: z.string().default("9000").transform(Number),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_USE_SSL: z
    .string()
    .default("false")
    .transform((val) => val === "true"),
  MINIO_BUCKET_NAME: z.string().default("dcert-storage"),
});

type Env = z.infer<typeof envSchema>;

/**
 * Validated environment variables
 */
let env: Env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("❌ Invalid environment variables:");
    error.issues.forEach((err) => {
      console.error(`  - ${err.path.join(".")}: ${err.message}`);
    });
  }
  process.exit(1);
}

export { env };
export default env;
