import express, { Request, Response, Application } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { rabbitmqService } from './services/rabbitmq.service';
import { delayedDeletionService } from './services/delayed-deletion.service';
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
      version: '1.0.0',
      description: `
        ## Dokumentasi API untuk layanan GaneshaDCERT dengan RabbitMQ Integration
        
        ### Message Queue Architecture
        API ini menggunakan **RabbitMQ** untuk message queue dalam pemrosesan 
        Verifiable Credentials (VC). Setiap VC request dikirim ke RabbitMQ dan 
        **otomatis terhapus setelah 5 menit** (TTL native).
        
        ### RabbitMQ Exchanges:
        - **vc.requests.exchange**: Exchange untuk VC requests
        - **vc.issuances.exchange**: Exchange untuk VC issuances
        
        ### Key Features:
        - ✅ **No TTL on storage**: Messages stay until processed
        - ✅ **Delayed deletion**: VCs deleted 5 minutes AFTER holder retrieves them
        - ✅ **Routing by DID**: Topic-based routing using issuer/holder DID
        - ✅ **Lightweight**: Simple and efficient message queue
        
        ### Architecture Flow:
        1. Client sends POST request to \`/api/requests\`
        2. API publishes message to RabbitMQ exchange
        3. Message routed to queue based on DID (routing key)
        4. Issuer fetches requests (messages stay in queue)
        5. Issuer issues VC via POST /api/issuances
        6. Holder fetches VCs with GET request
        7. **5-minute deletion timer starts** after holder retrieves VCs
        8. Messages **automatically deleted** after 5 minutes
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
  const deletionStatus = delayedDeletionService.getStatus();
  
  res.json({
    message: 'Welcome to GaneshaDCERT API with RabbitMQ Integration',
    version: '2.0.0',
    rabbitmq_status: rabbitmqService.isConnected,
    features: {
      storage: 'No TTL - Messages persist',
      deletion: '5 minutes after holder retrieves VCs',
      routing: 'topic-based by DID'
    },
    deletion_service: {
      active: deletionStatus.isRunning,
      scheduled_deletions: deletionStatus.scheduledCount
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
  const deletionStatus = delayedDeletionService.getStatus();
  
  const healthStatus = {
    status: rabbitmqService.isConnected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      server: 'running',
      rabbitmq: rabbitmqService.isConnected ? 'connected' : 'disconnected',
      delayed_deletion: deletionStatus.isRunning ? 'running' : 'stopped'
    },
    deletion_info: {
      scheduled_count: deletionStatus.scheduledCount,
      deletion_delay_minutes: deletionStatus.deletionDelayMinutes,
      check_interval_seconds: deletionStatus.checkIntervalSeconds,
      scheduled: deletionStatus.scheduledDeletions
    },
    uptime: process.uptime()
  };

  const statusCode = rabbitmqService.isConnected ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

// Fungsi untuk inisialisasi RabbitMQ
async function initializeRabbitMQ() {
  try {
    console.log('🚀 Initializing RabbitMQ services...');
    
    await rabbitmqService.initialize();
    
    // Start delayed deletion service
    delayedDeletionService.start();
    
    console.log('✅ RabbitMQ services initialized successfully');
    console.log('   📋 Storage: No TTL - Messages persist until processed');
    console.log('   🗑️  Deletion: 5 minutes after holder retrieves VCs');
  } catch (error) {
    console.error('❌ Failed to initialize RabbitMQ services:', error);
    console.error('⚠️  Server will continue running, but RabbitMQ features may not work');
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  delayedDeletionService.stop();
  await closeRabbitMQ();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  delayedDeletionService.stop();
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
