/**
 * RocksDB Configuration
 * Tuned using Kim et al. (2019) recommendations for blockchain read performance
 * 
 * Key optimizations:
 * - Bloom filter: 10 bits per key (reduces random read I/O)
 * - Block size: 1KB (reduces read amplification on SSD)
 * - Max open files: 5000 (enables parallel reads)
 * 
 * Reference: Kim, H., Park, J., Jung, S., Lee, S. (2019)
 * "Optimizing RocksDB for Better Read Throughput in Blockchain Systems"
 */

// @ts-ignore - rocksdb doesn't have TypeScript types
import rocksdb from "rocksdb";

export interface RocksDBOptions {
  createIfMissing: boolean;
  errorIfExists: boolean;
  bloom_bits_per_key: number;
  block_size: number;
  maxOpenFiles: number;
}

export function createRocksDBOptions(): RocksDBOptions {
  return {
    createIfMissing: true,
    errorIfExists: false,

    // Block-based table options
    // Bloom filter reduces unnecessary disk reads (Kim2019)
    bloom_bits_per_key: 10,

    // Small block size reduces read amplification (Kim2019)
    block_size: 1024, // 1KB

    // Parallelism for read-heavy workloads
    maxOpenFiles: 5000,
  };
}

export { rocksdb };
