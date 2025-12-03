# Troubleshooting K6 RocksDB Tests

## Common Issues and Solutions

### Issue 1: All Requests Failing (100% error rate)

**Symptoms:**
```
✗ http_req_failed: 100.00%
✗ status is 200: 0%
```

**Causes:**
1. Test schema IDs don't exist in database
2. Backend not running
3. Wrong port/URL in config

**Solutions:**

#### A. Get Real Schema IDs from Database

```bash
# macOS/Linux
cd k6-tests
./get-schema-ids.sh

# Or directly query:
psql -h localhost -U postgres -d ganeshadcert -c "SELECT id, version FROM \"VCSchema\" LIMIT 5;"
```

#### B. Update Config File

Edit `k6-tests/config/config.json` with real IDs:

```json
{
  "testSchemas": [
    { "id": "abc-123-real-id", "version": 1 }
  ]
}
```

#### C. Verify Backend is Running

```bash
# Check if backend is running
curl http://localhost:3069/api/v1/health

# Or start backend:
npm run dev
```

#### D. Test Endpoint Manually

```bash
# Replace with real schema ID and version
curl http://localhost:3069/api/v1/admin/performance/schema-compare/YOUR_SCHEMA_ID/1
```

Expected response:
```json
{
  "success": true,
  "postgres": { "duration_ms": 45.23, "found": true },
  "rocksdb": { "duration_ms": 0.15, "found": true },
  "comparison": { "speedup_factor": 301.53 }
}
```

---

### Issue 2: Missing Results Directory

**Error:**
```
could not open 'results/rocksdb-comparison.json': no such file or directory
```

**Solution:**
```bash
cd k6-tests
mkdir -p results
```

---

### Issue 3: Schema Not Found (404)

**Error:** All requests return 404

**Causes:**
- Schema ID doesn't exist
- Schema was deleted
- Wrong version number

**Solution:**

1. **Query database for existing schemas:**
   ```sql
   SELECT id, version, name, "isActive" 
   FROM "VCSchema" 
   WHERE "isActive" = true 
   LIMIT 10;
   ```

2. **Create test schemas if none exist:**
   ```bash
   # Use your API to create a test schema
   curl -X POST http://localhost:3069/api/v1/schemas \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{
       "name": "Test Schema",
       "schema": {"type": "object"},
       "issuer_did": "did:ganeshaid:0x123"
     }'
   ```

---

### Issue 4: Cache Not Available

**Warning:** `cache_available: false`

**Causes:**
- RocksDB failed to initialize
- Backend started without cache

**Solution:**

1. **Check backend logs for:**
   ```
   ✓ Schema cache initialized
   ```

2. **If not present, restart backend:**
   ```bash
   npm run dev
   ```

3. **Check for errors in startup:**
   ```
   ✗ Failed to initialize schema cache
   ```

---

### Issue 5: Low or Zero Speedup

**Symptoms:**
```
speedup_factor: avg=0 or avg<2
```

**Causes:**
1. Cache is cold (not populated)
2. All requests getting 404
3. Testing same schemas repeatedly without cache hits

**Solution:**

1. **Ensure schemas exist in database AND cache is initialized**

2. **Run warmup phase first:**
   ```javascript
   // The test already includes warmup - make sure it completes
   // Check logs for "Cache warmup completed"
   ```

3. **Verify cache is working:**
   ```bash
   curl http://localhost:3069/api/v1/admin/performance/schema-compare/YOUR_ID/1
   # Check that rocksdb.found = true
   ```

---

## Quick Diagnostic Steps

### 1. Verify Backend Health

```bash
curl http://localhost:3069/api/v1/health
```

Expected: `status: 200` with services all `true`

### 2. Verify Endpoint Exists

```bash
curl http://localhost:3069/api/v1/admin/performance/schema-compare/test/1
```

Expected: Valid JSON response (even if schema not found, should not be 404 route)

### 3. Check Database Has Schemas

```bash
psql -h localhost -U postgres -d ganeshadcert -c "SELECT COUNT(*) FROM \"VCSchema\";"
```

Expected: Count > 0

### 4. Test with Real Schema

```bash
# Get a real ID first
SCHEMA_ID=$(psql -h localhost -U postgres -d ganeshadcert -t -c "SELECT id FROM \"VCSchema\" LIMIT 1;" | xargs)

# Test the endpoint
curl "http://localhost:3069/api/v1/admin/performance/schema-compare/${SCHEMA_ID}/1"
```

Expected: Success response with timing data

---

## Step-by-Step Fix for Your Current Error

### Step 1: Create Results Directory
```bash
cd k6-tests
mkdir -p results
```

### Step 2: Get Real Schema IDs
```bash
# Option A: Using script
./get-schema-ids.sh

# Option B: Direct query
psql -h localhost -U postgres -d ganeshadcert -c \
  "SELECT id, version, name FROM \"VCSchema\" LIMIT 5;"
```

### Step 3: Update Config
Edit `k6-tests/config/config.json`:

```json
{
  "baseURL": "http://localhost:3069",
  "testSchemas": [
    {
      "id": "PASTE_REAL_ID_HERE",
      "version": 1,
      "description": "Real schema from database"
    }
  ]
}
```

### Step 4: Test Manually First
```bash
# Replace with your real schema ID
curl http://localhost:3069/api/v1/admin/performance/schema-compare/YOUR_REAL_ID/1

# Should return:
# { "success": true, "postgres": {...}, "rocksdb": {...}, "comparison": {...} }
```

### Step 5: Run Quick Test
```bash
cd k6-tests
k6 run quick-rocksdb-comparison.js
```

Expected: 0% errors, speedup > 5x

---

## Success Checklist

- [ ] Backend is running (`npm run dev`)
- [ ] RocksDB cache initialized (check logs: `✓ Schema cache initialized`)
- [ ] Database has schemas (`SELECT COUNT(*) FROM "VCSchema"`)
- [ ] Config has real schema IDs (not test-schema-1, test-schema-2)
- [ ] Results directory exists (`mkdir -p k6-tests/results`)
- [ ] Manual curl test succeeds (returns timing data)
- [ ] Quick test shows speedup > 1x

---

## Still Having Issues?

### Enable Debug Mode

Edit your test file to log responses:

```javascript
const result = testSchemaComparison(baseURL, schema.id, schema.version);
console.log('Response:', JSON.stringify(result, null, 2));
```

### Check Backend Logs

```bash
# In terminal where backend is running
# Look for:
# - Request to /api/v1/admin/performance/schema-compare
# - Any errors or warnings
# - Database query logs
```

### Test Database Connection

```bash
psql -h localhost -U postgres -d ganeshadcert -c "SELECT 1;"
# Should return: 1
```
