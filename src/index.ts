import express, { Request, Response, Application } from "express";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import cors from "cors";
import { env } from "./config/env";
import DatabaseService from "./config/database";
import BlockchainConfig from "./config/didblockchain";
import {
  errorHandler,
  notFoundHandler,
} from "./middlewares/errorHandler.middleware";

// Routes
import didRoutes from "./routes/did.routes";
import credentialRoutes from "./routes/credential.routes";
import schemaRoutes from "./routes/schema.routes";
import authRoutes from "./routes/auth.routes";
import adminAuthRoutes from "./routes/adminAuth.routes";
import presentationRoutes from "./routes/presentation.routes";
import notificationRoutes from "./routes/notification.routes";

const app: Application = express();
const PORT: number = env.PORT;

// Middleware untuk parsing JSON
app.use(express.json());
app.use(cors());

// Swagger Configuration
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "GaneshaDCERT API Documentation",
      version: "1.0.0",
      description: "Decentralized Certificate Management System API",
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
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
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
 */
app.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Welcome to GaneshaDCERT API",
    version: "1.0.0",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health Check
 *     description: Check API health status
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: API is healthy
 */
app.get("/health", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "API is healthy",
    timestamp: new Date().toISOString(),
  });
});

// API Routes with /api/v1 prefix
app.use("/api/v1/dids", didRoutes);
app.use("/api/v1/schemas", schemaRoutes);
app.use("/api/v1/credentials", credentialRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin/auth", adminAuthRoutes);
app.use("/api/v1/presentations", presentationRoutes);
app.use("/api/v1/notifications", notificationRoutes);

// 404 Handler - must be after all routes
app.use(notFoundHandler);

// Global Error Handler - must be last
app.use(errorHandler);

/**
 * Start Server with proper initialization
 */
const startServer = async () => {
  try {
    console.log("🚀 Starting GaneshaDCERT API Server...");
    console.log(`   Environment: ${env.NODE_ENV}`);
    console.log(`   Port: ${PORT}`);

    // Connect to Database
    await DatabaseService.connect();

    // Test Blockchain Connection
    const blockchainConnected = await BlockchainConfig.testConnection();
    if (!blockchainConnected) {
      console.warn(
        "⚠️  Blockchain connection failed, but server will continue"
      );
    }

    // Start Express Server
    app.listen(PORT, () => {
      console.log("\n✅ GaneshaDCERT API Server is running!");
      console.log(`   🌐 API: http://localhost:${PORT}`);
      console.log(`   📖 Swagger Docs: http://localhost:${PORT}/api-docs`);
      console.log(`   🔍 Health Check: http://localhost:${PORT}/health`);
      console.log("\n");
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Graceful Shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  await DatabaseService.disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  await DatabaseService.disconnect();
  process.exit(0);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Start the application
startServer();

export default app;
