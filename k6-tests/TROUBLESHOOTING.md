# K6 Testing Troubleshooting

## Error: "IP (127.0.0.1) is in a blacklisted range"

### Problem
```
Request Failed error=Get "http://localhost:3069/api/v1/schemas": IP (127.0.0.1) is in a blacklisted range (127.0.0.0/8)
lz="amazon:us:columbus" service_name=unknown_service test_run_id=6220230
```

Ini terjadi karena K6 berjalan dalam **cloud mode** dan K6 Cloud memblock localhost.

### Solution

#### Step 1: Logout dari K6 Cloud

```bash
k6 logout cloud
```

#### Step 2: Check K6 Status

```bash
k6 version
```

Pastikan tidak ada mention tentang cloud/login.

#### Step 3: Run Test LOCAL

```bash
cd k6-tests
k6 run quick-comparison.js
```

**PENTING:** Jangan gunakan command `k6 cloud`!

---

## Alternative: Create Local-Only Config

Jika masih ter-redirect ke cloud, buat file `k6.config.js`:

```javascript
export const options = {
  // Explicitly disable cloud
  ext: {
    loadimpact: {
      projectID: null,
      name: null,
    }
  }
};
```

---

## Check if K6 is Running in Cloud Mode

Indikator K6 cloud mode:
- ✗ Log shows `lz="amazon:us:..."`
- ✗ Log shows `test_run_id=xxxxx`
- ✗ Error: "IP is in blacklisted range"
- ✗ Test URL: `https://app.k6.io/runs/xxxxx`

Indikator K6 local mode:
- ✓ No `lz=` in logs
- ✓ No `test_run_id` in logs
- ✓ Tests run immediately
- ✓ No cloud URL

---

## Manual Command (Guaranteed Local)

```bash
# Explicitly disable cloud
K6_CLOUD_TOKEN="" k6 run quick-comparison.js

# Or use specific flags
k6 run --no-connection-reuse quick-comparison.js
```

---

## Verify Backend is Running

Before running K6 test:

```bash
# Test backend manually
curl http://localhost:3069/api/v1/schemas

# Should return JSON response
```

---

## Full Reset

If nothing works:

```bash
# 1. Logout
k6 logout cloud

# 2. Remove K6 config (if exists)
rm ~/.config/loadimpact/k6

# 3. Run test
cd k6-tests
k6 run quick-comparison.js
```

---

## Contact

If still having issues, check:
1. K6 version: `k6 version`
2. Backend running: `curl localhost:3069/api/v1/schemas`
3. Port correct in config.json: `"baseURL": "http://localhost:3069"`
