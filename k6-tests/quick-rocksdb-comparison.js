import { sleep } from 'k6';
import {
  testSchemaComparison,
  logComparison,
} from './scenarios/rocksdb-comparison.js';

const config = JSON.parse(open('./config/config.json'));

/**
 * Quick RocksDB Comparison Test - 30 seconds
 * Perfect for initial testing and quick validation
 */
export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    'postgres_query_duration': ['p(95)<500'],
    'rocksdb_query_duration': ['p(95)<50'],
    'speedup_factor': ['avg>5'],
    'cache_hit_rate': ['rate>0.5'], // Lower threshold for quick test
  },
};

export default function () {
  const baseURL = config.baseURL;
  const schemas = config.testSchemas;

  // Randomly select a schema
  const schema = schemas[Math.floor(Math.random() * schemas.length)];
  
  const result = testSchemaComparison(baseURL, schema.id, schema.version);
  
  // Log every comparison for quick test
  logComparison(result);

  sleep(1);
}

export function handleSummary(data) {
  const pgMetrics = data.metrics['postgres_query_duration'];
  const rocksMetrics = data.metrics['rocksdb_query_duration'];
  const speedupMetrics = data.metrics['speedup_factor'];

  console.log('\n=== Quick RocksDB Comparison Results ===');
  console.log(`PostgreSQL avg: ${pgMetrics?.values.avg?.toFixed(2)}ms`);
  console.log(`RocksDB avg: ${rocksMetrics?.values.avg?.toFixed(4)}ms`);
  console.log(`Average speedup: ${speedupMetrics?.values.avg?.toFixed(2)}x`);
  console.log('========================================\n');

  return {
    'results/quick-rocksdb-comparison.json': JSON.stringify(data, null, 2),
  };
}
