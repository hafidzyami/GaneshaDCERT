/**
 * K6 Test Utilities
 * Helper functions for performance tests
 */

import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';

// Custom metrics
export const dbResponseTime = new Trend('db_response_time', true);
export const bcResponseTime = new Trend('bc_response_time', true);
export const dbRequestCount = new Counter('db_request_count');
export const bcRequestCount = new Counter('bc_request_count');
export const dbErrorCount = new Counter('db_error_count');
export const bcErrorCount = new Counter('bc_error_count');

/**
 * Validate database response
 */
export function validateDatabaseResponse(response, expectedCount = null) {
  const checks = {
    'database status is 200': (r) => r.status === 200,
    'database response has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && Array.isArray(body.data);
      } catch (e) {
        return false;
      }
    },
    'database response has responseTime': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.responseTime && body.responseTime.includes('ms');
      } catch (e) {
        return false;
      }
    },
  };

  if (expectedCount !== null) {
    checks['database returns expected count'] = (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.count === expectedCount || body.data.length === expectedCount;
      } catch (e) {
        return false;
      }
    };
  }

  const result = check(response, checks);

  // Track metrics
  dbRequestCount.add(1);
  if (!result) {
    dbErrorCount.add(1);
  }

  return result;
}

/**
 * Validate blockchain response
 */
export function validateBlockchainResponse(response, expectedCount = null) {
  const checks = {
    'blockchain status is 200': (r) => r.status === 200,
    'blockchain response has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && Array.isArray(body.data);
      } catch (e) {
        return false;
      }
    },
    'blockchain response has responseTime': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.responseTime && body.responseTime.includes('ms');
      } catch (e) {
        return false;
      }
    },
    'blockchain schema is parsed object': (r) => {
      try {
        const body = JSON.parse(r.body);
        if (body.data.length > 0) {
          // Check that schema field is an object, not a string
          return typeof body.data[0].schema === 'object';
        }
        return true;
      } catch (e) {
        return false;
      }
    },
  };

  if (expectedCount !== null) {
    checks['blockchain returns expected count'] = (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.count === expectedCount || body.data.length === expectedCount;
      } catch (e) {
        return false;
      }
    };
  }

  const result = check(response, checks);

  // Track metrics
  bcRequestCount.add(1);
  if (!result) {
    bcErrorCount.add(1);
  }

  return result;
}

/**
 * Validate data consistency between database and blockchain
 */
export function validateDataConsistency(dbResponse, bcResponse) {
  const checks = {
    'data count matches': (r) => {
      try {
        const dbBody = JSON.parse(dbResponse.body);
        const bcBody = JSON.parse(bcResponse.body);
        return dbBody.data.length === bcBody.data.length;
      } catch (e) {
        return false;
      }
    },
    'schema IDs match': (r) => {
      try {
        const dbBody = JSON.parse(dbResponse.body);
        const bcBody = JSON.parse(bcResponse.body);

        const dbIds = dbBody.data.map(s => s.id).sort();
        const bcIds = bcBody.data.map(s => s.id).sort();

        return JSON.stringify(dbIds) === JSON.stringify(bcIds);
      } catch (e) {
        return false;
      }
    },
  };

  return check(null, checks);
}

/**
 * Calculate speedup factor
 */
export function calculateSpeedup(dbTime, bcTime) {
  if (dbTime === 0) return 0;
  return bcTime / dbTime;
}

/**
 * Parse response time from API response
 */
export function parseResponseTime(response) {
  try {
    const body = JSON.parse(response.body);
    if (body.responseTime) {
      // Extract number from "123ms" format
      const match = body.responseTime.match(/(\d+(\.\d+)?)/);
      return match ? parseFloat(match[1]) : 0;
    }
  } catch (e) {
    return 0;
  }
  return 0;
}

/**
 * Log test summary
 */
export function logSummary(testName, iteration, dbTime, bcTime) {
  const speedup = calculateSpeedup(dbTime, bcTime);
  console.log(
    `[${testName}] Iteration ${iteration}: ` +
    `DB=${dbTime.toFixed(2)}ms, ` +
    `BC=${bcTime.toFixed(2)}ms, ` +
    `Speedup=${speedup.toFixed(2)}x`
  );
}

/**
 * Random sleep between min and max seconds
 */
export function randomSleep(min, max) {
  const sleepTime = min + Math.random() * (max - min);
  return sleepTime;
}

export default {
  validateDatabaseResponse,
  validateBlockchainResponse,
  validateDataConsistency,
  calculateSpeedup,
  parseResponseTime,
  logSummary,
  randomSleep,
  dbResponseTime,
  bcResponseTime,
  dbRequestCount,
  bcRequestCount,
  dbErrorCount,
  bcErrorCount,
};
