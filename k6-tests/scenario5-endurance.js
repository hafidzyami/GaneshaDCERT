/**
 * Scenario 5: Endurance Test (Sustained Load)
 *
 * Objective: Identify memory leaks, connection issues, or performance
 *            degradation over time
 *
 * Configuration:
 * - VUs: 10 concurrent users
 * - Duration: 30 minutes sustained load
 * - Graceful stop: 30 seconds
 *
 * Analysis:
 * - Compare first 5 minutes vs last 5 minutes
 * - Monitor for performance degradation over time
 * - Check for memory/connection leaks
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

export const options = {
  vus: 10,
  duration: '30m',
  gracefulStop: '30s',

  thresholds: {
    // Database should maintain stable performance
    'http_req_duration{endpoint:database}': [
      'p(50)<200',
      'p(95)<1000',
    ],
    'http_req_failed{endpoint:database}': [
      'rate<0.01'  // Less than 1% error rate
    ],

    // Blockchain may show degradation but should remain functional
    'http_req_duration{endpoint:blockchain}': [
      'p(50)<10000',
      'p(95)<60000',
    ],
    'http_req_failed{endpoint:blockchain}': [
      'rate<0.2'   // Allow up to 20% errors
    ],

    // Stability check: performance variance should be minimal
    'http_req_duration{endpoint:database,phase:first5min}': ['p(95)<1000'],
    'http_req_duration{endpoint:database,phase:last5min}': ['p(95)<1200'], // Allow 20% degradation
  },

  summaryTrendStats: ['min', 'avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
};

const startTime = Date.now();

export default function () {
  const baseURL = config.baseURL;
  const elapsed = (Date.now() - startTime) / 1000;
  const elapsedMinutes = elapsed / 60;

  // Determine phase for analysis
  let phase = 'middle';
  if (elapsedMinutes < 5) {
    phase = 'first5min';
  } else if (elapsedMinutes > 25) {
    phase = 'last5min';
  }

  // Query database
  const dbResponse = queryDatabase(baseURL);
  sleepWithJitter(0.5);

  // Query blockchain
  const bcResponse = queryBlockchain(baseURL);

  // Log comparison with phase tag
  const metrics = logComparison(dbResponse, bcResponse);

  // Log phase information periodically
  if (__ITER % 50 === 0) {
    console.log(`[${phase.toUpperCase()}] Elapsed: ${elapsedMinutes.toFixed(1)} minutes`);
    console.log(`  DB: ${metrics.dbTime.toFixed(2)}ms | BC: ${metrics.bcTime.toFixed(2)}ms`);
  }

  // Sleep between requests
  sleepWithJitter(1);
}

export function handleSummary(data) {
  const dbMetrics = data.metrics['http_req_duration{endpoint:database}'];
  const bcMetrics = data.metrics['http_req_duration{endpoint:blockchain}'];
  const dbFailed = data.metrics['http_req_failed{endpoint:database}'];
  const bcFailed = data.metrics['http_req_failed{endpoint:blockchain}'];
  const dbReqs = data.metrics['http_reqs{endpoint:database}'];
  const bcReqs = data.metrics['http_reqs{endpoint:blockchain}'];

  // Try to get phase-specific metrics if available
  const dbFirst5 = data.metrics['http_req_duration{endpoint:database,phase:first5min}'];
  const dbLast5 = data.metrics['http_req_duration{endpoint:database,phase:last5min}'];

  const testDurationMinutes = data.state.testRunDurationMs / 1000 / 60;

  // Calculate degradation
  let degradationPercent = 0;
  if (dbFirst5 && dbLast5) {
    const first5Avg = dbFirst5.values.avg;
    const last5Avg = dbLast5.values.avg;
    degradationPercent = ((last5Avg - first5Avg) / first5Avg) * 100;
  }

  const comparison = {
    testDuration: `${testDurationMinutes.toFixed(1)} minutes`,
    constantLoad: '10 concurrent users',

    database: {
      totalRequests: dbReqs?.values.count || 0,
      throughput: ((dbReqs?.values.count || 0) / (testDurationMinutes * 60)).toFixed(2) + ' req/s',
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
      performanceOverTime: {
        first5MinAvg: dbFirst5?.values.avg,
        last5MinAvg: dbLast5?.values.avg,
        degradationPercent: degradationPercent.toFixed(2) + '%',
        verdict: degradationPercent < 10 ? 'STABLE' : 'DEGRADED',
      },
    },

    blockchain: {
      totalRequests: bcReqs?.values.count || 0,
      throughput: ((bcReqs?.values.count || 0) / (testDurationMinutes * 60)).toFixed(2) + ' req/s',
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

    stability: {
      performanceVariance: degradationPercent < 10 ? 'ACCEPTABLE (<10%)' : 'HIGH (>10%)',
      memoryLeaks: 'Check system metrics for increasing memory usage',
      connectionLeaks: 'Check connection pool status for leaks',
      notes: 'Compare first 5 minutes vs last 5 minutes performance',
    },

    speedup: {
      avg: bcMetrics?.values.avg / dbMetrics?.values.avg,
      p95: bcMetrics?.values['p(95)'] / dbMetrics?.values['p(95)'],
    },
  };

  const enhancedData = {
    ...data,
    comparison,
    scenario: {
      name: 'Scenario 5: Endurance Test (Sustained Load)',
      vus: 10,
      duration: '30 minutes',
      objective: 'Identify memory leaks, connection issues, or performance degradation over time',
    },
  };

  return {
    'results/scenario5-endurance.html': htmlReport(enhancedData),
    'results/scenario5-endurance.json': JSON.stringify(enhancedData, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
