import express, { Request, Response, Application } from "express";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

// Load environment variables
require("dotenv").config();

const app: Application = express();
const PORT: number = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Middleware untuk parsing JSON
app.use(express.json());

// Opsi Konfigurasi untuk swagger-jsdoc
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "GaneshaDCERT API with RabbitMQ Integration",
      version: "1.0.0",
      description: "",
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: "Development Server",
      },
      {
        url: "https://api.ganesha-dcert.com",
        description: "Production Server",
      },
    ],
  },
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts", "./src/index.ts"],
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
 *   get:
 *     summary: API Welcome & Status
 *     description: Welcome endpoint dengan status RabbitMQ connection
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: API status
 */
app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "Welcome to GaneshaDCERT API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
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
