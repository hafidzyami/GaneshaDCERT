import express, { Request, Response, Application } from "express";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import cors from "cors";
import {
  env,
  DatabaseService,
  DIDBlockchainConfig,
  VCBlockchainConfig,
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
} from "./routes";

// Schedulers
import { scheduleVCCleanup } from "./jobs/vcCleanupScheduler";

const app: Application = express();
const PORT: number = env.PORT;

// Middleware untuk parsing JSON
app.use(express.json());
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

  const response: HealthCheckResponse = {
    success: dbHealth && didBCHealth,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: dbHealth,
      didblockchain: didBCHealth,
      vcblockchain: vcBCHealth,
    },
  };

  const statusCode = response.success ? 200 : 503;
  res.status(statusCode).json(response);
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
    await DatabaseService.connect();

    // Test DID Blockchain Connection
    const didBlockchainConnected = await DIDBlockchainConfig.testConnection();
    if (!didBlockchainConnected) {
      logger.warn("DID Blockchain connection failed, but server will continue");
    }

    // Test VC Blockchain Connection
    const vcBlockchainConnected = await DIDBlockchainConfig.testConnection();
    if (!vcBlockchainConnected) {
      logger.warn("VC Blockchain connection failed, but server will continue");
    }

    // Initialize Background Jobs
    logger.info("⏰ Initializing background jobs...");
    scheduleVCCleanup();
    logger.success("   ✓ VC cleanup scheduler started (runs every 5 minutes)");

    // Start Express Server
    app.listen(PORT, () => {
      logger.success("GaneshaDCERT API Server is running!");
      logger.info(`   🌐 API: http://localhost:${PORT}`);
      logger.info(`   📖 Swagger Docs: http://localhost:${PORT}/api-docs`);
      logger.info(`   🔍 Health Check: http://localhost:${PORT}/api/v1/health`);
    });
  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
};

// Graceful Shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down gracefully...");
  await DatabaseService.disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down gracefully...");
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
