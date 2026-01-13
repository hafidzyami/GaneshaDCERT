// Simple Redis connection test
const Bull = require('bull');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

console.log(`Testing Redis connection to: ${REDIS_URL}`);

// Create a test queue
const testQueue = new Bull('test-connection', REDIS_URL);

testQueue.on('ready', () => {
  console.log('✅ Redis connection successful!');
  console.log(`Connected to: ${REDIS_URL}`);
  process.exit(0);
});

testQueue.on('error', (error) => {
  console.log('❌ Redis connection failed!');
  console.error('Error:', error.message);
  process.exit(1);
});

// Timeout after 5 seconds
setTimeout(() => {
  console.log('⏱️  Connection timeout - Redis might not be accessible');
  process.exit(1);
}, 5000);
