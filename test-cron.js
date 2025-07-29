require('dotenv').config();
const { handleTaskAgentCronJob } = require('./cronJob/taskAgentJob');

console.log('🧪 Testing cron job manually...');
console.log(
  'Current time:',
  new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
);

handleTaskAgentCronJob()
  .then(() => {
    console.log('✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
