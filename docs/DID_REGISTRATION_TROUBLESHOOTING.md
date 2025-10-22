# DID Registration - Troubleshooting & Testing Guide

## 🐛 **ISSUE RESOLVED**

### **Problem:**
Validation error without details when registering DID.

### **Root Cause:**
Validator was using `"institutional"` but API expects `"institution"`.

### **Solution:**
Updated validator to accept `"individual"` or `"institution"`.

---

## ✅ **CORRECT REQUEST FORMAT**

### **Example 1: Register Institution DID**

```bash
curl -X POST http://localhost:3000/api/did \
  -H "Content-Type: application/json" \
  -d '{
    "did_string": "did:ganesha:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "public_key": "0x04a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd",
    "role": "institution",
    "name": "Universitas Indonesia",
    "email": "admin@ui.ac.id",
    "phone": "+6221727001",
    "country": "Indonesia",
    "website": "https://ui.ac.id",
    "address": "Depok, West Java, Indonesia"
  }'
```

### **Example 2: Register Individual DID**

```bash
curl -X POST http://localhost:3000/api/did \
  -H "Content-Type: application/json" \
  -d '{
    "did_string": "did:ganesha:0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
    "public_key": "0x04b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "role": "individual",
    "name": "John Doe",
    "email": "john.doe@student.ui.ac.id"
  }'
```

---

## 📋 **VALIDATION RULES**

### **Required Fields:**

| Field | Type | Validation | Example |
|-------|------|------------|---------|
| `did_string` | string | `did:method:identifier` | `did:ganesha:0x742d35Cc...` |
| `public_key` | string | Hex string (0x + 128-130 chars) | `0x04a1b2c3d4e5f6...` |
| `role` | string | `individual` or `institution` | `institution` |

### **Optional Fields:**

| Field | Type | Validation | Example |
|-------|------|------------|---------|
| `name` | string | 2-255 characters | `Universitas Indonesia` |
| `email` | string | Valid email format | `admin@ui.ac.id` |
| `phone` | string | E.164 format | `+6221727001` |
| `country` | string | 2-100 characters | `Indonesia` |
| `website` | string | Valid URL | `https://ui.ac.id` |
| `address` | string | 5-500 characters | `Depok, West Java` |

---

## ❌ **COMMON ERRORS & SOLUTIONS**

### **Error 1: Invalid Role**

**Request:**
```json
{
  "role": "issuer"  // ❌ Wrong
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "role",
      "message": "Role must be either 'individual' or 'institution'",
      "value": "issuer"
    }
  ]
}
```

**Solution:**
```json
{
  "role": "institution"  // ✅ Correct
}
```

---

### **Error 2: Invalid Public Key Format**

**Request:**
```json
{
  "public_key": "a1b2c3d4e5f6"  // ❌ Missing 0x prefix and too short
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "public_key",
      "message": "Invalid public key format. Must be hex string starting with 0x (64-65 bytes)",
      "value": "a1b2c3d4e5f6"
    }
  ]
}
```

**Solution:**
```json
{
  "public_key": "0x04a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd"
}
```

---

### **Error 3: Invalid DID Format**

**Request:**
```json
{
  "did_string": "did:123456"  // ❌ Invalid format
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "did_string",
      "message": "Invalid DID format. Must follow pattern: did:method:identifier (e.g., did:ganesha:0x123...)"
    }
  ]
}
```

**Solution:**
```json
{
  "did_string": "did:ganesha:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"  // ✅ Correct
}
```

---

### **Error 4: Invalid Email**

**Request:**
```json
{
  "email": "invalid-email"  // ❌ Not a valid email
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "email",
      "message": "Must be a valid email address",
      "value": "invalid-email"
    }
  ]
}
```

**Solution:**
```json
{
  "email": "admin@ui.ac.id"  // ✅ Correct
}
```

---

### **Error 5: Invalid Phone Number**

**Request:**
```json
{
  "phone": "021-7270011"  // ❌ Not in E.164 format
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "phone",
      "message": "Must be a valid phone number in E.164 format (e.g., +62-21-xxx)"
    }
  ]
}
```

**Solution:**
```json
{
  "phone": "+6221727001"  // ✅ Correct (E.164 format)
}
```

---

## 🧪 **TESTING CHECKLIST**

### **Minimal Request (Required Fields Only):**

```json
{
  "did_string": "did:ganesha:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "public_key": "0x04a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd",
  "role": "institution"
}
```

### **Full Request (All Fields):**

```json
{
  "did_string": "did:ganesha:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "public_key": "0x04a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd",
  "role": "institution",
  "name": "Universitas Indonesia",
  "email": "admin@ui.ac.id",
  "phone": "+6221727001",
  "country": "Indonesia",
  "website": "https://ui.ac.id",
  "address": "Depok, West Java, Indonesia"
}
```

---

## 🔍 **DEBUGGING STEPS**

### **Step 1: Check Request Body**
```bash
# Verify your JSON is valid
echo '{...your json...}' | jq .
```

### **Step 2: Check Role Value**
```bash
# Must be exactly "individual" or "institution" (lowercase)
grep -o '"role": "[^"]*"' your-request.json
```

### **Step 3: Check Public Key Format**
```bash
# Must start with 0x and be 130 characters total (0x + 128 hex chars)
echo "0x04a1b2c3..." | wc -c
# Should output: 130 or 132
```

### **Step 4: Test with cURL Verbose Mode**
```bash
curl -v -X POST http://localhost:3000/api/did \
  -H "Content-Type: application/json" \
  -d @request.json
```

---

## 📊 **VALIDATOR CHANGES**

### **Before (Wrong):**
```typescript
body("role")
  .isIn(["individual", "institutional"])  // ❌ "institutional" is wrong
  .withMessage("Role must be 'individual' or 'institutional'"),
```

### **After (Fixed):**
```typescript
body("role")
  .isIn(["individual", "institution"])  // ✅ "institution" is correct
  .withMessage("Role must be either 'individual' or 'institution'"),
```

---

## ✅ **EXPECTED SUCCESS RESPONSE**

```json
{
  "success": true,
  "message": "DID registered successfully",
  "data": {
    "did": "did:ganesha:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "public_key": "0x04a1b2c3d4e5f6...",
    "role": "institution",
    "status": "ACTIVE",
    "blockchain_tx_hash": "0x9876543210fedcba...",
    "created_at": "2025-10-21T10:30:00Z"
  }
}
```

---

## 🚀 **QUICK FIX**

If you're still getting validation errors:

1. ✅ **Update validator** - Already done in `src/validators/did.validator.ts`
2. ✅ **Use correct role** - `"institution"` not `"institutional"`
3. ✅ **Check public key** - Must be 0x + 128 hex characters
4. ✅ **Check DID format** - `did:ganesha:0x...`
5. ✅ **Restart server** - To load new validator

```bash
# Restart your server
npm run dev
# or
yarn dev
```

---

## 📞 **STILL HAVING ISSUES?**

Check the error response for `errors` array:

```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "role",
      "message": "Role must be either 'individual' or 'institution'",
      "value": "issuer"
    }
  ]
}
```

The `errors` array will tell you exactly which field is invalid!

---

**Validator has been fixed! The correct roles are:**
- ✅ `"individual"`
- ✅ `"institution"`
