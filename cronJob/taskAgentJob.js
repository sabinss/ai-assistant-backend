// cron-jobs/taskAgentJob.js
const cron = require('node-cron');
const axios = require('axios');
const Organization = require('../models/Organization');
const TaskAgentModel = require('../models/TaskAgentModel');
const moment = require('moment');
const AgentModel = require('../models/AgentModel');
const logger = require('../config/logger');
const AgentCronLogSchema = require('../models/AgentCronLogSchema');

/**
 * Parse scheduleTime string "HH:mm" to extract hour
 * @param {string} scheduleTime - Time string like "09:00", "14:30", or "5"
 * @returns {number} - Hour (0-23)
 */
const parseScheduleHour = (scheduleTime) => {
  if (!scheduleTime) return null;

  // Handle "HH:mm" format
  if (typeof scheduleTime === 'string' && scheduleTime.includes(':')) {
    const [hours] = scheduleTime.split(':');
    return parseInt(hours) || null;
  }

  // Handle plain number
  return parseInt(scheduleTime) || null;
};

/**
 * Parse dayTime string to extract numeric value
 * Handles formats like "W-1" (Weekly), "M-15" (Monthly), or plain "1", "15"
 */
const parseDayTime = (dayTime) => {
  if (!dayTime) return null;

  // Handle formats like "W-1" (Weekly) or "M-15" (Monthly)
  if (typeof dayTime === 'string' && dayTime.includes('-')) {
    const parts = dayTime.split('-');
    if (parts.length === 2) {
      const number = parseInt(parts[1]);
      return isNaN(number) ? null : number;
    }
  }

  // Handle plain number
  const parsed = parseInt(dayTime);
  return isNaN(parsed) ? null : parsed;
};

/**
 * Check if target hour falls within the 3-hour window
 * @param {number} targetHour - Agent's scheduled hour (0-23)
 * @param {number} windowStartHour - Start hour of window (0-23)
 * @param {number} windowEndHour - End hour of window (0-23)
 * @returns {boolean}
 */
const isHourInWindow = (targetHour, windowStartHour, windowEndHour) => {
  // Same day window (e.g., 3-6)
  if (windowStartHour < windowEndHour) {
    // Include both start and end hours: >= start and <= end
    return targetHour >= windowStartHour && targetHour <= windowEndHour;
  }

  // Day boundary crossed (e.g., 22-1)
  // Include hours from start hour to 23, and 0 to end hour
  return targetHour >= windowStartHour || targetHour <= windowEndHour;
};

/**
 * Check if agent should be triggered
 */
const shouldTriggerAgent = (agent, currentHour, windowStartHour, windowEndHour, currentDay, currentDate) => {
  const { frequency, dayTime, scheduleTime, lastTriggeredAt } = agent;

  if (!frequency) {
    return { shouldTrigger: false, skipReason: 'Missing frequency' };
  }

  switch (frequency) {
    case 'Daily': {
      if (!scheduleTime) {
        return { shouldTrigger: false, skipReason: 'Missing scheduleTime for Daily frequency' };
      }

      const targetHour = parseScheduleHour(scheduleTime);
      if (targetHour === null) {
        return { shouldTrigger: false, skipReason: `Invalid scheduleTime: ${scheduleTime}` };
      }

      // Check if already triggered today
      if (lastTriggeredAt) {
        const lastRun = moment(lastTriggeredAt);
        const today = moment();
        const isSameDay = lastRun.isSame(today, 'day');
        console.log(`      Last triggered: ${lastRun.format('YYYY-MM-DD HH:mm:ss')}, Today: ${today.format('YYYY-MM-DD HH:mm:ss')}, Same day? ${isSameDay}`);
        if (isSameDay) {
          return { shouldTrigger: false, skipReason: `Already triggered today at ${lastRun.format('HH:mm')}` };
        }
      } else {
        console.log(`      Last triggered: Never (first run)`);
      }

      // Check if hour is in window
      if (!isHourInWindow(targetHour, windowStartHour, windowEndHour)) {
        return {
          shouldTrigger: false,
          skipReason: `Hour ${targetHour}:00 not in window ${windowStartHour}:00-${windowEndHour}:00`
        };
      }

      return { shouldTrigger: true, skipReason: null };
    }

    case 'Weekly': {
      if (!dayTime) {
        return { shouldTrigger: false, skipReason: 'Missing dayTime for Weekly frequency' };
      }

      const targetDay = parseDayTime(dayTime);
      if (targetDay === null) {
        return { shouldTrigger: false, skipReason: `Invalid dayTime: ${dayTime}` };
      }

      // Check if already triggered this week
      if (lastTriggeredAt) {
        const lastRun = moment(lastTriggeredAt);
        if (lastRun.isSame(moment(), 'week')) {
          return { shouldTrigger: false, skipReason: `Already triggered this week` };
        }
      }

      // Check if today is the target day
      if (currentDay !== targetDay) {
        const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        return {
          shouldTrigger: false,
          skipReason: `Today is ${dayNames[currentDay]}, scheduled for ${dayNames[targetDay]}`
        };
      }

      // Check if hour is in window
      const targetHour = parseScheduleHour(scheduleTime) || 0;
      if (!isHourInWindow(targetHour, windowStartHour, windowEndHour)) {
        return {
          shouldTrigger: false,
          skipReason: `Hour ${targetHour} not in window ${windowStartHour}:00-${windowEndHour}:00`
        };
      }

      return { shouldTrigger: true, skipReason: null };
    }

    case 'Monthly': {
      if (!dayTime) {
        return { shouldTrigger: false, skipReason: 'Missing dayTime for Monthly frequency' };
      }

      const targetDate = parseDayTime(dayTime);
      if (targetDate === null) {
        return { shouldTrigger: false, skipReason: `Invalid dayTime: ${dayTime}` };
      }

      // Check if already triggered this month
      if (lastTriggeredAt) {
        const lastRun = moment(lastTriggeredAt);
        if (lastRun.isSame(moment(), 'month')) {
          return { shouldTrigger: false, skipReason: `Already triggered this month` };
        }
      }

      // Check if today is the target date
      if (currentDate !== targetDate) {
        return {
          shouldTrigger: false,
          skipReason: `Today is ${currentDate}th, scheduled for ${targetDate}th`
        };
      }

      // Check if hour is in window
      const targetHour = parseScheduleHour(scheduleTime) || 0;
      if (!isHourInWindow(targetHour, windowStartHour, windowEndHour)) {
        return {
          shouldTrigger: false,
          skipReason: `Hour ${targetHour} not in window ${windowStartHour}:00-${windowEndHour}:00`
        };
      }

      return { shouldTrigger: true, skipReason: null };
    }

    default:
      return false;
  }
};

const handleTaskAgentCronJob = async () => {
  const now = moment();
  const currentHour = now.hour(); // 0-23
  const windowEndHour = currentHour;
  // Calculate window start (3 hours before), handle day boundary
  const windowStartHour = (currentHour - 3 + 24) % 24;
  const currentDay = now.isoWeekday(); // 1-7 (Mon-Sun)
  const currentDate = now.date(); // 1-31

  console.log(`⏰ Cron job started at ${now.format('YYYY-MM-DD HH:mm:ss')}`);
  console.log(`📅 Checking window: ${windowStartHour}:00 - ${windowEndHour}:00 (24-hour format)`);
  console.log(`   Current day: ${currentDay}, Current date: ${currentDate}`);

  // Format cron execution time (e.g., "06:00", "09:00")
  const cronExecutionTime = `${String(currentHour).padStart(2, '0')}:00`;

  try {
    // Log cron start
    await AgentCronLogSchema.create({
      status: 'cron_started',
      cronWindow: `${windowStartHour}:00 - ${windowEndHour}:00`,
      cronExecutionTime: cronExecutionTime,
      message: `Cron job started at ${now.format('YYYY-MM-DD HH:mm:ss')} | Cron execution time: ${cronExecutionTime}`,
    });
    // logger.info(`⏰ Cron job started at ${now.format('YYYY-MM-DD HH:mm:ss')}`);

    const allOrgs = await Organization.find();
    for (const org of allOrgs) {
      const activeAgents = await AgentModel.find({
        active: true,
        isAgent: true,
        organization: org._id,
        frequency: { $in: ['Daily', 'Weekly', 'Monthly'] },
        $or: [
          { frequency: 'Daily', scheduleTime: { $ne: null } },
          { frequency: 'Weekly', dayTime: { $ne: null } },
          { frequency: 'Monthly', dayTime: { $ne: null } },
        ],
      });

      if (activeAgents.length === 0) continue;

      console.log(`🏢 Org ${org._id}: Found ${activeAgents.length} scheduled agents`);

      for (const agent of activeAgents) {
        totalAgentsChecked++;

        console.log(`\n   Checking agent: ${agent.name || agent._id}`);
        console.log(`      Frequency: ${agent.frequency}`);
        console.log(`      scheduleTime: ${agent.scheduleTime || 'N/A'}`);
        console.log(`      dayTime: ${agent.dayTime || 'N/A'}`);

        const { shouldTrigger, skipReason } = shouldTriggerAgent(
          agent,
          currentHour,
          windowStartHour,
          windowEndHour,
          currentDay,
          currentDate
        );

        // Parse agent's scheduled hour for logging
        const agentScheduledHour = parseScheduleHour(agent.scheduleTime);
        const windowCheckResult = agentScheduledHour !== null
          ? isHourInWindow(agentScheduledHour, windowStartHour, windowEndHour)
          : null;

        // Log that agent was selected/checked
        await AgentCronLogSchema.create({
          organization: org._id,
          agent: agent._id,
          agentName: agent.name,
          status: 'selected',
          frequency: agent.frequency,
          dayTime: agent.dayTime,
          scheduleTime: agent.scheduleTime,
          cronWindow: `${windowStartHour}:00 - ${windowEndHour}:00`,
          cronExecutionTime: cronExecutionTime,
          agentScheduledHour: agentScheduledHour,
          windowCheckResult: windowCheckResult,
          message: `Agent checked: ${agent.name} | Frequency: ${agent.frequency} | Scheduled: ${agent.scheduleTime || 'N/A'} (Hour: ${agentScheduledHour !== null ? agentScheduledHour : 'N/A'}) | Cron ran at: ${cronExecutionTime} | In window: ${windowCheckResult !== null ? windowCheckResult : 'N/A'}`,
        });

        if (shouldTrigger) {
          try {
            const pythonServerUri = `${process.env.AI_AGENT_SERVER_URI}/ask/agent?agent_name=${agent.name}&org_id=${org._id}&query='run'`;

            // const response = await
            await axios.get(pythonServerUri);
            await AgentCronLogSchema.create({
              organization: org._id,
              agent: agent._id,
              agentName: agent.name,
              status: 'triggered',
              frequency: agent.frequency,
              dayTime: agent.dayTime,
              scheduleTime: agent.scheduleTime,
              apiUrl: pythonServerUri,
              sessionId: session_id,
              cronWindow: `${windowStartHour}:00 - ${windowEndHour}:00`,
              cronExecutionTime: cronExecutionTime,
              agentScheduledHour: agentScheduledHour,
              windowCheckResult: windowCheckResult,
              message: `API called for agent: ${agent.name} | Scheduled: ${agent.scheduleTime} (Hour: ${agentScheduledHour}) | Cron ran at: ${cronExecutionTime} | URL: ${pythonServerUri}`,
            });

            // Fire API call
            axios.get(pythonServerUri)
              .then(async (response) => {
                console.log(`   ✅ Agent API call successful: ${agent.name}`);
                console.log(`      Response Status: ${response.status}`);

                // Update lastTriggeredAt
                await AgentModel.findByIdAndUpdate(agent._id, {
                  lastTriggeredAt: new Date(),
                });

                // Log API success to database
                await AgentCronLogSchema.create({
                  organization: org._id,
                  agent: agent._id,
                  agentName: agent.name,
                  status: 'success',
                  frequency: agent.frequency,
                  dayTime: agent.dayTime,
                  scheduleTime: agent.scheduleTime,
                  apiUrl: pythonServerUri,
                  sessionId: session_id,
                  cronWindow: `${windowStartHour}:00 - ${windowEndHour}:00`,
                  cronExecutionTime: cronExecutionTime,
                  agentScheduledHour: agentScheduledHour,
                  windowCheckResult: windowCheckResult,
                  message: `API call successful for agent: ${agent.name} | Scheduled: ${agent.scheduleTime} (Hour: ${agentScheduledHour}) | Cron ran at: ${cronExecutionTime} | Status: ${response.status}`,
                });
              })
              .catch(async (err) => {
                const errorMessage = err.response
                  ? `Status ${err.response.status}: ${err.response.statusText} - ${JSON.stringify(err.response.data)}`
                  : err.message || 'Unknown error';

                console.error(`   ❌ Agent API call failed: ${agent.name}`);
                console.error(`      Error: ${errorMessage}`);

                // Log API failure with detailed error
                await AgentCronLogSchema.create({
                  organization: org._id,
                  agent: agent._id,
                  agentName: agent.name,
                  status: 'failure',
                  frequency: agent.frequency,
                  dayTime: agent.dayTime,
                  scheduleTime: agent.scheduleTime,
                  apiUrl: pythonServerUri,
                  sessionId: session_id,
                  cronWindow: `${windowStartHour}:00 - ${windowEndHour}:00`,
                  cronExecutionTime: cronExecutionTime,
                  agentScheduledHour: agentScheduledHour,
                  windowCheckResult: windowCheckResult,
                  message: `API call failed for agent: ${agent.name} | Scheduled: ${agent.scheduleTime} (Hour: ${agentScheduledHour}) | Cron ran at: ${cronExecutionTime} | Error: ${errorMessage}`,
                });
              });

            totalAgentsTriggered++;
          } catch (error) {
            console.log('Failed Cron job api', error);
            await AgentCronLogSchema.create({
              organization: org._id,
              agent: agent._id,
              status: 'failure',
              frequency: agent.frequency,
              dayTime: agent.dayTime,
              scheduleTime: agent.scheduleTime,
              cronWindow: `${windowStartHour}:00 - ${windowEndHour}:00`,
              cronExecutionTime: cronExecutionTime,
              agentScheduledHour: agentScheduledHour,
              windowCheckResult: windowCheckResult,
              message: `Error triggering agent: ${agent.name} | Scheduled: ${agent.scheduleTime} (Hour: ${agentScheduledHour}) | Cron ran at: ${cronExecutionTime} | Error: ${errorMessage}`,
            });
          }
        } else {
          console.log(`   ⏭️  SKIPPED: ${skipReason}`);

          // Log skipped agent with reason
          await AgentCronLogSchema.create({
            organization: org._id,
            agent: agent._id,
            agentName: agent.name,
            status: 'skipped',
            frequency: agent.frequency,
            dayTime: agent.dayTime,
            scheduleTime: agent.scheduleTime,
            cronWindow: `${windowStartHour}:00 - ${windowEndHour}:00`,
            cronExecutionTime: cronExecutionTime,
            agentScheduledHour: agentScheduledHour,
            windowCheckResult: windowCheckResult,
            skipReason: skipReason,
            message: `Agent skipped: ${agent.name} | Scheduled: ${agent.scheduleTime} (Hour: ${agentScheduledHour !== null ? agentScheduledHour : 'N/A'}) | Cron ran at: ${cronExecutionTime} | In window: ${windowCheckResult !== null ? windowCheckResult : 'N/A'} | Reason: ${skipReason}`,
          });

          totalAgentsSkipped++;
        }
      }
    }

    // Log cron completion with summary
    await AgentCronLogSchema.create({
      status: 'cron_completed',
      cronWindow: `${windowStartHour}:00 - ${windowEndHour}:00`,
      cronExecutionTime: cronExecutionTime,
      totalAgentsChecked,
      totalAgentsTriggered,
      totalAgentsSkipped,
      message: `Cron completed at ${cronExecutionTime}: ${totalAgentsTriggered} triggered, ${totalAgentsSkipped} skipped out of ${totalAgentsChecked} checked`,
    });

    console.log(`\n✅ Cron job completed: ${totalAgentsTriggered} triggered, ${totalAgentsSkipped} skipped`);
  } catch (err) {
    console.error('❌ Cron job error:', err.message);
    console.error(err);

    await AgentCronLogSchema.create({
      status: 'failure',
      cronWindow: `${windowStartHour}:00 - ${windowEndHour}:00`,
      cronExecutionTime: cronExecutionTime,
      message: `Cron job error at ${cronExecutionTime}: ${err.message}`,
    });
  }
};

module.exports = { handleTaskAgentCronJob };
