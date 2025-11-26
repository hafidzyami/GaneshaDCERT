# GaneshaDCERT

> A blockchain-based decentralized certificate management system implementing W3C DID and Verifiable Credentials standards.

## Overview

GaneshaDCERT provides a secure, tamper-proof platform for issuing, managing, and verifying digital certificates using blockchain technology and cryptographic signatures.

### Core Features

- **Decentralized Identity (DID)** - W3C-compliant identity management with P-256 cryptography
- **Verifiable Credentials (VC)** - Complete lifecycle management (issue, update, renew, revoke)
- **Verifiable Presentations (VP)** - Selective disclosure with QR code support
- **Schema Management** - Version-controlled credential templates
- **Blockchain Integration** - Ethereum-compatible smart contracts for immutability

### Tech Stack

- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL + Prisma ORM
- **Blockchain**: Ethereum (ethers.js)
- **Crypto**: ECDSA P-256, ECIES encryption (@noble/curves, @noble/hashes)
- **Auth**: JWT with DID signature verification
- **Docs**: Swagger/OpenAPI

---

## Quick Start

### Prerequisites

- Node.js v18.20.8 or higher
- PostgreSQL v12 or higher
- npm

### Installation

```bash
# Clone repository
git clone <repository-url>
cd GaneshaDCERT

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Setup database
npx prisma generate
npx prisma db push

# Build and run
npm run build
npm start
```

### Environment Configuration

Create `.env` file with these variables:

```env
# Server
PORT=3000
NODE_ENV=production

# Database
DATABASE_URL="postgresql://user:password@host:5432/ganeshadcert"

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=24h

# Blockchain
BLOCKCHAIN_RPC_URL=https://your-rpc-url
BLOCKCHAIN_PRIVATE_KEY=your_private_key
DID_CONTRACT_ADDRESS=0x...
VC_CONTRACT_ADDRESS=0x...

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure_password
```

### Available Scripts

```bash
npm run dev      # Development with hot-reload
npm start        # Production server
npm run build    # Compile TypeScript
npm run clean    # Remove dist folder
```

---

## API Documentation

Once running, access the interactive API documentation:

**Swagger UI**: http://localhost:3000/api-docs

### Authentication

Most endpoints require JWT authentication:

```
Authorization: Bearer <jwt-token>
```

### Key Endpoints

| Category | Endpoint | Description |
|----------|----------|-------------|
| **DID** | `POST /api/v1/did/institution` | Register institutional DID |
| | `POST /api/v1/did/individual` | Register individual DID |
| | `GET /api/v1/did/:did` | Get DID document |
| | `DELETE /api/v1/did/:did` | Deactivate DID |
| **Schema** | `POST /api/v1/schemas` | Create credential schema |
| | `GET /api/v1/schemas` | List all schemas |
| | `PATCH /api/v1/schemas/:id/activate` | Activate schema |
| **Credential** | `POST /api/v1/credentials/request` | Request VC from issuer |
| | `POST /api/v1/credentials/issuer/issue` | Issue VC directly |
| | `POST /api/v1/credentials/issuer/revoke` | Revoke VC |
| | `GET /api/v1/credentials/holder/:did/claim` | Claim pending VCs |
| **Presentation** | `POST /api/v1/vp/request` | Request VP from holder |
| | `POST /api/v1/vp/create` | Create and share VP |
| | `GET /api/v1/vp/:vpId/verify` | Verify VP |

---

## Architecture

```
┌──────────────────────────────────────────┐
│  API Routes + Swagger + Validators       │
└──────────────────┬───────────────────────┘
                   │
┌──────────────────▼───────────────────────┐
│  Controllers (Request Handlers)          │
└──────────────────┬───────────────────────┘
                   │
┌──────────────────▼───────────────────────┐
│  Services (Business Logic)               │
│  ├─ DID Service                          │
│  ├─ Credential Service                   │
│  ├─ Schema Service                       │
│  ├─ Presentation Service                 │
│  └─ Blockchain Services                  │
└──────────────────┬───────────────────────┘
                   │
┌──────────────────▼───────────────────────┐
│  Data Layer                              │
│  ├─ PostgreSQL (Prisma ORM)              │
│  └─ Ethereum Smart Contracts             │
└──────────────────────────────────────────┘
```

---

## Project Structure

```
GaneshaDCERT/
├── prisma/
│   └── schema.prisma           # Database schema
├── src/
│   ├── config/                 # App configuration
│   ├── controllers/            # Request handlers
│   ├── services/               # Business logic
│   │   └── blockchain/         # Blockchain services
│   ├── middlewares/            # Auth & validation
│   ├── validators/             # Input validation
│   ├── routes/                 # API routes
│   ├── utils/                  # Utilities (encryption, errors)
│   └── index.ts                # Entry point
├── dist/                       # Compiled output
├── .env                        # Environment config
├── package.json
├── tsconfig.json
└── README.md
```

---

## Docker Deployment

```bash
# Build image
docker build -t ganeshadcert .

# Run container
docker run -d \
  --name ganeshadcert \
  -p 3000:3000 \
  --env-file .env \
  ganeshadcert

# View logs
docker logs -f ganeshadcert
```

---

## Security

- **Encryption**: ECIES (P-256) for credential data
- **Signatures**: ECDSA P-256 for authenticity
- **Authentication**: JWT + DID signature verification
- **Access Control**: Role-based (Admin, Institution, Individual)
- **Data Protection**: Encrypted storage, prepared statements (Prisma)
- **Blockchain**: Immutable audit trail

⚠️ **Important**: Never commit private keys or sensitive credentials to version control.

---

## Database Schema

Main tables:

- `DIDRegistry` - DID records and metadata
- `Schema` - Credential schema definitions
- `VCRequest` / `VCResponse` - Holder-initiated VC workflow
- `VCinitiatedByIssuer` - Issuer-initiated VCs
- `IssuerVCData` - Encrypted credential storage
- `VPRequest` / `VPSharing` - Presentation workflow
- `Institution` / `Admin` - User management

View database with Prisma Studio:
```bash
npx prisma studio
```

---

## Troubleshooting

### Common Issues

**Database connection error**
```bash
# Verify PostgreSQL is running and credentials are correct
npx prisma db push
```

**ESM module import error**
```bash
# Rebuild the project
npm run clean && npm run build
```

**JWT token invalid**
```bash
# Ensure JWT_SECRET is consistent and re-login
```

**Blockchain transaction fails**
```bash
# Check RPC connectivity and wallet balance
# Verify contract addresses are correct
```

---

## Development

### Adding New Features

1. Update `prisma/schema.prisma` for database changes
2. Create validators in `src/validators/`
3. Implement business logic in `src/services/`
4. Add controllers in `src/controllers/`
5. Define routes with Swagger docs in `src/routes/`
6. Test via Swagger UI

### Logging

```typescript
import logger from "./config/logger";

logger.info("Information");
logger.warn("Warning");
logger.error("Error", error);
logger.success("Success");
```

Logs are saved in:
- `logs/combined.log` - All logs
- `logs/error.log` - Errors only

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/name`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push to branch (`git push origin feature/name`)
5. Open Pull Request

---

## License

[Specify License]

---

## Acknowledgments

Built with:
- [W3C DID Specification](https://www.w3.org/TR/did-core/)
- [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/)
- [Ethereum](https://ethereum.org/)
- [Prisma](https://www.prisma.io/)
- [Noble Cryptography](https://github.com/paulmillr/noble-curves)

---

**Version**: 2.0.0
**Last Updated**: January 2025
