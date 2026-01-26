# K6 Performance Tests - Database vs Blockchain

Performance testing suite untuk membandingkan performa query antara PostgreSQL database dan Blockchain menggunakan API performance yang baru.

## Prerequisites

1. **Install K6**

```bash
# Windows (using Chocolatey)
choco install k6

# macOS (using Homebrew)
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

2. **Start Backend Server**

Pastikan backend server sudah running di `http://localhost:3069`

```bash
npm run dev
```

3. **Prepare Test Data**

Pastikan database dan blockchain sudah memiliki data schemas yang bisa di-query.

## Test Scenarios

### GROUP A: Get All Query Scenarios

#### Scenario A1: Baseline Performance (5 minutes)

Mengukur baseline performance dengan 1 virtual user.

```bash
k6 run scenario-a1-baseline.js
```

**Configuration:**
- Virtual Users: 1
- Duration: 5 minutes
- Expected Count: 10 schemas (update dengan `--env EXPECTED_COUNT=N`)

**Metrics yang diukur:**
- Response time (avg, p50, p95, p99)
- Data consistency between database and blockchain
- Speedup factor

#### Scenario A2: Concurrent Load Test (7 minutes)

Mengukur performa degradation dengan concurrent users.

```bash
k6 run scenario-a2-concurrent-load.js
```

**Load Stages:**
- Light: 5 VUs (1 minute)
- Medium: 20 VUs (2 minutes)
- Heavy: 50 VUs (2 minutes)
- Peak: 100 VUs (1 minute)
- Ramp down: 0 VUs (1 minute)

**Metrics yang diukur:**
- Response time per load level
- Error rate progression
- Throughput (requests/second)
- Saturation point identification

## Configuration

### Environment Variables

Customize test dengan environment variables:

```bash
# Set custom base URL
k6 run --env BASE_URL=http://192.168.1.100:3069 scenario-a1-baseline.js

# Set expected schema count
k6 run --env EXPECTED_COUNT=15 scenario-a1-baseline.js

# Set schema IDs untuk testing (comma-separated)
k6 run --env SCHEMA_IDS=id1,id2,id3 scenario-a1-baseline.js
```

### Customize Thresholds

Edit file `config.js` untuk mengubah performance thresholds:

```javascript
export const THRESHOLDS = {
  database: {
    'http_req_duration{endpoint:database}': [
      'p(50)<100',   // Customize ini
      'p(95)<500',
      'p(99)<1000',
    ],
  },
  // ...
};
```

## Output

### Console Output

Setiap test akan menampilkan summary di console:

```
=== Scenario A1: Baseline Performance Summary ===

Database Performance:
  - Average: 78.45 ms
  - Median (p50): 75.20 ms
  - p95: 120.50 ms
  - p99: 150.80 ms
  - Min: 45.10 ms
  - Max: 180.90 ms

Blockchain Performance:
  - Average: 3500.23 ms
  - Median (p50): 3200.45 ms
  - p95: 5000.67 ms
  - p99: 6500.89 ms
  - Min: 2100.12 ms
  - Max: 7200.34 ms

Speedup Factor: 44.62x (Blockchain is 44.62x slower than Database)
```

### JSON Output

Hasil test juga disimpan dalam format JSON:

- `summary.json` - Untuk Scenario A1
- `summary-concurrent-load.json` - Untuk Scenario A2

File ini berisi detail metrics yang bisa dianalisis lebih lanjut.

## API Endpoints yang Ditest

### 1. Get All Schemas from Database
```
GET http://localhost:3069/api/v1/performance/schemas/database
```

Response:
```json
{
  "success": true,
  "source": "database",
  "responseTime": "25ms",
  "count": 10,
  "data": [...]
}
```

### 2. Get All Schemas from Blockchain
```
GET http://localhost:3069/api/v1/performance/schemas/blockchain
```

Response:
```json
{
  "success": true,
  "source": "blockchain",
  "responseTime": "150ms",
  "count": 10,
  "data": [...]
}
```

### 3. Get Specific Schema from Database
```
GET http://localhost:3069/api/v1/performance/schemas/database/:schemaId/:version
```

### 4. Get Specific Schema from Blockchain
```
GET http://localhost:3069/api/v1/performance/schemas/blockchain/:schemaId/:version
```

## Analyzing Results

### Key Metrics to Look For

**Database (PostgreSQL):**
- ✅ p95 should be < 500ms
- ✅ Error rate < 1%
- ✅ Handles 100+ VUs with acceptable degradation

**Blockchain:**
- ⚠️ p95 will be 5-30 seconds
- ⚠️ Error rate increases with load (10-30% at high VUs)
- ⚠️ Saturates at 30-50 VUs

**Speedup Factor:**
- Expected: 10-100x (Blockchain slower than Database)
- Higher speedup = bigger performance gap

### Interpreting Results

1. **Baseline Performance (A1)**
   - Establishes single-user performance
   - Should have 0% error rate
   - Provides baseline speedup factor

2. **Concurrent Load (A2)**
   - Shows how systems scale under load
   - Identifies saturation points
   - Reveals error rates at different load levels

## Troubleshooting

### Common Issues

**Issue: Connection refused**
```
Solution: Ensure backend server is running on http://localhost:3069
```

**Issue: Unexpected error rate**
```
Solution: Check backend logs for errors
        Verify database and blockchain connections
        Reduce concurrent VUs if blockchain is saturated
```

**Issue: Schema count mismatch**
```
Solution: Update EXPECTED_COUNT environment variable
        Check actual data in database and blockchain
```

**Issue: High blockchain error rate**
```
This is expected under high load (50-100 VUs)
Blockchain RPC has rate limits
Document the saturation point
```

## Next Steps

Setelah menjalankan tests:

1. Analyze JSON output untuk detailed metrics
2. Create visualizations (charts, graphs)
3. Document findings untuk research paper
4. Compare results against expected results di TEST_SCENARIOS.md
5. Run additional scenarios jika diperlukan

## File Structure

```
k6-tests/
├── README.md                        # This file
├── config.js                        # Centralized configuration
├── utils.js                         # Helper functions and metrics
├── scenario-a1-baseline.js          # Baseline performance test
├── scenario-a2-concurrent-load.js   # Concurrent load test
├── summary.json                     # Output from A1 (generated)
└── summary-concurrent-load.json     # Output from A2 (generated)
```

## References

- K6 Documentation: https://k6.io/docs/
- TEST_SCENARIOS.md - Detailed test scenarios and expected results
- API Documentation: http://localhost:3069/api-docs

---

**Version:** 1.0
**Last Updated:** December 4, 2025
**Compatible with:** GaneshaDCERT Performance API v2.0
