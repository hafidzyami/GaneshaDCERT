import express, { Request, Response, Application } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const app: Application = express();
const PORT: number = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Middleware untuk parsing JSON
app.use(express.json());

// Opsi Konfigurasi untuk swagger-jsdoc
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0', // Tentukan versi OpenAPI
    info: {
      title: 'API GaneshaDCERT',
      version: '1.0.0',
      description: 'Dokumentasi API untuk layanan GaneshaDCERT',
      contact: {
        name: 'Hafidz Yami',
        url: 'https://github.com/hafidzyami',
      },
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Server Development',
      },
    ],
  },
  // Path ke file API yang ingin Anda dokumentasikan
  apis: ['./src/*.ts', './src/routes/*.ts'], // Perbaiki path untuk mencakup berbagai kemungkinan lokasi file
};

// Generate spesifikasi Swagger
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Debug: Log untuk melihat apakah spec berhasil di-generate
console.log('Swagger Spec:', JSON.stringify(swaggerSpec, null, 2));

// Sajikan Swagger UI di endpoint /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /:
 *   get:
 *     summary: Rute utama aplikasi
 *     description: Mengembalikan pesan selamat datang dari server.
 *     responses:
 *       200:
 *         description: Pesan selamat datang berhasil diterima.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: Halo dari Express + TypeScript!
 */
app.get('/', (req: Request, res: Response) => {
  res.send('GHAYLAN MEMEK');
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  console.log(`Dokumentasi API tersedia di http://localhost:${PORT}/api-docs`);
});
