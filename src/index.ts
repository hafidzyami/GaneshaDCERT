import express, { Request, Response, Application } from "express";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import cors from "cors";
import {
  env,
  DatabaseService,
  DIDBlockchainConfig,
  VCBlockchainConfig,
  CredentialsHistoryBlockchainConfig,
  PaymentBlockchainConfig,
  logger,
} from "./config";
import {
  errorHandler,
  notFoundHandler,
  requestLogger,
  apiRateLimit,
} from "./middlewares";
import { HealthCheckResponse } from "./types";

// Routes
import {
  authRoutes,
  adminAuthRoutes,
  didRoutes,
  credentialRoutes,
  schemaRoutes,
  presentationRoutes,
  notificationRoutes,
  institutionRoutes,
  paymentRoutes,
  performanceRoutes,
} from "./routes";

// Schedulers
import { scheduleVCCleanup } from "./jobs/vcCleanupScheduler";

// Blockchain Event Publishers
import blockchainEventPublisher from "./services/blockchainEventPublisher.service";
import credentialsHistoryEventPublisher from "./services/credentialsHistoryEventPublisher.service";
import paymentEventPublisher from "./services/paymentEventPublisher.service";

// Database for performance comparison
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const app: Application = express();
const PORT: number = env.PORT;

// Middleware untuk parsing JSON
app.use(express.json());

// // CORS Configuration
// const corsOptions = {
//   origin: (
//     origin: string | undefined,
//     callback: (err: Error | null, allow?: boolean) => void
//   ) => {
//     // Allow requests with no origin (like mobile apps or Postman)
//     if (!origin) {
//       return callback(null, true);
//     }

//     // List of allowed origins
//     const allowedOrigins = [
//       env.FRONTEND_URL, // From environment variable
//       "http://localhost:3000", // Local development frontend
//       "http://localhost:5173", // Vite dev server
//       `http://localhost:${PORT}`, // Backend API (for Swagger UI)
//       "https://dev-api-dcert.ganeshait.com", // Dev API (for Swagger UI)
//       "https://api-dcert.ganeshait.com", // Production API (for Swagger UI)
//       "https://dev-dcert.ganeshait.com", // Dev frontend
//       "https://dcert.ganeshait.com", // Production frontend
//     ];

//     if (allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       logger.warn(`CORS blocked origin: ${origin}`);
//       callback(new Error("Not allowed by CORS"));
//     }
//   },
//   credentials: true, // Allow cookies and authorization headers
//   methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
//   allowedHeaders: [
//     "Content-Type",
//     "Authorization",
//     "X-Requested-With",
//     "Accept",
//   ],
//   exposedHeaders: ["Content-Range", "X-Content-Range"],
//   maxAge: 86400, // 24 hours
// };

app.use(cors());

// Request logger (before all routes)
app.use(requestLogger);

// Global rate limiter
app.use(apiRateLimit);

// Swagger Configuration
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "GaneshaDCERT API Documentation",
      version: "2.0.0",
      description: "Decentralized Certificate Management System API",
      contact: {
        name: "API Support",
        email: "support@ganeshadcert.com",
      },
    },
    servers: [
      {
        url: `http://localhost:${PORT}/api/v1`,
        description: "Development Server",
      },
      {
        url: "https://dev-api-dcert.ganeshait.com/api/v1",
        description: "Development Server",
      },
      {
        url: "https://api-dcert.ganeshait.com/api/v1",
        description: "Production Server",
      },
      {
        url: "http://192.168.55.122:3069/api/v1",
        description: "Local Server",
      },
    ],
    components: {
      securitySchemes: {
        InstitutionBearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter JWT token for institution authentication",
        },
        AdminBearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter JWT token for admin authentication",
        },
        HolderBearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter JWT token for holder authentication",
        },
        VerifierBearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter JWT token for holder authentication",
        },
      },
    },
  },
  apis: [
    `./${env.NODE_ENV === "production" ? "dist" : "src"}/routes/*.${
      env.NODE_ENV === "production" ? "js" : "ts"
    }`,
    `./${env.NODE_ENV === "production" ? "dist" : "src"}/index.${
      env.NODE_ENV === "production" ? "js" : "ts"
    }`,
  ],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Swagger UI
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #1976d2 }
    `,
    customSiteTitle: "GaneshaDCERT API Docs",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    },
  })
);

/**
 * @swagger
 * /:
 *   get:
 *     summary: API Welcome & Status
 *     description: Welcome endpoint with system status
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: API status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Welcome to GaneshaDCERT API
 *                 version:
 *                   type: string
 *                   example: 2.0.0
 *                 environment:
 *                   type: string
 *                   example: development
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Welcome to GaneshaDCERT API",
    version: "2.0.0",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health Check
 *     description: Check API and services health status
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: API and services are healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                   example: 3600
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: boolean
 *                       example: true
 *                     blockchain:
 *                       type: boolean
 *                       example: true
 *       503:
 *         description: One or more services are unhealthy
 */
app.get("/api/v1/health", async (req: Request, res: Response) => {
  const dbHealth = await DatabaseService.isConnected();
  const didBCHealth = await DIDBlockchainConfig.isConnected();
  const vcBCHealth = await VCBlockchainConfig.isConnected();
  const credHistoryBCHealth =
    await CredentialsHistoryBlockchainConfig.isConnected();
  const paymentBCHealth = await PaymentBlockchainConfig.isConnected();

  const response: HealthCheckResponse = {
    success:
      dbHealth &&
      didBCHealth &&
      vcBCHealth &&
      credHistoryBCHealth &&
      paymentBCHealth,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: dbHealth,
      didblockchain: didBCHealth,
      vcblockchain: vcBCHealth,
      credentialsHistoryBlockchain: credHistoryBCHealth,
      paymentBlockchain: paymentBCHealth,
    },
  };

  if (response.success) {
    res.status(200).json(response);
  } else {
    res.status(503).json(response);
  }
});

/**
 * @swagger
 * /health/blockchain-sync:
 *   get:
 *     summary: Blockchain Sync Status
 *     description: Check blockchain event synchronization status
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Blockchain sync status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 currentBlockchainBlock:
 *                   type: number
 *                   example: 12345
 *                 checkpoints:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       eventType:
 *                         type: string
 *                         example: SchemaCreated
 *                       lastSyncedBlock:
 *                         type: string
 *                         example: "12340"
 *                       blockGap:
 *                         type: number
 *                         example: 5
 *                       isSynced:
 *                         type: boolean
 *                         example: true
 *                       lastSyncedAt:
 *                         type: string
 *                         format: date-time
 */
app.get(
  "/api/v1/health/blockchain-sync",
  async (req: Request, res: Response) => {
    try {
      const status = await blockchainEventPublisher.getSyncStatus();
      res.json({
        success: true,
        ...status,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to get blockchain sync status",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * @swagger
 * /health/credentials-history-sync:
 *   get:
 *     summary: Credentials History Blockchain Sync Status
 *     description: Check credentials history blockchain event synchronization status
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Credentials history sync status
 */
app.get(
  "/api/v1/health/credentials-history-sync",
  async (req: Request, res: Response) => {
    try {
      const status = await credentialsHistoryEventPublisher.getSyncStatus();
      res.json({
        success: true,
        ...status,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to get credentials history sync status",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * @swagger
 * /health/payment-sync:
 *   get:
 *     summary: Payment Blockchain Sync Status
 *     description: Check payment blockchain event synchronization status
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Payment sync status
 */
app.get("/api/v1/health/payment-sync", async (req: Request, res: Response) => {
  try {
    const status = await paymentEventPublisher.getSyncStatus();
    res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get payment sync status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// API Routes with /api/v1 prefix
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin/auth", adminAuthRoutes);
app.use("/api/v1/dids", didRoutes);
app.use("/api/v1/schemas", schemaRoutes);
app.use("/api/v1/credentials", credentialRoutes);
app.use("/api/v1/presentations", presentationRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/institutions", institutionRoutes);
app.use("/api/v1/payment", paymentRoutes);
app.use("/api/v1/performance", performanceRoutes);

// 404 Handler - must be after all routes
app.use(notFoundHandler);

// Global Error Handler - must be last
app.use(errorHandler);

/**
 * Start Server with proper initialization
 */
const startServer = async () => {
  try {
    logger.info("🚀 Starting GaneshaDCERT API Server...");
    logger.info(`   Environment: ${env.NODE_ENV}`);
    logger.info(`   Port: ${PORT}`);

    // Connect to Database
    logger.info("📦 Connecting to database...");
    await DatabaseService.connect();
    logger.success("   ✓ Database connected");

    // Test Blockchain Connections
    logger.info("⛓️  Testing blockchain connections...");

    const didBlockchainConnected = await DIDBlockchainConfig.testConnection();
    if (didBlockchainConnected) {
      logger.success("   ✓ DID Blockchain connected");
    } else {
      logger.warn(
        "   ⚠ DID Blockchain connection failed, server will continue"
      );
    }

    const vcBlockchainConnected = await VCBlockchainConfig.testConnection();
    if (vcBlockchainConnected) {
      logger.success("   ✓ VC Blockchain connected");
    } else {
      logger.warn("   ⚠ VC Blockchain connection failed, server will continue");
    }

    const credHistoryBlockchainConnected =
      await CredentialsHistoryBlockchainConfig.testConnection();
    if (credHistoryBlockchainConnected) {
      logger.success("   ✓ CredentialsHistory Blockchain connected");
    } else {
      logger.warn(
        "   ⚠ CredentialsHistory Blockchain connection failed, server will continue"
      );
    }

    const paymentBlockchainConnected =
      await PaymentBlockchainConfig.testConnection();
    if (paymentBlockchainConnected) {
      logger.success("   ✓ Payment Blockchain connected");
    } else {
      logger.warn(
        "   ⚠ Payment Blockchain connection failed, server will continue"
      );
    }

    // Initialize Background Jobs
    logger.info("⏰ Initializing background jobs...");
    scheduleVCCleanup();
    logger.success("   ✓ VC cleanup scheduler started (runs every 5 minutes)");

    // Start Blockchain Event Listeners
    logger.info("🔗 Starting blockchain event listeners...");

    // VC Schema Event Listener (Credentials Blockchain)
    try {
      await blockchainEventPublisher.start();
      logger.success("   ✓ VC Schema event listener started");
    } catch (error) {
      logger.error("   ✗ Failed to start VC Schema event listener:", error);
      logger.warn("   Server will continue without VC Schema event listener");
    }

    // Credentials History Event Listener (History Blockchain)
    try {
      await credentialsHistoryEventPublisher.start();
      logger.success("   ✓ Credentials History event listener started");
    } catch (error) {
      logger.error(
        "   ✗ Failed to start Credentials History event listener:",
        error
      );
      logger.warn(
        "   Server will continue without Credentials History event listener"
      );
    }

    // Payment Event Listener (History Blockchain)
    try {
      await paymentEventPublisher.start();
      logger.success("   ✓ Payment event listener started");
    } catch (error: any) {
      logger.error("   ✗ Failed to start Payment event listener:", {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        error: error,
      });
      logger.warn("   Server will continue without Payment event listener");
    }

    // Start Express Server
    logger.info("🎯 Starting HTTP server...");
    app.listen(PORT, () => {
      logger.success("=".repeat(60));
      logger.success("✅ GaneshaDCERT API Server is running!");
      logger.success("=".repeat(60));
      logger.info(`   🌐 API: http://localhost:${PORT}`);
      logger.info(`   📖 Swagger Docs: http://localhost:${PORT}/api-docs`);
      logger.info(`   🔍 Health Check: http://localhost:${PORT}/api/v1/health`);
      logger.success("=".repeat(60));
    });
  } catch (error) {
    logger.error("=".repeat(60));
    logger.error("❌ FATAL: Failed to start server");
    logger.error("=".repeat(60));
    logger.error("Error details:", error);
    if (error instanceof Error) {
      logger.error("Stack trace:", error.stack);
    }
    logger.error("=".repeat(60));
    process.exit(1);
  }
};

// Graceful Shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down gracefully...");
  await blockchainEventPublisher.stop();
  await credentialsHistoryEventPublisher.stop();
  await paymentEventPublisher.stop();
  await DatabaseService.disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down gracefully...");
  await blockchainEventPublisher.stop();
  await credentialsHistoryEventPublisher.stop();
  await paymentEventPublisher.stop();
  await DatabaseService.disconnect();
  process.exit(0);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", { reason, promise });
  process.exit(1);
});

// Start the application
startServer();

export default app;
