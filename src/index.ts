import express, { Request, Response, Application } from "express";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import cors from "cors";
import didRoutes from "./routes/did";
import institutionRegistrationRoutes from "./routes/institutionRegistration";
import credentialRoutes from "./routes/credential";
import schemaRoutes from "./routes/schema";
// Load environment variables
require("dotenv").config();

const app: Application = express();
const PORT: number = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Middleware untuk parsing JSON
app.use(express.json());
app.use(cors());

// Opsi Konfigurasi untuk swagger-jsdoc
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "GaneshaDCERT API Documentation",
      version: "1.0.0",
      description: "",
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: "Development Server",
      },
      {
        url: "https://api-dcert.ganeshait.com",
        description: "Production Server",
      },
    ],
  },
  apis: [
    `./${process.env.NODE_ENV === "production" ? "dist" : "src"}/routes/*.${
      process.env.NODE_ENV === "production" ? "js" : "ts"
    }`,
    `./${process.env.NODE_ENV === "production" ? "dist" : "src"}/index.${
      process.env.NODE_ENV === "production" ? "js" : "ts"
    }`,
  ],
};

// Generate spesifikasi Swagger
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Sajikan Swagger UI di endpoint /api-docs
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
 *  get:
 *    summary: API Welcome & Status
 *    description: Welcome endpoint dengan status RabbitMQ connection
 *    tags:
 *      - System
 *    responses:
 *      200:
 *        description: API status
 */
app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "Welcome to GaneshaDCERT API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use("/dids", didRoutes);
app.use("/institution-registration", institutionRegistrationRoutes);
app.use("/schemas", schemaRoutes);
app.use("/credential", credentialRoutes);
// Error handling middleware
app.use((error: any, req: Request, res: Response, next: any) => {
  const status = error.statusCode || 500;
  const message = error.message || "An error occurred";
  const data = error.data;

  res.status(status).json({
    message: message,
    ...(data && { data }),
  });
});

// Start server
const startServer = async () => {
  try {
    // Start Express server
    app.listen(PORT, () => {
      console.log(
        `🚀 GaneshaDCERT API Server running at http://localhost:${PORT}`
      );
      console.log(
        `📖 Swagger API Documentation: http://localhost:${PORT}/api-docs`
      );
      // console.log(`🐰 RabbitMQ Management UI: http://localhost:15672`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Start the application
startServer();
