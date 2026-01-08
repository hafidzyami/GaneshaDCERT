/**
 * Scenario 4: Spike Test (Sudden Load)
 *
 * Objective: Test system resilience to sudden traffic spikes
 *
 * Test Pattern:
 * 1. Baseline (10s): 5 VUs - normal load
 * 2. Spike (5s): Rapid increase to 100 VUs
 * 3. Hold (30s): Maintain 100 VUs
 * 4. Recovery (10s): Drop back to 5 VUs
 * 5. Observe (1m): Monitor recovery to normal performance
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
  scenarios: {
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 5 },    // Baseline: Normal load
        { duration: '5s', target: 100 },   // Spike: Sudden increase
        { duration: '30s', target: 100 },  // Hold: Maintain spike
        { duration: '10s', target: 5 },    // Recovery: Drop back
        { duration: '1m', target: 5 },     // Observe: Monitor recovery
      ],
      gracefulRampDown: '10s',
    },
  },

  thresholds: {
    // Database should handle spike (though performance may degrade)
    'http_req_duration{endpoint:database}': [
      'p(95)<3000',  // Relaxed during spike
    ],
    'http_req_failed{endpoint:database}': [
      'rate<0.1'     // Allow 10% error during spike
    ],

    // Blockchain likely to have issues during spike
    'http_req_duration{endpoint:blockchain}': [
      'p(50)<15000',
    ],
    'http_req_failed{endpoint:blockchain}': [
      'rate<0.5'     // Allow 50% error during spike
    ],
  },

  summaryTrendStats: ['min', 'avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
};

// Track which phase we're in
let phase = 'BASELINE';
let phaseStartTime = Date.now();

export default function () {
  const baseURL = config.baseURL;
  const currentTime = Date.now();
  const elapsed = (currentTime - phaseStartTime) / 1000;

  // Determine current phase based on time
  if (elapsed < 10) {
    phase = 'BASELINE';
  } else if (elapsed < 15) {
    phase = 'SPIKE';
  } else if (elapsed < 45) {
    phase = 'HOLD';
  } else if (elapsed < 55) {
    phase = 'RECOVERY';
  } else {
    phase = 'OBSERVE';
  }

  // Query both endpoints
  const dbResponse = queryDatabase(baseURL);
  sleepWithJitter(0.3);

  const bcResponse = queryBlockchain(baseURL);

  // Log with phase information
  const metrics = logComparison(dbResponse, bcResponse);

  if (__ITER % 10 === 0) {
    console.log(`[${phase}] Phase at ${elapsed.toFixed(1)}s`);
  }

  // Shorter sleep during spike
  const sleepTime = phase === 'SPIKE' || phase === 'HOLD' ? 0.3 : 0.5;
  sleepWithJitter(sleepTime);
}

export function handleSummary(data) {
  const dbMetrics = data.metrics['http_req_duration{endpoint:database}'];
  const bcMetrics = data.metrics['http_req_duration{endpoint:blockchain}'];
  const dbFailed = data.metrics['http_req_failed{endpoint:database}'];
  const bcFailed = data.metrics['http_req_failed{endpoint:blockchain}'];
  const dbReqs = data.metrics['http_reqs{endpoint:database}'];
  const bcReqs = data.metrics['http_reqs{endpoint:blockchain}'];

  const testDuration = data.state.testRunDurationMs / 1000;

  const comparison = {
    testPattern: {
      baseline: '10s at 5 VUs',
      spike: '5s ramp to 100 VUs',
      hold: '30s at 100 VUs',
      recovery: '10s ramp to 5 VUs',
      observe: '60s at 5 VUs',
      totalDuration: testDuration + 's',
    },

    database: {
      totalRequests: dbReqs?.values.count || 0,
      failedRequests: Math.round((dbReqs?.values.count || 0) * (dbFailed?.values.rate || 0)),
      successRate: (1 - (dbFailed?.values.rate || 0)) * 100,
      errorRate: (dbFailed?.values.rate || 0) * 100,
      responseTime: {
        min: dbMetrics?.values.min,
        avg: dbMetrics?.values.avg,
        p50: dbMetrics?.values['p(50)'],
        p95: dbMetrics?.values['p(95)'],
        p99: dbMetrics?.values['p(99)'],
        max: dbMetrics?.values.max,
      },
      duringSpike: {
        maxResponseTime: dbMetrics?.values.max,
        notes: 'Expected degradation during spike, should recover quickly',
      },
    },

    blockchain: {
      totalRequests: bcReqs?.values.count || 0,
      failedRequests: Math.round((bcReqs?.values.count || 0) * (bcFailed?.values.rate || 0)),
      successRate: (1 - (bcFailed?.values.rate || 0)) * 100,
      errorRate: (bcFailed?.values.rate || 0) * 100,
      responseTime: {
        min: bcMetrics?.values.min,
        avg: bcMetrics?.values.avg,
        p50: bcMetrics?.values['p(50)'],
        p95: bcMetrics?.values['p(95)'],
        p99: bcMetrics?.values['p(99)'],
        max: bcMetrics?.values.max,
      },
      duringSpike: {
        maxResponseTime: bcMetrics?.values.max,
        notes: 'Likely to timeout/fail during spike, slow recovery expected',
      },
    },

    resilience: {
      dbRecoveryTime: 'Check if p95 returns to baseline after spike',
      bcRecoveryTime: 'Check if error rate decreases after spike',
      cascadingFailures: 'Monitor for cascading failures',
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
      name: 'Scenario 4: Spike Test (Sudden Load)',
      objective: 'Test system resilience to sudden traffic spikes',
      spikeIntensity: '20x increase (5 → 100 VUs)',
    },
  };

  return {
    'results/scenario4-spike.html': htmlReport(enhancedData),
    'results/scenario4-spike.json': JSON.stringify(enhancedData, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
