// src/index.ts
import express from 'express';
import 'dotenv/config';
import issuanceRoutes from './routes/issuanceRoutes';
import manualWorkerRoutes from './routes/manualWorkerRoutes';
import { getChannel } from './config/rabbitmq';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swaggerDef'; // Impor dari sini

const app = express();
const port = process.env.API_PORT || 3000;

app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec)); // Gunakan objek yang diimpor
app.use('/api/vc-issuance', issuanceRoutes);
app.use('/api/manual-worker', manualWorkerRoutes);

app.listen(port, async () => {
  console.log(`🚀 API server is running on http://localhost:${port}`);
  console.log(`📚 API documentation available at http://localhost:${port}/api-docs`);
  await getChannel();
});