#!/bin/bash
# Full RocksDB comparison test (~4 minutes)

echo "=== RocksDB Full Performance Test ==="
echo "Duration: ~4 minutes"
echo "Phases:"
echo "  1. Cache warmup (30s)"
echo "  2. Sustained load test (2m)"
echo "  3. Spike test (50s)"
echo ""
echo "Starting test..."
echo ""

cd "$(dirname "$0")"
k6 run rocksdb-comparison-test.js

echo ""
echo "Test completed!"
echo "Results:"
echo "  - HTML report: results/rocksdb-comparison.html"
echo "  - JSON data: results/rocksdb-comparison.json"
