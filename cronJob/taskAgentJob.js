// cron-jobs/taskAgentJob.js
const cron = require('node-cron');
const axios = require('axios');
const Organization = require('../models/Organization');
const TaskAgentModel = require('../models/TaskAgentModel');

function getCronSchedule(frequency, dayTime) {
  let minute = '0';
  let hour = '0';
  let dayOfMonth = '*';
  let month = '*';
  let dayOfWeek = '*';

  switch (frequency.toLowerCase()) {
    case 'daily':
      hour = parseInt(dayTime) % 24;
      break;

    case 'weekly':
      dayOfWeek = (parseInt(dayTime) % 7).toString(); // 0–6
      break;

    case 'monthly':
      dayOfMonth = parseInt(dayTime).toString();
      break;

    case 'quarterly':
      const quarter = parseInt(dayTime);
      const quarterMonths = { 1: 1, 2: 4, 3: 7, 4: 10 };
      month = quarterMonths[quarter] || 1;
      dayOfMonth = '1';
      break;

    default:
      throw new Error('Invalid frequency');
  }

  return `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
}

function startTaskAgentCron(frequency = 'daily', dayTime = '6') {
  const cronTrigger = getCronSchedule(frequency, dayTime);
  console.log(`⏰ Scheduling Task Agent job with: ${cronTrigger}`);

  cron.schedule(cronTrigger, async () => {
    console.log('🔄 Running scheduled task at:', new Date().toISOString());

    try {
      const organizations = await Organization.find();

      for (const org of organizations) {
        const activeAgents = await TaskAgentModel.find({
          active: true,
          isAgent: true,
          organization: org._id,
        }).populate('organization');

        for (const task of activeAgents) {
          try {
            const pythonServerUri = `${
              process.env.AI_AGENT_SERVER_URI
            }/task-agent?task_name=${encodeURIComponent(task.name)}&org_id=${
              org._id
            }`;

            const response = await axios.post(pythonServerUri);
            console.log(
              `✅ [${org._id}] Task: ${task.name} responded with status ${response.status}`
            );
          } catch (err) {
            console.error(`❌ Task failed: ${task.name}`, err.message);
          }
        }
      }
    } catch (err) {
      console.error('❌ Cron job failed:', err.message);
    }
  });
}

module.exports = { startTaskAgentCron };
