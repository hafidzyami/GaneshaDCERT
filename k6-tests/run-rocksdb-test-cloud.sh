#!/bin/bash
# Run RocksDB test with Grafana Cloud k6 output

echo "=== RocksDB Performance Test (Cloud Output) ==="
echo ""
echo "⚠️  Make sure you have logged in to k6 cloud:"
echo "   k6 login cloud --token YOUR_TOKEN"
echo ""
echo "Duration: ~4 minutes"
echo "Results will be available at: https://app.k6.io"
echo ""
echo "Starting test..."
echo ""

cd "$(dirname "$0")"
k6 run --out cloud rocksdb-comparison-test.js

echo ""
echo "Test completed!"
echo "Check the URL above for online results."
echo "Local results: results/rocksdb-comparison.html"
