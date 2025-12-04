/**
 * Scenario 2: Data Volume Impact Analysis
 *
 * Objective: Understand how performance scales with increasing data size
 *
 * Configuration:
 * - VUs: 5 concurrent users
 * - Duration: 3 minutes per dataset
 * - Iterations: 50 queries per VU
 *
 * Test Datasets:
 * - Small: 10 schemas
 * - Medium: 100 schemas
 * - Large: 1,000 schemas
 * - X-Large: 10,000 schemas
 *
 * Run with: DATA_SIZE=SMALL|MEDIUM|LARGE|XLARGE k6 run scenario2-volume.js
 */

import { sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import {
  queryDatabase,
  queryBlockchain,
  logComparison,
  getRecordCount,
  sleepWithJitter
} from './utils/test-helpers.js';

const configFile = open('./config/config.json');
const config = JSON.parse(configFile);

// Get data size from environment variable
const DATA_SIZE = __ENV.DATA_SIZE || 'CURRENT';

// Data size configurations
const DATA_SIZES = {
  SMALL: { size: 10, description: '2 issuers × 5 schemas each' },
  MEDIUM: { size: 100, description: '10 issuers × 10 schemas each' },
  LARGE: { size: 1000, description: '50 issuers × 20 schemas each' },
  XLARGE: { size: 10000, description: '100 issuers × 100 schemas each' },
  CURRENT: { size: null, description: 'Current production data' }
};

const currentDataSize = DATA_SIZES[DATA_SIZE] || DATA_SIZES.CURRENT;

export const options = {
  vus: 5,
  duration: '3m',
  iterations: 250, // 50 iterations per VU (5 VUs × 50)

  thresholds: {
    // Database thresholds (stricter for small data, relaxed for large)
    'http_req_duration{endpoint:database}': [
      currentDataSize.size <= 100 ? 'p(95)<200' : 'p(95)<500',
      'p(99)<1000',
    ],
    'http_req_failed{endpoint:database}': ['rate<0.01'],

    // Blockchain thresholds (relaxed for large data)
    'http_req_duration{endpoint:blockchain}': [
      currentDataSize.size <= 100 ? 'p(95)<15000' : 'p(95)<60000',
      'p(99)<120000', // 2 minutes max
    ],
    'http_req_failed{endpoint:blockchain}': ['rate<0.1'],
  },

  summaryTrendStats: ['min', 'avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
};

export default function () {
  const baseURL = config.baseURL;

  // Query both endpoints
  const dbResponse = queryDatabase(baseURL);
  sleepWithJitter(0.5);

  const bcResponse = queryBlockchain(baseURL);
  sleepWithJitter(0.5);

  // Log comparison with record count
  const metrics = logComparison(dbResponse, bcResponse);
  const recordCount = getRecordCount(dbResponse);

  if (__ITER === 0) {
    console.log(`Testing with dataset: ${DATA_SIZE} (${currentDataSize.description})`);
    console.log(`Record count: ${recordCount}`);
  }
}

export function handleSummary(data) {
  const dbMetrics = data.metrics['http_req_duration{endpoint:database}'];
  const bcMetrics = data.metrics['http_req_duration{endpoint:blockchain}'];
  const dbFailed = data.metrics['http_req_failed{endpoint:database}'];
  const bcFailed = data.metrics['http_req_failed{endpoint:blockchain}'];

  // Get actual record count from first iteration
  const dbRequests = data.metrics['http_reqs{endpoint:database}'];
  const totalRequests = dbRequests?.values.count || 0;

  const comparison = {
    dataSize: DATA_SIZE,
    dataDescription: currentDataSize.description,
    expectedRecords: currentDataSize.size,
    database: {
      totalRequests: totalRequests,
      successRate: (1 - (dbFailed?.values.rate || 0)) * 100,
      responseTime: {
        min: dbMetrics?.values.min,
        avg: dbMetrics?.values.avg,
        p50: dbMetrics?.values['p(50)'],
        p90: dbMetrics?.values['p(90)'],
        p95: dbMetrics?.values['p(95)'],
        p99: dbMetrics?.values['p(99)'],
        max: dbMetrics?.values.max,
      },
    },
    blockchain: {
      totalRequests: totalRequests,
      successRate: (1 - (bcFailed?.values.rate || 0)) * 100,
      responseTime: {
        min: bcMetrics?.values.min,
        avg: bcMetrics?.values.avg,
        p50: bcMetrics?.values['p(50)'],
        p90: bcMetrics?.values['p(90)'],
        p95: bcMetrics?.values['p(95)'],
        p99: bcMetrics?.values['p(99)'],
        max: bcMetrics?.values.max,
      },
    },
    speedup: {
      avg: bcMetrics?.values.avg / dbMetrics?.values.avg,
      p50: bcMetrics?.values['p(50)'] / dbMetrics?.values['p(50)'],
      p95: bcMetrics?.values['p(95)'] / dbMetrics?.values['p(95)'],
      p99: bcMetrics?.values['p(99)'] / dbMetrics?.values['p(99)'],
    },
    scalabilityAnalysis: {
      dbComplexity: 'O(log n) - indexed query',
      bcComplexity: 'O(n) - full scan',
      notes: 'Speedup factor should increase with data size'
    }
  };

  const enhancedData = {
    ...data,
    comparison,
    scenario: {
      name: 'Scenario 2: Data Volume Impact Analysis',
      vus: 5,
      duration: '3m',
      dataSize: DATA_SIZE,
      objective: 'Understand how performance scales with increasing data size',
    },
  };

  return {
    [`results/scenario2-volume-${DATA_SIZE}.html`]: htmlReport(enhancedData),
    [`results/scenario2-volume-${DATA_SIZE}.json`]: JSON.stringify(enhancedData, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
