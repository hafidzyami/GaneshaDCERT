# GaneshaDCERT - Verifiable Credentials Issuance System

A Node.js-based ## 🔍 API Documentation

The API documentation is available via Swagger UI at:
- http://localhost:3000/api-docs

### Main Endpoints

1. **Request VC Issuance**
   - `POST /api/vc-issuance`
   - Request a new Verifiable Credential

2. **Manual Worker Endpoints**
   - `GET /api/manual-worker/next-request?issuer_did={DID}`
     - Fetch next pending request for manual processing
   - `POST /api/manual-worker/issue-vc`
     - Submit manually signed VC for the fetched request

The manual worker endpoints allow operators to process VC requests one at a time, with manual verification and signing steps in between.uing and managing Verifiable Credentials (VCs) using RabbitMQ for message queuing. The system supports manual credential issuance workflow with digital signatures.

## 🏗️ System Architecture

The system consists of several components:
- REST API server for credential requests with manual worker interface
- RabbitMQ message broker for request queue management
- Python-based VC signing tool for manual credential signing
- TypeScript client for testing credential requests

## 🚀 Getting Started

### Prerequisites

- Node.js and npm
- Python 3.x
- Docker and Docker Compose (for RabbitMQ)
- TypeScript

### Installation

1. **Install Node.js Dependencies**
```bash
npm install
```

2. **Install Python Dependencies**
```bash
pip install -r requirements.txt
```

3. **Start RabbitMQ Server**
```bash
docker-compose up -d
```

This will start RabbitMQ with:
- AMQP port: 5672
- Management UI port: 15672
- Default credentials: user/password

## 🔧 Configuration

### Environment Variables
Create a `.env` file with:
```env
API_PORT=3000
RABBITMQ_URL=amqp://user:password@localhost:5672
```

## 💻 Running the Application

### Development Mode

1. **Start the API Server**
```bash
npm run dev:api
```

### Production Mode

1. **Build the TypeScript Code**
```bash
npm run build
```

2. **Start the API Server**
```bash
npm run start:api
```

## � API Documentation

The API documentation is available via Swagger UI at:
- http://localhost:3000/api-docs

### Main Endpoints

1. **Request VC Issuance**
   - `POST /api/vc-issuance`
   - Request a new Verifiable Credential

2. **Manual Worker Endpoints**
   - `GET /api/manual-worker/next-request?issuer_did={DID}`
   - `POST /api/manual-worker/issue-vc`

## 🛠️ Tools and Scripts

### Manual VC Signing Workflow

1. **Start the API Server**
    ```bash
    npm run dev:api
    ```

2. **Fetch Pending Request**
    Run the test client to simulate a credential request:
    ```bash
    npx ts-node client.ts
    ```
3. **Fetch Pending Request**
   ```bash
   # Use the API endpoint to fetch next request
   curl "http://localhost:3000/api/manual-worker/next-request?issuer_did=YOUR_ISSUER_DID"
   ```

4. **Sign VC Using Python Tool**
   ```bash
   # Use the provided Python script to sign the VC
   python sign-vc.py
   ```

5. **Submit Signed VC**
   ```bash
   # Submit the signed VC back through the API
   curl -X POST http://localhost:3000/api/manual-worker/issue-vc -H "Content-Type: application/json" -d '{"jobDetails": {...}, "signedVc": {...}}'
   ```



## 📁 Project Structure

```
GaneshaDCERT/
├── src/
│   ├── config/
│   │   ├── rabbitmq.ts         # RabbitMQ configuration
│   │   └── swaggerDef.ts       # Swagger API documentation
│   ├── controllers/
│   │   ├── issuanceController.ts
│   │   └── manualWorkerController.ts  # Manual processing endpoints
│   ├── routes/
│   │   ├── issuanceRoutes.ts
│   │   └── manualWorkerRoutes.ts
│   ├── services/
│   │   └── signatureService.ts
│   └── index.ts                # Main API server
├── client.ts                   # Test client
├── sign-vc.py                 # Python VC signing tool
├── docker-compose.yml         # Docker configuration
└── package.json
```

## 🔐 Security Features

- Digital signature verification for VC requests
- Queue-based message handling
- Correlation IDs for request tracking
- DID-based routing for multi-issuer support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📝 License

This project is licensed under the MIT License.
