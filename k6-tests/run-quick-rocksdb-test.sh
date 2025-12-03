#!/bin/bash
# Quick RocksDB comparison test (30 seconds)

echo "=== RocksDB Quick Performance Test ==="
echo "Duration: 30 seconds"
echo "VUs: 10"
echo ""
echo "Starting test..."
echo ""

cd "$(dirname "$0")"
k6 run quick-rocksdb-comparison.js

echo ""
echo "Test completed! Check results/quick-rocksdb-comparison.json for details."
