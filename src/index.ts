import express, { Request, Response, Application } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { kafkaService } from './services/kafka.service';
import requestRoutes from './routes/request.route';
import issuanceRoutes from './routes/issuance.route';

// Load environment variables
require('dotenv').config();

const app: Application = express();
const PORT: number = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Middleware untuk parsing JSON
app.use(express.json());

// Opsi Konfigurasi untuk swagger-jsdoc
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GaneshaDCERT API with Kafka Integration',
      version: '1.0.0',
      description: `
        ## Dokumentasi API untuk layanan GaneshaDCERT dengan Apache Kafka Integration
        
        ### Event-Driven Architecture
        API ini menggunakan **Apache Kafka** untuk arsitektur event-driven dalam pemrosesan 
        Verifiable Credentials (VC). Setiap request VC dikirim ke Kafka topic untuk diproses 
        secara asynchronous oleh worker consumers.
        
        ### Kafka Topics:
        - **vc_requests**: Topic untuk VC request submissions
        - **vc_issuances**: Topic untuk completed VC issuances
        
        ### Architecture Flow:
        1. Client mengirim POST request ke \`/api/requests\`
        2. API memvalidasi data dan mengirim ke Kafka topic \`vc_requests\` 
        3. Consumer workers memproses request secara asynchronous
        4. Client dapat check status menggunakan \`request_id\`
        
        ### Kafka Configuration:
        - **Broker**: Apache Kafka single node (localhost:9092)
        - **Consumer Group**: request-processors  
        - **Partitions**: 3 per topic
        - **Replication Factor**: 1 (development setup)
      `,
      contact: {
        name: 'Hafidz Yami',
        url: 'https://github.com/hafidzyami',
        email: 'hafidz@ganesha.edu'
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      }
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development Server (Apache Kafka)',
      },
      {
        url: 'https://api.ganesha-dcert.com',
        description: 'Production Server (Kafka Cluster)',
      }
    ],
    externalDocs: {
      description: 'Apache Kafka Documentation',
      url: 'https://kafka.apache.org/documentation/'
    }
  },
  // Path ke file API yang ingin didokumentasikan
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
    './src/index.ts'
  ],
};

// Generate spesifikasi Swagger
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Sajikan Swagger UI di endpoint /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info .title { color: #1976d2 }
  `,
  customSiteTitle: 'GaneshaDCERT API Docs',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
  }
}));

// Routes
app.use('/api/requests', requestRoutes);
app.use('/api/issuances', issuanceRoutes);

/**
 * @swagger
 * /:
 *   get:
 *     summary: API Welcome & Status
 *     description: |
 *       Endpoint utama yang menampilkan welcome message dan status koneksi Kafka.
 *       Berguna untuk health check awal dan memverifikasi bahwa API dan Kafka terhubung dengan baik.
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: API dan Kafka status berhasil diperoleh
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Welcome to GaneshaDCERT API with Kafka Integration"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 kafka_status:
 *                   type: boolean
 *                   example: true
 *                   description: Status koneksi ke Apache Kafka
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-09-26T08:30:00.000Z"
 */
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to GaneshaDCERT API with Kafka Integration',
    version: '1.0.0',
    kafka_status: kafkaService.isConnected,
    timestamp: new Date().toISOString()
  });
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Comprehensive Health Check
 *     description: |
 *       Endpoint untuk monitoring kesehatan sistem termasuk:
 *       - Status server Express.js
 *       - Koneksi ke Apache Kafka broker
 *       - Timestamp untuk tracking uptime
 *       
 *       Endpoint ini berguna untuk:
 *       - Load balancer health checks
 *       - Monitoring & alerting systems  
 *       - DevOps automation scripts
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Sistem berjalan dengan baik
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "ok"
 *                   enum: [ok, degraded, down]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-09-26T08:30:00.000Z"
 *                 services:
 *                   type: object
 *                   properties:
 *                     server:
 *                       type: string
 *                       example: "running"
 *                       enum: [running, stopped]
 *                     kafka:
 *                       type: string
 *                       example: "connected"
 *                       enum: [connected, disconnected, error]
 *                 uptime:
 *                   type: number
 *                   example: 3600
 *                   description: Server uptime in seconds
 *       503:
 *         description: Service unavailable - Kafka disconnected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "degraded"
 *                 services:
 *                   type: object
 *                   properties:
 *                     server:
 *                       type: string
 *                       example: "running"
 *                     kafka:
 *                       type: string
 *                       example: "disconnected"
 */
app.get('/health', (req: Request, res: Response) => {
  const healthStatus = {
    status: kafkaService.isConnected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      server: 'running',
      kafka: kafkaService.isConnected ? 'connected' : 'disconnected'
    },
    uptime: process.uptime()
  };

  const statusCode = kafkaService.isConnected ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

// Fungsi untuk inisialisasi Kafka
async function initializeKafka() {
  try {
    console.log('🚀 Initializing Apache Kafka services...');
    
    // Connect Producer
    await kafkaService.connectProducer();
    
    // Create Topics
    await kafkaService.createTopics();
    
    console.log('✅ Apache Kafka services initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Kafka services:', error);
    console.error('⚠️ Server will continue running, but Kafka features may not work');
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  await kafkaService.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  await kafkaService.disconnect();
  process.exit(0);
});

// Start server
const startServer = async () => {
  try {
    // Initialize Kafka first
    await initializeKafka();
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 GaneshaDCERT API Server running at http://localhost:${PORT}`);
      console.log(`📖 Swagger API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🔍 Health Check Endpoint: http://localhost:${PORT}/health`);
      console.log(`🎯 Apache Kafka UI: http://localhost:8080`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the application
startServer();
