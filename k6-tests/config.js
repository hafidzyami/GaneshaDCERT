/**
 * K6 Test Configuration
 * Centralized configuration for all performance tests
 */

// Base URL - adjust based on environment
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3069';

// API Endpoints
export const ENDPOINTS = {
  // Database endpoints
  database: {
    getAll: `${BASE_URL}/api/v1/performance/schemas/database`,
    getById: (id, version) => `${BASE_URL}/api/v1/performance/schemas/database/${id}/${version}`,
  },
  // Blockchain endpoints
  blockchain: {
    getAll: `${BASE_URL}/api/v1/performance/schemas/blockchain`,
    getById: (id, version) => `${BASE_URL}/api/v1/performance/schemas/blockchain/${id}/${version}`,
  },
};

// Performance thresholds
export const THRESHOLDS = {
  database: {
    'http_req_duration{endpoint:database}': [
      'p(50)<100',   // 50% under 100ms
      'p(95)<500',   // 95% under 500ms
      'p(99)<1000',  // 99% under 1s
    ],
    'http_req_failed{endpoint:database}': [
      'rate<0.01'    // Less than 1% error rate
    ],
  },
  blockchain: {
    'http_req_duration{endpoint:blockchain}': [
      'p(50)<5000',   // 50% under 5 seconds
      'p(95)<30000',  // 95% under 30 seconds
      'p(99)<60000',  // 99% under 1 minute
    ],
    'http_req_failed{endpoint:blockchain}': [
      'rate<0.1'      // Less than 10% error rate
    ],
  },
};

// Sleep durations (in seconds)
export const SLEEP = {
  betweenRequests: 0.5,  // Wait between database and blockchain calls
  afterIteration: 1,     // Wait after completing one iteration
};

// Test data
export const TEST_DATA = {
  // Sample schema IDs for testing (update with actual IDs)
  schemaIds: __ENV.SCHEMA_IDS ? __ENV.SCHEMA_IDS.split(',') : [],
  // Expected schema count
  expectedCount: parseInt(__ENV.EXPECTED_COUNT) || 10,
};

export default {
  BASE_URL,
  ENDPOINTS,
  THRESHOLDS,
  SLEEP,
  TEST_DATA,
};
