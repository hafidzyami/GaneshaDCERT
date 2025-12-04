/**
 * Shared Test Configuration
 * Used across all k6 test scenarios
 */

import { readFileSync } from 'k6/experimental/fs';

// Load base configuration
const configFile = readFileSync('./config/config.json');
export const config = JSON.parse(configFile);

// API Endpoints
export const ENDPOINTS = {
  database: `${config.baseURL}/api/v1/schemas`,
  blockchain: `${config.baseURL}/api/v1/schemas/blockchain`,
};

// Performance Thresholds
export const THRESHOLDS = {
  database: {
    'http_req_duration{endpoint:database}': [
      'p(50)<100',      // 50% under 100ms
      'p(95)<500',      // 95% under 500ms
      'p(99)<1000',     // 99% under 1s
    ],
    'http_req_failed{endpoint:database}': [
      'rate<0.01'       // Less than 1% error rate
    ]
  },
  blockchain: {
    'http_req_duration{endpoint:blockchain}': [
      'p(50)<5000',     // 50% under 5 seconds
      'p(95)<30000',    // 95% under 30 seconds
      'p(99)<60000',    // 99% under 1 minute
    ],
    'http_req_failed{endpoint:blockchain}': [
      'rate<0.1'        // Less than 10% error rate
    ]
  }
};

// Test Data Sizes
export const DATA_SIZES = {
  SMALL: 10,
  MEDIUM: 100,
  LARGE: 1000,
  XLARGE: 10000
};

// Load Levels for Concurrent Testing
export const LOAD_LEVELS = {
  LIGHT: { vus: 5, duration: '2m', rampUp: '10s' },
  MEDIUM: { vus: 20, duration: '3m', rampUp: '30s' },
  HIGH: { vus: 50, duration: '3m', rampUp: '30s' },
  STRESS: { vus: 100, duration: '2m', rampUp: '20s' }
};

export default {
  config,
  ENDPOINTS,
  THRESHOLDS,
  DATA_SIZES,
  LOAD_LEVELS
};
