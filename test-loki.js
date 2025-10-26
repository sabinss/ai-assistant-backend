// Test script to demonstrate Loki logging
const logger = require('./helper/logger');

console.log('🚀 Testing Loki Integration...\n');

// Simulate some application activity
const simulateAppActivity = () => {
  // Simulate user login
  logger.logAuth('login_success', 'user123', {
    email: 'user@example.com',
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0...',
  });

  // Simulate API requests
  logger.info('API request started', {
    method: 'GET',
    url: '/api/users',
    requestId: 'req_001',
    userId: 'user123',
  });

  // Simulate database operation
  logger.logDatabase('select', 'users', 45, {
    query: 'SELECT * FROM users WHERE id = ?',
    userId: 'user123',
  });

  // Simulate successful response
  logger.info('API request completed', {
    method: 'GET',
    url: '/api/users',
    requestId: 'req_001',
    statusCode: 200,
    durationMs: 150,
    userId: 'user123',
  });

  // Simulate an error
  logger.error('Database connection failed', {
    error: 'Connection timeout',
    database: 'postgres',
    host: 'localhost:5432',
    duration: 5000,
  });

  // Simulate business logic
  logger.info('Payment processed', {
    transactionId: 'txn_456789',
    amount: 99.99,
    currency: 'USD',
    userId: 'user123',
    paymentMethod: 'credit_card',
  });

  // Simulate warning
  logger.warn('High memory usage detected', {
    memoryUsage: '85%',
    processId: 12345,
    timestamp: new Date().toISOString(),
  });
};

// Run the simulation
simulateAppActivity();

console.log('\n✅ Test completed! Check your logs:');
console.log('📁 Log file: logs/app.log');
console.log('🌐 Grafana: http://localhost:3001');
console.log('📊 Prometheus: http://localhost:9090');
console.log('📝 Loki: http://localhost:3100');

console.log('\n🔍 To view logs in real-time:');
console.log('tail -f logs/app.log');

console.log('\n🚀 To start the monitoring stack:');
console.log('docker-compose up -d');
