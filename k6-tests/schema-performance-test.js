import { sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import {
  testDatabaseQuery,
  testBlockchainQuery,
  testWithFilter,
  testWithoutFilter,
} from './scenarios/schema-comparison.js';

const config = JSON.parse(open('./config/config.json'));

// Test configuration
export const options = {
  scenarios: {
    // Scenario 1: Light load - Compare both endpoints
    light_load_comparison: {
      executor: 'constant-vus',
      vus: 5,
      duration: '1m',
      tags: { scenario: 'light_load' },
    },

    // Scenario 2: Medium load - Database only (should handle well)
    medium_load_database: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 20 },
        { duration: '30s', target: 0 },
      ],
      tags: { scenario: 'medium_load_db' },
      startTime: '2m', // Start after light load
    },

    // Scenario 3: Medium load - Blockchain only (expected to be slower)
    medium_load_blockchain: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 10 },
        { duration: '30s', target: 0 },
      ],
      tags: { scenario: 'medium_load_bc' },
      startTime: '4m', // Start after medium_load_database
    },

    // Scenario 4: Spike test - Database resilience
    spike_database: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 50 },  // Sudden spike
        { duration: '30s', target: 50 },  // Maintain spike
        { duration: '10s', target: 0 },   // Drop
      ],
      tags: { scenario: 'spike_db' },
      startTime: '6m', // Start after blockchain test
    },
  },

  thresholds: {
    // Overall HTTP metrics
    'http_req_duration': ['p(95)<5000', 'p(99)<10000'],
    'http_req_failed': ['rate<0.05'],

    // Database-specific thresholds
    'http_req_duration{endpoint:/api/v1/schemas}': [
      'p(95)<500',   // 95% should be under 500ms
      'p(99)<1000',  // 99% should be under 1s
    ],

    // Blockchain-specific thresholds
    'http_req_duration{endpoint:/api/v1/schemas/blockchain}': [
      'p(95)<15000',  // 95% should be under 15s
      'p(99)<30000',  // 99% should be under 30s
    ],

    // Custom metrics thresholds
    'database_query_duration': ['p(95)<500', 'p(99)<1000'],
    'blockchain_query_duration': ['p(95)<15000', 'p(99)<30000'],
    'database_error_rate': ['rate<0.01'],
    'blockchain_error_rate': ['rate<0.05'],
  },
};

// Main test function
export default function () {
  const baseURL = config.baseURL;

  // 50% chance to test with filter, 50% without filter
  if (Math.random() < 0.5) {
    // Test with filter
    const results = testWithFilter(baseURL, config.testDID);

    if (results.database.success && results.blockchain.success) {
      console.log(`✓ Comparison [WITH FILTER]:
        - Database: ${results.database.duration.toFixed(2)}ms (count: ${results.database.count})
        - Blockchain: ${results.blockchain.duration.toFixed(2)}ms (count: ${results.blockchain.count})
        - Speedup: ${(results.blockchain.duration / results.database.duration).toFixed(2)}x
      `);
    }
  } else {
    // Test without filter
    const results = testWithoutFilter(baseURL);

    if (results.database.success && results.blockchain.success) {
      console.log(`✓ Comparison [NO FILTER]:
        - Database: ${results.database.duration.toFixed(2)}ms (count: ${results.database.count})
        - Blockchain: ${results.blockchain.duration.toFixed(2)}ms (count: ${results.blockchain.count})
        - Speedup: ${(results.blockchain.duration / results.database.duration).toFixed(2)}x
      `);
    }
  }

  sleep(1);
}

// Generate HTML report
export function handleSummary(data) {
  return {
    'results/summary.html': htmlReport(data),
    'results/summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
