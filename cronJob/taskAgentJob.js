// cronJob/taskAgentJob.js
const cron = require('node-cron');
const axios = require('axios');
const Organization = require('../models/Organization');
const moment = require('moment');
const AgentModel = require('../models/AgentModel');
const AgentCronLogSchema = require('../models/AgentCronLogSchema');

/**
 * Check if an agent should be triggered based on frequency and dayTime
 * Returns { shouldTrigger: boolean, skipReason: string | null }
 */
const shouldTriggerInWindow = (agent, windowStart, windowEnd) => {
  const { frequency, dayTime, scheduledHour, lastTriggeredAt } = agent;

  if (!frequency || dayTime === null || dayTime === undefined) {
    return { shouldTrigger: false, skipReason: 'Missing frequency or dayTime' };
  }

  const parsedDayTime = parseInt(dayTime);
  if (isNaN(parsedDayTime)) {
    return { shouldTrigger: false, skipReason: `Invalid dayTime: ${dayTime}` };
  }

  switch (frequency) {
    case 'Daily': {
      const targetHour = parsedDayTime;

      if (lastTriggeredAt) {
        const lastRun = moment(lastTriggeredAt);
        if (lastRun.isSame(windowEnd, 'day')) {
          return { shouldTrigger: false, skipReason: `Already triggered today at ${lastRun.format('HH:mm')}` };
        }
      }

      if (!isHourInWindow(targetHour, windowStart, windowEnd)) {
        return { shouldTrigger: false, skipReason: `Hour ${targetHour} not in window ${windowStart.format('HH:mm')}-${windowEnd.format('HH:mm')}` };
      }

      return { shouldTrigger: true, skipReason: null };
    }

    case 'Weekly': {
      const targetDay = parsedDayTime;
      const targetHour = scheduledHour ?? 0;
      const currentDay = windowEnd.isoWeekday();
      const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

      if (lastTriggeredAt) {
        const lastRun = moment(lastTriggeredAt);
        if (lastRun.isSame(windowEnd, 'week')) {
          return { shouldTrigger: false, skipReason: `Already triggered this week on ${lastRun.format('dddd HH:mm')}` };
        }
      }

      if (currentDay !== targetDay) {
        return { shouldTrigger: false, skipReason: `Today is ${dayNames[currentDay]}, scheduled for ${dayNames[targetDay]}` };
      }

      if (!isHourInWindow(targetHour, windowStart, windowEnd)) {
        return { shouldTrigger: false, skipReason: `Hour ${targetHour} not in window ${windowStart.format('HH:mm')}-${windowEnd.format('HH:mm')}` };
      }

      return { shouldTrigger: true, skipReason: null };
    }

    case 'Monthly': {
      const targetDate = parsedDayTime;
      const targetHour = scheduledHour ?? 0;
      const currentDate = windowEnd.date();

      if (lastTriggeredAt) {
        const lastRun = moment(lastTriggeredAt);
        if (lastRun.isSame(windowEnd, 'month')) {
          return { shouldTrigger: false, skipReason: `Already triggered this month on ${lastRun.format('Do HH:mm')}` };
        }
      }

      if (currentDate !== targetDate) {
        return { shouldTrigger: false, skipReason: `Today is ${currentDate}th, scheduled for ${targetDate}th` };
      }

      if (!isHourInWindow(targetHour, windowStart, windowEnd)) {
        return { shouldTrigger: false, skipReason: `Hour ${targetHour} not in window ${windowStart.format('HH:mm')}-${windowEnd.format('HH:mm')}` };
      }

      return { shouldTrigger: true, skipReason: null };
    }

    default:
      return { shouldTrigger: false, skipReason: `Unknown frequency: ${frequency}` };
  }
};

/**
 * Check if target hour falls within the 3-hour window
 */
const isHourInWindow = (targetHour, windowStart, windowEnd) => {
  const startHour = windowStart.hour();
  const endHour = windowEnd.hour();

  if (windowStart.isSame(windowEnd, 'day')) {
    return targetHour > startHour && targetHour <= endHour;
  }

  return targetHour > startHour || targetHour <= endHour;
};

/**
 * Main cron job handler - runs every 3 hours
 */
const handleTaskAgentCronJob = async () => {
  const now = moment();
  const windowEnd = now.clone();
  const windowStart = now.clone().subtract(3, 'hours');
  const cronWindow = `${windowStart.format('HH:mm')} - ${windowEnd.format('HH:mm')}`;

  console.log(`⏰ Cron job started at ${now.format('YYYY-MM-DD HH:mm:ss')}`);
  console.log(`📅 Checking window: ${cronWindow}`);

  try {
    // Log cron start
    await AgentCronLogSchema.create({
      status: 'cron_started',
      cronWindow,
      message: `Cron job started at ${now.format('YYYY-MM-DD HH:mm:ss')}`,
    });

    const allOrgs = await Organization.find();
    let totalAgentsChecked = 0;
    let totalAgentsTriggered = 0;
    let totalAgentsSkipped = 0;

    for (const org of allOrgs) {
      // Find active agents with scheduling configured
      const activeAgents = await AgentModel.find({
        active: true,
        isAgent: true,
        organization: org._id,
        frequency: { $in: ['Daily', 'Weekly', 'Monthly'] },
        dayTime: { $ne: null },
      });

      if (activeAgents.length === 0) continue;

      console.log(`🏢 Org ${org._id}: Found ${activeAgents.length} scheduled agents`);

      for (const agent of activeAgents) {
        totalAgentsChecked++;

        const { shouldTrigger, skipReason } = shouldTriggerInWindow(agent, windowStart, windowEnd);

        // Log that agent was selected/checked
        await AgentCronLogSchema.create({
          organization: org._id,
          agent: agent._id,
          agentName: agent.name,
          status: 'selected',
          frequency: agent.frequency,
          dayTime: agent.dayTime,
          scheduledHour: agent.scheduledHour,
          cronWindow,
          message: `Agent checked: ${agent.name} | Frequency: ${agent.frequency} | dayTime: ${agent.dayTime}`,
        });

        if (shouldTrigger) {
          try {
            const session_id = Math.floor(100000 + Math.random() * 900000).toString();
            const pythonServerUri = `${process.env.AI_AGENT_SERVER_URI}/ask/agent?agent_name=${encodeURIComponent(agent.name)}&org_id=${org._id}&query='run'&session_id=${session_id}`;

            console.log(`🚀 Triggering agent: ${agent.name}`);

            // Log that agent API is being called
            await AgentCronLogSchema.create({
              organization: org._id,
              agent: agent._id,
              agentName: agent.name,
              status: 'triggered',
              frequency: agent.frequency,
              dayTime: agent.dayTime,
              scheduledHour: agent.scheduledHour,
              apiUrl: pythonServerUri,
              sessionId: session_id,
              cronWindow,
              message: `API called for agent: ${agent.name}`,
            });

            // Fire API call
            axios.get(pythonServerUri).catch((err) => {
              console.error(`❌ Agent API call failed: ${agent.name}`, err.message);
              // Log API failure
              AgentCronLogSchema.create({
                organization: org._id,
                agent: agent._id,
                agentName: agent.name,
                status: 'failure',
                frequency: agent.frequency,
                dayTime: agent.dayTime,
                apiUrl: pythonServerUri,
                sessionId: session_id,
                cronWindow,
                message: `API call failed: ${err.message}`,
              });
            });

            // Update lastTriggeredAt
            await AgentModel.findByIdAndUpdate(agent._id, {
              lastTriggeredAt: now.toDate(),
            });

            // Log success
            await AgentCronLogSchema.create({
              organization: org._id,
              agent: agent._id,
              agentName: agent.name,
              status: 'success',
              frequency: agent.frequency,
              dayTime: agent.dayTime,
              scheduledHour: agent.scheduledHour,
              apiUrl: pythonServerUri,
              sessionId: session_id,
              cronWindow,
              message: `Successfully triggered at ${now.format('YYYY-MM-DD HH:mm:ss')}`,
            });

            totalAgentsTriggered++;
          } catch (error) {
            console.error(`❌ Failed to trigger agent: ${agent.name}`, error.message);

            await AgentCronLogSchema.create({
              organization: org._id,
              agent: agent._id,
              agentName: agent.name,
              status: 'failure',
              frequency: agent.frequency,
              dayTime: agent.dayTime,
              cronWindow,
              message: `Error: ${error?.message || 'Unknown error'}`,
            });
          }
        } else {
          // Log skipped agent with reason
          await AgentCronLogSchema.create({
            organization: org._id,
            agent: agent._id,
            agentName: agent.name,
            status: 'skipped',
            frequency: agent.frequency,
            dayTime: agent.dayTime,
            scheduledHour: agent.scheduledHour,
            cronWindow,
            skipReason: skipReason,
            message: `Skipped: ${skipReason}`,
          });

          totalAgentsSkipped++;
        }
      }
    }

    // Log cron completion with summary
    await AgentCronLogSchema.create({
      status: 'cron_completed',
      cronWindow,
      totalAgentsChecked,
      totalAgentsTriggered,
      totalAgentsSkipped,
      message: `Cron completed: ${totalAgentsTriggered} triggered, ${totalAgentsSkipped} skipped out of ${totalAgentsChecked} checked`,
    });

    console.log(`✅ Cron job completed: ${totalAgentsTriggered} triggered, ${totalAgentsSkipped} skipped`);
  } catch (err) {
    console.error('❌ Cron job error:', err.message);

    await AgentCronLogSchema.create({
      status: 'failure',
      cronWindow,
      message: `Cron job error: ${err.message}`,
    });
  }
};

module.exports = { handleTaskAgentCronJob };
