/**
 * Quick test to check endpoint response format
 * Run with: k6 run k6-tests/test-endpoint.js
 */

import http from 'k6';

const configFile = open('./config/config.json');
const config = JSON.parse(configFile);

export default function () {
  console.log('Testing Database Endpoint...');
  const dbResponse = http.get(`${config.baseURL}/api/v1/schemas`);
  console.log('DB Response Status:', dbResponse.status);
  console.log('DB Response Body:', dbResponse.body.substring(0, 500));

  try {
    const dbData = JSON.parse(dbResponse.body);
    console.log('DB Response parsed:', JSON.stringify(dbData, null, 2).substring(0, 500));
    console.log('DB Response keys:', Object.keys(dbData));

    if (dbData.data) {
      console.log('DB data type:', typeof dbData.data);
      console.log('DB data is array:', Array.isArray(dbData.data));
      if (Array.isArray(dbData.data)) {
        console.log('DB data length:', dbData.data.length);
      }
    }
  } catch (e) {
    console.error('Failed to parse DB response:', e.message);
  }

  console.log('\nTesting Blockchain Endpoint...');
  const bcResponse = http.get(`${config.baseURL}/api/v1/schemas/blockchain`, {
    timeout: '120s'
  });
  console.log('BC Response Status:', bcResponse.status);
  console.log('BC Response Body:', bcResponse.body.substring(0, 500));

  try {
    const bcData = JSON.parse(bcResponse.body);
    console.log('BC Response parsed:', JSON.stringify(bcData, null, 2).substring(0, 500));
    console.log('BC Response keys:', Object.keys(bcData));

    if (bcData.data) {
      console.log('BC data type:', typeof bcData.data);
      console.log('BC data is array:', Array.isArray(bcData.data));
      if (Array.isArray(bcData.data)) {
        console.log('BC data length:', bcData.data.length);
      }
    }
  } catch (e) {
    console.error('Failed to parse BC response:', e.message);
  }
}

export const options = {
  iterations: 1,
  vus: 1,
};
