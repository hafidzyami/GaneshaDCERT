# K6 Performance Testing - Schema Query Comparison

Performance testing untuk membandingkan performa antara query PostgreSQL dan query Blockchain langsung.

## Prerequisites

1. Install K6:
   ```bash
   # Windows (via Chocolatey)
   choco install k6

   # Windows (via Scoop)
   scoop install k6

   # MacOS
   brew install k6

   # Linux
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6
   ```

2. Pastikan backend GaneshaDCERT sudah running di port yang dikonfigurasi (default: 3069)

3. Pastikan ada data schema di database dan blockchain untuk testing

## Configuration

Edit `config/config.json` untuk mengubah:
- `baseURL`: URL backend API (default: http://localhost:3069)
- `testDID`: DID untuk testing dengan filter
- `scenarios`: Konfigurasi VUs dan duration untuk masing-masing scenario
- `thresholds`: Target performance yang diharapkan

## Running Tests

### Local Testing (Default)

#### 1. Quick Comparison (Recommended untuk awal)
Test cepat selama 30 detik dengan 10 Virtual Users:

```bash
cd k6-tests

# Windows
run-test.bat

# Linux/Mac
k6 run quick-comparison.js
```

**Output:**
- Console: Real-time comparison logs
- `results/quick-comparison.html`: Visual HTML report
- `results/quick-comparison.json`: Raw JSON data

### Cloud Testing (With Visualization)

Untuk hasil testing yang lebih visual dan bisa di-share:

#### 1. Setup K6 Cloud (One-time)

```bash
# Sign up for free: https://app.k6.io/account/register
# Then login:
k6 login cloud --token YOUR_TOKEN
```

#### 2. Run Quick Test with Cloud Output

```bash
cd k6-tests

# Windows
run-test-cloud.bat

# Linux/Mac
k6 run --out cloud quick-comparison.js
```

**Output:**
- Cloud URL: https://app.k6.io/runs/xxxxx (with graphs!)
- Local HTML: `results/quick-comparison.html`
- Local JSON: `results/quick-comparison.json`

**Benefits:**
- ✅ Beautiful real-time graphs
- ✅ Historical comparison
- ✅ Share results dengan team
- ✅ Trend analysis
- ✅ Free tier: 50 test runs/month

### 2. Full Performance Test
Test lengkap dengan multiple scenarios (total ~7 menit):

```bash
cd k6-tests
k6 run schema-performance-test.js
```

**Scenarios:**
1. **Light Load (0-2m)**: 5 VUs testing both endpoints
2. **Medium Load DB (2-4m)**: 20 VUs testing database only
3. **Medium Load BC (4-6m)**: 10 VUs testing blockchain only
4. **Spike Test (6-7m)**: Sudden spike to 50 VUs on database

**Output:**
- Console: Detailed comparison logs
- `results/summary.html`: Complete HTML report
- `results/summary.json`: Complete JSON data

### 3. Custom Test Duration

```bash
# Test dengan 20 VUs selama 5 menit
k6 run --vus 20 --duration 5m quick-comparison.js

# Test dengan specific scenario
k6 run --stage 1m:10,2m:20,1m:0 quick-comparison.js
```

## Understanding Results

### Key Metrics

1. **http_req_duration**: Total request duration
   - Database endpoint: Target p95 < 500ms
   - Blockchain endpoint: Target p95 < 15s

2. **Custom Metrics:**
   - `database_query_duration`: PostgreSQL query time
   - `blockchain_query_duration`: Blockchain query time
   - `database_error_rate`: Error rate for database queries
   - `blockchain_error_rate`: Error rate for blockchain queries

3. **Comparison:**
   - Speedup factor: How many times faster database vs blockchain
   - Request count: Total requests per endpoint
   - Throughput: Requests per second

### Expected Results

**Database (PostgreSQL):**
- p50: 100-200ms
- p95: 300-500ms
- p99: 500-1000ms
- Throughput: 50-100 req/s

**Blockchain (Direct Query):**
- p50: 5-10s
- p95: 10-15s
- p99: 15-30s
- Throughput: 5-10 req/s

**Speedup Factor:**
- Expected: 50-100x faster (database vs blockchain)

## Viewing Results

### HTML Reports

Open hasil report di browser:

```bash
# Windows
start results/quick-comparison.html
start results/summary.html

# MacOS
open results/quick-comparison.html

# Linux
xdg-open results/quick-comparison.html
```

### JSON Analysis

Untuk analisis programmatic:

```bash
# Pretty print JSON
cat results/quick-comparison.json | jq .

# Extract specific metrics
cat results/quick-comparison.json | jq '.metrics."http_req_duration{endpoint:database}"'
```

## Troubleshooting

### Connection Refused
```
ERRO[0000] GoError: Get "http://localhost:3069/api/v1/schemas": dial tcp: connect: connection refused
```
**Solution:** Pastikan backend sudah running dan port sesuai di config.json

### High Error Rate
```
✗ http_req_failed: rate>0.05
```
**Solution:**
- Check backend logs untuk errors
- Reduce VUs jika terlalu banyak load
- Check database connection pool settings

### Timeout
```
WARN[0030] Request timeout
```
**Solution:**
- Increase timeout di options: `http_req_timeout: '60s'`
- Check blockchain node connection
- Check network latency

## Advanced Usage

### Environment Variables

```bash
# Override base URL
BASE_URL=http://staging.example.com:3000 k6 run quick-comparison.js

# Custom test DID
TEST_DID=did:dcert:xxx k6 run quick-comparison.js
```

### Output to InfluxDB (Optional)

```bash
# Send results to InfluxDB for Grafana visualization
k6 run --out influxdb=http://localhost:8086/k6 quick-comparison.js
```

### Cloud Execution (K6 Cloud)

```bash
# Login to K6 Cloud
k6 login cloud

# Run test in cloud
k6 cloud quick-comparison.js
```

## Test Structure

```
k6-tests/
├── config/
│   └── config.json           # Test configuration
├── lib/
│   └── helpers.js            # Helper functions & custom metrics
├── scenarios/
│   └── schema-comparison.js  # Test scenarios
├── results/                  # Generated reports (gitignored)
│   ├── quick-comparison.html
│   ├── quick-comparison.json
│   ├── summary.html
│   └── summary.json
├── quick-comparison.js       # Quick 30s comparison test
├── schema-performance-test.js # Full performance test
└── README.md                 # This file
```

## Next Steps

1. Run `quick-comparison.js` untuk baseline
2. Analyze hasil dan identify bottlenecks
3. Optimize berdasarkan findings
4. Run `schema-performance-test.js` untuk comprehensive testing
5. Compare before/after optimization results
