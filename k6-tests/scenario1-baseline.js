/**
 * Scenario 1: Baseline Performance Comparison
 *
 * Objective: Establish baseline performance metrics with minimal load
 *
 * Configuration:
 * - VUs: 1 (single virtual user)
 * - Duration: 2 minutes
 * - Data: Current production data
 *
 * Expected Results:
 * - PostgreSQL: 50-500ms response time
 * - Blockchain: 2-10 seconds response time
 * - Speedup: SQL 10-50x faster than blockchain
 */

import { sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import {
  queryDatabase,
  queryBlockchain,
  logComparison
} from './utils/test-helpers.js';

const configFile = open('./config/config.json');
const config = JSON.parse(configFile);

export const options = {
  vus: 1,
  duration: '2m',

  thresholds: {
    // Database thresholds
    'http_req_duration{endpoint:database}': [
      'p(50)<100',
      'p(95)<500',
      'p(99)<1000',
    ],
    'http_req_failed{endpoint:database}': ['rate<0.01'],

    // Blockchain thresholds
    'http_req_duration{endpoint:blockchain}': [
      'p(50)<5000',
      'p(95)<30000',
      'p(99)<60000',
    ],
    'http_req_failed{endpoint:blockchain}': ['rate<0.1'],
  },

  summaryTrendStats: ['min', 'avg', 'med', 'p(95)', 'p(99)', 'max'],
};

export default function () {
  const baseURL = config.baseURL;

  // Step 1: Query Database
  const dbResponse = queryDatabase(baseURL);

  // Wait 1 second
  sleep(1);

  // Step 2: Query Blockchain
  const bcResponse = queryBlockchain(baseURL);

  // Log comparison
  logComparison(dbResponse, bcResponse);

  // Wait 1 second before next iteration
  sleep(1);
}

export function handleSummary(data) {
  // Extract metrics
  const dbMetrics = data.metrics['http_req_duration{endpoint:database}'];
  const bcMetrics = data.metrics['http_req_duration{endpoint:blockchain}'];

  // Calculate comparison
  const comparison = {
    database: {
      p50: dbMetrics?.values['p(50)'],
      p95: dbMetrics?.values['p(95)'],
      p99: dbMetrics?.values['p(99)'],
      avg: dbMetrics?.values.avg,
      min: dbMetrics?.values.min,
      max: dbMetrics?.values.max,
    },
    blockchain: {
      p50: bcMetrics?.values['p(50)'],
      p95: bcMetrics?.values['p(95)'],
      p99: bcMetrics?.values['p(99)'],
      avg: bcMetrics?.values.avg,
      min: bcMetrics?.values.min,
      max: bcMetrics?.values.max,
    },
    speedup: {
      p50: bcMetrics?.values['p(50)'] / dbMetrics?.values['p(50)'],
      p95: bcMetrics?.values['p(95)'] / dbMetrics?.values['p(95)'],
      p99: bcMetrics?.values['p(99)'] / dbMetrics?.values['p(99)'],
      avg: bcMetrics?.values.avg / dbMetrics?.values.avg,
    },
  };

  const enhancedData = {
    ...data,
    comparison,
    scenario: {
      name: 'Scenario 1: Baseline Performance Comparison',
      vus: 1,
      duration: '2m',
      objective: 'Establish baseline performance metrics with minimal load',
    },
  };

  return {
    'results/scenario1-baseline.html': htmlReport(enhancedData),
    'results/scenario1-baseline.json': JSON.stringify(enhancedData, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
