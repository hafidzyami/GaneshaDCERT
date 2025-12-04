# K6 Tests Troubleshooting Guide

## Current Issue: "Responses are not arrays"

Based on your error, the endpoints are responding but the data format isn't matching expectations.

### Quick Fix

Run this diagnostic script to see actual response format:

```bash
k6 run k6-tests/test-endpoint.js
```

This will show you:
- Actual response status
- Response body structure
- Data type and format

### Common Cause

Your API might be returning data in a different format. Check if your response looks like:

**Format 1: With wrapper object (Expected)**
```json
{
  "success": true,
  "count": 5,
  "data": [...]
}
```

**Format 2: Direct array**
```json
[...]
```

**Format 3: Different wrapper**
```json
{
  "schemas": [...]
}
```

### Solution Steps

1. **Run diagnostic:**
   ```bash
   k6 run k6-tests/test-endpoint.js
   ```

2. **Check the output** - it will tell you the response structure

3. **If Format 2 (direct array)**, the fix is already in test-helpers.js

4. **If authentication required**, endpoints return 401:
   - Check if `/api/v1/schemas` and `/api/v1/schemas/blockchain` should be public
   - Or add authentication to tests

5. **Test manually with curl:**
   ```bash
   curl http://localhost:3000/api/v1/schemas
   curl http://localhost:3000/api/v1/schemas/blockchain
   ```

---

## Other Common Issues

### Authentication Required (401)

If you see:
```json
{"statusCode": 401, "message": "Unauthorized"}
```

**Check:** Are these endpoints supposed to be public for testing?

**Quick fix:** Update routes to allow unauthenticated access for GET endpoints

---

### Timeout Errors

If blockchain queries timeout, increase timeout in `test-helpers.js`:
```javascript
const bcResponse = http.get(`${baseURL}/api/v1/schemas/blockchain`, {
  timeout: '180s', // Increase from default
});
```

---

### API Not Running

If you get "Connection refused":
```bash
# Start API
npm run dev

# Verify it's running
curl http://localhost:3000/api/v1/schemas
```

---

## Need More Help?

Run the diagnostic script and share the output:
```bash
k6 run k6-tests/test-endpoint.js
```

This will show exactly what format your API is returning.
