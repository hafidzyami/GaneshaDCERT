# K6 Performance Testing Guide

This directory contains performance tests for the GaneshaDCERT API, including:
1. **PostgreSQL vs Blockchain** comparison (original tests)
2. **PostgreSQL vs RocksDB** cache comparison (new tests for research)

---

## Prerequisites

### 1. Install K6

```bash
# macOS
brew install k6

# Windows (via Chocolatey)
choco install k6

# Windows (via Scoop)
scoop install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### 2. Backend Requirements

- GaneshaDCERT API running on port 3069 (or configured port)
- PostgreSQL database with schema data
- RocksDB cache initialized (for RocksDB tests)
- Some test schemas in the database

### 3. Configuration

Edit `config/config.json`:

```json
{
  "baseURL": "http://localhost:3069",
  "testSchemas": [
    { "id": "your-schema-id", "version": 1 }
  ]
}
```

**Important:** Replace `your-schema-id` with actual schema IDs from your database!

---

## Test Suites

### 🆕 RocksDB Cache Performance Tests

Tests comparing PostgreSQL vs RocksDB cache performance.

#### Quick Test (30 seconds)

Fast validation of cache performance:

```bash
cd k6-tests
k6 run quick-rocksdb-comparison.js
```

**What it tests:**
- 10 Virtual Users for 30 seconds
- Random schema access pattern
- Basic cache hit rate
- Speedup factor measurement

**Expected results:**
- PostgreSQL: ~50-500ms per query
- RocksDB: ~0.1-10ms per query
- Speedup: 10-100x faster

#### Full Comparison Test (4 minutes)

Comprehensive test with multiple scenarios:

```bash
cd k6-tests
k6 run rocksdb-comparison-test.js
```

**Test phases:**
1. **Cache Warmup** (30s): Populate RocksDB cache
2. **Sustained Load** (2m): 50 VUs testing warm cache
3. **Spike Test** (50s): Ramp to 200 VUs to test under pressure

**Metrics tracked:**
- Query duration (PostgreSQL vs RocksDB)
- Speedup factor (how many times faster)
- Cache hit rate
- Time saved per query
- Error rates

**Output files:**
- `results/rocksdb-comparison.html` - Visual report
- `results/rocksdb-comparison.json` - Raw data

#### Cloud Testing (with Grafana Visualization)

Send results to Grafana Cloud k6 for beautiful visualizations:

```bash
# One-time setup
k6 login cloud --token YOUR_TOKEN

# Run test with cloud output
k6 run --out cloud rocksdb-comparison-test.js
```

View results at: https://app.k6.io/runs/xxxxx

**Benefits:**
- Real-time performance graphs
- Historical comparison
- Share results with team
- Export for research papers

---

### Original Tests (PostgreSQL vs Blockchain)

#### Quick Comparison

```bash
k6 run quick-comparison.js
```

#### Full Performance Test

```bash
k6 run schema-performance-test.js
```

---

## Understanding Results

### Key Metrics for RocksDB Tests

1. **postgres_query_duration**
   - Time taken to query PostgreSQL
   - Target: p95 < 500ms

2. **rocksdb_query_duration**
   - Time taken to query RocksDB cache
   - Target: p95 < 50ms (10x faster than PostgreSQL)

3. **speedup_factor**
   - How many times faster RocksDB is than PostgreSQL
   - Formula: `postgres_duration / rocksdb_duration`
   - Target: avg > 5x (typically 10-100x)

4. **cache_hit_rate**
   - Percentage of requests served from cache
   - Target: > 95% after warmup

5. **time_saved_ms**
   - Milliseconds saved per query by using cache
   - Direct impact on API response time

### Sample Output

```
PostgreSQL Query Times:
  Average: 245.32ms
  p95: 456.78ms

RocksDB Query Times:
  Average: 2.15ms
  p95: 8.34ms

Speedup Factor:
  Average: 114.10x faster
  p95: 54.76x

Cache Performance:
  Hit Rate: 98.5%
```

---

## Troubleshooting

### Test Schemas Not Found (404 errors)

**Problem:** Test is getting 404 errors

**Solution:**
1. Check if schemas exist in database:
   ```sql
   SELECT id, version FROM "VCSchema" LIMIT 10;
   ```
2. Update `config/config.json` with actual schema IDs
3. Or create test schemas via API

### Cache Not Available

**Problem:** `cache_available: false` in results

**Solution:**
1. Ensure RocksDB is initialized (check server logs)
2. Restart backend: `npm run dev`
3. Look for: `✓ Schema cache initialized`

### Low Speedup Factor (<5x)

**Problem:** RocksDB is not much faster than PostgreSQL

**Possible causes:**
1. Cache is cold (not populated) - Run warmup phase
2. Testing wrong endpoint - Should use `/admin/performance/schema-compare`
3. Database is cached by OS - Normal, RocksDB still has advantages

### High Error Rate

**Problem:** > 1% errors during test

**Solution:**
1. Check backend logs for errors
2. Reduce VUs (might be overloading)
3. Increase test duration
4. Check database connection

---

## Test Configuration Reference

### config/config.json

```json
{
  "baseURL": "http://localhost:3069",
  "testSchemas": [
    { "id": "schema-1", "version": 1, "description": "Test schema" }
  ],
  "scenarios": {
    "quickTest": { "vus": 10, "duration": "30s" },
    "warmCacheTest": { "vus": 50, "duration": "2m" },
    "spikeTest": { "vus": 200, "duration": "30s" }
  },
  "thresholds": {
    "postgres": { "p95": 500, "p99": 1000 },
    "rocksdb": { "p95": 50, "p99": 100 }
  }
}
```

### Custom Thresholds

Edit the test file to add custom thresholds:

```javascript
thresholds: {
  'speedup_factor': ['avg>10'],        // Require 10x average speedup
  'cache_hit_rate': ['rate>0.99'],     // Require 99% cache hit rate
  'http_req_failed': ['rate<0.001'],   // Allow < 0.1% errors
}
```

---

## For Research Papers

### Data Collection

All test results are saved in JSON format for analysis:

```bash
# Run test and save results
k6 run rocksdb-comparison-test.js

# Results location
cat results/rocksdb-comparison.json
```

### Key Metrics to Report

1. **Latency Reduction**
   - PostgreSQL p50, p95, p99
   - RocksDB p50, p95, p99
   - Percentage improvement

2. **Throughput**
   - Requests per second
   - With and without cache

3. **Cache Effectiveness**
   - Hit rate percentage
   - Miss penalty

4. **Resource Usage**
   - Memory (RocksDB cache size)
   - CPU usage during tests

### Example Results Table

| Metric | PostgreSQL | RocksDB | Improvement |
|--------|-----------|---------|-------------|
| p50 latency | 245ms | 2.1ms | 116.7x faster |
| p95 latency | 456ms | 8.3ms | 54.9x faster |
| p99 latency | 789ms | 15.2ms | 51.9x faster |
| Cache hit rate | N/A | 98.5% | N/A |

---

## Files Reference

### Test Files
- `quick-rocksdb-comparison.js` - 30s quick validation
- `rocksdb-comparison-test.js` - Full 4-minute test suite
- `quick-comparison.js` - PostgreSQL vs Blockchain (original)
- `schema-performance-test.js` - Full blockchain test (original)

### Helper Files
- `scenarios/rocksdb-comparison.js` - RocksDB test helpers
- `scenarios/schema-comparison.js` - Blockchain test helpers
- `lib/helpers.js` - Common utilities
- `config/config.json` - Test configuration

### Output Files
- `results/*.html` - Visual reports
- `results/*.json` - Raw test data

---

## Next Steps

1. ✅ Run quick test to validate setup
2. ✅ Update config with real schema IDs
3. ✅ Run full comparison test
4. ✅ Upload to Grafana Cloud k6 for visualization
5. ✅ Collect data for research paper
6. ✅ Compare with baseline (PostgreSQL only)

Happy testing! 🚀
