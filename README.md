# GaneshaDCERT dengan Kafka Integration (Single Node)

API GaneshaDCERT yang telah diintegrasikan dengan Apache Kafka single node untuk arsitektur event-driven menggunakan TypeScript, Express.js, dan KafkaJS.

## 📋 Fitur

- **Express.js API** dengan TypeScript
- **Single Node Kafka** dengan KRaft mode (tanpa Zookeeper)
- **Kafka Producer & Consumer** menggunakan KafkaJS
- **Event-Driven Architecture** untuk VC (Verifiable Credential) requests
- **Swagger Documentation** untuk API endpoints
- **Docker Compose** untuk setup Kafka yang mudah
- **Graceful Shutdown** handling
- **Health Check** endpoints

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Kafka Single Node

```bash
npm run kafka:start
```

### 3. Verifikasi Kafka Running

```bash
npm run kafka:status
```

Atau buka Kafka UI di: http://localhost:8080

### 4. Start API Server

```bash
npm run dev
```

Server akan berjalan di: http://localhost:3000

### 5. Start Consumer Worker (Terminal Terpisah)

```bash
npm run worker
```

## 📚 API Documentation

Akses Swagger UI di: http://localhost:3000/api-docs

### Endpoints

- `GET /` - Welcome message dengan status Kafka
- `GET /health` - Health check server dan Kafka
- `POST /api/requests` - Buat VC request baru
- `GET /api/requests/:request_id/status` - Cek status VC request

### Contoh Request

```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d '{
    "issuer_id": "issuer-001",
    "holder_id": "holder-123",
    "credential_type": "university_degree",
    "credential_data": {
      "degree": "Bachelor of Science",
      "university": "Ganesha University",
      "graduation_year": 2024
    }
  }'
```

## 🏗️ Arsitektur

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Express API   │───▶│ Kafka Single │───▶│  Worker/Consumer │
│  (Producer)     │    │    Node      │    │  (Processor)     │
└─────────────────┘    └──────────────┘    └─────────────────┘
         │                       │                    │
         ▼                       ▼                    ▼
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   POST Request  │    │ Topic:       │    │  Process VC     │
│   VC Request    │    │ vc_requests  │    │  Generate       │
└─────────────────┘    └──────────────┘    └─────────────────┘
```

## 📁 Struktur Proyek

```
src/
├── config/
│   └── kafka.config.ts         # Konfigurasi Kafka single node
├── controllers/
│   └── request.controller.ts   # Controller untuk VC requests
├── services/
│   └── kafka.service.ts        # Kafka service (singleton)
├── routes/
│   └── request.route.ts        # Route definitions
├── index.ts                    # Express server utama
└── worker.ts                   # Consumer worker (terpisah)
```

## 🐳 Docker Commands

```bash
# Start Kafka single node
npm run kafka:start

# Stop Kafka
npm run kafka:stop

# View logs
npm run kafka:logs

# Restart Kafka
npm run kafka:restart

# Clean up (hapus volumes)
npm run kafka:clean

# Check health
npm run kafka:health
```

## 🔧 Development Commands

```bash
# Development server
npm run dev

# Consumer worker
npm run worker

# Build untuk production
npm run build

# Start production
npm start

# Production worker
npm run worker-build
```

## 📊 Monitoring

### Kafka UI
- URL: http://localhost:8080
- Username/Password: Tidak diperlukan

### Health Check
```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-09-26T08:30:00.000Z",
  "services": {
    "server": "running",
    "kafka": "connected"
  }
}
```

## 🐛 Troubleshooting

### 1. Kafka Connection Failed

**Problem:** Error `Connection error: ECONNREFUSED`

**Solution:**
```bash
# Cek status Docker
npm run kafka:status

# Restart Kafka
npm run kafka:restart

# Cek logs
npm run kafka:logs
```

### 2. Port Already in Use

**Problem:** Port 9092 atau 8080 sudah digunakan

**Solution:**
```bash
# Cek proses yang menggunakan port (Windows)
netstat -ano | findstr :9092
netstat -ano | findstr :8080

# Kill proses jika diperlukan
taskkill /PID <PID_NUMBER> /F
```

### 3. Topics Tidak Dibuat

**Problem:** Topics `vc_requests` tidak ada

**Solution:**
- Topics akan dibuat otomatis karena `KAFKA_AUTO_CREATE_TOPICS_ENABLE: true`
- Atau buat manual via Kafka UI: http://localhost:8080

### 4. Consumer Tidak Menerima Messages

**Problem:** Worker tidak log messages

**Solution:**
```bash
# Restart consumer
Ctrl+C (di terminal worker)
npm run worker

# Cek Kafka UI untuk melihat messages
# http://localhost:8080
```

## 📋 Konfigurasi Environment

Buat file `.env`:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Kafka Single Node Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=ganesha-dcert-app

# Kafka Topics
KAFKA_VC_REQUESTS_TOPIC=vc_requests
KAFKA_VC_ISSUANCES_TOPIC=vc_issuances

# Kafka Consumer Group
KAFKA_CONSUMER_GROUP=request-processors

# Application Settings
LOG_LEVEL=info
API_VERSION=v1
```

## 🏃‍♂️ Running in Production

1. Build project:
```bash
npm run build
```

2. Start services:
```bash
# Start Kafka
npm run kafka:start

# Start API server
npm start

# Start worker (terminal terpisah)
npm run worker-build
```

## 💡 Keunggulan Single Node Setup

1. **Simplicity**: Mudah di-setup dan di-maintain
2. **Development Friendly**: Cocok untuk development dan testing
3. **Resource Efficient**: Menggunakan resource minimal
4. **Fast Startup**: Start up lebih cepat dibanding cluster
5. **Easy Debugging**: Lebih mudah untuk debug issues

## 🔄 Upgrade ke Cluster

Jika nantinya butuh high availability, bisa upgrade ke cluster:

1. Ganti docker-compose.yml dengan multi-node setup
2. Update `TOPIC_CONFIG.replicationFactor` ke 3
3. Update `KAFKA_ENV.BROKERS` dengan multiple brokers

## 🤝 Contributing

1. Fork repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push branch: `git push origin feature/new-feature`
5. Create Pull Request

## 📄 License

ISC © Hafidz Yami

---

**Happy Coding! 🚀**
