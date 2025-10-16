# DID API Test Cases

## 🧪 HTTP Test Collection

Copy and paste these curl commands to test the API.

---

## 1️⃣ Register DID (Success)

```bash
curl -X POST http://localhost:3000/api/v1/dids \
  -H "Content-Type: application/json" \
  -d '{
    "did_string": "did:ganesh:abc123def456ghi789",
    "public_key": "0x04a34b99f22c790c4e36b2b3c2c35a36db06226e41c692fc82b8b56ac1c540c5bd5b8dec5235a0fa8722476c7709c02559e3aa73aa03918ba2d492eea75abea235",
    "role": "holder"
  }'
```

**Expected:** `201 Created` with transaction details

---

## 2️⃣ Register DID - Invalid Format

```bash
curl -X POST http://localhost:3000/api/v1/dids \
  -H "Content-Type: application/json" \
  -d '{
    "did_string": "invalid-did-format",
    "public_key": "0x04a34b99f22c790c4e36b2b3c2c35a36db06226e41c692fc82b8b56ac1c540c5bd",
    "role": "holder"
  }'
```

**Expected:** `400 Bad Request` - Invalid DID format

---

## 3️⃣ Register DID - Missing did: prefix

```bash
curl -X POST http://localhost:3000/api/v1/dids \
  -H "Content-Type: application/json" \
  -d '{
    "did_string": "ganesh:abc123",
    "public_key": "0x04a34b99f22c790c4e36b2b3c2c35a36db06226e41c692fc82b8b56ac1c540c5bd",
    "role": "holder"
  }'
```

**Expected:** `400 Bad Request` - DID must start with "did:"

---

## 4️⃣ Register DID - Invalid Public Key

```bash
curl -X POST http://localhost:3000/api/v1/dids \
  -H "Content-Type: application/json" \
  -d '{
    "did_string": "did:ganesh:abc123",
    "public_key": "invalid-key",
    "role": "holder"
  }'
```

**Expected:** `400 Bad Request` - Invalid public key format

---

## 5️⃣ Register DID - Invalid Role

```bash
curl -X POST http://localhost:3000/api/v1/dids \
  -H "Content-Type: application/json" \
  -d '{
    "did_string": "did:ganesh:abc123",
    "public_key": "0x04a34b99f22c790c4e36b2b3c2c35a36db06226e41c692fc82b8b56ac1c540c5bd",
    "role": "admin"
  }'
```

**Expected:** `400 Bad Request` - Role must be one of: holder, issuer, verifier

---

## 6️⃣ Get DID Document

```bash
curl http://localhost:3000/api/v1/dids/did:ganesh:abc123def456ghi789/document
```

**Expected:** `200 OK` with DID Document

---

## 7️⃣ Get DID Metadata (NEW)

```bash
curl http://localhost:3000/api/v1/dids/did:ganesh:abc123def456ghi789/metadata
```

**Expected:** `200 OK` with metadata summary

---

## 8️⃣ Key Rotation (Success)

```bash
curl -X PUT http://localhost:3000/api/v1/dids/did:ganesh:abc123def456ghi789/key-rotation \
  -H "Content-Type: application/json" \
  -d '{
    "old_public_key": "0x04a34b99f22c790c4e36b2b3c2c35a36db06226e41c692fc82b8b56ac1c540c5bd5b8dec5235a0fa8722476c7709c02559e3aa73aa03918ba2d492eea75abea235",
    "new_public_key": "0x04b45c88e33d891d5f37c91a4d6e78f23d41c897ef62b9c73f8d65b91e5c632f8c6d9aed6346b1gb9833587d8820d13670f4bb84bb14929cb3e593f571cdfcf346",
    "iteration_number": 2
  }'
```

**Expected:** `200 OK` with rotation transaction

---

## 9️⃣ Key Rotation - Same Keys

```bash
curl -X PUT http://localhost:3000/api/v1/dids/did:ganesh:abc123/key-rotation \
  -H "Content-Type: application/json" \
  -d '{
    "old_public_key": "0x04a34b99f22c790c4e36b2b3c2c35a36db06226e41c692fc82b8b56ac1c540c5bd",
    "new_public_key": "0x04a34b99f22c790c4e36b2b3c2c35a36db06226e41c692fc82b8b56ac1c540c5bd",
    "iteration_number": 2
  }'
```

**Expected:** `400 Bad Request` - Keys must be different

---

## 🔟 Key Rotation - Invalid Iteration

```bash
curl -X PUT http://localhost:3000/api/v1/dids/did:ganesh:abc123/key-rotation \
  -H "Content-Type: application/json" \
  -d '{
    "old_public_key": "0x04a34b99f22c790c4e36b2b3c2c35a36db06226e41c692fc82b8b56ac1c540c5bd",
    "new_public_key": "0x04b45c88e33d891d5f37c91a4d6e78f23d41c897ef62b9c73f8d65b91e5c632f8c",
    "iteration_number": 0
  }'
```

**Expected:** `400 Bad Request` - Iteration must be at least 1

---

## 1️⃣1️⃣ Delete DID

```bash
curl -X DELETE http://localhost:3000/api/v1/dids/did:ganesh:abc123def456ghi789
```

**Expected:** `200 OK` with deletion confirmation

---

## 1️⃣2️⃣ Get Deleted DID Document

```bash
curl http://localhost:3000/api/v1/dids/did:ganesh:deleted123/document
```

**Expected:** `200 OK` (mock still returns document, in production would be 404)

---

## 📝 Postman Collection

Import this JSON into Postman:

```json
{
  "info": {
    "name": "GaneshaDCERT - DID API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Register DID",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"did_string\": \"did:ganesh:{{$randomUUID}}\",\n  \"public_key\": \"0x04a34b99f22c790c4e36b2b3c2c35a36db06226e41c692fc82b8b56ac1c540c5bd5b8dec5235a0fa8722476c7709c02559e3aa73aa03918ba2d492eea75abea235\",\n  \"role\": \"holder\"\n}"
        },
        "url": {
          "raw": "http://localhost:3000/api/v1/dids",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3000",
          "path": ["api", "v1", "dids"]
        }
      }
    },
    {
      "name": "Get DID Document",
      "request": {
        "method": "GET",
        "url": {
          "raw": "http://localhost:3000/api/v1/dids/did:ganesh:abc123/document",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3000",
          "path": ["api", "v1", "dids", "did:ganesh:abc123", "document"]
        }
      }
    },
    {
      "name": "Get DID Metadata",
      "request": {
        "method": "GET",
        "url": {
          "raw": "http://localhost:3000/api/v1/dids/did:ganesh:abc123/metadata",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3000",
          "path": ["api", "v1", "dids", "did:ganesh:abc123", "metadata"]
        }
      }
    },
    {
      "name": "Key Rotation",
      "request": {
        "method": "PUT",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"old_public_key\": \"0x04a34b99f22c790c4e36b2b3c2c35a36db06226e41c692fc82b8b56ac1c540c5bd\",\n  \"new_public_key\": \"0x04b45c88e33d891d5f37c91a4d6e78f23d41c897ef62b9c73f8d65b91e5c632f8c\",\n  \"iteration_number\": 2\n}"
        },
        "url": {
          "raw": "http://localhost:3000/api/v1/dids/did:ganesh:abc123/key-rotation",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3000",
          "path": ["api", "v1", "dids", "did:ganesh:abc123", "key-rotation"]
        }
      }
    },
    {
      "name": "Delete DID",
      "request": {
        "method": "DELETE",
        "url": {
          "raw": "http://localhost:3000/api/v1/dids/did:ganesh:abc123",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3000",
          "path": ["api", "v1", "dids", "did:ganesh:abc123"]
        }
      }
    }
  ]
}
```

---

## 🎯 Testing Checklist

- [ ] All endpoints return standardized response format
- [ ] Error messages are clear and helpful
- [ ] Validation catches all invalid inputs
- [ ] Logs appear in console with proper formatting
- [ ] Swagger documentation loads correctly
- [ ] All status codes are appropriate
- [ ] Response times are acceptable (< 500ms)
