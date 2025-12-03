// rocksdb-config.js
// RocksDB configuration tuned using Kim2019 recommendations
// - Bloom filter: 10 bits (reduces random reads)
// - Block size: 1KB (reduces read amplification)
// - Parallelism enabled

const rocksdb = require("rocksdb");

function createOptions() {
  return {
    createIfMissing: true,
    errorIfExists: false,

    // Block-based table options
    // Not all Node bindings expose this fully, but Level+RocksDB uses them internally
    // These two are the most important (matches Kim2019 paper)
    bloom_bits_per_key: 10,
    block_size: 1024, // 1KB

    // Good parallelism for read-heavy workloads
    maxOpenFiles: 5000,
  };
}

module.exports = {
  rocksdb,
  createOptions,
};
