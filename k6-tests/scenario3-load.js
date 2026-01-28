/**
 * Scenario 3: Concurrent User Load Testing
 *
 * Objective: Measure performance degradation under increasing concurrent load
 *
 * Load Levels:
 * - LIGHT: 5 VUs for 2 minutes
 * - MEDIUM: 20 VUs for 3 minutes
 * - HIGH: 50 VUs for 3 minutes
 * - STRESS: 100 VUs for 2 minutes
 *
 * Run with: LOAD_LEVEL=LIGHT|MEDIUM|HIGH|STRESS k6 run scenario3-load.js
 */

import { sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import {
  queryDatabase,
  queryBlockchain,
  logComparison,
  sleepWithJitter
} from './utils/test-helpers.js';

const configFile = open('./config/config.json');
const config = JSON.parse(configFile);

// Get load level from environment variable
const LOAD_LEVEL = __ENV.LOAD_LEVEL || 'LIGHT';

// Load level configurations
const LOAD_LEVELS = {
  LIGHT: {
    vus: 5,
    duration: '2m',
    rampUp: '10s',
    rampDown: '10s',
    description: 'Normal usage - 5 concurrent users',
  },
  MEDIUM: {
    vus: 20,
    duration: '3m',
    rampUp: '30s',
    rampDown: '30s',
    description: 'Peak hours - 20 concurrent users',
  },
  HIGH: {
    vus: 50,
    duration: '3m',
    rampUp: '30s',
    rampDown: '30s',
    description: 'High traffic - 50 concurrent users',
  },
  STRESS: {
    vus: 100,
    duration: '2m',
    rampUp: '20s',
    rampDown: '20s',
    description: 'Stress test - 100 concurrent users',
  },
};

const currentLoad = LOAD_LEVELS[LOAD_LEVEL] || LOAD_LEVELS.LIGHT;

export const options = {
  scenarios: {
    load_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: currentLoad.rampUp, target: currentLoad.vus },  // Ramp up
        { duration: currentLoad.duration, target: currentLoad.vus }, // Hold
        { duration: currentLoad.rampDown, target: 0 },              // Ramp down
      ],
      gracefulRampDown: '10s',
    },
  },

  thresholds: {
    // Database thresholds (adjust by load level)
    'http_req_duration{endpoint:database}': [
      LOAD_LEVEL === 'STRESS' ? 'p(95)<2000' : 'p(95)<1000',
      'p(99)<3000',
    ],
    'http_req_failed{endpoint:database}': [
      LOAD_LEVEL === 'STRESS' ? 'rate<0.05' : 'rate<0.01'
    ],

    // Blockchain thresholds (very relaxed for high load)
    'http_req_duration{endpoint:blockchain}': [
      'p(50)<10000',
      LOAD_LEVEL === 'STRESS' ? 'p(95)<120000' : 'p(95)<60000',
    ],
    'http_req_failed{endpoint:blockchain}': [
      LOAD_LEVEL === 'STRESS' ? 'rate<0.5' : 'rate<0.3'
    ],

    // Throughput checks
    'http_reqs{endpoint:database}': ['rate>10'], // At least 10 req/s for DB
  },

  summaryTrendStats: ['min', 'avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
};

export default function () {
  const baseURL = config.baseURL;

  // Query database
  const dbResponse = queryDatabase(baseURL);
  sleepWithJitter(0.5);

  // Query blockchain (with longer timeout for high load)
  const bcResponse = queryBlockchain(baseURL);

  // Log metrics
  logComparison(dbResponse, bcResponse);

  // Variable sleep based on load level
  const sleepTime = LOAD_LEVEL === 'STRESS' ? 0.5 : 1;
  sleepWithJitter(sleepTime);
}

export function handleSummary(data) {
  const dbMetrics = data.metrics['http_req_duration{endpoint:database}'];
  const bcMetrics = data.metrics['http_req_duration{endpoint:blockchain}'];
  const dbFailed = data.metrics['http_req_failed{endpoint:database}'];
  const bcFailed = data.metrics['http_req_failed{endpoint:blockchain}'];
  const dbReqs = data.metrics['http_reqs{endpoint:database}'];
  const bcReqs = data.metrics['http_reqs{endpoint:blockchain}'];

  // Calculate test duration (in seconds)
  const testDuration = data.state.testRunDurationMs / 1000;

  const comparison = {
    loadLevel: LOAD_LEVEL,
    loadDescription: currentLoad.description,
    maxConcurrentUsers: currentLoad.vus,
    testDurationSeconds: testDuration,

    database: {
      totalRequests: dbReqs?.values.count || 0,
      throughput: (dbReqs?.values.count || 0) / testDuration,
      successRate: (1 - (dbFailed?.values.rate || 0)) * 100,
      errorRate: (dbFailed?.values.rate || 0) * 100,
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
      totalRequests: bcReqs?.values.count || 0,
      throughput: (bcReqs?.values.count || 0) / testDuration,
      successRate: (1 - (bcFailed?.values.rate || 0)) * 100,
      errorRate: (bcFailed?.values.rate || 0) * 100,
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
    },

    analysis: {
      dbDegradation: 'Performance degradation under load',
      bcBottleneck: 'Likely RPC rate limiting',
      throughputRatio: ((dbReqs?.values.count || 0) / (bcReqs?.values.count || 1)).toFixed(2) + 'x',
    }
  };

  const enhancedData = {
    ...data,
    comparison,
    scenario: {
      name: 'Scenario 3: Concurrent User Load Testing',
      loadLevel: LOAD_LEVEL,
      maxVUs: currentLoad.vus,
      duration: currentLoad.duration,
      objective: 'Measure performance degradation under increasing concurrent load',
    },
  };

  return {
    [`results/scenario3-load-${LOAD_LEVEL}.html`]: htmlReport(enhancedData),
    [`results/scenario3-load-${LOAD_LEVEL}.json`]: JSON.stringify(enhancedData, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
