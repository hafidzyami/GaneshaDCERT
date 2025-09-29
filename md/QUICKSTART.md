# 🚀 Quick Start Guide - RabbitMQ Version

## 📦 Installation

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Start RabbitMQ
npm run rabbitmq:start

# 4. Start server
npm run dev
```

## ✅ Verify Installation

Open in browser:
- API: http://localhost:3000
- Swagger Docs: http://localhost:3000/api-docs
- RabbitMQ UI: http://localhost:15672 (admin/admin123)

## 🧪 Test the API

### 1. Create VC Request
```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d '{
    "issuer_did": "did:example:issuer123",
    "holder_did": "did:example:holder456",
    "credential_type": "bachelor_degree",
    "credential_data": {
      "university": "Ganesha University",
      "major": "Computer Science",
      "graduation_year": 2024
    }
  }'
```

### 2. Get Requests (First Time)
```bash
curl "http://localhost:3000/api/requests?issuer_did=did:example:issuer123"
```
Result: **1 request found** ✅

### 3. Get Requests Again (Immediately)
```bash
curl "http://localhost:3000/api/requests?issuer_did=did:example:issuer123"
```
Result: **0 requests** (already deleted!) ✅

## 🎯 Key Features

- ✅ **Auto-delete**: Messages deleted immediately after fetch (ACK)
- ✅ **TTL 5 minutes**: Unused messages expire automatically
- ✅ **Simple**: No complex cleanup code needed
- ✅ **Lightweight**: Uses ~100MB memory vs Kafka's ~1GB

## 📖 Full Documentation

- **RABBITMQ_MIGRATION.md** - Why RabbitMQ is better
- **IMPLEMENTATION_SUMMARY.md** - Technical details
- **Swagger UI** - Interactive API docs at `/api-docs`

## 🛑 Stop Services

```bash
# Stop server: Ctrl+C

# Stop RabbitMQ
npm run rabbitmq:stop
```

---

**That's it! You're ready to go!** 🎉
