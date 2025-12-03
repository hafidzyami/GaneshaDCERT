import { sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import {
  testSchemaComparison,
  testMultipleSchemas,
  warmupCache,
  logComparison,
} from './scenarios/rocksdb-comparison.js';

const config = JSON.parse(open('./config/config.json'));

/**
 * K6 Test Configuration for RocksDB Performance Comparison
 * 
 * This test compares PostgreSQL vs RocksDB cache performance for schema queries.
 * It includes:
 * 1. Cache warmup phase
 * 2. Warm cache testing (sustained load)
 * 3. Spike test (sudden load increase)
 */
export const options = {
  scenarios: {
    // Scenario 1: Warm up the cache
    cache_warmup: {
      executor: 'per-vu-iterations',
      vus: 5,
      iterations: 4, // Each VU queries each schema 4 times
      maxDuration: '30s',
      tags: { scenario: 'warmup' },
      exec: 'warmupScenario',
    },

    // Scenario 2: Test warm cache performance (main test)
    warm_cache_sustained: {
      executor: 'constant-vus',
      vus: 50,
      duration: '2m',
      startTime: '35s', // Start after warmup
      tags: { scenario: 'warm_cache' },
      exec: 'sustainedLoadScenario',
    },

    // Scenario 3: Spike test with cache
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 200 }, // Ramp up to 200 VUs
        { duration: '30s', target: 200 }, // Maintain 200 VUs
        { duration: '10s', target: 0 },   // Ramp down
      ],
      startTime: '3m', // Start after warm cache test
      tags: { scenario: 'spike' },
      exec: 'sustainedLoadScenario',
    },
  },

  thresholds: {
    // Overall HTTP thresholds
    'http_req_duration': ['p(95)<1000', 'p(99)<2000'],
    'http_req_failed': ['rate<0.01'],

    // PostgreSQL query thresholds
    'postgres_query_duration': [
      `p(95)<${config.thresholds.postgres.p95}`,
      `p(99)<${config.thresholds.postgres.p99}`,
    ],

    // RocksDB query thresholds (should be MUCH faster)
    'rocksdb_query_duration': [
      `p(95)<${config.thresholds.rocksdb.p95}`,
      `p(99)<${config.thresholds.rocksdb.p99}`,
    ],

    // Speedup factor (RocksDB should be at least 5x faster on average)
    'speedup_factor': ['avg>5'],

    // Cache hit rate (after warmup, should be very high)
    'cache_hit_rate': ['rate>0.95'],

    // Comparison success rate
    'comparison_success_rate': ['rate>0.99'],
  },
};

/**
 * Warmup scenario - populate the cache
 */
export function warmupScenario() {
  const baseURL = config.baseURL;
  const schemas = config.testSchemas;

  // Query each schema to populate cache
  schemas.forEach(schema => {
    const result = testSchemaComparison(baseURL, schema.id, schema.version);
    // Don't log during warmup to reduce noise
    sleep(0.2);
  });
}

/**
 * Sustained load scenario - test cache performance
 */
export function sustainedLoadScenario() {
  const baseURL = config.baseURL;
  const schemas = config.testSchemas;

  // Randomly select a schema to test (simulates real-world access pattern)
  const schema = schemas[Math.floor(Math.random() * schemas.length)];
  
  const result = testSchemaComparison(baseURL, schema.id, schema.version);
  
  // Log occasionally (10% of requests)
  if (Math.random() < 0.1) {
    logComparison(result);
  }

  sleep(0.5);
}

/**
 * Generate HTML and JSON reports
 */
export function handleSummary(data) {
  // Extract custom metrics
  const pgMetrics = data.metrics['postgres_query_duration'];
  const rocksMetrics = data.metrics['rocksdb_query_duration'];
  const speedupMetrics = data.metrics['speedup_factor'];
  const cacheHitRate = data.metrics['cache_hit_rate'];

  // Calculate comparison statistics
  const comparison = {
    postgres: {
      p50: pgMetrics?.values['p(50)']?.toFixed(2),
      p95: pgMetrics?.values['p(95)']?.toFixed(2),
      p99: pgMetrics?.values['p(99)']?.toFixed(2),
      avg: pgMetrics?.values.avg?.toFixed(2),
      min: pgMetrics?.values.min?.toFixed(2),
      max: pgMetrics?.values.max?.toFixed(2),
    },
    rocksdb: {
      p50: rocksMetrics?.values['p(50)']?.toFixed(4),
      p95: rocksMetrics?.values['p(95)']?.toFixed(4),
      p99: rocksMetrics?.values['p(99)']?.toFixed(4),
      avg: rocksMetrics?.values.avg?.toFixed(4),
      min: rocksMetrics?.values.min?.toFixed(4),
      max: rocksMetrics?.values.max?.toFixed(4),
    },
    speedup: {
      avg: speedupMetrics?.values.avg?.toFixed(2),
      p50: speedupMetrics?.values['p(50)']?.toFixed(2),
      p95: speedupMetrics?.values['p(95)']?.toFixed(2),
      min: speedupMetrics?.values.min?.toFixed(2),
      max: speedupMetrics?.values.max?.toFixed(2),
    },
    cache: {
      hit_rate: (cacheHitRate?.values.rate * 100)?.toFixed(2) + '%',
      hits: cacheHitRate?.values.passes,
      misses: cacheHitRate?.values.fails,
    },
  };

  // Print summary to console
  console.log('\n=== RocksDB Performance Comparison Summary ===\n');
  console.log('PostgreSQL Query Times:');
  console.log(`  Average: ${comparison.postgres.avg}ms`);
  console.log(`  p50: ${comparison.postgres.p50}ms, p95: ${comparison.postgres.p95}ms, p99: ${comparison.postgres.p99}ms`);
  console.log(`  Range: ${comparison.postgres.min}ms - ${comparison.postgres.max}ms`);
  
  console.log('\nRocksDB Query Times:');
  console.log(`  Average: ${comparison.rocksdb.avg}ms`);
  console.log(`  p50: ${comparison.rocksdb.p50}ms, p95: ${comparison.rocksdb.p95}ms, p99: ${comparison.rocksdb.p99}ms`);
  console.log(`  Range: ${comparison.rocksdb.min}ms - ${comparison.rocksdb.max}ms`);
  
  console.log('\nSpeedup Factor (PostgreSQL / RocksDB):');
  console.log(`  Average: ${comparison.speedup.avg}x faster`);
  console.log(`  p50: ${comparison.speedup.p50}x, p95: ${comparison.speedup.p95}x`);
  console.log(`  Range: ${comparison.speedup.min}x - ${comparison.speedup.max}x`);
  
  console.log('\nCache Performance:');
  console.log(`  Hit Rate: ${comparison.cache.hit_rate}`);
  console.log(`  Hits: ${comparison.cache.hits}, Misses: ${comparison.cache.misses}`);
  
  console.log('\n===========================================\n');

  const enhancedData = {
    ...data,
    comparison,
  };

  return {
    'results/rocksdb-comparison.html': htmlReport(enhancedData),
    'results/rocksdb-comparison.json': JSON.stringify(enhancedData, null, 2),
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}
