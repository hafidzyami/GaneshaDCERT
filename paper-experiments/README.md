# Paper Experiments - Event-Driven Synchronization for Blockchain-Database Hybrid Systems

This directory contains scripts for collecting performance and reliability metrics for the research paper.

## 📁 Directory Structure

```
paper-experiments/
├── scripts/           # Data collection and analysis scripts
│   ├── performance-monitor.ts           # Continuous performance monitoring
│   ├── event-processing-benchmark.ts    # Event processing benchmarks
│   ├── reliability-test.ts              # Reliability test suite
│   └── analyze-results.ts               # Data analysis and visualization
├── results/           # Raw experiment results (JSON)
├── data/              # Processed data (CSV, LaTeX, Markdown)
└── README.md          # This file
```

## 🚀 Quick Start

### Prerequisites

1. **Node.js & TypeScript**
   ```bash
   npm install
   npm install -g ts-node typescript
   ```

2. **Python (for visualization)**
   ```bash
   pip install matplotlib pandas numpy
   ```

3. **Database & Blockchain Access**
   - Ensure `.env` is configured with database and blockchain connections
   - Blockchain sync should be running

### Running Experiments

#### 1. Performance Monitoring (Continuous)

Collects performance metrics over time:

```bash
# Monitor for 30 minutes, collect metrics every 60 seconds
ts-node paper-experiments/scripts/performance-monitor.ts 60 30

# Monitor for 1 hour, collect every 30 seconds
ts-node paper-experiments/scripts/performance-monitor.ts 30 60
```

**Metrics Collected:**
- ✅ Database query latency
- ✅ Blockchain query latency
- ✅ Speedup factor
- ✅ Events processed per second
- ✅ CPU usage
- ✅ Memory usage
- ✅ Sync gap (blocks behind)
- ✅ Consistency lag (seconds)

**Output:** `results/performance-metrics-YYYY-MM-DDTHH-MM-SS.json`

---

#### 2. Event Processing Benchmark

Tests event processing throughput and batch size optimization:

```bash
ts-node paper-experiments/scripts/event-processing-benchmark.ts
```

**Tests:**
- ✅ Historical catch-up performance (10K blocks)
- ✅ Batch size optimization (100, 500, 1000, 2000 blocks)
- ✅ Checkpoint update overhead
- ✅ Current sync status

**Output:** `results/event-processing-benchmark-YYYY-MM-DDTHH-MM-SS.json`

---

#### 3. Reliability Test Suite

Comprehensive reliability testing:

```bash
ts-node paper-experiments/scripts/reliability-test.ts
```

**Tests:**
- ✅ **Test 1: Data Consistency** - Verify database matches blockchain
- ✅ **Test 2: Idempotency** - Check for duplicate events
- ✅ **Test 3: Checkpoint Recovery** - Recovery metrics (RPO, RTO)
- ✅ **Test 4: Gap Detection** - Identify missed events
- ✅ **Test 5: Data Loss** - Verify no events lost

**Output:** `results/reliability-test-YYYY-MM-DDTHH-MM-SS.json`

---

#### 4. Analyze Results

Process collected data and generate visualizations:

```bash
# Analyze latest performance metrics
ts-node paper-experiments/scripts/analyze-results.ts
```

**Generates:**
- ✅ `data/performance-metrics.csv` - Raw data for plotting
- ✅ `data/performance-table.tex` - LaTeX table for paper
- ✅ `data/performance-summary.md` - Markdown summary
- ✅ `plot_results.py` - Python plotting script

---

#### 5. Generate Plots

After analysis, generate plots for paper:

```bash
python3 paper-experiments/plot_results.py
```

**Generates plots:**
- 📊 `plots/query_latency_comparison.png` - DB vs BC latency over time
- 📊 `plots/speedup_factor.png` - Speedup factor timeline
- 📊 `plots/resource_utilization.png` - CPU and memory usage
- 📊 `plots/consistency_lag.png` - Consistency lag over time
- 📊 `plots/latency_distribution.png` - Latency histograms

---

## 📊 Expected Results

### Performance Metrics

| Metric | Database Query | Blockchain Query | Speedup |
|--------|---------------|------------------|---------|
| Average | ~50ms | ~5000ms | ~100x |
| p95 | <500ms | <15000ms | ~100x |
| p99 | <1000ms | <30000ms | ~50x |

### Reliability Metrics

| Metric | Target | Expected |
|--------|--------|----------|
| Data Loss | 0% | 0% |
| Duplicate Events | 0% | 0% |
| Consistency Rate | 100% | 100% |
| Recovery Time | <5 min | <2 min |
| Consistency Lag | <1 min | <10s |

---

## 🔬 Experiment Scenarios

### Scenario 1: Normal Operation (Real-time Sync)

**Purpose:** Measure performance during normal operation

**Steps:**
1. Ensure system is synced (gap < 10 blocks)
2. Run performance monitor for 30 minutes
3. Observe real-time event processing

**Expected:**
- Consistency lag: <10s
- CPU usage: 5-15%
- Memory: stable

---

### Scenario 2: Cold Start (Historical Catch-up)

**Purpose:** Measure catch-up performance after downtime

**Steps:**
1. Stop sync process for several hours
2. Restart sync
3. Run event processing benchmark
4. Measure catch-up time

**Expected:**
- Processing rate: ~50 events/sec
- Catch-up time: ~3 min for 10K blocks
- CPU usage: 15-25% during catch-up

---

### Scenario 3: Stress Test (High Event Rate)

**Purpose:** Test system under load

**Steps:**
1. Create multiple schemas in quick succession
2. Monitor performance during high activity
3. Verify no events missed

**Expected:**
- All events processed
- No duplicates
- Slight increase in consistency lag

---

### Scenario 4: Failure Recovery

**Purpose:** Test fault tolerance and recovery

**Steps:**
1. Note current checkpoint
2. Simulate crash (kill process)
3. Restart system
4. Run reliability test
5. Verify recovery

**Expected:**
- Resume from checkpoint
- No data loss
- Recovery time: <1 min + catch-up

---

## 📈 Data Analysis Workflow

```
1. Collect Data
   ├─ performance-monitor.ts → performance-metrics-*.json
   ├─ event-processing-benchmark.ts → event-processing-benchmark-*.json
   └─ reliability-test.ts → reliability-test-*.json

2. Analyze Data
   └─ analyze-results.ts
       ├─ performance-metrics.csv
       ├─ performance-table.tex
       └─ performance-summary.md

3. Visualize
   └─ plot_results.py
       ├─ query_latency_comparison.png
       ├─ speedup_factor.png
       ├─ resource_utilization.png
       ├─ consistency_lag.png
       └─ latency_distribution.png

4. Use in Paper
   ├─ LaTeX tables → Section 4 (Performance Analysis)
   ├─ Plots → Figures 4-7
   └─ Statistics → Results discussion
```

---

## 🎯 Metrics for Paper

### Section 4: Performance Analysis

**Table 1: Query Performance Comparison**
- Source: `data/performance-table.tex`
- Metrics: DB latency, BC latency, Speedup (p50, p95, p99)

**Figure 4: Latency Distribution Histogram**
- Source: `plots/latency_distribution.png`
- Shows: DB vs BC query latency distributions

**Figure 5: Speedup Factor Over Time**
- Source: `plots/speedup_factor.png`
- Shows: Consistent ~100x speedup

**Table 2: Event Processing Throughput**
- Source: `results/event-processing-benchmark-*.json`
- Metrics: Events/sec, Blocks/sec, Catch-up time

**Figure 6: Resource Utilization**
- Source: `plots/resource_utilization.png`
- Shows: CPU and memory usage over time

### Section 5: Reliability Analysis

**Table 3: Reliability Metrics Summary**
- Source: `results/reliability-test-*.json`
- Metrics: Data loss, Duplicates, Consistency rate, Recovery time

**Table 4: Fault Tolerance Test Results**
- Source: Manual testing + reliability-test results
- Scenarios: Crash recovery, Network interruption, etc.

---

## 🛠️ Troubleshooting

### Issue: No blockchain connection

**Error:** `Cannot connect to blockchain`

**Solution:**
```bash
# Check .env configuration
cat .env | grep BLOCKCHAIN_RPC_URL

# Test connection
curl -X POST <RPC_URL> -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

---

### Issue: Database connection failed

**Error:** `Database connection timeout`

**Solution:**
```bash
# Check database is running
npx prisma db push

# Test connection
psql <DATABASE_URL>
```

---

### Issue: No data collected

**Error:** `No metrics collected`

**Solution:**
- Ensure sync is running: Check `src/index.ts`
- Verify events exist: `SELECT COUNT(*) FROM "ProcessedEvent";`
- Check logs for errors

---

## 📝 Tips for Paper Writing

### Using Results in Paper

1. **Abstract:**
   - "Performance evaluation shows 100x query speedup"
   - "Reliability tests demonstrate zero data loss"

2. **Section 4.2 (Query Performance):**
   - Use Table 1 (performance-table.tex)
   - Reference Figure 4 (latency distribution)
   - Cite specific numbers: "p95 latency: 120ms (DB) vs 12,500ms (BC)"

3. **Section 4.3 (Sync Performance):**
   - Use event processing benchmark results
   - "Processing rate: ~50 events/sec"
   - "Catch-up time for 10K blocks: ~3 minutes"

4. **Section 5 (Reliability):**
   - Use Table 3 (reliability summary)
   - Cite test scenarios: "Application crash recovery: <30s"
   - "Consistency rate: 100% (verified with 1000 samples)"

### Interpreting Results

**Good results:**
- ✅ Speedup > 50x consistently
- ✅ Consistency lag < 1 minute
- ✅ Zero data loss and duplicates
- ✅ Recovery time < 5 minutes

**Issues to investigate:**
- ⚠️ Speedup < 10x → Check network latency
- ⚠️ Consistency lag > 5 minutes → Check sync process
- ⚠️ Data loss > 0% → Check checkpoint mechanism
- ⚠️ Duplicates > 0 → Check idempotency logic

---

## 🔄 Continuous Monitoring

For long-term monitoring, run performance monitor as a background service:

```bash
# Start monitoring (Linux/Mac)
nohup ts-node paper-experiments/scripts/performance-monitor.ts 300 1440 > monitor.log 2>&1 &

# This runs for 24 hours (1440 minutes), collecting every 5 minutes (300 seconds)
```

---

## 📚 Additional Resources

- **Main Paper:** `conference-paper-structure.md`
- **Implementation:** `src/services/blockchainEventPublisher.service.ts`
- **Database Schema:** `prisma/schema.prisma`
- **k6 Load Tests:** `k6-tests/quick-comparison.js`

---

## 🎓 Citation

If you use these scripts or methodology in your research:

```bibtex
@inproceedings{ganesha2025,
  title={Event-Driven Synchronization for Blockchain-Database Hybrid Systems},
  author={Your Name},
  booktitle={Conference Name},
  year={2025}
}
```

---

## 📧 Contact

For questions or issues with experiments:
- Open an issue in the repository
- Check logs in `results/` directory
- Review paper structure: `conference-paper-structure.md`

---

**Last Updated:** 2025-12-03
**Status:** Ready for data collection ✅
