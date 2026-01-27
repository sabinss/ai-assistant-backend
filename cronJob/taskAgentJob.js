// cronJob/taskAgentJob.js - Simplified version (no timezone)
const cron = require('node-cron');
const axios = require('axios');
const Organization = require('../models/Organization');
const moment = require('moment');
const AgentModel = require('../models/AgentModel');
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
    return targetHour > windowStartHour && targetHour <= windowEndHour;
  }

  // Day boundary crossed (e.g., 22-1)
  return targetHour > windowStartHour || targetHour <= windowEndHour;
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
        if (lastRun.isSame(moment(), 'day')) {
          return { shouldTrigger: false, skipReason: `Already triggered today at ${lastRun.format('HH:mm')}` };
        }
      }

      // Check if hour is in window
      if (!isHourInWindow(targetHour, windowStartHour, windowEndHour)) {
        return {
          shouldTrigger: false,
          skipReason: `Hour ${targetHour} not in window ${windowStartHour}:00-${windowEndHour}:00`
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
      return { shouldTrigger: false, skipReason: `Unknown frequency: ${frequency}` };
  }
};

/**
 * Main cron job handler - runs every 3 hours
 */
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

  try {
    // Log cron start
    await AgentCronLogSchema.create({
      status: 'cron_started',
      cronWindow: `${windowStartHour}:00 - ${windowEndHour}:00`,
      message: `Cron job started at ${now.format('YYYY-MM-DD HH:mm:ss')}`,
    });

    const allOrgs = await Organization.find();
    let totalAgentsChecked = 0;
    let totalAgentsTriggered = 0;
    let totalAgentsSkipped = 0;

    for (const org of allOrgs) {
      // Find active agents with scheduling configured
      const activeAgents = await AgentModel.find({
        // active: true,
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
          message: `Agent checked: ${agent.name} | Frequency: ${agent.frequency}`,
        });

        if (shouldTrigger) {
          try {
            const session_id = Math.floor(100000 + Math.random() * 900000).toString();
            const pythonServerUri = `${process.env.AI_AGENT_SERVER_URI}/ask/agent?agent_name=${encodeURIComponent(agent.name)}&org_id=${org._id}&query='run'&session_id=${session_id}`;

            console.log(`   🚀 TRIGGERING agent: ${agent.name}`);
            console.log(`      Python API URL: ${pythonServerUri}`);
            console.log(`      Session ID: ${session_id}`);

            // Log that agent API is being called.
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
              message: `API called for agent: ${agent.name} | URL: ${pythonServerUri}`,
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
                  message: `API call successful for agent: ${agent.name} | Status: ${response.status} | URL: ${pythonServerUri}`,
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
                  message: `API call failed for agent: ${agent.name} | URL: ${pythonServerUri} | Error: ${errorMessage}`,
                });
              });

            totalAgentsTriggered++;
          } catch (error) {
            const errorMessage = error?.message || 'Unknown error';

            console.error(`   ❌ Failed to trigger agent: ${agent.name}`);
            console.error(`      Error: ${errorMessage}`);

            await AgentCronLogSchema.create({
              organization: org._id,
              agent: agent._id,
              agentName: agent.name,
              status: 'failure',
              frequency: agent.frequency,
              dayTime: agent.dayTime,
              scheduleTime: agent.scheduleTime,
              cronWindow: `${windowStartHour}:00 - ${windowEndHour}:00`,
              message: `Error triggering agent: ${agent.name} | Error: ${errorMessage}`,
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
            skipReason: skipReason,
            message: `Agent skipped: ${agent.name} | Reason: ${skipReason}`,
          });

          totalAgentsSkipped++;
        }
      }
    }

    // Log cron completion with summary
    await AgentCronLogSchema.create({
      status: 'cron_completed',
      cronWindow: `${windowStartHour}:00 - ${windowEndHour}:00`,
      totalAgentsChecked,
      totalAgentsTriggered,
      totalAgentsSkipped,
      message: `Cron completed: ${totalAgentsTriggered} triggered, ${totalAgentsSkipped} skipped out of ${totalAgentsChecked} checked`,
    });

    console.log(`\n✅ Cron job completed: ${totalAgentsTriggered} triggered, ${totalAgentsSkipped} skipped`);
  } catch (err) {
    console.error('❌ Cron job error:', err.message);
    console.error(err);

    await AgentCronLogSchema.create({
      status: 'failure',
      cronWindow: `${windowStartHour}:00 - ${windowEndHour}:00`,
      message: `Cron job error: ${err.message}`,
    });
  }
};

module.exports = { handleTaskAgentCronJob };
