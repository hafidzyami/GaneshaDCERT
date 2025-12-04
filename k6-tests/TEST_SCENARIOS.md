# Test Scenarios: PostgreSQL vs Blockchain Query Performance

## Research Objective

Compare query performance between PostgreSQL database and direct blockchain queries to understand:
1. **Performance difference** between indexed SQL queries and blockchain full-scan queries
2. **Scalability characteristics** as data volume increases
3. **Behavior under different load levels** (concurrent users)
4. **Real-world implications** for system architecture decisions

---

## Test Scope

### What We're Testing

| Aspect | PostgreSQL | Blockchain |
|--------|-----------|------------|
| **Endpoint** | `GET /api/v1/schemas` | `GET /api/v1/schemas/blockchain` |
| **Query Method** | SQL with indexes | Smart contract `getAllSchemas()` |
| **Data Source** | PostgreSQL database | Blockchain via RPC |
| **Optimization** | B-tree indexes on `id`, `version`, `isActive` | Sequential scan of all data |

### What We're NOT Testing

- ❌ RocksDB cache performance (separate implementation)
- ❌ Filtered queries (blockchain endpoint doesn't support filters)
- ❌ Indexed lookups by specific ID (blockchain endpoint doesn't support)
- ❌ Write performance (only testing reads)

---

## Test Scenarios

## Scenario 1: Baseline Performance Comparison

**Objective:** Establish baseline performance metrics with minimal load

### Configuration
```javascript
{
  name: "baseline_comparison",
  vus: 1,              // Single virtual user
  duration: "2m",      // 2 minutes
  dataSize: "current"  // Use existing data (~3-10 schemas)
}
```

### Test Steps
1. Query PostgreSQL endpoint: `GET /api/v1/schemas`
2. Wait 1 second
3. Query Blockchain endpoint: `GET /api/v1/schemas/blockchain`
4. Wait 1 second
5. Repeat for 2 minutes

### Metrics to Collect
- **Response Time:**
  - Average (mean)
  - Median (p50)
  - 95th percentile (p95)
  - 99th percentile (p99)
  - Min/Max
  
- **Data Consistency:**
  - Record count from SQL
  - Record count from Blockchain
  - Verify counts match

- **Response Size:**
  - Payload size in bytes
  - Number of schemas returned

### Expected Results
- PostgreSQL: 50-500ms response time
- Blockchain: 2-10 seconds response time
- Speedup: SQL 10-50x faster than blockchain

### Success Criteria
- ✅ Both endpoints return same number of schemas
- ✅ Both endpoints return 200 OK status
- ✅ PostgreSQL p95 < 500ms
- ✅ Blockchain p95 < 30 seconds
- ✅ Zero errors

---

## Scenario 2: Data Volume Impact Analysis

**Objective:** Understand how performance scales with increasing data size

### Data Preparation

Create test datasets of different sizes:

| Dataset | Size | Description |
|---------|------|-------------|
| **Small** | 10 schemas | 2 issuers × 5 schemas each |
| **Medium** | 100 schemas | 10 issuers × 10 schemas each |
| **Large** | 1,000 schemas | 50 issuers × 20 schemas each |
| **X-Large** | 10,000 schemas | 100 issuers × 100 schemas each |

### Configuration (Per Dataset)
```javascript
{
  name: "volume_impact",
  vus: 5,              // 5 concurrent users
  duration: "3m",      // 3 minutes per dataset
  iterations: 50       // 50 queries per VU
}
```

### Test Steps
For each dataset size:
1. **Setup:** Populate database with test data
2. **Execute:** Run load test (5 VUs, 3 minutes)
3. **Collect:** Gather performance metrics
4. **Cleanup:** Remove test data
5. **Repeat:** Move to next dataset size

### Metrics to Collect

**Per Dataset Size:**
- PostgreSQL response time (p50, p95, p99)
- Blockchain response time (p50, p95, p99)
- Speedup factor (Blockchain time / PostgreSQL time)
- Response payload size
- Database query time (from logs)
- Blockchain RPC calls made

**Scalability Analysis:**
- Time growth rate as data increases
- PostgreSQL: Expected O(log n) with indexes
- Blockchain: Expected O(n) linear scan
- Crossover point (if any) where performance converges

### Expected Results

| Dataset | PostgreSQL p95 | Blockchain p95 | Speedup Factor |
|---------|---------------|----------------|----------------|
| Small (10) | ~50ms | ~2s | ~40x |
| Medium (100) | ~100ms | ~10s | ~100x |
| Large (1K) | ~200ms | ~60s | ~300x |
| X-Large (10K) | ~500ms | ~600s | ~1200x |

### Success Criteria
- ✅ PostgreSQL shows logarithmic growth (sub-linear)
- ✅ Blockchain shows linear growth
- ✅ Speedup factor increases with data size
- ✅ Zero errors across all dataset sizes
- ✅ Data consistency maintained (SQL count = Blockchain count)

---

## Scenario 3: Concurrent User Load Testing

**Objective:** Measure performance degradation under increasing concurrent load

### Configuration Matrix

| Load Level | VUs | Duration | Ramp-up | Description |
|-----------|-----|----------|---------|-------------|
| **Light** | 5 | 2m | 10s | Normal usage |
| **Medium** | 20 | 3m | 30s | Peak hours |
| **High** | 50 | 3m | 30s | High traffic |
| **Stress** | 100 | 2m | 20s | Stress test |

### Test Steps (Per Load Level)

```javascript
// Example: Medium Load
{
  executor: "ramping-vus",
  stages: [
    { duration: "30s", target: 20 },   // Ramp up to 20 VUs
    { duration: "2m", target: 20 },    // Hold at 20 VUs
    { duration: "30s", target: 0 }     // Ramp down
  ]
}
```

Each VU executes:
1. Query PostgreSQL endpoint
2. Wait 0.5 seconds
3. Query Blockchain endpoint
4. Wait 1 second
5. Repeat

### Metrics to Collect

**Throughput:**
- Requests per second (overall)
- PostgreSQL requests/sec
- Blockchain requests/sec
- Failed requests/sec

**Response Time Under Load:**
- p50, p95, p99 for each load level
- Max response time observed
- Response time degradation percentage

**Resource Usage (if available):**
- Database CPU usage
- Database connection pool utilization
- Blockchain RPC rate limiting hits

**Error Rates:**
- HTTP errors (4xx, 5xx)
- Timeout errors
- Connection errors

### Expected Results

#### PostgreSQL Performance:
```
Load Level | VUs | p95 Response Time | Throughput | Error Rate
Light      | 5   | 100ms            | 50 req/s   | 0%
Medium     | 20  | 200ms            | 100 req/s  | 0%
High       | 50  | 500ms            | 150 req/s  | 0%
Stress     | 100 | 1000ms           | 180 req/s  | 0-5%
```

#### Blockchain Performance:
```
Load Level | VUs | p95 Response Time | Throughput | Error Rate
Light      | 5   | 5s               | 1 req/s    | 0%
Medium     | 20  | 20s              | 2 req/s    | 0-10%
High       | 50  | 60s              | 3 req/s    | 10-30%
Stress     | 100 | 120s+            | 3 req/s    | 30-50%
```

### Success Criteria
- ✅ PostgreSQL handles 100 VUs with acceptable performance (p95 < 2s)
- ✅ PostgreSQL error rate < 5% at stress level
- ✅ Blockchain bottleneck identified (likely RPC rate limiting)
- ✅ Clear documentation of performance degradation patterns

---

## Scenario 4: Spike Test (Sudden Load)

**Objective:** Test system resilience to sudden traffic spikes

### Configuration
```javascript
{
  executor: "ramping-vus",
  stages: [
    { duration: "10s", target: 5 },    // Normal load
    { duration: "5s", target: 100 },   // Sudden spike
    { duration: "30s", target: 100 },  // Hold spike
    { duration: "10s", target: 5 },    // Return to normal
    { duration: "1m", target: 5 }      // Recovery period
  ]
}
```

### Test Steps
1. **Baseline (10s):** 5 VUs establishing normal load
2. **Spike (5s):** Rapid increase to 100 VUs
3. **Hold (30s):** Maintain 100 VUs
4. **Recovery (10s):** Drop back to 5 VUs
5. **Observe (1m):** Monitor recovery to normal performance

### Metrics to Collect

**During Spike:**
- Response time spike (how high does it go?)
- Error rate during spike
- Time to stabilize performance
- Requests queued/dropped

**During Recovery:**
- Time to return to baseline performance
- Residual errors after spike ends
- Connection pool recovery time

### Expected Results
- PostgreSQL: Should handle spike with degradation but recover quickly
- Blockchain: Likely to timeout/fail during spike, slow recovery
- Recovery: PostgreSQL < 10s, Blockchain > 1 minute

### Success Criteria
- ✅ PostgreSQL recovers to baseline within 20 seconds
- ✅ No cascading failures
- ✅ Error rate returns to 0% after recovery
- ✅ Documentation of failure modes during spike

---

## Scenario 5: Endurance Test (Sustained Load)

**Objective:** Identify memory leaks, connection issues, or performance degradation over time

### Configuration
```javascript
{
  vus: 10,              // 10 concurrent users
  duration: "30m",      // 30 minutes sustained
  gracefulStop: "30s"   // Allow cleanup
}
```

### Test Steps
1. Run for 30 minutes with constant 10 VUs
2. Each VU alternates between PostgreSQL and Blockchain queries
3. Monitor performance metrics throughout
4. Compare first 5 minutes vs last 5 minutes

### Metrics to Collect

**Performance Over Time:**
- Response time trend (5-minute buckets)
- Throughput stability
- Error rate over time

**Resource Monitoring:**
- Database connection count
- Memory usage trend
- Open file descriptors
- RPC connection pool status

**Degradation Detection:**
- Compare metrics: minutes 1-5 vs minutes 25-30
- Identify memory leaks (increasing memory usage)
- Identify connection leaks (increasing open connections)

### Expected Results
- PostgreSQL: Stable performance throughout
- Blockchain: May show RPC connection issues over time
- No memory leaks in either system

### Success Criteria
- ✅ Performance variance < 10% between start and end
- ✅ No memory leaks detected
- ✅ No connection pool exhaustion
- ✅ Error rate remains stable (< 1%)

---

## Test Execution Plan

### Phase 1: Preparation (Day 1)

**Tasks:**
1. ✅ Create test data generator script
2. ✅ Set up test environment (ensure blockchain RPC accessible)
3. ✅ Configure k6 test files
4. ✅ Prepare monitoring/logging infrastructure
5. ✅ Validate both endpoints return consistent data

**Deliverables:**
- Test data seeds (10, 100, 1K, 10K schemas)
- K6 test files for each scenario
- Baseline metrics from manual testing

---

### Phase 2: Baseline & Volume Testing (Day 2-3)

**Day 2 Morning:**
- Run Scenario 1 (Baseline) with current data
- Analyze results, adjust thresholds if needed

**Day 2 Afternoon:**
- Run Scenario 2 (Data Volume) - Small & Medium datasets
- Document findings

**Day 3:**
- Run Scenario 2 (Data Volume) - Large & X-Large datasets
- Compare scalability curves
- Generate charts and analysis

---

### Phase 3: Load & Stress Testing (Day 4)

**Day 4 Morning:**
- Run Scenario 3 (Load Testing) - Light & Medium
- Run Scenario 4 (Spike Test)

**Day 4 Afternoon:**
- Run Scenario 3 (Load Testing) - High & Stress
- Document failure modes and bottlenecks

---

### Phase 4: Endurance Testing (Day 5)

**Day 5:**
- Run Scenario 5 (Endurance Test) - 30 minutes
- Monitor for degradation
- Final data collection

---

### Phase 5: Analysis & Reporting (Day 6-7)

**Day 6:**
- Aggregate all test results
- Create performance comparison charts
- Statistical analysis (regression, correlation)

**Day 7:**
- Write research findings
- Create visualizations
- Prepare final report

---

## Data Collection Format

### Test Result Template

For each test scenario, record:

```json
{
  "scenario": "baseline_comparison",
  "timestamp": "2025-12-03T10:30:00Z",
  "configuration": {
    "vus": 1,
    "duration": "2m",
    "dataSize": 10
  },
  "postgresql": {
    "totalRequests": 120,
    "successRate": 100,
    "responseTime": {
      "min": 45,
      "avg": 78,
      "p50": 75,
      "p95": 120,
      "p99": 150,
      "max": 180
    },
    "throughput": 1.0,
    "recordCount": 10,
    "payloadSizeKB": 2.5
  },
  "blockchain": {
    "totalRequests": 120,
    "successRate": 100,
    "responseTime": {
      "min": 2100,
      "avg": 3500,
      "p50": 3200,
      "p95": 5000,
      "p99": 6500,
      "max": 7200
    },
    "throughput": 0.033,
    "recordCount": 10,
    "payloadSizeKB": 2.5,
    "rpcCalls": 120
  },
  "comparison": {
    "speedupFactor": 44.87,
    "timeDifference": 3422,
    "consistencyCheck": "PASS"
  }
}
```

---

## Performance Thresholds

### PostgreSQL Acceptable Limits

```javascript
thresholds: {
  'http_req_duration{endpoint:database}': [
    'p(50)<100',      // 50% of requests under 100ms
    'p(95)<500',      // 95% of requests under 500ms
    'p(99)<1000',     // 99% of requests under 1s
  ],
  'http_req_failed{endpoint:database}': [
    'rate<0.01'       // Less than 1% error rate
  ]
}
```

### Blockchain Expected Limits

```javascript
thresholds: {
  'http_req_duration{endpoint:blockchain}': [
    'p(50)<5000',     // 50% under 5 seconds
    'p(95)<30000',    // 95% under 30 seconds
    'p(99)<60000',    // 99% under 1 minute
  ],
  'http_req_failed{endpoint:blockchain}': [
    'rate<0.1'        // Less than 10% error rate
  ]
}
```

---

## Analysis Framework

### Key Metrics for Research Paper

#### 1. **Performance Comparison**
- Absolute response time difference (milliseconds)
- Speedup factor (Blockchain time / PostgreSQL time)
- Percentage improvement (%)

#### 2. **Scalability Analysis**
- Growth rate as data increases
- Complexity: O(log n) vs O(n)
- Crossover point analysis (if any)

#### 3. **Reliability Under Load**
- Error rates at different VU levels
- Degradation patterns
- Recovery characteristics

#### 4. **Resource Efficiency**
- Requests per second capacity
- Cost per query (RPC costs)
- Infrastructure requirements

### Statistical Analysis

**Calculate for each metric:**
- Mean and standard deviation
- Confidence intervals (95%)
- Correlation analysis (data size vs response time)
- Regression models (predict performance at scale)

### Visualizations to Create

1. **Response Time Comparison Bar Chart**
   - X-axis: Data size (10, 100, 1K, 10K)
   - Y-axis: Response time (ms)
   - Two bars: PostgreSQL vs Blockchain

2. **Scalability Curve**
   - X-axis: Number of records
   - Y-axis: Response time (log scale)
   - Two lines: PostgreSQL (log growth) vs Blockchain (linear growth)

3. **Load Testing Results**
   - X-axis: Virtual Users (5, 20, 50, 100)
   - Y-axis: p95 Response Time
   - Two lines with error bars

4. **Throughput Comparison**
   - X-axis: Load Level
   - Y-axis: Requests per second
   - Two lines showing capacity limits

5. **Spike Test Timeline**
   - X-axis: Time (seconds)
   - Y-axis: Response time
   - Show spike event and recovery

---

## Expected Research Findings

### Hypothesis 1: PostgreSQL is faster for all scenarios
**Expected:** ✅ CONFIRMED
- PostgreSQL uses indexed queries: O(log n)
- Blockchain uses full scan: O(n)
- Gap widens as data grows

### Hypothesis 2: Performance gap increases with data size
**Expected:** ✅ CONFIRMED
- Small data (10): ~40x faster
- Large data (10K): ~1200x faster
- Linear vs logarithmic scalability

### Hypothesis 3: Blockchain hits RPC rate limits under load
**Expected:** ✅ CONFIRMED
- RPC providers limit requests/second
- High VU tests will show errors/timeouts
- PostgreSQL scales better with concurrent users

### Hypothesis 4: PostgreSQL maintains consistency under stress
**Expected:** ✅ CONFIRMED
- Database connection pooling handles spikes
- Quick recovery after spike ends
- Blockchain may have cascading failures

---

## Conclusion & Recommendations

### When to Use PostgreSQL (Recommended)
- ✅ Production read queries
- ✅ High-frequency access
- ✅ Multiple concurrent users
- ✅ Complex filtering/searching
- ✅ Latency-sensitive applications

### When Blockchain Query is Acceptable
- ✅ Audit/verification purposes
- ✅ Low-frequency access
- ✅ Single-user scenarios
- ✅ Small datasets (< 100 records)
- ⚠️ When absolute blockchain verification needed

### Architecture Recommendation
```
Blockchain (Source of Truth - Write)
    ↓ Events
Event Listener (Synchronization)
    ↓
PostgreSQL (Optimized Reads)
    ↓
API Endpoints (Production Traffic)
```

**Best Practice:** 
- Write to blockchain for immutability
- Sync to PostgreSQL via event listener
- Read from PostgreSQL for performance
- Use blockchain queries only for verification

---

## Appendix

### Test Environment Specifications

**Database:**
- PostgreSQL version: [to be filled]
- Connection pool size: [to be filled]
- Indexes: `id`, `version`, `isActive`

**Blockchain:**
- Network: [to be filled]
- RPC provider: [to be filled]
- Rate limits: [to be filled]
- Smart contract address: [to be filled]

**Load Testing:**
- k6 version: latest
- Test runner location: [local/cloud]
- Network conditions: [to be documented]

### Test Data Schema

```json
{
  "id": "uuid-v4",
  "version": 1,
  "name": "Test Schema Name",
  "schema": { /* JSON Schema */ },
  "issuer_did": "did:dcert:issuer-xxx",
  "issuer_name": "Test Issuer",
  "image_link": "https://example.com/image.png",
  "expired_in": 5,
  "isActive": true,
  "createdAt": "2025-12-03T00:00:00Z",
  "updatedAt": "2025-12-03T00:00:00Z"
}
```

### Contact & Support

- Research Lead: [Name]
- Technical Contact: [Name]
- Repository: hafidzyami/GaneshaDCERT
- Branch: paper

---

**Document Version:** 1.0  
**Last Updated:** December 3, 2025  
**Status:** Ready for Implementation
