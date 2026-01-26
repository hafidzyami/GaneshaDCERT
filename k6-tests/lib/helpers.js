import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// Custom metrics
export const databaseQueryDuration = new Trend('database_query_duration', true);
export const blockchainQueryDuration = new Trend('blockchain_query_duration', true);
export const databaseErrorRate = new Rate('database_error_rate');
export const blockchainErrorRate = new Rate('blockchain_error_rate');
export const databaseRequestCount = new Counter('database_request_count');
export const blockchainRequestCount = new Counter('blockchain_request_count');

/**
 * Check response and record metrics
 */
export function checkResponse(response, source, checks = {}) {
  const defaultChecks = {
    'status is 200': (r) => r.status === 200,
    'response has data': (r) => r.json('data') !== undefined,
    'response time < 30s': (r) => r.timings.duration < 30000,
  };

  const result = check(response, { ...defaultChecks, ...checks });

  // Record custom metrics
  if (source === 'database') {
    databaseQueryDuration.add(response.timings.duration);
    databaseErrorRate.add(response.status !== 200);
    databaseRequestCount.add(1);
  } else if (source === 'blockchain') {
    blockchainQueryDuration.add(response.timings.duration);
    blockchainErrorRate.add(response.status !== 200);
    blockchainRequestCount.add(1);
  }

  return result;
}

/**
 * Format duration for logging
 */
export function formatDuration(ms) {
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Parse response data
 */
export function parseResponse(response) {
  try {
    const json = response.json();
    return {
      success: response.status === 200,
      data: json.data || [],
      count: json.count || 0,
      source: json.source || 'unknown',
      duration: response.timings.duration,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      duration: response.timings.duration,
    };
  }
}
