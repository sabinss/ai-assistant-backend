// cronJob/taskAgentJob.js
const cron = require('node-cron');
const axios = require('axios');
const Organization = require('../models/Organization');
const moment = require('moment-timezone');
const AgentModel = require('../models/AgentModel');
const AgentCronLogSchema = require('../models/AgentCronLogSchema');

/**
 * Map timezone abbreviations to IANA timezone names
 * These are the values stored in the database
 */
const TIMEZONE_MAP = {
  'EST': 'America/New_York',      // Eastern Standard Time
  'PST': 'America/Los_Angeles',   // Pacific Standard Time
  'CST': 'America/Chicago',       // Central Standard Time
  'MST': 'America/Denver',        // Mountain Standard Time
  'UTC': 'UTC',                   // Coordinated Universal Time
  'GMT': 'Europe/London',         // Greenwich Mean Time
  'CET': 'Europe/Paris',          // Central European Time
  'JST': 'Asia/Tokyo',            // Japan Standard Time
  'AEST': 'Australia/Sydney',     // Australian Eastern Standard Time
  'IST': 'Asia/Kolkata',          // India Standard Time
};


const getIANATimezone = (tzAbbr) => {
  if (!tzAbbr) return 'UTC';

  // If it's already an IANA name (contains '/'), return as-is
  if (tzAbbr.includes('/')) return tzAbbr;

  // Look up in map, default to UTC if not found
  return TIMEZONE_MAP[tzAbbr.toUpperCase()] || 'UTC';
};

/**
 * Parse scheduleTime string "HH:mm" to extract hour and minute
 * @param {string} scheduleTime - Time string like "09:00", "14:30"
 * @returns {{ hour: number, minute: number }}
 */
const parseScheduleTime = (scheduleTime) => {
  if (!scheduleTime) return { hour: 0, minute: 0 };

  // Handle "HH:mm" format
  if (typeof scheduleTime === 'string' && scheduleTime.includes(':')) {
    const [hours, minutes] = scheduleTime.split(':');
    return {
      hour: parseInt(hours) || 0,
      minute: parseInt(minutes) || 0,
    };
  }

  // Handle plain number (backward compatibility)
  return { hour: parseInt(scheduleTime) || 0, minute: 0 };
};

/**
 * Convert agent's local time to UTC hour
 */
const convertLocalTimeToUTC = (localHour, localMinute, agentTimezone, referenceDate) => {
  // First, get today's date in agent's timezone
  const todayInAgentTZ = referenceDate.clone().tz(agentTimezone);

  // Create a moment with the scheduled hour/minute on today's date in agent's timezone
  const localTime = todayInAgentTZ.clone()
    .hour(localHour)
    .minute(localMinute)
    .second(0);

  // Convert to UTC
  const utcTime = localTime.clone().utc();

  return {
    utcHour: utcTime.hour(),
    utcDay: utcTime.isoWeekday(),  // 1-7 (Mon-Sun)
    utcDate: utcTime.date(),       // 1-31
    utcMoment: utcTime,
  };
};

/**
 * Check if an agent should be triggered based on frequency, dayTime, and timezone
 * All comparisons are done in UTC
 * Returns { shouldTrigger: boolean, skipReason: string | null, ... }
 */
const shouldTriggerInWindow = (agent, utcNow, utcWindowStart, utcWindowEnd) => {
  const { frequency, dayTime, scheduleTime, lastTriggeredAt, timezone } = agent;

  // Convert abbreviation (EST, IST) to IANA timezone (America/New_York, Asia/Kolkata)
  const agentTimezone = getIANATimezone(timezone);

  if (!frequency) {
    return { shouldTrigger: false, skipReason: 'Missing frequency', agentTimezone };
  }

  switch (frequency) {
    case 'Daily': {
      // Daily uses scheduleTime (e.g., "13:00" or "09:30")
      if (!scheduleTime) {
        return { shouldTrigger: false, skipReason: 'Missing scheduleTime for Daily frequency', agentTimezone };
      }

      const { hour: localHour, minute: localMinute } = parseScheduleTime(scheduleTime);
      const { utcHour } = convertLocalTimeToUTC(localHour, localMinute, agentTimezone, utcNow);

      if (lastTriggeredAt) {
        const lastRunUTC = moment(lastTriggeredAt).utc();
        if (lastRunUTC.isSame(utcWindowEnd, 'day')) {
          const lastRunLocal = moment(lastTriggeredAt).tz(agentTimezone);
          return {
            shouldTrigger: false,
            skipReason: `Already triggered today at ${lastRunLocal.format('HH:mm')} (${agentTimezone})`,
            agentTimezone,
            targetHourUTC: utcHour,
            targetHourLocal: localHour,
          };
        }
      }

      if (!isHourInWindow(utcHour, utcWindowStart, utcWindowEnd)) {
        return {
          shouldTrigger: false,
          skipReason: `Local time ${scheduleTime} (${agentTimezone}) = UTC hour ${utcHour}, not in UTC window ${utcWindowStart.format('HH:mm')}-${utcWindowEnd.format('HH:mm')}`,
          agentTimezone,
          targetHourUTC: utcHour,
          targetHourLocal: localHour,
        };
      }

      return { shouldTrigger: true, skipReason: null, agentTimezone, targetHourUTC: utcHour, targetHourLocal: localHour };
    }

    case 'Weekly': {
      // Weekly uses dayTime (day 1-7) + scheduleTime ("HH:mm")
      if (!dayTime) {
        return { shouldTrigger: false, skipReason: 'Missing dayTime for Weekly frequency', agentTimezone };
      }

      const parsedDayTime = parseInt(dayTime);
      if (isNaN(parsedDayTime)) {
        return { shouldTrigger: false, skipReason: `Invalid dayTime: ${dayTime}`, agentTimezone };
      }

      const targetLocalDay = parsedDayTime; // 1-7 (Mon-Sun)
      const { hour: localHour, minute: localMinute } = parseScheduleTime(scheduleTime);

      // Get current day in agent's timezone
      const todayInAgentTZ = utcNow.clone().tz(agentTimezone);
      const currentLocalDay = todayInAgentTZ.isoWeekday(); // 1-7 (Mon-Sun)

      const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

      if (lastTriggeredAt) {
        const lastRunUTC = moment(lastTriggeredAt).utc();
        if (lastRunUTC.isSame(utcWindowEnd, 'week')) {
          const lastRunLocal = moment(lastTriggeredAt).tz(agentTimezone);
          return {
            shouldTrigger: false,
            skipReason: `Already triggered this week on ${lastRunLocal.format('dddd HH:mm')} (${agentTimezone})`,
            agentTimezone,
          };
        }
      }

      // Check if today (in agent's timezone) is the target day
      if (currentLocalDay !== targetLocalDay) {
        return {
          shouldTrigger: false,
          skipReason: `Today in ${agentTimezone} is ${dayNames[currentLocalDay]}, scheduled for ${dayNames[targetLocalDay]}`,
          agentTimezone,
        };
      }

      // Convert the scheduled time to UTC for window check
      const { utcHour } = convertLocalTimeToUTC(localHour, localMinute, agentTimezone, utcNow);

      if (!isHourInWindow(utcHour, utcWindowStart, utcWindowEnd)) {
        return {
          shouldTrigger: false,
          skipReason: `${dayNames[targetLocalDay]} ${scheduleTime} (${agentTimezone}) = UTC ${utcHour}:00, not in window ${utcWindowStart.format('HH:mm')}-${utcWindowEnd.format('HH:mm')}`,
          agentTimezone,
        };
      }

      return { shouldTrigger: true, skipReason: null, agentTimezone };
    }

    case 'Monthly': {
      // Monthly uses dayTime (day 1-31) + scheduleTime ("HH:mm")
      if (!dayTime) {
        return { shouldTrigger: false, skipReason: 'Missing dayTime for Monthly frequency', agentTimezone };
      }

      const parsedDayTime = parseInt(dayTime);
      if (isNaN(parsedDayTime)) {
        return { shouldTrigger: false, skipReason: `Invalid dayTime: ${dayTime}`, agentTimezone };
      }

      const targetLocalDate = parsedDayTime; // 1-31
      const { hour: localHour, minute: localMinute } = parseScheduleTime(scheduleTime);

      // Get current date in agent's timezone
      const todayInAgentTZ = utcNow.clone().tz(agentTimezone);
      const currentLocalDate = todayInAgentTZ.date(); // 1-31

      if (lastTriggeredAt) {
        const lastRunUTC = moment(lastTriggeredAt).utc();
        if (lastRunUTC.isSame(utcWindowEnd, 'month')) {
          const lastRunLocal = moment(lastTriggeredAt).tz(agentTimezone);
          return {
            shouldTrigger: false,
            skipReason: `Already triggered this month on ${lastRunLocal.format('Do HH:mm')} (${agentTimezone})`,
            agentTimezone,
          };
        }
      }

      // Check if today (in agent's timezone) is the target date
      if (currentLocalDate !== targetLocalDate) {
        return {
          shouldTrigger: false,
          skipReason: `Today in ${agentTimezone} is ${currentLocalDate}th, scheduled for ${targetLocalDate}th`,
          agentTimezone,
        };
      }

      // Convert the scheduled time to UTC for window check
      const { utcHour } = convertLocalTimeToUTC(localHour, localMinute, agentTimezone, utcNow);

      if (!isHourInWindow(utcHour, utcWindowStart, utcWindowEnd)) {
        return {
          shouldTrigger: false,
          skipReason: `${targetLocalDate}th ${scheduleTime} (${agentTimezone}) = UTC ${utcHour}:00, not in window ${utcWindowStart.format('HH:mm')}-${utcWindowEnd.format('HH:mm')}`,
          agentTimezone,
        };
      }

      return { shouldTrigger: true, skipReason: null, agentTimezone };
    }

    default:
      return { shouldTrigger: false, skipReason: `Unknown frequency: ${frequency}`, agentTimezone };
  }
};

/**
 * Check if target hour falls within the 3-hour window (all in UTC)
 */
const isHourInWindow = (targetHour, windowStart, windowEnd) => {
  const startHour = windowStart.hour();
  const endHour = windowEnd.hour();

  if (windowStart.isSame(windowEnd, 'day')) {
    return targetHour > startHour && targetHour <= endHour;
  }

  // Day boundary crossed (e.g., window from 22:00 to 01:00)
  return targetHour > startHour || targetHour <= endHour;
};

/**
 * Main cron job handler - runs every 3 hours in UTC
 */
const handleTaskAgentCronJob = async () => {
  // Always work in UTC
  const utcNow = moment.utc();
  const utcWindowEnd = utcNow.clone();
  const utcWindowStart = utcNow.clone().subtract(3, 'hours');
  const cronWindowUTC = `${utcWindowStart.format('HH:mm')} - ${utcWindowEnd.format('HH:mm')} UTC`;

  console.log(`⏰ Cron job started at ${utcNow.format('YYYY-MM-DD HH:mm:ss')} UTC`);
  console.log(`📅 UTC Window: ${cronWindowUTC}`);

  try {
    // Log cron start
    await AgentCronLogSchema.create({
      status: 'cron_started',
      cronWindow: cronWindowUTC,
      message: `Cron job started at ${utcNow.format('YYYY-MM-DD HH:mm:ss')} UTC`,
    });

    const allOrgs = await Organization.find();
    let totalAgentsChecked = 0;
    let totalAgentsTriggered = 0;
    let totalAgentsSkipped = 0;

    for (const org of allOrgs) {
      // Find active agents with scheduling configured
      // Daily: needs scheduleTime (time like "13:00")
      // Weekly/Monthly: needs dayTime (day) + scheduleTime (time)
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

        // Check trigger - converts agent's local time to UTC for comparison
        const { shouldTrigger, skipReason, agentTimezone } = shouldTriggerInWindow(agent, utcNow, utcWindowStart, utcWindowEnd);

        // Log that agent was selected/checked
        await AgentCronLogSchema.create({
          organization: org._id,
          agent: agent._id,
          agentName: agent.name,
          status: 'selected',
          frequency: agent.frequency,
          dayTime: agent.dayTime,
          scheduleTime: agent.scheduleTime,
          timezone: agentTimezone,
          cronWindow: cronWindowUTC,
          message: `Agent checked: ${agent.name} | Frequency: ${agent.frequency} | dayTime: ${agent.dayTime} | Timezone: ${agentTimezone}`,
        });

        if (shouldTrigger) {
          try {
            const session_id = Math.floor(100000 + Math.random() * 900000).toString();
            const pythonServerUri = `${process.env.AI_AGENT_SERVER_URI}/ask/agent?agent_name=${encodeURIComponent(agent.name)}&org_id=${org._id}&query='run'&session_id=${session_id}`;

            console.log(`🚀 Triggering agent: ${agent.name} (Timezone: ${agentTimezone})`);

            // Log that agent API is being called
            await AgentCronLogSchema.create({
              organization: org._id,
              agent: agent._id,
              agentName: agent.name,
              status: 'triggered',
              frequency: agent.frequency,
              dayTime: agent.dayTime,
              scheduleTime: agent.scheduleTime,
              timezone: agentTimezone,
              apiUrl: pythonServerUri,
              sessionId: session_id,
              cronWindow: cronWindowUTC,
              message: `API called for agent: ${agent.name} | Timezone: ${agentTimezone}`,
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
                timezone: agentTimezone,
                apiUrl: pythonServerUri,
                sessionId: session_id,
                cronWindow: cronWindowUTC,
                message: `API call failed: ${err.message}`,
              });
            });

            // Update lastTriggeredAt (always store in UTC)
            await AgentModel.findByIdAndUpdate(agent._id, {
              lastTriggeredAt: new Date(),
            });

            // Log success
            await AgentCronLogSchema.create({
              organization: org._id,
              agent: agent._id,
              agentName: agent.name,
              status: 'success',
              frequency: agent.frequency,
              dayTime: agent.dayTime,
              scheduleTime: agent.scheduleTime,
              timezone: agentTimezone,
              apiUrl: pythonServerUri,
              sessionId: session_id,
              cronWindow: cronWindowUTC,
              message: `Successfully triggered at ${utcNow.format('YYYY-MM-DD HH:mm:ss')} UTC`,
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
              timezone: agentTimezone,
              cronWindow: cronWindowUTC,
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
            scheduleTime: agent.scheduleTime,
            timezone: agentTimezone,
            cronWindow: cronWindowUTC,
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
      cronWindow: cronWindowUTC,
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
      cronWindow: cronWindowUTC,
      message: `Cron job error: ${err.message}`,
    });
  }
};

module.exports = { handleTaskAgentCronJob };
