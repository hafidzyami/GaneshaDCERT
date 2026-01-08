/**
 * Scenario A1: Baseline Performance Comparison
 *
 * Objective: Establish baseline performance metrics with minimal load
 *
 * Configuration:
 * - VUs: 1 (single virtual user)
 * - Duration: 5 minutes
 * - Queries: Get all schemas from both database and blockchain
 */

import http from 'k6/http';
import { sleep } from 'k6';
import { ENDPOINTS, THRESHOLDS, SLEEP, TEST_DATA } from './config.js';
import {
  validateDatabaseResponse,
  validateBlockchainResponse,
  validateDataConsistency,
  parseResponseTime,
  logSummary,
  dbResponseTime,
  bcResponseTime,
} from './utils.js';

// Test configuration
export const options = {
  vus: 1,
  duration: '5m',
  thresholds: {
    ...THRESHOLDS.database,
    ...THRESHOLDS.blockchain,
    'http_req_duration': ['p(95)<30000'], // Overall 95% under 30s
  },
  tags: {
    scenario: 'baseline',
    group: 'A',
  },
};

let iterationCount = 0;

export default function () {
  iterationCount++;

  // 1. Query Database endpoint
  const dbResponse = http.get(ENDPOINTS.database.getAll, {
    tags: {
      endpoint: 'database',
      query_type: 'get_all',
      source: 'database',
    },
  });

  // Validate database response
  validateDatabaseResponse(dbResponse, TEST_DATA.expectedCount);

  // Record database response time
  const dbTime = parseResponseTime(dbResponse);
  if (dbTime > 0) {
    dbResponseTime.add(dbTime);
  }

  // Wait before blockchain query
  sleep(SLEEP.betweenRequests);

  // 2. Query Blockchain endpoint
  const bcResponse = http.get(ENDPOINTS.blockchain.getAll, {
    tags: {
      endpoint: 'blockchain',
      query_type: 'get_all',
      source: 'blockchain',
    },
  });

  // Validate blockchain response
  validateBlockchainResponse(bcResponse, TEST_DATA.expectedCount);

  // Record blockchain response time
  const bcTime = parseResponseTime(bcResponse);
  if (bcTime > 0) {
    bcResponseTime.add(bcTime);
  }

  // 3. Validate data consistency
  if (dbResponse.status === 200 && bcResponse.status === 200) {
    validateDataConsistency(dbResponse, bcResponse);
  }

  // Log summary every 10 iterations
  if (iterationCount % 10 === 0) {
    logSummary('A1-Baseline', iterationCount, dbTime, bcTime);
  }

  // Wait before next iteration
  sleep(SLEEP.afterIteration);
}

export function handleSummary(data) {
  const dbMetrics = data.metrics['http_req_duration{endpoint:database}'];
  const bcMetrics = data.metrics['http_req_duration{endpoint:blockchain}'];

  console.log('\n=== Scenario A1: Baseline Performance Summary ===');
  console.log('\nDatabase Performance:');
  console.log(`  - Average: ${dbMetrics?.values?.avg?.toFixed(2) || 'N/A'} ms`);
  console.log(`  - Median (p50): ${dbMetrics?.values?.['p(50)']?.toFixed(2) || 'N/A'} ms`);
  console.log(`  - p95: ${dbMetrics?.values?.['p(95)']?.toFixed(2) || 'N/A'} ms`);
  console.log(`  - p99: ${dbMetrics?.values?.['p(99)']?.toFixed(2) || 'N/A'} ms`);
  console.log(`  - Min: ${dbMetrics?.values?.min?.toFixed(2) || 'N/A'} ms`);
  console.log(`  - Max: ${dbMetrics?.values?.max?.toFixed(2) || 'N/A'} ms`);

  console.log('\nBlockchain Performance:');
  console.log(`  - Average: ${bcMetrics?.values?.avg?.toFixed(2) || 'N/A'} ms`);
  console.log(`  - Median (p50): ${bcMetrics?.values?.['p(50)']?.toFixed(2) || 'N/A'} ms`);
  console.log(`  - p95: ${bcMetrics?.values?.['p(95)']?.toFixed(2) || 'N/A'} ms`);
  console.log(`  - p99: ${bcMetrics?.values?.['p(99)']?.toFixed(2) || 'N/A'} ms`);
  console.log(`  - Min: ${bcMetrics?.values?.min?.toFixed(2) || 'N/A'} ms`);
  console.log(`  - Max: ${bcMetrics?.values?.max?.toFixed(2) || 'N/A'} ms`);

  if (dbMetrics?.values?.avg && bcMetrics?.values?.avg) {
    const speedup = bcMetrics.values.avg / dbMetrics.values.avg;
    console.log(`\nSpeedup Factor: ${speedup.toFixed(2)}x (Blockchain is ${speedup.toFixed(2)}x slower than Database)`);
  }

  console.log('\n=== End of Summary ===\n');

  return {
    'summary.json': JSON.stringify(data, null, 2),
  };
}
