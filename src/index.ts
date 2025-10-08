import express, { Request, Response, Application } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { rabbitmqService } from './services/rabbitmq.service';
import { closeRabbitMQ } from './config/rabbitmq.config';
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
      title: 'GaneshaDCERT API with RabbitMQ Integration',
      version: '2.0.0',
      description: `
        ## Dokumentasi API untuk layanan GaneshaDCERT dengan RabbitMQ Integration
        
        ### Message Queue Architecture
        API ini menggunakan **RabbitMQ** untuk message queue dalam pemrosesan 
        Verifiable Credentials (VC) dengan pola **consume-and-delete**.
        
        ### RabbitMQ Exchanges:
        - **vc.requests.exchange**: Exchange untuk VC requests
        - **vc.issuances.exchange**: Exchange untuk VC issuances
        - **vc.requests.dlx**: Dead Letter Exchange untuk failed requests
        - **vc.issuances.dlx**: Dead Letter Exchange untuk failed issuances
        
        ### Key Features:
        - ✅ **Consume & Delete**: Messages deleted immediately when retrieved
        - ✅ **No TTL**: Messages persist indefinitely until consumed
        - ✅ **Dead Letter Queue**: Failed messages routed to DLQ for debugging
        - ✅ **Routing by DID**: Topic-based routing using issuer/holder DID
        - ✅ **Error Handling**: Malformed messages automatically sent to DLQ
        
        ### Architecture Flow:
        1. Client sends POST request to \`/api/requests\`
        2. API publishes message to RabbitMQ exchange
        3. Message routed to queue based on DID (routing key)
        4. Issuer fetches requests - **messages are deleted**
        5. Issuer issues VC via POST /api/issuances
        6. Holder fetches VCs - **messages are deleted**
        7. Malformed messages sent to Dead Letter Queue
        
        ### Error Recovery:
        - JSON parse errors trigger DLQ routing
        - DLQ messages retained for debugging
        - No automatic retry to prevent infinite loops
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
        description: 'Development Server (RabbitMQ)',
      },
      {
        url: 'https://api.ganesha-dcert.com',
        description: 'Production Server',
      }
    ],
    externalDocs: {
      description: 'RabbitMQ Documentation',
      url: 'https://www.rabbitmq.com/documentation.html'
    }
  },
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
 *     description: Welcome endpoint dengan status RabbitMQ connection
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: API status
 */
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to GaneshaDCERT API with RabbitMQ Integration',
    version: '2.0.0',
    rabbitmq_status: rabbitmqService.isConnected,
    features: {
      consumption: 'Consume & Delete - Messages deleted on retrieval',
      persistence: 'No TTL - Messages persist until consumed',
      error_handling: 'Dead Letter Queue for failed messages',
      routing: 'Topic-based by DID'
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health Check
 *     description: Check system health including RabbitMQ connection
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: System healthy
 */
app.get('/health', (req: Request, res: Response) => {
  const healthStatus = {
    status: rabbitmqService.isConnected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      server: 'running',
      rabbitmq: rabbitmqService.isConnected ? 'connected' : 'disconnected',
    },
    architecture: {
      pattern: 'Consume & Delete',
      ttl: 'None - Messages persist',
      error_handling: 'Dead Letter Queue',
    },
    uptime: process.uptime()
  };

  const statusCode = rabbitmqService.isConnected ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

/**
 * @swagger
 * /dlq/requests:
 *   get:
 *     summary: Get Dead Letter Queue Messages for Requests
 *     description: View failed/malformed request messages (for debugging)
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: DLQ messages retrieved
 */
app.get('/dlq/requests', async (req: Request, res: Response) => {
  try {
    const messages = await rabbitmqService.getDeadLetterMessages();
    res.json({
      success: true,
      dlq: 'vc.requests.dlq',
      total_failed: messages.length,
      messages: messages,
      note: 'These are malformed messages that failed JSON parsing'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch DLQ messages',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /dlq/issuances:
 *   get:
 *     summary: Get Dead Letter Queue Messages for Issuances
 *     description: View failed/malformed issuance messages (for debugging)
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: DLQ messages retrieved
 */
app.get('/dlq/issuances', async (req: Request, res: Response) => {
  try {
    const messages = await rabbitmqService.getDeadLetterMessages();
    res.json({
      success: true,
      dlq: 'vc.issuances.dlq',
      total_failed: messages.length,
      messages: messages,
      note: 'These are malformed messages that failed JSON parsing'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch DLQ messages',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Fungsi untuk inisialisasi RabbitMQ
async function initializeRabbitMQ() {
  try {
    console.log('🚀 Initializing RabbitMQ services...');
    
    await rabbitmqService.initialize();
    
    console.log('✅ RabbitMQ services initialized successfully');
    console.log('   📋 Pattern: Consume & Delete');
    console.log('   ⏰ TTL: None - Messages persist until consumed');
    console.log('   ☠️  Error Handling: Dead Letter Queue enabled');
  } catch (error) {
    console.error('❌ Failed to initialize RabbitMQ services:', error);
    console.error('⚠️  Server will continue running, but RabbitMQ features may not work');
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  await closeRabbitMQ();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  await closeRabbitMQ();
  process.exit(0);
});

// Start server
const startServer = async () => {
  try {
    // Initialize RabbitMQ first
    await initializeRabbitMQ();
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 GaneshaDCERT API Server running at http://localhost:${PORT}`);
      console.log(`📖 Swagger API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🔍 Health Check Endpoint: http://localhost:${PORT}/health`);
      console.log(`☠️  Dead Letter Queue (Requests): http://localhost:${PORT}/dlq/requests`);
      console.log(`☠️  Dead Letter Queue (Issuances): http://localhost:${PORT}/dlq/issuances`);
      console.log(`🐰 RabbitMQ Management UI: http://localhost:15672`);
      console.log(`   Username: admin`);
      console.log(`   Password: admin123`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the application
startServer();
