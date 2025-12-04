/**
 * Scenario A2: Concurrent User Load Test (Get All)
 *
 * Objective: Measure performance degradation and scalability under concurrent load
 *
 * Configuration:
 * - Load stages: 5 VUs → 20 VUs → 50 VUs → 100 VUs → 0 VUs
 * - Duration: 7 minutes total
 * - Queries: Get all schemas from both database and blockchain
 */

import http from 'k6/http';
import { sleep } from 'k6';
import { ENDPOINTS, THRESHOLDS, SLEEP, TEST_DATA } from './config.js';
import {
  validateDatabaseResponse,
  validateBlockchainResponse,
  parseResponseTime,
  dbResponseTime,
  bcResponseTime,
} from './utils.js';

// Test configuration with load stages
export const options = {
  stages: [
    { duration: '1m', target: 5 },    // Light: 5 concurrent users
    { duration: '2m', target: 20 },   // Medium: 20 concurrent users
    { duration: '2m', target: 50 },   // Heavy: 50 concurrent users
    { duration: '1m', target: 100 },  // Peak: 100 concurrent users
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    ...THRESHOLDS.database,
    ...THRESHOLDS.blockchain,
    'http_req_duration': ['p(95)<60000'], // Overall 95% under 60s
    'http_req_failed': ['rate<0.15'],     // Overall error rate < 15%
  },
  tags: {
    scenario: 'concurrent_load',
    group: 'A',
  },
};

export default function () {
  // Test PostgreSQL
  const dbResponse = http.get(ENDPOINTS.database.getAll, {
    tags: {
      endpoint: 'database',
      query_type: 'get_all',
      source: 'database',
    },
  });

  // Validate and record database metrics
  validateDatabaseResponse(dbResponse);
  const dbTime = parseResponseTime(dbResponse);
  if (dbTime > 0) {
    dbResponseTime.add(dbTime);
  }

  sleep(SLEEP.betweenRequests);

  // Test Blockchain
  const bcResponse = http.get(ENDPOINTS.blockchain.getAll, {
    tags: {
      endpoint: 'blockchain',
      query_type: 'get_all',
      source: 'blockchain',
    },
  });

  // Validate and record blockchain metrics
  validateBlockchainResponse(bcResponse);
  const bcTime = parseResponseTime(bcResponse);
  if (bcTime > 0) {
    bcResponseTime.add(bcTime);
  }

  sleep(SLEEP.afterIteration);
}

export function handleSummary(data) {
  const dbMetrics = data.metrics['http_req_duration{endpoint:database}'];
  const bcMetrics = data.metrics['http_req_duration{endpoint:blockchain}'];
  const dbErrors = data.metrics['http_req_failed{endpoint:database}'];
  const bcErrors = data.metrics['http_req_failed{endpoint:blockchain}'];

  console.log('\n=== Scenario A2: Concurrent Load Test Summary ===');

  console.log('\nDatabase Performance:');
  console.log(`  - Average: ${dbMetrics?.values?.avg?.toFixed(2) || 'N/A'} ms`);
  console.log(`  - p50: ${dbMetrics?.values?.['p(50)']?.toFixed(2) || 'N/A'} ms`);
  console.log(`  - p95: ${dbMetrics?.values?.['p(95)']?.toFixed(2) || 'N/A'} ms`);
  console.log(`  - p99: ${dbMetrics?.values?.['p(99)']?.toFixed(2) || 'N/A'} ms`);
  console.log(`  - Max: ${dbMetrics?.values?.max?.toFixed(2) || 'N/A'} ms`);
  console.log(`  - Error Rate: ${(dbErrors?.values?.rate * 100)?.toFixed(2) || 0}%`);

  console.log('\nBlockchain Performance:');
  console.log(`  - Average: ${bcMetrics?.values?.avg?.toFixed(2) || 'N/A'} ms`);
  console.log(`  - p50: ${bcMetrics?.values?.['p(50)']?.toFixed(2) || 'N/A'} ms`);
  console.log(`  - p95: ${bcMetrics?.values?.['p(95)']?.toFixed(2) || 'N/A'} ms`);
  console.log(`  - p99: ${bcMetrics?.values?.['p(99)']?.toFixed(2) || 'N/A'} ms`);
  console.log(`  - Max: ${bcMetrics?.values?.max?.toFixed(2) || 'N/A'} ms`);
  console.log(`  - Error Rate: ${(bcErrors?.values?.rate * 100)?.toFixed(2) || 0}%`);

  console.log('\nLoad Test Analysis:');
  console.log(`  - Total Requests: ${data.metrics.http_reqs?.values?.count || 0}`);
  console.log(`  - Failed Requests: ${data.metrics.http_req_failed?.values?.fails || 0}`);
  console.log(`  - Overall Error Rate: ${(data.metrics.http_req_failed?.values?.rate * 100)?.toFixed(2) || 0}%`);
  console.log(`  - Total Duration: ${data.state?.testRunDurationMs ? (data.state.testRunDurationMs / 1000 / 60).toFixed(2) : 'N/A'} minutes`);

  if (dbMetrics?.values?.avg && bcMetrics?.values?.avg) {
    const speedup = bcMetrics.values.avg / dbMetrics.values.avg;
    console.log(`\nAverage Speedup: ${speedup.toFixed(2)}x`);
  }

  console.log('\n=== End of Summary ===\n');

  return {
    'summary-concurrent-load.json': JSON.stringify(data, null, 2),
  };
}
