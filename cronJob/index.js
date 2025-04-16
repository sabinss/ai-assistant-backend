const cron = require('node-cron');
const Organization = require('../models/Organization');
const TaskAgentModel = require('../models/TaskAgentModel');

// Runs at 6:00 AM GMT daily (equivalent to 1:00 AM EST)

cron.schedule('0 6 * * *', async () => {
  console.log('Running job at 6:00 AM GMT / 1:00 AM EST');
  const activeAgents = await TaskAgentModel.find({ active: true }).populate(
    'organization'
  );
  console.log('activeAgents', activeAgents);
});
