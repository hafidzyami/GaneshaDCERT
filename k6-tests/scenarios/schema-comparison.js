import http from 'k6/http';
import { sleep } from 'k6';
import { checkResponse, parseResponse } from '../lib/helpers.js';

const config = JSON.parse(open('../config/config.json'));

/**
 * Test GET /api/v1/schemas (PostgreSQL)
 */
export function testDatabaseQuery(baseURL, params = {}) {
  const url = `${baseURL}/api/v1/schemas`;
  const urlWithParams = Object.keys(params).length > 0
    ? `${url}?${Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`
    : url;

  const response = http.get(urlWithParams, {
    tags: { name: 'GetSchemas_Database', endpoint: '/api/v1/schemas' },
  });

  checkResponse(response, 'database', {
    'source is rdbms': (r) => {
      const json = r.json();
      return json.source === 'rdbms';
    },
  });

  return parseResponse(response);
}

/**
 * Test GET /api/v1/schemas/blockchain (Blockchain)
 */
export function testBlockchainQuery(baseURL, params = {}) {
  const url = `${baseURL}/api/v1/schemas/blockchain`;
  const urlWithParams = Object.keys(params).length > 0
    ? `${url}?${Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`
    : url;

  const response = http.get(urlWithParams, {
    tags: { name: 'GetSchemas_Blockchain', endpoint: '/api/v1/schemas/blockchain' },
  });

  checkResponse(response, 'blockchain', {
    'source is blockchain': (r) => {
      const json = r.json();
      return json.source === 'blockchain';
    },
  });

  return parseResponse(response);
}

/**
 * Test with filtering by issuerDid
 */
export function testWithFilter(baseURL, issuerDid) {
  console.log(`Testing with filter: issuerDid=${issuerDid}`);

  const dbResult = testDatabaseQuery(baseURL, { issuerDid });
  sleep(0.5);

  const bcResult = testBlockchainQuery(baseURL, { issuerDid });
  sleep(0.5);

  return {
    database: dbResult,
    blockchain: bcResult,
  };
}

/**
 * Test without filter (all schemas)
 */
export function testWithoutFilter(baseURL) {
  const dbResult = testDatabaseQuery(baseURL);
  sleep(0.5);

  const bcResult = testBlockchainQuery(baseURL);
  sleep(0.5);

  return {
    database: dbResult,
    blockchain: bcResult,
  };
}
