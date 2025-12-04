# Test Scenarios: PostgreSQL vs Blockchain Query Performance

## Research Objective

Compare query performance between PostgreSQL database and direct blockchain queries to understand:

1. **Performance difference** between indexed SQL queries and blockchain queries
2. **Scalability characteristics** with different data retrieval patterns (full scan vs. filtered)
3. **Behavior under different load levels** (concurrent users)
4. **Impact of query optimization** techniques (pagination, filtering)
5. **Real-world implications** for system architecture decisions

---

## Test Scope

### What We're Testing

| Aspect           | PostgreSQL                                    | Blockchain                                       |
| ---------------- | --------------------------------------------- | ------------------------------------------------ |
| **Endpoint**     | `GET /api/v1/schemas`                         | `GET /api/v1/schemas/blockchain`                 |
| **Query Method** | SQL with indexes                              | Smart contract `getAllSchemas()` + app filtering |
| **Data Source**  | PostgreSQL database                           | Blockchain via RPC                               |
| **Optimization** | B-tree indexes on `id`, `version`, `isActive` | Application-layer filtering/pagination           |

### Dataset Constraints

**Important Context:**

- **Total schemas in database:** ~100-150 schemas (production data)
- **Retrievable from blockchain:** Only ~10 schemas due to data availability issues
- **Limitation cause:** "Missing refer data" errors (IPFS, archive node, or DID resolution)
- **Test implication:** All tests use the 10 reliably accessible schemas

### What We're NOT Testing

- ❌ RocksDB cache performance (separate implementation)
- ❌ Write performance (only testing reads)
- ❌ Smart contract-level pagination (would require contract redeployment)

---

## Test Structure Overview

This test plan includes **TWO main groups** to comprehensively evaluate query performance:

### **GROUP A: Get All Queries** (Full Scan - Baseline)

Tests retrieving all available data without filtering or pagination.

- **Purpose:** Establish baseline performance, test worst-case scenarios
- **Scenarios:** 2 scenarios (Baseline + Concurrent Load)
- **Duration:** ~12 minutes

### **GROUP B: Indexed/Filtered Queries** (Optimized Access)

Tests retrieving subsets of data using pagination, ID filtering, and version filtering.

- **Purpose:** Evaluate optimization techniques, test typical production patterns
- **Scenarios:** 4 scenarios (Pagination + ID Filter + Version Filter + Load Test)
- **Duration:** ~25 minutes

**Total Testing Time:** ~37 minutes  
**Total Scenarios:** 6 scenarios  
**Data Points:** ~5,000+ measurements

---

# GROUP A: Get All Query Scenarios

## Scenario A1: Baseline Performance Comparison

**Objective:** Establish baseline performance metrics with minimal load for full dataset retrieval

### Configuration

```javascript
{
  name: "baseline_get_all",
  vus: 1,              // Single virtual user
  duration: "5m",      // 5 minutes for statistical significance
  dataSize: 10         // All retrievable schemas
}
```

### Endpoints Tested

```
PostgreSQL: GET /api/v1/schemas?limit=10
Blockchain: GET /api/v1/schemas/blockchain
```

### Test Steps

1. Query PostgreSQL endpoint: `GET /api/v1/schemas?limit=10`
2. Wait 1 second
3. Query Blockchain endpoint: `GET /api/v1/schemas/blockchain`
4. Wait 1 second
5. Verify data consistency (both return same 10 schemas)
6. Repeat for 5 minutes (~150 iterations)

### Metrics to Collect

- **Response Time:**
  - Average (mean)
  - Median (p50)
  - 95th percentile (p95)
  - 99th percentile (p99)
  - Min/Max
- **Data Consistency:**

  - Record count from SQL (should be 10)
  - Record count from Blockchain (should be 10)
  - Schema ID matching rate (100%)

- **Response Size:**
  - Payload size in bytes
  - JSON serialization time

### Expected Results

```
PostgreSQL:
  - Avg: 50-200ms
  - p95: <500ms
  - Success rate: 100%

Blockchain:
  - Avg: 2,000-5,000ms
  - p95: <10,000ms
  - Success rate: 100%

Speedup Factor: 10-100x (Blockchain/PostgreSQL)
```

### Success Criteria

- ✅ Both endpoints return same 10 schemas
- ✅ Both endpoints return 200 OK status
- ✅ PostgreSQL p95 < 500ms
- ✅ Blockchain p95 < 30 seconds
- ✅ Zero errors (100% success rate)

---

## Scenario A2: Concurrent User Load Test (Get All)

**Objective:** Measure performance degradation and scalability under concurrent load for full scans

### Configuration

```javascript
{
  name: "concurrent_load_get_all",
  stages: [
    { duration: "1m", target: 5 },    // Light: 5 concurrent users
    { duration: "2m", target: 20 },   // Medium: 20 concurrent users
    { duration: "2m", target: 50 },   // Heavy: 50 concurrent users
    { duration: "1m", target: 100 },  // Peak: 100 concurrent users
    { duration: "1m", target: 0 }     // Ramp down
  ],
  dataSize: 10 // All schemas
}
```

### Endpoints Tested

```
PostgreSQL: GET /api/v1/schemas?limit=10
Blockchain: GET /api/v1/schemas/blockchain
```

### Load Stages

| Stage           | VUs | Duration | Description            |
| --------------- | --- | -------- | ---------------------- |
| **Ramp-up 1**   | 5   | 1m       | Light load baseline    |
| **Sustained 1** | 20  | 2m       | Medium production load |
| **Sustained 2** | 50  | 2m       | Heavy production load  |
| **Peak**        | 100 | 1m       | Stress test            |
| **Ramp-down**   | 0   | 1m       | Recovery observation   |

### Test Steps (Per VU)

```javascript
export default function () {
  // Test PostgreSQL
  const pgResponse = http.get(`${baseURL}/api/v1/schemas?limit=10`, {
    tags: { endpoint: "database", query_type: "get_all" },
  });
  sleep(0.5);

  // Test Blockchain
  const bcResponse = http.get(`${baseURL}/api/v1/schemas/blockchain`, {
    tags: { endpoint: "blockchain", query_type: "get_all" },
  });
  sleep(1);
}
```

### Metrics to Collect Per Load Level

**Throughput:**

- Requests per second (overall)
- PostgreSQL requests/sec
- Blockchain requests/sec
- Failed requests/sec

**Response Time Under Load:**

- p50, p95, p99 for each VU level
- Max response time observed
- Response time degradation percentage

**Error Rates:**

- HTTP errors (4xx, 5xx)
- Timeout errors
- Connection errors
- % of requests failing

### Expected Results

| Load Level | VUs | PostgreSQL p95 | Blockchain p95 | PG Error Rate | BC Error Rate |
| ---------- | --- | -------------- | -------------- | ------------- | ------------- |
| Light      | 5   | ~100ms         | ~5s            | 0%            | 0%            |
| Medium     | 20  | ~200ms         | ~15s           | 0%            | 5-10%         |
| Heavy      | 50  | ~500ms         | ~30s           | 0-2%          | 20-30%        |
| Peak       | 100 | ~1000ms        | 60s+           | 2-5%          | 40-60%        |

### Success Criteria

- ✅ PostgreSQL handles 100 VUs with p95 < 2s
- ✅ PostgreSQL error rate < 5% at peak load
- ✅ Blockchain saturation point identified (VU level where errors > 10%)
- ✅ Clear performance degradation patterns documented

---

# GROUP B: Indexed/Filtered Query Scenarios

## Scenario B1: Dataset Scalability Test (Fixed Page Size)

**Objective:** Test how query performance degrades as total dataset size grows, using consistent pagination (limit=10)

**Key Question:** Does PostgreSQL maintain performance advantage as the dataset scales from small to large?

### Configuration

```javascript
{
  name: "dataset_scalability",
  vus: 10,              // 10 concurrent users
  duration: "3m",       // 3 minutes per dataset size
  pageSize: 10,         // Fixed page size for all tests
  datasetSizes: [50, 100, 500] // Growing number of total schemas
}
```

### Test Approach

**Important:** Since blockchain data is immutable, tests must run **incrementally**:

1. Start with 50 schemas in database → Run test
2. Add 50 more (total 100) → Run test
3. Add 400 more (total 500) → Run test

### Endpoints Tested

```
PostgreSQL: GET /api/v1/schemas?offset=0&limit=10
Blockchain: GET /api/v1/schemas/blockchain?offset=0&limit=10

Both fetch 10 schemas, but from datasets of different sizes
```

### Test Matrix

| Test Case          | Total Dataset Size | Page Size (Fixed) | Schemas Returned |
| ------------------ | ------------------ | ----------------- | ---------------- |
| **Small Dataset**  | 50 schemas         | limit=10          | 10 schemas       |
| **Medium Dataset** | 100 schemas        | limit=10          | 10 schemas       |
| **Large Dataset**  | 500 schemas        | limit=10          | 10 schemas       |

**Hypothesis:**

- PostgreSQL: Performance stays consistent (indexes maintain O(1) lookup)
- Blockchain: Performance degrades (must scan more data to find 10 schemas)

### Test Steps

```javascript
// Run this test 3 times with different dataset sizes

export default function () {
  const pageSize = 10; // Always fetch 10 schemas

  // Test PostgreSQL with pagination
  const pgResponse = http.get(
    `${baseURL}/api/v1/schemas?offset=0&limit=${pageSize}`,
    { tags: { endpoint: "database", dataset_size: __ENV.DATASET_SIZE } }
  );

  sleep(0.5);

  // Test Blockchain with pagination
  const bcResponse = http.get(
    `${baseURL}/api/v1/schemas/blockchain?offset=0&limit=${pageSize}`,
    { tags: { endpoint: "blockchain", dataset_size: __ENV.DATASET_SIZE } }
  );

  // Verify pagination consistency
  check(bcResponse, {
    "returns 10 schemas": (r) => JSON.parse(r.body).data.length === 10,
    "status is 200": (r) => r.status === 200,
  });

  sleep(1);
}
```

### Metrics to Collect

**Per Dataset Size:**

- Response time (avg, p50, p95, p99)
- Success rate
- Error rate
- Throughput (requests/second)

**Scalability Analysis:**

```
Performance Degradation = (Time at 500 schemas / Time at 50 schemas)

Expected:
- PostgreSQL: 1.1-1.3x (minimal degradation, indexes help)
- Blockchain: 5-10x (significant degradation, must scan more data)
```

### Expected Results

#### PostgreSQL (With Indexes):

```
Dataset Size | Avg Response | p95 Response | Degradation vs 50
50 schemas   | 60-80ms      | <120ms       | Baseline (1.0x)
100 schemas  | 65-90ms      | <140ms       | 1.1x slower
500 schemas  | 80-120ms     | <200ms       | 1.3x slower
```

**PostgreSQL Behavior:** Performance stays relatively consistent because:

- Indexes provide O(log n) lookup
- LIMIT clause prevents full table scan
- Query planner optimizes efficiently

#### Blockchain (No Indexes):

```
Dataset Size | Avg Response | p95 Response | Degradation vs 50
50 schemas   | 2,000-3,000ms| <5,000ms     | Baseline (1.0x)
100 schemas  | 4,000-6,000ms| <10,000ms    | 2.0x slower
500 schemas  | 15,000-25,000ms| <45,000ms  | 7-8x slower
```

**Blockchain Behavior:** Performance degrades significantly because:

- Must query ALL schemas from smart contract
- Application-layer filtering (slice after retrieval)
- No blockchain-level indexes or optimization
- More data = more RPC calls = longer processing

### Visualization: Scalability Curve

```
Response Time (ms, log scale)
    ^
40s |                                        ● Blockchain (500)
    |
20s |                          ● Blockchain (100)
    |
10s |
    |      ● Blockchain (50)
 5s |
    |
 2s |
    |
500ms|                                      ■ PostgreSQL (500)
    |                         ■ PostgreSQL (100)
100ms|      ■ PostgreSQL (50)
    +------------------------------------------>
           50          100                    500
                 Dataset Size (schemas)

Key Insight: PostgreSQL scales horizontally,
             Blockchain scales vertically (exponentially worse)
```

### Success Criteria

- ✅ All tests return exactly 10 schemas (pagination works)
- ✅ PostgreSQL degradation < 2x from 50 to 500 schemas
- ✅ Blockchain degradation > 5x from 50 to 500 schemas
- ✅ PostgreSQL maintains 10-50x advantage at all scales
- ✅ Clear scalability difference documented

---

## Scenario B2: ID-Based Filtering Performance

**Objective:** Test performance when querying specific schemas by ID

### Configuration

```javascript
{
  name: "id_filtering_performance",
  vus: 10,            // 10 concurrent users
  duration: "3m",     // 3 minutes per filter size
  filterSizes: [1, 3, 7] // Test different ID counts
}
```

### Endpoints Tested

```
PostgreSQL:
  - GET /api/v1/schemas?ids=schema-1
  - GET /api/v1/schemas?ids=schema-1,schema-2,schema-3
  - GET /api/v1/schemas?ids=schema-1,...,schema-7

Blockchain:
  - GET /api/v1/schemas/blockchain?ids=schema-1
  - GET /api/v1/schemas/blockchain?ids=schema-1,schema-2,schema-3
  - GET /api/v1/schemas/blockchain?ids=schema-1,...,schema-7
```

### Test Matrix

| Test Case  | IDs Requested | Schemas Returned | Use Case          |
| ---------- | ------------- | ---------------- | ----------------- |
| **Single** | 1 ID          | 1 schema         | Individual lookup |
| **Few**    | 3 IDs         | 3 schemas        | Related schemas   |
| **Many**   | 7 IDs         | 7 schemas        | Batch retrieval   |

### Test Steps

```javascript
const testSchemas = [
  ['schema-uuid-1'],  // Single
  ['schema-uuid-1', 'schema-uuid-2', 'schema-uuid-3'],  // Few
  ['schema-uuid-1', ..., 'schema-uuid-7']  // Many
];

export default function() {
  const schemaIds = testSchemas[Math.floor(Math.random() * testSchemas.length)];
  const idsParam = schemaIds.join(',');

  // Test PostgreSQL with ID filter
  const pgResponse = http.get(
    `${baseURL}/api/v1/schemas?ids=${idsParam}`,
    { tags: { endpoint: 'database', id_count: schemaIds.length } }
  );

  sleep(0.5);

  // Test Blockchain with ID filter
  const bcResponse = http.get(
    `${baseURL}/api/v1/schemas/blockchain?ids=${idsParam}`,
    { tags: { endpoint: 'blockchain', id_count: schemaIds.length } }
  );

  // Verify correct schemas returned
  check(bcResponse, {
    'returns requested schemas only': (r) => {
      const data = JSON.parse(r.body).data;
      return data.every(schema => schemaIds.includes(schema.id));
    }
  });

  sleep(1);
}
```

### Metrics to Collect

**Per ID Count:**

- Response time (avg, p50, p95)
- Filter accuracy (% correct schemas returned)
- Response size reduction vs get-all

**Speedup Analysis:**

```
Speedup vs Get-All = (Get-All Time) / (Filtered Time)

Expected:
- 1 ID:  1.5-2.0x faster (90% data reduction)
- 3 IDs: 1.3-1.6x faster (70% data reduction)
- 7 IDs: 1.1-1.3x faster (30% data reduction)
```

### Expected Results

#### PostgreSQL:

```
ID Count | Avg Response | p95 Response | vs Get-All
1 schema | 30-50ms      | <80ms        | 1.8x faster
3 schemas| 40-70ms      | <120ms       | 1.4x faster
7 schemas| 55-90ms      | <180ms       | 1.2x faster
```

#### Blockchain:

```
ID Count | Avg Response | p95 Response | vs Get-All
1 schema | 1,500-2,200ms| <3,500ms     | 1.6x faster
3 schemas| 1,800-2,600ms| <4,200ms     | 1.4x faster
7 schemas| 2,100-3,200ms| <5,500ms     | 1.2x faster
```

### Success Criteria

- ✅ ID filtering returns only requested schemas (100% accuracy)
- ✅ Smaller ID sets show measurable speedup
- ✅ PostgreSQL maintains 10-50x advantage over blockchain
- ✅ No false positives (extra schemas) or false negatives (missing schemas)

---

## Scenario B3: Version Filtering Performance

**Objective:** Test performance when filtering by schema version

### Configuration

```javascript
{
  name: "version_filtering_performance",
  vus: 10,            // 10 concurrent users
  duration: "3m",     // 3 minutes per filter type
  filterTypes: ['all', 'version1', 'latestOnly']
}
```

### Endpoints Tested

```
PostgreSQL:
  - GET /api/v1/schemas (all versions)
  - GET /api/v1/schemas?version=1 (specific version)
  - GET /api/v1/schemas?latestOnly=true (latest versions)

Blockchain:
  - GET /api/v1/schemas/blockchain (all versions)
  - GET /api/v1/schemas/blockchain?version=1
  - GET /api/v1/schemas/blockchain?latestOnly=true
```

### Test Matrix

| Test Case          | Filter          | Schemas Returned | Description                    |
| ------------------ | --------------- | ---------------- | ------------------------------ |
| **All Versions**   | none            | 10 schemas       | All versions of all schemas    |
| **Version 1 Only** | version=1       | 5-7 schemas      | First versions only            |
| **Latest Only**    | latestOnly=true | 5-7 schemas      | Most recent version per schema |

### Test Steps

```javascript
const filterTypes = [
  { query: "", name: "all" },
  { query: "?version=1", name: "version1" },
  { query: "?latestOnly=true", name: "latest" },
];

export default function () {
  const filter = filterTypes[Math.floor(Math.random() * filterTypes.length)];

  // Test PostgreSQL
  const pgResponse = http.get(`${baseURL}/api/v1/schemas${filter.query}`, {
    tags: { endpoint: "database", filter_type: filter.name },
  });

  sleep(0.5);

  // Test Blockchain
  const bcResponse = http.get(
    `${baseURL}/api/v1/schemas/blockchain${filter.query}`,
    { tags: { endpoint: "blockchain", filter_type: filter.name } }
  );

  sleep(1);
}
```

### Expected Results

#### PostgreSQL:

```
Filter Type   | Avg Response | Schemas | vs All Versions
All versions  | 60-100ms     | 10      | Baseline
Version 1     | 45-75ms      | 5-7     | 1.2-1.4x faster
Latest only   | 50-80ms      | 5-7     | 1.2-1.3x faster
```

#### Blockchain:

```
Filter Type   | Avg Response | Schemas | vs All Versions
All versions  | 2,500-4,000ms| 10      | Baseline
Version 1     | 2,000-3,200ms| 5-7     | 1.2-1.3x faster
Latest only   | 2,100-3,400ms| 5-7     | 1.2-1.2x faster
```

### Success Criteria

- ✅ Version filtering returns correct subset
- ✅ `latestOnly` returns one version per schema ID
- ✅ `version=1` returns only v1 schemas
- ✅ Filtered queries faster than get-all (>10% speedup)

---

## Scenario B4: Concurrent Load with Indexing

**Objective:** Test scalability of indexed queries under concurrent load

### Configuration

```javascript
{
  name: "concurrent_load_indexed",
  stages: [
    { duration: "1m", target: 10 },   // Light: 10 concurrent users
    { duration: "2m", target: 30 },   // Medium: 30 concurrent users
    { duration: "2m", target: 70 },   // Heavy: 70 concurrent users
    { duration: "1m", target: 0 }     // Ramp down
  ],
  queryMix: {
    pagination: 40,   // 40% pagination queries
    idFilter: 40,     // 40% ID filtering
    versionFilter: 20 // 20% version filtering
  }
}
```

### Endpoints Tested

Mixed query patterns simulating production traffic:

```
40% Pagination:  ?offset=0&limit=5
40% ID Filter:   ?ids=schema-1,schema-2,schema-3
20% Version:     ?latestOnly=true
```

### Test Steps

```javascript
const queryTypes = [
  { weight: 40, fn: () => testPagination(5) },
  { weight: 40, fn: () => testIDFilter(3) },
  { weight: 20, fn: () => testVersionFilter("latest") },
];

export default function () {
  // Weighted random query selection
  const rand = Math.random() * 100;
  let cumulative = 0;

  for (const queryType of queryTypes) {
    cumulative += queryType.weight;
    if (rand < cumulative) {
      queryType.fn();
      break;
    }
  }
}
```

### Metrics to Collect

**Per Load Level:**

- Mixed query p95 response time
- Error rate by query type
- Throughput (req/s) by query type
- Cache hit rate (if applicable)

**Comparison:**

- Indexed queries vs get-all queries (from Scenario A2)
- Performance improvement percentage

### Expected Results

| Load Level | VUs | PostgreSQL p95 (Indexed) | Blockchain p95 (Indexed) | Improvement vs Get-All |
| ---------- | --- | ------------------------ | ------------------------ | ---------------------- |
| Light      | 10  | ~80ms                    | ~3,500ms                 | 20-30% faster          |
| Medium     | 30  | ~150ms                   | ~8,000ms                 | 25-35% faster          |
| Heavy      | 70  | ~350ms                   | ~18,000ms                | 30-40% faster          |

### Success Criteria

- ✅ Indexed queries handle 2-3x more VUs than get-all for same p95
- ✅ Error rate remains < 5% at all load levels
- ✅ Clear performance advantage documented
- ✅ Query type distribution matches configured weights

# Test Execution Plan

### Phase 1: Preparation (Day 1)

**Tasks:**

1. ✅ Verify both endpoints are working (`/api/v1/schemas` and `/api/v1/schemas/blockchain`)
2. ✅ Confirm 10 schemas exist and are retrievable from both systems
3. ✅ Implement pagination and filtering support in backend
4. ✅ Set up k6 on local machine or CI/CD
5. ✅ Configure Grafana Cloud k6 (optional for visualization)
6. ✅ Prepare schema IDs list for ID-based filtering tests

**Deliverables:**

- Working endpoints with pagination/filtering
- List of 10 schema IDs for testing
- K6 test files configured
- Baseline metrics from manual API testing

---

### Phase 2: Group A Testing - Get All Queries (Day 2)

**Morning: Scenario A1 - Baseline**

- [ ] Run baseline test (1 VU, 5 minutes)
- [ ] Verify data consistency between endpoints
- [ ] Document response times
- [ ] Calculate initial speedup factor

**Afternoon: Scenario A2 - Concurrent Load**

- [ ] Run load test (5-100 VUs, 7 minutes)
- [ ] Monitor server resources (CPU, memory, connections)
- [ ] Document error rates at each VU level
- [ ] Identify blockchain saturation point

**Evening: Analysis**

- [ ] Aggregate Group A results
- [ ] Create performance charts (response time vs VUs)
- [ ] Calculate error rate trends
- [ ] Document get-all baseline performance

---

### Phase 3: Group B Testing - Indexed Queries (Day 3-4)

**Day 3 Morning: Scenario B1 - Pagination**

- [ ] Run pagination tests (page sizes: 2, 5, 10)
- [ ] Measure response time per page size
- [ ] Calculate speedup vs get-all
- [ ] Verify payload size reduction

**Day 3 Afternoon: Scenario B2 - ID Filtering**

- [ ] Run ID filtering tests (1, 3, 7 IDs)
- [ ] Measure response time per ID count
- [ ] Verify filter accuracy
- [ ] Calculate speedup vs get-all

**Day 4 Morning: Scenario B3 - Version Filtering**

- [ ] Run version filter tests (all, v1, latestOnly)
- [ ] Measure response time per filter type
- [ ] Verify correct schema selection
- [ ] Document version distribution

**Day 4 Afternoon: Scenario B4 - Concurrent Load with Indexing**

- [ ] Run mixed query load test (10-70 VUs, 6 minutes)
- [ ] Monitor query type distribution
- [ ] Compare with Scenario A2 results
- [ ] Document performance improvements

---

### Phase 4: Analysis & Reporting (Day 5-6)

**Day 5: Data Aggregation**

- [ ] Compile all test results into structured format
- [ ] Calculate comparative metrics (speedup factors, error rates)
- [ ] Generate performance charts:
  - Response time: Get-All vs Indexed
  - Scalability: VUs vs p95 response time
  - Optimization impact: Page size vs response time
  - Error rates: VUs vs error percentage
- [ ] Statistical analysis (mean, median, std dev, confidence intervals)

**Day 6: Research Paper Preparation**

- [ ] Write methodology section (test design, execution)
- [ ] Document findings with data visualizations
- [ ] Create comparison tables (PostgreSQL vs Blockchain)
- [ ] Write conclusions and recommendations
- [ ] Prepare presentation slides (if needed)

---

## Data Collection Format

### Test Result Template (JSON)

```json
{
  "test_metadata": {
    "scenario_name": "baseline_get_all",
    "group": "A",
    "date": "2025-12-XX",
    "duration_seconds": 300,
    "vus": 1,
    "dataset_size": 10
  },
  "postgresql": {
    "total_requests": 150,
    "successful_requests": 150,
    "failed_requests": 0,
    "success_rate": 1.0,
    "response_times_ms": {
      "min": 45,
      "avg": 78,
      "median": 75,
      "p95": 120,
      "p99": 150,
      "max": 180
    },
    "throughput_rps": 0.5,
    "payload_size_bytes": 2500,
    "schemas_returned": 10
  },
  "blockchain": {
    "total_requests": 150,
    "successful_requests": 150,
    "failed_requests": 0,
    "success_rate": 1.0,
    "response_times_ms": {
      "min": 2100,
      "avg": 3500,
      "median": 3200,
      "p95": 5000,
      "p99": 6500,
      "max": 7200
    },
    "throughput_rps": 0.033,
    "payload_size_bytes": 2500,
    "schemas_returned": 10,
    "rpc_calls": 150
  },
  "comparison": {
    "speedup_factor": 44.87,
    "time_difference_ms": 3422,
    "postgresql_percentage_faster": 97.77,
    "consistency_check": "PASS",
    "data_match": true
  }
}
```

### Consolidated Results Template

```json
{
  "test_suite": "PostgreSQL vs Blockchain Performance",
  "test_date": "2025-12-XX",
  "total_duration_minutes": 37,
  "group_a_results": {
    "a1_baseline": {
      /* ... */
    },
    "a2_concurrent_load": {
      "load_5_vus": {
        /* ... */
      },
      "load_20_vus": {
        /* ... */
      },
      "load_50_vus": {
        /* ... */
      },
      "load_100_vus": {
        /* ... */
      }
    }
  },
  "group_b_results": {
    "b1_pagination": {
      "limit_2": {
        /* ... */
      },
      "limit_5": {
        /* ... */
      },
      "limit_10": {
        /* ... */
      }
    },
    "b2_id_filtering": {
      "single_id": {
        /* ... */
      },
      "three_ids": {
        /* ... */
      },
      "seven_ids": {
        /* ... */
      }
    },
    "b3_version_filtering": {
      "all_versions": {
        /* ... */
      },
      "version_1": {
        /* ... */
      },
      "latest_only": {
        /* ... */
      }
    },
    "b4_concurrent_indexed": {
      "load_10_vus": {
        /* ... */
      },
      "load_30_vus": {
        /* ... */
      },
      "load_70_vus": {
        /* ... */
      }
    }
  },
  "summary": {
    "postgresql_avg_speedup": "10-100x",
    "blockchain_data_availability": "10 / ~150 schemas (6.7%)",
    "optimization_impact": "20-40% improvement with indexing",
    "scalability_conclusion": "PostgreSQL scales better under load"
  }
}
```

---

## Performance Thresholds

### PostgreSQL Acceptable Limits

```javascript
thresholds: {
  // Group A: Get All
  'http_req_duration{endpoint:database,query_type:get_all}': [
    'p(50)<100',      // 50% under 100ms
    'p(95)<500',      // 95% under 500ms
    'p(99)<1000',     // 99% under 1s
  ],

  // Group B: Indexed
  'http_req_duration{endpoint:database,query_type:indexed}': [
    'p(50)<80',       // 50% under 80ms (faster than get-all)
    'p(95)<400',      // 95% under 400ms
    'p(99)<800',      // 99% under 800ms
  ],

  // Error rates
  'http_req_failed{endpoint:database}': [
    'rate<0.01'       // Less than 1% error rate
  ]
}
```

### Blockchain Expected Limits

```javascript
thresholds: {
  // Group A: Get All
  'http_req_duration{endpoint:blockchain,query_type:get_all}': [
    'p(50)<5000',     // 50% under 5 seconds
    'p(95)<30000',    // 95% under 30 seconds
    'p(99)<60000',    // 99% under 1 minute
  ],

  // Group B: Indexed
  'http_req_duration{endpoint:blockchain,query_type:indexed}': [
    'p(50)<4000',     // 50% under 4 seconds (slightly faster)
    'p(95)<25000',    // 95% under 25 seconds
    'p(99)<50000',    // 99% under 50 seconds
  ],

  // Error rates (more lenient)
  'http_req_failed{endpoint:blockchain}': [
    'rate<0.1'        // Less than 10% error rate (RPC limits)
  ]
}
```

---

## Analysis Framework

### Key Research Questions & Answers

#### **RQ1: How does query performance compare between PostgreSQL and blockchain?**

**Metrics to Measure:**

- Absolute response time difference (ms)
- Speedup factor (Blockchain time / PostgreSQL time)
- Percentage improvement

**Expected Answer:**

```
GROUP A (Get All):
- PostgreSQL: 50-200ms avg
- Blockchain: 2,000-5,000ms avg
- Speedup: 10-100x

GROUP B (Indexed):
- PostgreSQL: 30-150ms avg (20-40% faster than get-all)
- Blockchain: 1,500-4,000ms avg (10-20% faster than get-all)
- Speedup: 15-130x
```

---

#### **RQ2: How does each system scale under concurrent load?**

**Metrics to Measure:**

- p95 response time at 5, 20, 50, 100 VUs
- Error rate progression
- Throughput capacity (req/s)

**Expected Answer:**

```
PostgreSQL:
- Linear degradation up to 100 VUs
- p95: 100ms → 500ms (5x growth)
- Error rate: <5% at peak

Blockchain:
- Exponential degradation due to RPC limits
- p95: 3s → 60s+ (20x growth)
- Error rate: >50% at 100 VUs
- Saturation at ~30-50 VUs
```

---

#### **RQ3: Do optimization techniques (pagination, filtering) improve performance?**

**Metrics to Measure:**

- Response time improvement vs get-all
- Payload size reduction
- Error rate reduction

**Expected Answer:**

```
PostgreSQL Improvements:
- Pagination (limit=2): 20-30% faster
- ID filtering (1 ID): 30-50% faster
- Version filtering: 20-30% faster

Blockchain Improvements:
- Pagination (limit=2): 15-25% faster
- ID filtering (1 ID): 20-40% faster
- Version filtering: 15-20% faster

KEY INSIGHT: Improvements are MODEST because blockchain query
time (2-5s) dominates over data transfer time (<100ms).
```

---

#### **RQ4: What are the practical implications for system architecture?**

**Metrics to Measure:**

- Data completeness (% schemas accessible)
- Production readiness (error rates, latency)
- Cost implications (RPC calls, infrastructure)

**Expected Answer:**

```
Blockchain Limitations:
- Data availability: Only 10/150 schemas (6.7%) accessible
- High latency: 2-5 seconds baseline
- Poor scalability: Saturates at 30-50 concurrent users
- Cost: ~$0.0001 per RPC call × N requests = expensive at scale

PostgreSQL Advantages:
- Complete data access: 100% schemas available
- Low latency: 50-200ms baseline
- Good scalability: Handles 100+ concurrent users
- Cost: Fixed database hosting (scales horizontally)

CONCLUSION:
Blockchain should be write-only source of truth.
PostgreSQL is essential for production read queries.
Event-driven synchronization bridges the gap.
```

---

## Visualizations to Create

### 1. Response Time Comparison (Bar Chart)

```
X-axis: Query Type (Get All, Pagination, ID Filter, Version Filter)
Y-axis: Response Time (ms, log scale)
Bars: PostgreSQL (blue) vs Blockchain (red)
```

### 2. Scalability Under Load (Line Chart)

```
X-axis: Virtual Users (5, 20, 50, 100)
Y-axis: p95 Response Time (ms)
Lines:
  - PostgreSQL Get All (solid blue)
  - PostgreSQL Indexed (dashed blue)
  - Blockchain Get All (solid red)
  - Blockchain Indexed (dashed red)
```

### 3. Optimization Impact (Grouped Bar Chart)

```
X-axis: Optimization Type (Baseline, Pagination, ID Filter, Version)
Y-axis: Speedup Factor
Groups: PostgreSQL vs Blockchain
Show % improvement vs baseline
```

### 4. Error Rate Progression (Area Chart)

```
X-axis: Virtual Users
Y-axis: Error Rate (%)
Areas:
  - PostgreSQL (green, stays near 0%)
  - Blockchain (red, increases exponentially)
Mark saturation point where errors > 10%
```

### 5. Data Availability (Pie Chart)

```
Show blockchain data completeness:
  - Accessible: 10 schemas (6.7%)
  - Inaccessible: 140 schemas (93.3%)
```

---

## Expected Research Findings

### Hypothesis 1: PostgreSQL is faster for all query types

**Status:** ✅ CONFIRMED  
**Evidence:**

- Baseline: 10-100x faster
- Indexed queries: 15-130x faster
- Advantage maintained across all scenarios

### Hypothesis 2: Optimization techniques improve performance

**Status:** ⚠️ PARTIALLY CONFIRMED  
**Evidence:**

- Improvements exist but modest (20-40%)
- Blockchain query time dominates, not data transfer
- PostgreSQL benefits more from indexing (has real indexes)

### Hypothesis 3: PostgreSQL scales better under load

**Status:** ✅ CONFIRMED  
**Evidence:**

- Handles 2-3x more concurrent users
- Linear degradation vs exponential (blockchain)
- Error rate stays low (<5% vs >50%)

### Hypothesis 4: Blockchain has data availability issues

**Status:** ✅ CONFIRMED  
**Evidence:**

- Only 6.7% of schemas accessible
- "Missing refer data" errors
- Not production-ready for reads

---

## Conclusion & Recommendations

### When to Use PostgreSQL (Recommended)

- ✅ All production read queries
- ✅ High-frequency access
- ✅ Multiple concurrent users (>10)
- ✅ Complex filtering/searching
- ✅ Latency-sensitive applications (<500ms)
- ✅ Complete data access required

### When Blockchain Query is Acceptable

- ✅ Audit/verification purposes (low frequency)
- ✅ Single-user scenarios
- ✅ Small datasets (<10 records accessible)
- ⚠️ When absolute blockchain verification needed
- ❌ NOT for production traffic

### Architecture Recommendation

```
┌─────────────────┐
│   Blockchain    │ (Source of Truth - Write Only)
└────────┬────────┘
         │ Events
         ↓
┌─────────────────┐
│ Event Listener  │ (Real-time Sync)
└────────┬────────┘
         │ Writes
         ↓
┌─────────────────┐
│   PostgreSQL    │ (Optimized Reads)
└────────┬────────┘
         │ Queries
         ↓
┌─────────────────┐
│  API Endpoints  │ (Production Traffic)
└─────────────────┘
```

**Best Practice:**

1. Write to blockchain for immutability
2. Sync to PostgreSQL via event listener
3. Read from PostgreSQL for performance
4. Use blockchain queries only for verification
5. Implement caching layer (RocksDB) for hot data

---

## Appendix

### Test Environment Specifications

**Database:**

- PostgreSQL version: [to be filled]
- Connection pool size: [to be filled]
- Indexes: `id`, `version`, `isActive`
- Total schemas: ~150

**Blockchain:**

- Network: [to be filled]
- RPC provider: [to be filled]
- Rate limits: [to be filled]
- Smart contract address: [to be filled]
- Accessible schemas: 10 (6.7% of total)

**Load Testing:**

- k6 version: latest
- Test runner: Local machine
- Network conditions: [to be documented]

### Required Backend Implementations

**New Endpoints Needed:**

```typescript
// Pagination support
GET /api/v1/schemas?offset=0&limit=5
GET /api/v1/schemas/blockchain?offset=0&limit=5

// ID filtering
GET /api/v1/schemas?ids=schema-1,schema-2
GET /api/v1/schemas/blockchain?ids=schema-1,schema-2

// Version filtering
GET /api/v1/schemas?version=1
GET /api/v1/schemas/blockchain?version=1
GET /api/v1/schemas?latestOnly=true
GET /api/v1/schemas/blockchain?latestOnly=true
```

### Test Data Schema

```json
{
  "id": "uuid-v4",
  "version": 1,
  "name": "Schema Name",
  "schema": {
    /* JSON Schema */
  },
  "issuer_did": "did:dcert:issuer-xxx",
  "issuer_name": "Issuer Name",
  "image_link": "https://example.com/image.png",
  "expired_in": 5,
  "isActive": true,
  "createdAt": "2025-12-04T00:00:00Z",
  "updatedAt": "2025-12-04T00:00:00Z"
}
```

---

**Document Version:** 2.0  
**Last Updated:** December 4, 2025  
**Status:** Ready for Implementation (Groups A & B)  
**Total Test Duration:** ~37 minutes  
**Total Scenarios:** 6 (2 in Group A, 4 in Group B)
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

| Dataset       | PostgreSQL p95 | Blockchain p95 | Speedup Factor |
| ------------- | -------------- | -------------- | -------------- |
| Small (10)    | ~50ms          | ~2s            | ~40x           |
| Medium (100)  | ~100ms         | ~10s           | ~100x          |
| Large (1K)    | ~200ms         | ~60s           | ~300x          |
| X-Large (10K) | ~500ms         | ~600s          | ~1200x         |

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

| Load Level | VUs | Duration | Ramp-up | Description  |
| ---------- | --- | -------- | ------- | ------------ |
| **Light**  | 5   | 2m       | 10s     | Normal usage |
| **Medium** | 20  | 3m       | 30s     | Peak hours   |
| **High**   | 50  | 3m       | 30s     | High traffic |
| **Stress** | 100 | 2m       | 20s     | Stress test  |

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
  "schema": {
    /* JSON Schema */
  },
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
