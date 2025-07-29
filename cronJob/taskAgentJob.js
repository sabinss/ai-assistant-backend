// cron-jobs/taskAgentJob.js
const cron = require('node-cron');
const axios = require('axios');
const Organization = require('../models/Organization');
const TaskAgentModel = require('../models/TaskAgentModel');
const moment = require('moment');
const AgentModel = require('../models/AgentModel');
const logger = require('../config/logger');
const AgentCronLogSchema = require('../models/AgentCronLogSchema');
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

const shouldTriggerNow = (org, now, agentId) => {
  const { frequency, dayTime } = org;
  switch (frequency) {
    case 'Daily':
      //   logger.info(`🔁 [Agent ${agentId}] Daily check @ ${now.format()} → `);
      // return now.date() == +dayTime;
      // return now.hour() === 1; // always true at 1 AM
      return true;
    case 'Weekly':
      // `W-1` = Monday (moment.isoWeekday: 1 = Monday, 7 = Sunday)
      const todayWeekDay = now.isoWeekday(); // 1-7
      const orgWeekDay = parseInt(dayTime.replace('W-', ''));
      const isWeekly = todayWeekDay === orgWeekDay;
      //   logger.info(
      //     `📅 [Agent ${agentId}] Weekly check: Today=${todayWeekDay}, Org=${orgWeekDay} → ${isWeekly}`
      //   );
      return isWeekly;
    case 'Monthly':
      // `M-15` means 15th of the month
      const todayDate = now.date(); // 1-31
      const orgDay = parseInt(dayTime.replace('M-', ''));
      const isMonthly = todayDate === orgDay;
      //   logger.info(
      //     `📆 [Agent ${agentId}] Monthly check: Today=${todayDate}, Org=${orgDay} → ${isMonthly}`
      //   );
      return isMonthly;
    case 'Quarterly':
      const quarterMonths = [1, 4, 7, 10];
      const currentMonth = now.month() + 1; // 1-12
      const quarterDay = parseInt(dayTime);
      const isQuarterMonth = quarterMonths.includes(currentMonth);
      const isQuarterDay = now.date() === quarterDay;
      const isQuarterly = isQuarterMonth && isQuarterDay;
      //   logger.info(
      //     `🗓️ [Agent ${agentId}] Quarterly check: Month=${currentMonth}, Day=${now.date()}, OrgDay=${quarterDay} → ${isQuarterly}`
      //   );
      return isQuarterly;
    default:
      return false;
  }
};

const handleTaskAgentCronJob = async () => {
  try {
    const now = moment();

    await AgentCronLogSchema.create({
      organization: null,
      agent: null,
      status: 'triggered',
      message: `Cron job started at ${now.format('YYYY-MM-DD HH:mm:ss')}`,
    });
    // logger.info(`⏰ Cron job started at ${now.format('YYYY-MM-DD HH:mm:ss')}`);

    const allOrgs = await Organization.find();
    for (const org of allOrgs) {
      const activeAgents = await AgentModel.find({
        active: true,
        isAgent: true,
        organization: org._id,
        frequency: { $ne: null },
        dayTime: { $ne: null },
      }).populate('organization');
      console.log('activeAgents', activeAgents.length);

      if (activeAgents?.length === 0) continue;
      if (activeAgents) {
        await AgentCronLogSchema.create({
          organization: org._id,
          agent: activeAgents._id,
          status: 'success',
          message: `Cron job started at ${now.format('YYYY-MM-DD HH:mm:ss')}`,
        });
      }

      for (const agent of activeAgents) {
        if (shouldTriggerNow(agent, now, agent._id)) {
          try {
            const pythonServerUri = `${process.env.AI_AGENT_SERVER_URI}/ask/agent?agent_name=${agent.name}&org_id=${org._id}`;

            const response = await axios.get(pythonServerUri);
            await AgentCronLogSchema.create({
              organization: org?._id,
              agent: agent?._id,
              status: 'success',
              message: `Response status: ${response?.status}`,
            });

            console.log(
              `✅ [${org._id}] Task: ${agent.name} responded with status ${response.status}`
            );
          } catch (error) {
            console.log('Failed Cron job api', error);
            await AgentCronLog.create({
              organization: org._id,
              agent: agent._id,
              status: 'failure',
              message: error?.message,
            });
          }
        }
      }
    }
    console.log('Job triggerd');
  } catch (err) {
    console.log(err);
  }
};

module.exports = { handleTaskAgentCronJob };
