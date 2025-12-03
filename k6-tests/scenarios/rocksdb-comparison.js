import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// Custom metrics for RocksDB comparison
export const postgresQueryDuration = new Trend('postgres_query_duration', true);
export const rocksdbQueryDuration = new Trend('rocksdb_query_duration', true);
export const speedupFactor = new Trend('speedup_factor', true);
export const timeSavedMs = new Trend('time_saved_ms', true);
export const cacheHitRate = new Rate('cache_hit_rate');
export const postgresRequestCount = new Counter('postgres_request_count');
export const rocksdbRequestCount = new Counter('rocksdb_request_count');
export const comparisonSuccessRate = new Rate('comparison_success_rate');

/**
 * Test the performance comparison endpoint
 */
export function testSchemaComparison(baseURL, schemaId, version) {
  const url = `${baseURL}/api/v1/admin/performance/schema-compare/${schemaId}/${version}`;
  
  const response = http.get(url, {
    tags: { 
      name: 'SchemaPerformanceComparison',
      schemaId: schemaId,
      version: version,
    },
  });

  // Check response
  const checkResult = check(response, {
    'status is 200': (r) => r.status === 200,
    'has comparison data': (r) => {
      try {
        const json = r.json();
        return json.comparison && json.postgres && json.rocksdb;
      } catch (e) {
        return false;
      }
    },
    'postgres query successful': (r) => {
      try {
        const json = r.json();
        return json.postgres && json.postgres.found === true;
      } catch (e) {
        return false;
      }
    },
    'rocksdb cache available': (r) => {
      try {
        const json = r.json();
        return json.rocksdb && json.rocksdb.cache_available === true;
      } catch (e) {
        return false;
      }
    },
  });

  comparisonSuccessRate.add(checkResult);

  // Record metrics if successful
  if (response.status === 200) {
    try {
      const data = response.json();
      
      // Record individual query durations
      if (data.postgres && data.postgres.duration_ms !== undefined) {
        postgresQueryDuration.add(data.postgres.duration_ms);
        postgresRequestCount.add(1);
      }
      
      if (data.rocksdb && data.rocksdb.duration_ms !== undefined) {
        rocksdbQueryDuration.add(data.rocksdb.duration_ms);
        rocksdbRequestCount.add(1);
        
        // Track cache hits
        if (data.rocksdb.found) {
          cacheHitRate.add(1);
        } else {
          cacheHitRate.add(0);
        }
      }
      
      // Record comparison metrics
      if (data.comparison) {
        if (data.comparison.speedup_factor !== undefined) {
          speedupFactor.add(data.comparison.speedup_factor);
        }
        if (data.comparison.time_saved_ms !== undefined) {
          timeSavedMs.add(data.comparison.time_saved_ms);
        }
      }

      return {
        success: true,
        postgres_ms: data.postgres?.duration_ms,
        rocksdb_ms: data.rocksdb?.duration_ms,
        speedup: data.comparison?.speedup_factor,
        timeSaved: data.comparison?.time_saved_ms,
        cacheHit: data.rocksdb?.found,
      };
    } catch (error) {
      console.error(`Error parsing response: ${error}`);
      return { success: false, error: String(error) };
    }
  }

  return { 
    success: false, 
    status: response.status,
    body: response.body 
  };
}

/**
 * Test multiple schemas in sequence
 */
export function testMultipleSchemas(baseURL, schemas) {
  const results = [];
  
  schemas.forEach(schema => {
    const result = testSchemaComparison(baseURL, schema.id, schema.version);
    results.push({
      schema: `${schema.id} v${schema.version}`,
      ...result,
    });
  });

  return results;
}

/**
 * Warm up cache by querying schemas
 */
export function warmupCache(baseURL, schemas, iterations = 2) {
  console.log(`Warming up cache with ${schemas.length} schemas, ${iterations} iterations each`);
  
  for (let i = 0; i < iterations; i++) {
    schemas.forEach(schema => {
      testSchemaComparison(baseURL, schema.id, schema.version);
    });
  }
  
  console.log('Cache warmup completed');
}

/**
 * Log comparison statistics
 */
export function logComparison(result) {
  if (result.success) {
    const speedupDisplay = result.speedup ? `${result.speedup.toFixed(2)}x` : 'N/A';
    const timeSavedDisplay = result.timeSaved ? `${result.timeSaved.toFixed(2)}ms` : 'N/A';
    const cacheStatus = result.cacheHit ? '✓ HIT' : '✗ MISS';
    
    console.log(
      `PostgreSQL: ${result.postgres_ms?.toFixed(2)}ms | ` +
      `RocksDB: ${result.rocksdb_ms?.toFixed(2)}ms | ` +
      `Speedup: ${speedupDisplay} | ` +
      `Saved: ${timeSavedDisplay} | ` +
      `Cache: ${cacheStatus}`
    );
  } else {
    console.log(`❌ Comparison failed: ${result.error || result.status}`);
  }
}
