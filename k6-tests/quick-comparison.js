import http from 'k6/http';
import { sleep } from 'k6';
// import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
// import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

const config = JSON.parse(open('./config/config.json'));

// Quick comparison test - 10 VUs for 30 seconds
export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    'http_req_duration{endpoint:database}': ['p(95)<500'],
    'http_req_duration{endpoint:blockchain}': ['p(95)<15000'],
  },
};

export default function () {
  const baseURL = config.baseURL;

  // Test Database endpoint
  const dbResponse = http.get(`${baseURL}/api/v1/schemas`, {
    tags: { endpoint: 'database', name: 'GetSchemas_Database' },
  });

  sleep(0.5);

  // Test Blockchain endpoint
  const bcResponse = http.get(`${baseURL}/api/v1/schemas/blockchain`, {
    tags: { endpoint: 'blockchain', name: 'GetSchemas_Blockchain' },
  });

  // Log comparison
  if (dbResponse.status === 200 && bcResponse.status === 200) {
    const dbData = dbResponse.json();
    const bcData = bcResponse.json();

    console.log(`Database: ${dbResponse.timings.duration.toFixed(2)}ms | Blockchain: ${bcResponse.timings.duration.toFixed(2)}ms | Speedup: ${(bcResponse.timings.duration / dbResponse.timings.duration).toFixed(2)}x`);
  }

  sleep(1);
}

export function handleSummary(data) {
  // Calculate custom statistics
  const dbMetrics = data.metrics['http_req_duration{endpoint:database}'];
  const bcMetrics = data.metrics['http_req_duration{endpoint:blockchain}'];

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
  };

  return {
    // 'results/quick-comparison.html': htmlReport(enhancedData),
    'results/quick-comparison.json': JSON.stringify(enhancedData, null, 2),
    // stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
