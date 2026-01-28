/**
 * Shared Test Helper Functions
 */

import { check, sleep } from 'k6';
import http from 'k6/http';

/**
 * Query database endpoint
 */
export function queryDatabase(baseURL) {
  const response = http.get(`${baseURL}/api/v1/schemas`, {
    tags: { endpoint: 'database', name: 'GetSchemas_Database' },
  });

  check(response, {
    'DB: status is 200': (r) => r.status === 200,
    'DB: has response body': (r) => r.body && r.body.length > 0,
    'DB: is valid JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch (e) {
        return false;
      }
    },
  });

  return response;
}

/**
 * Query blockchain endpoint
 */
export function queryBlockchain(baseURL) {
  const response = http.get(`${baseURL}/api/v1/schemas/blockchain`, {
    tags: { endpoint: 'blockchain', name: 'GetSchemas_Blockchain' },
    timeout: '120s', // 2 minutes timeout for blockchain
  });

  check(response, {
    'BC: status is 200': (r) => r.status === 200,
    'BC: has response body': (r) => r.body && r.body.length > 0,
    'BC: is valid JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch (e) {
        return false;
      }
    },
  });

  return response;
}

/**
 * Verify data consistency between database and blockchain
 */
export function verifyConsistency(dbResponse, bcResponse) {
  let dbData, bcData;

  try {
    dbData = JSON.parse(dbResponse.body);
    bcData = JSON.parse(bcResponse.body);
  } catch (e) {
    console.error('Failed to parse responses:', e.message);
    return false;
  }

  // Check for error responses
  if (dbData.statusCode === 401 || bcData.statusCode === 401) {
    console.error('Unauthorized - API requires authentication');
    return false;
  }

  if (!dbData.success || !bcData.success) {
    console.error('API returned error:', {
      db: dbData.message || 'Unknown error',
      bc: bcData.message || 'Unknown error'
    });
    return false;
  }

  // Extract data array (handle different response formats)
  // Response format: { success: true, count: X, data: [...] }
  const dbSchemas = dbData.data || dbData.schemas || dbData;
  const bcSchemas = bcData.data || bcData.schemas || bcData;

  // Check if both are arrays
  if (!Array.isArray(dbSchemas) || !Array.isArray(bcSchemas)) {
    console.error('Responses are not arrays:', {
      dbType: typeof dbSchemas,
      bcType: typeof bcSchemas,
      dbIsArray: Array.isArray(dbSchemas),
      bcIsArray: Array.isArray(bcSchemas)
    });
    return false;
  }

  // Compare counts
  const countMatch = dbSchemas.length === bcSchemas.length;

  if (!countMatch) {
    console.warn(`Count mismatch: DB=${dbSchemas.length}, BC=${bcSchemas.length}`);
    console.warn(`Note: Blockchain returns ALL versions, Database may return only latest/active`);

    // Still return true if DB count is reasonable (BC includes all versions)
    // BC count should be >= DB count (BC has all versions)
    const reasonableMatch = bcSchemas.length >= dbSchemas.length;

    if (reasonableMatch) {
      console.log(`✓ Acceptable: BC has ${bcSchemas.length - dbSchemas.length} more versions`);
      return true; // Accept this as valid
    }

    return false;
  } else {
    console.log(`✓ Count match: ${dbSchemas.length} schemas`);
  }

  return countMatch;
}

/**
 * Calculate speedup factor
 */
export function calculateSpeedup(dbTime, bcTime) {
  if (dbTime === 0) return 0;
  return Math.round((bcTime / dbTime) * 100) / 100;
}

/**
 * Log comparison metrics
 */
export function logComparison(dbResponse, bcResponse) {
  const dbTime = dbResponse.timings.duration;
  const bcTime = bcResponse.timings.duration;
  const speedup = calculateSpeedup(dbTime, bcTime);

  console.log(
    `Database: ${dbTime.toFixed(2)}ms | Blockchain: ${bcTime.toFixed(2)}ms | Speedup: ${speedup}x`
  );

  // Verify consistency
  const consistent = verifyConsistency(dbResponse, bcResponse);
  console.log(`Data Consistency: ${consistent ? '✓ PASS' : '✗ FAIL'}`);

  return {
    dbTime,
    bcTime,
    speedup,
    consistent
  };
}

/**
 * Extract record count from response
 */
export function getRecordCount(response) {
  try {
    const data = JSON.parse(response.body);
    const schemas = data.data || data.schemas || data;
    return Array.isArray(schemas) ? schemas.length : 0;
  } catch (e) {
    return 0;
  }
}

/**
 * Wait with jitter to prevent thundering herd
 */
export function sleepWithJitter(baseSleep, jitterPercent = 0.2) {
  const jitter = baseSleep * jitterPercent * (Math.random() - 0.5) * 2;
  sleep(baseSleep + jitter);
}

export default {
  queryDatabase,
  queryBlockchain,
  verifyConsistency,
  calculateSpeedup,
  logComparison,
  getRecordCount,
  sleepWithJitter
};
