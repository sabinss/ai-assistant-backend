// cronJob/taskAgentJob.js — timezone-aware agent scheduler
const axios = require("axios");
const Organization = require("../models/Organization");
const moment = require("moment-timezone");
const AgentModel = require("../models/AgentModel");
const AgentCronLogSchema = require("../models/AgentCronLogSchema");

/**
 * Map timezone abbreviations to IANA timezone names
 */
const TIMEZONE_MAP = {
  EST: "America/New_York",
  EDT: "America/New_York",
  PST: "America/Los_Angeles",
  PDT: "America/Los_Angeles",
  CST: "America/Chicago",
  CDT: "America/Chicago",
  MST: "America/Denver",
  MDT: "America/Denver",
  UTC: "UTC",
  GMT: "Europe/London",
  CET: "Europe/Paris",
  JST: "Asia/Tokyo",
  AEST: "Australia/Sydney",
  IST: "Asia/Kolkata",
};

const getIANATimezone = (tzAbbr) => {
  if (!tzAbbr) return "UTC";
  if (typeof tzAbbr === "string" && tzAbbr.includes("/")) return tzAbbr;
  return TIMEZONE_MAP[String(tzAbbr).toUpperCase()] || "UTC";
};

/**
 * Parse scheduleTime string "HH:mm" to extract hour
 * @param {string} scheduleTime - Time string like "09:00", "14:30", or "5"
 * @returns {number} - Hour (0-23)
 */
const parseScheduleHour = (scheduleTime) => {
  if (!scheduleTime && scheduleTime !== 0) return null;

  // Handle "HH:mm" format
  if (typeof scheduleTime === "string" && scheduleTime.includes(":")) {
    const [hours] = scheduleTime.split(":");
    const parsed = parseInt(hours, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  // Handle plain number
  const parsed = parseInt(scheduleTime, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * Get sort key from scheduleTime for ascending order (e.g. "4:00" -> 240, "14:30" -> 870)
 * Agents without scheduleTime sort last (use 24*60 = 1440)
 */
const getScheduleSortKey = (scheduleTime) => {
  if (!scheduleTime) return 24 * 60;
  if (typeof scheduleTime === "string" && scheduleTime.includes(":")) {
    const [h, m] = scheduleTime.split(":").map((x) => parseInt(x, 10) || 0);
    return (h % 24) * 60 + (m % 60);
  }
  const h = parseInt(scheduleTime) || 0;
  return (h % 24) * 60;
};

/**
 * Parse dayTime string to extract numeric value
 * Handles formats like "W-1" (Weekly), "M-15" (Monthly), or plain "1", "15"
 */
const parseDayTime = (dayTime) => {
  if (!dayTime) return null;

  // Handle formats like "W-1" (Weekly) or "M-15" (Monthly)
  if (typeof dayTime === "string" && dayTime.includes("-")) {
    const parts = dayTime.split("-");
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
 * Check if target hour falls within the 2-hour window
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

const normalizeFrequency = (frequency) =>
  String(frequency || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const is15MinuteFrequency = (frequency) => {
  const f = normalizeFrequency(frequency);
  // Matches: 15min, 15 min, every 15 min, every 15 minutes, every 15 mins, etc.
  return /^(every\s+)?15\s*mins?(utes)?$/.test(f);
};

/**
 * Parse "HH:mm" to minutes since midnight. Returns null if invalid.
 */
const parseTimeToMinutes = (timeStr) => {
  if (timeStr == null || timeStr === "") return null;
  const match = String(timeStr)
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

/**
 * Inclusive same-day HH:mm window check against nowLocal (minute precision).
 * Does not support overnight windows (from > to).
 */
const isTimeInWindow = (nowLocal, fromTime, toTime) => {
  const currentMinutes = nowLocal.hour() * 60 + nowLocal.minute();
  const fromMinutes = parseTimeToMinutes(fromTime);
  const toMinutes = parseTimeToMinutes(toTime);
  if (fromMinutes == null || toMinutes == null) return false;
  if (fromMinutes > toMinutes) return false; // overnight not supported
  return currentMinutes >= fromMinutes && currentMinutes <= toMinutes;
};

const isHourlyLikeFrequency = (frequency) => {
  const f = normalizeFrequency(frequency);
  return f === "hourly";
};

const isWeekend = (isoWeekday) => isoWeekday === 6 || isoWeekday === 7; // Sat / Sun

/**
 * Shared once-per-day schedule check (Daily).
 */
const shouldTriggerDailyLike = ({
  scheduleTime,
  lastTriggeredAt,
  agentTimezone,
  nowLocal,
  currentHour,
  windowStartHour,
  windowEndHour,
  label,
}) => {
  if (!scheduleTime) {
    return {
      shouldTrigger: false,
      skipReason: `Missing scheduleTime for ${label} frequency`,
      agentTimezone,
      currentHour,
      windowStartHour,
      windowEndHour,
    };
  }

  const targetHour = parseScheduleHour(scheduleTime);
  if (targetHour === null) {
    return {
      shouldTrigger: false,
      skipReason: `Invalid scheduleTime: ${scheduleTime}`,
      agentTimezone,
      currentHour,
      windowStartHour,
      windowEndHour,
    };
  }

  if (lastTriggeredAt) {
    const lastRunLocal = moment(lastTriggeredAt).tz(agentTimezone);
    const isSameDay = lastRunLocal.isSame(nowLocal, "day");
    console.log(
      `      [${agentTimezone}] Last triggered: ${lastRunLocal.format("YYYY-MM-DD HH:mm:ss")}, Now local: ${nowLocal.format("YYYY-MM-DD HH:mm:ss")}, Same day? ${isSameDay}`
    );
    if (isSameDay) {
      return {
        shouldTrigger: false,
        skipReason: `Already triggered today at ${lastRunLocal.format("HH:mm")} (${agentTimezone})`,
        agentTimezone,
        currentHour,
        windowStartHour,
        windowEndHour,
        targetHour,
      };
    }
  } else {
    console.log(`      [${agentTimezone}] Last triggered: Never (first run)`);
  }

  const hasTargetHourPassed = targetHour <= currentHour;
  const isMidnightCatch = currentHour === 0 && targetHour >= 22;
  const shouldTriggerByTime = hasTargetHourPassed || isMidnightCatch;

  console.log(
    `      [${agentTimezone}] Target hour check: Scheduled ${targetHour}:00 <= Local now ${currentHour}:00? ${hasTargetHourPassed}`
  );

  if (!shouldTriggerByTime) {
    return {
      shouldTrigger: false,
      skipReason: `Scheduled hour ${targetHour}:00 has not passed yet in ${agentTimezone} (local hour: ${currentHour}:00). Will check again in next cron run.`,
      agentTimezone,
      currentHour,
      windowStartHour,
      windowEndHour,
      targetHour,
    };
  }

  return {
    shouldTrigger: true,
    skipReason: null,
    agentTimezone,
    currentHour,
    windowStartHour,
    windowEndHour,
    targetHour,
  };
};

/**
 * Check if agent should be triggered using the agent's own timezone.
 * scheduleTime / dayTime are interpreted in agent.timezone (EST, IST, America/New_York, etc.).
 * @param {object} agent
 * @param {object} [options]
 * @param {import('moment').Moment} [options.nowLocal] - optional override for tests
 */
const shouldTriggerAgent = (agent, options = {}) => {
  const { frequency, dayTime, scheduleTime, lastTriggeredAt, timezone, fromTime, toTime, businessDays } =
    agent;
  const agentTimezone = getIANATimezone(timezone);
  const nowLocal = options.nowLocal
    ? options.nowLocal.clone().tz(agentTimezone)
    : moment.tz(agentTimezone);
  const currentHour = nowLocal.hour();
  const currentDay = nowLocal.isoWeekday(); // 1-7 (Mon-Sun)
  const currentDate = nowLocal.date(); // 1-31
  const windowEndHour = currentHour;
  const windowStartHour = (currentHour - 2 + 24) % 24;
  const freq = normalizeFrequency(frequency);

  if (!frequency) {
    return {
      shouldTrigger: false,
      skipReason: "Missing frequency",
      agentTimezone,
      currentHour,
      windowStartHour,
      windowEndHour,
    };
  }

  // Every 15 Minutes — poll via */5 cron; throttle with lastTriggeredAt + fromTime/toTime window
  if (is15MinuteFrequency(frequency)) {
    // When businessDays is enabled, only Mon–Fri (agent timezone)
    if (businessDays && isWeekend(currentDay)) {
      return {
        shouldTrigger: false,
        skipReason: `Weekend in ${agentTimezone} — businessDays agents do not run Sat/Sun`,
        agentTimezone,
        currentHour,
        windowStartHour,
        windowEndHour,
      };
    }

    if (!fromTime || !toTime) {
      return {
        shouldTrigger: false,
        skipReason: "Missing fromTime or toTime for 15min frequency",
        agentTimezone,
        currentHour,
        windowStartHour,
        windowEndHour,
      };
    }

    if (!isTimeInWindow(nowLocal, fromTime, toTime)) {
      return {
        shouldTrigger: false,
        skipReason: `Outside time window in ${agentTimezone} (local ${nowLocal.format("HH:mm")}; allowed ${fromTime}-${toTime})`,
        agentTimezone,
        currentHour,
        windowStartHour,
        windowEndHour,
      };
    }

    if (lastTriggeredAt) {
      const lastTriggeredLocal = moment(lastTriggeredAt).tz(agentTimezone);
      // Compare at minute precision so API latency (e.g. lastTriggeredAt=09:00:30)
      // does not miss the 09:15 cron tick and slip to 09:20 (~20 min gap).
      const nextAllowedTime = lastTriggeredLocal.clone().startOf("minute").add(15, "minutes");
      const nowMinute = nowLocal.clone().startOf("minute");
      if (nextAllowedTime.isAfter(nowMinute)) {
        return {
          shouldTrigger: false,
          skipReason: `15min throttle: next allowed at ${nextAllowedTime.format("HH:mm")} (${agentTimezone}); last ran ${lastTriggeredLocal.format("HH:mm:ss")}`,
          agentTimezone,
          currentHour,
          windowStartHour,
          windowEndHour,
        };
      }
    }

    return {
      shouldTrigger: true,
      skipReason: null,
      agentTimezone,
      currentHour,
      windowStartHour,
      windowEndHour,
    };
  }

  switch (freq) {
    case "daily": {
      // businessDays=true → Mon–Fri only; otherwise all days (existing Daily behavior)
      // No fromTime/toTime check for Daily
      if (businessDays && isWeekend(currentDay)) {
        return {
          shouldTrigger: false,
          skipReason: `Weekend in ${agentTimezone} — businessDays Daily agents do not run Sat/Sun`,
          agentTimezone,
          currentHour,
          windowStartHour,
          windowEndHour,
        };
      }
      return shouldTriggerDailyLike({
        scheduleTime,
        lastTriggeredAt,
        agentTimezone,
        nowLocal,
        currentHour,
        windowStartHour,
        windowEndHour,
        label: "Daily",
      });
    }

    case "weekly": {
      if (!dayTime) {
        return {
          shouldTrigger: false,
          skipReason: "Missing dayTime for Weekly frequency",
          agentTimezone,
          currentHour,
          windowStartHour,
          windowEndHour,
        };
      }

      const targetDay = parseDayTime(dayTime);
      if (targetDay === null) {
        return {
          shouldTrigger: false,
          skipReason: `Invalid dayTime: ${dayTime}`,
          agentTimezone,
          currentHour,
          windowStartHour,
          windowEndHour,
        };
      }

      // Check if already triggered this week in agent's timezone
      if (lastTriggeredAt) {
        const lastRunLocal = moment(lastTriggeredAt).tz(agentTimezone);
        if (lastRunLocal.isSame(nowLocal, "week")) {
          return {
            shouldTrigger: false,
            skipReason: `Already triggered this week (${agentTimezone})`,
            agentTimezone,
            currentHour,
            windowStartHour,
            windowEndHour,
          };
        }
      }

      // Check if today (in agent's timezone) is the target day
      if (currentDay !== targetDay) {
        const dayNames = [
          "",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ];
        return {
          shouldTrigger: false,
          skipReason: `Today in ${agentTimezone} is ${dayNames[currentDay]}, scheduled for ${dayNames[targetDay]}`,
          agentTimezone,
          currentHour,
          windowStartHour,
          windowEndHour,
        };
      }

      const targetHour = parseScheduleHour(scheduleTime) || 0;
      if (!isHourInWindow(targetHour, windowStartHour, windowEndHour)) {
        return {
          shouldTrigger: false,
          skipReason: `Hour ${targetHour} not in local window ${windowStartHour}:00-${windowEndHour}:00 (${agentTimezone})`,
          agentTimezone,
          currentHour,
          windowStartHour,
          windowEndHour,
          targetHour,
        };
      }

      return {
        shouldTrigger: true,
        skipReason: null,
        agentTimezone,
        currentHour,
        windowStartHour,
        windowEndHour,
        targetHour,
      };
    }

    case "monthly": {
      if (!dayTime) {
        return {
          shouldTrigger: false,
          skipReason: "Missing dayTime for Monthly frequency",
          agentTimezone,
          currentHour,
          windowStartHour,
          windowEndHour,
        };
      }

      const targetDate = parseDayTime(dayTime);
      if (targetDate === null) {
        return {
          shouldTrigger: false,
          skipReason: `Invalid dayTime: ${dayTime}`,
          agentTimezone,
          currentHour,
          windowStartHour,
          windowEndHour,
        };
      }

      // Check if already triggered this month in agent's timezone
      if (lastTriggeredAt) {
        const lastRunLocal = moment(lastTriggeredAt).tz(agentTimezone);
        if (lastRunLocal.isSame(nowLocal, "month")) {
          return {
            shouldTrigger: false,
            skipReason: `Already triggered this month (${agentTimezone})`,
            agentTimezone,
            currentHour,
            windowStartHour,
            windowEndHour,
          };
        }
      }

      // Check if today (in agent's timezone) is the target date
      if (currentDate !== targetDate) {
        return {
          shouldTrigger: false,
          skipReason: `Today in ${agentTimezone} is ${currentDate}th, scheduled for ${targetDate}th`,
          agentTimezone,
          currentHour,
          windowStartHour,
          windowEndHour,
        };
      }

      const targetHour = parseScheduleHour(scheduleTime) || 0;
      if (!isHourInWindow(targetHour, windowStartHour, windowEndHour)) {
        return {
          shouldTrigger: false,
          skipReason: `Hour ${targetHour} not in local window ${windowStartHour}:00-${windowEndHour}:00 (${agentTimezone})`,
          agentTimezone,
          currentHour,
          windowStartHour,
          windowEndHour,
          targetHour,
        };
      }

      return {
        shouldTrigger: true,
        skipReason: null,
        agentTimezone,
        currentHour,
        windowStartHour,
        windowEndHour,
        targetHour,
      };
    }

    case "hourly": {
      // businessDays=true → Mon–Fri only
      if (businessDays && isWeekend(currentDay)) {
        return {
          shouldTrigger: false,
          skipReason: `Weekend in ${agentTimezone} — businessDays Hourly agents do not run Sat/Sun`,
          agentTimezone,
          currentHour,
          windowStartHour,
          windowEndHour,
        };
      }

      // fromTime/toTime are optional: only enforce when both are configured
      if (fromTime && toTime) {
        if (!isTimeInWindow(nowLocal, fromTime, toTime)) {
          return {
            shouldTrigger: false,
            skipReason: `Outside time window in ${agentTimezone} (local ${nowLocal.format("HH:mm")}; allowed ${fromTime}-${toTime})`,
            agentTimezone,
            currentHour,
            windowStartHour,
            windowEndHour,
          };
        }
      }

      // Trigger at most once per calendar hour in the agent's timezone
      if (lastTriggeredAt) {
        const lastRunLocal = moment(lastTriggeredAt).tz(agentTimezone);
        if (lastRunLocal.isSame(nowLocal, "hour")) {
          return {
            shouldTrigger: false,
            skipReason: `Already triggered this hour at ${lastRunLocal.format("HH:mm:ss")} (${agentTimezone})`,
            agentTimezone,
            currentHour,
            windowStartHour,
            windowEndHour,
          };
        }
      }
      return {
        shouldTrigger: true,
        skipReason: null,
        agentTimezone,
        currentHour,
        windowStartHour,
        windowEndHour,
      };
    }

    default:
      return {
        shouldTrigger: false,
        skipReason: `Unknown frequency: ${frequency}`,
        agentTimezone,
        currentHour,
        windowStartHour,
        windowEndHour,
      };
  }
};

/**
 * Main cron job handler — invoked each hour by `index.js` (`0 * * * *`).
 * Handles Daily / Weekly / Monthly / Hourly agents.
 * Each agent's scheduleTime/dayTime is evaluated in that agent's timezone.
 */
const handleTaskAgentCronJob = async () => {
  const utcNow = moment.utc();
  const cronExecutionTime = utcNow.format("YYYY-MM-DD HH:mm:ss");
  const cronExecutionHour = utcNow.hour();

  console.log(`⏰ Cron job started at ${cronExecutionTime} UTC`);
  console.log(`   Server local: ${moment().format("YYYY-MM-DD HH:mm:ss")} (${moment.tz.guess()})`);

  try {
    // Log cron start
    await AgentCronLogSchema.create({
      status: "cron_started",
      cronWindow: `UTC hour ${cronExecutionHour}:00`,
      cronExecutionTime: cronExecutionTime,
      cronExecutionHour: cronExecutionHour,
      message: `Cron job started at ${cronExecutionTime} UTC`,
    });

    const allOrgs = await Organization.find();
    let totalAgentsChecked = 0;
    let totalAgentsTriggered = 0;
    let totalAgentsSkipped = 0;

    for (const org of allOrgs) {
      // Find active agents with scheduling configured
      let activeAgents = await AgentModel.find({
        isAgent: true,
        active: true,
        organization: org._id,
        frequency: {
          $in: ["Daily", "Weekly", "Monthly", "Hourly", "hourly"],
        },
        $or: [
          { frequency: "Daily", scheduleTime: { $ne: null } },
          { frequency: "Weekly", dayTime: { $ne: null } },
          { frequency: "Monthly", dayTime: { $ne: null } },
          { frequency: "Hourly" },
          { frequency: "hourly" },
        ],
      });

      if (activeAgents.length === 0) continue;

      // Sort agents by scheduleTime ascending so earliest runs first (e.g. 4:00 → 6:00 → 8:00)
      // getScheduleSortKey converts "HH:mm" to minutes; agents without scheduleTime sort last
      activeAgents = activeAgents.sort((a, b) => {
        const keyA = isHourlyLikeFrequency(a.frequency) ? -1 : getScheduleSortKey(a.scheduleTime);
        const keyB = isHourlyLikeFrequency(b.frequency) ? -1 : getScheduleSortKey(b.scheduleTime);
        if (keyA !== keyB) return keyA - keyB;
        return String(a._id).localeCompare(String(b._id)); // stable order when same time
      });

      console.log(
        `🏢 Org ${org._id}: Found ${activeAgents.length} scheduled agents (sorted by scheduleTime ascending)`
      );

      for (const agent of activeAgents) {
        totalAgentsChecked++;

        console.log(`\n   Checking agent: ${agent.name || agent._id}`);
        console.log(`      Frequency: ${agent.frequency}`);
        console.log(`      scheduleTime: ${agent.scheduleTime || "N/A"}`);
        console.log(`      dayTime: ${agent.dayTime || "N/A"}`);
        console.log(
          `      fromTime: ${agent.fromTime || "N/A"} | toTime: ${agent.toTime || "N/A"} | businessDays: ${!!agent.businessDays}`
        );
        console.log(
          `      timezone: ${agent.timezone || "UTC"} → ${getIANATimezone(agent.timezone)}`
        );

        const {
          shouldTrigger,
          skipReason,
          agentTimezone,
          currentHour,
          windowStartHour,
          windowEndHour,
          targetHour,
        } = shouldTriggerAgent(agent);

        // Parse agent's scheduled hour for logging
        const agentScheduledHour =
          targetHour != null ? targetHour : parseScheduleHour(agent.scheduleTime);
        const windowCheckResult = shouldTrigger ? "IN_WINDOW" : "OUT_OF_WINDOW";
        const cronWindow = `${windowStartHour}:00 - ${windowEndHour}:00 ${agentTimezone}`;

        // Log that agent was selected/checked with detailed timing info
        const logStatus = shouldTrigger ? "selected" : "skipped";
        const logMessage = shouldTrigger
          ? `Agent SELECTED: ${agent.name} | Scheduled: ${agent.scheduleTime} (${agentScheduledHour}:00 ${agentTimezone}) | Local now: ${currentHour}:00 | Cron UTC: ${cronExecutionTime}`
          : `Agent SKIPPED: ${agent.name} | Scheduled: ${agent.scheduleTime} (${agentScheduledHour}:00 ${agentTimezone}) | Local now: ${currentHour}:00 | Cron UTC: ${cronExecutionTime} | Reason: ${skipReason}`;

        await AgentCronLogSchema.create({
          organization: org._id,
          agent: agent._id,
          agentName: agent.name,
          status: logStatus,
          frequency: agent.frequency,
          dayTime: agent.dayTime,
          scheduleTime: agent.scheduleTime,
          timezone: agentTimezone,
          cronWindow,
          cronExecutionTime: cronExecutionTime,
          cronExecutionHour: cronExecutionHour,
          agentScheduledHour: agentScheduledHour,
          windowCheckResult: windowCheckResult,
          skipReason: skipReason || null,
          message: logMessage,
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
              status: "triggered",
              frequency: agent.frequency,
              dayTime: agent.dayTime,
              scheduleTime: agent.scheduleTime,
              timezone: agentTimezone,
              apiUrl: pythonServerUri,
              sessionId: session_id,
              cronWindow,
              cronExecutionTime: cronExecutionTime,
              cronExecutionHour: cronExecutionHour,
              agentScheduledHour: agentScheduledHour,
              windowCheckResult: "IN_WINDOW",
              message: `API called for agent: ${agent.name} | Scheduled: ${agent.scheduleTime} (${agentScheduledHour}:00 ${agentTimezone}) | Cron UTC: ${cronExecutionTime} | URL: ${pythonServerUri}`,
            });

            // Fire API call
            axios
              .get(pythonServerUri)
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
                  status: "success",
                  frequency: agent.frequency,
                  dayTime: agent.dayTime,
                  scheduleTime: agent.scheduleTime,
                  timezone: agentTimezone,
                  apiUrl: pythonServerUri,
                  sessionId: session_id,
                  cronWindow,
                  cronExecutionTime: cronExecutionTime,
                  cronExecutionHour: cronExecutionHour,
                  agentScheduledHour: agentScheduledHour,
                  windowCheckResult: "IN_WINDOW",
                  message: `API call successful for agent: ${agent.name} | Scheduled: ${agent.scheduleTime} (${agentScheduledHour}:00 ${agentTimezone}) | Cron UTC: ${cronExecutionTime} | Status: ${response.status}`,
                });
              })
              .catch(async (err) => {
                const errorMessage = err.response
                  ? `Status ${err.response.status}: ${err.response.statusText} - ${JSON.stringify(err.response.data)}`
                  : err.message || "Unknown error";

                console.error(`   ❌ Agent API call failed: ${agent.name}`);
                console.error(`      Error: ${errorMessage}`);

                // Log API failure with detailed error
                await AgentCronLogSchema.create({
                  organization: org._id,
                  agent: agent._id,
                  agentName: agent.name,
                  status: "failure",
                  frequency: agent.frequency,
                  dayTime: agent.dayTime,
                  scheduleTime: agent.scheduleTime,
                  timezone: agentTimezone,
                  apiUrl: pythonServerUri,
                  sessionId: session_id,
                  cronWindow,
                  cronExecutionTime: cronExecutionTime,
                  cronExecutionHour: cronExecutionHour,
                  agentScheduledHour: agentScheduledHour,
                  windowCheckResult: "IN_WINDOW",
                  message: `API call failed for agent: ${agent.name} | Scheduled: ${agent.scheduleTime} (${agentScheduledHour}:00 ${agentTimezone}) | Cron UTC: ${cronExecutionTime} | Error: ${errorMessage}`,
                });
              });

            totalAgentsTriggered++;
          } catch (error) {
            const errorMessage = error?.message || "Unknown error";

            console.error(`   ❌ Failed to trigger agent: ${agent.name}`);
            console.error(`      Error: ${errorMessage}`);

            await AgentCronLogSchema.create({
              organization: org._id,
              agent: agent._id,
              agentName: agent.name,
              status: "failure",
              frequency: agent.frequency,
              dayTime: agent.dayTime,
              scheduleTime: agent.scheduleTime,
              timezone: agentTimezone,
              cronWindow,
              cronExecutionTime: cronExecutionTime,
              cronExecutionHour: cronExecutionHour,
              agentScheduledHour: agentScheduledHour,
              windowCheckResult: "IN_WINDOW",
              message: `Error triggering agent: ${agent.name} | Scheduled: ${agent.scheduleTime} (${agentScheduledHour}:00 ${agentTimezone}) | Cron UTC: ${cronExecutionTime} | Error: ${errorMessage}`,
            });
          }
        } else {
          console.log(`   ⏭️  SKIPPED: ${skipReason}`);
          totalAgentsSkipped++;
        }
      }
    }

    // Log cron completion with summary
    await AgentCronLogSchema.create({
      status: "cron_completed",
      cronWindow: `UTC hour ${cronExecutionHour}:00`,
      cronExecutionTime: cronExecutionTime,
      cronExecutionHour: cronExecutionHour,
      totalAgentsChecked,
      totalAgentsTriggered,
      totalAgentsSkipped,
      message: `Cron completed at ${cronExecutionTime} UTC: ${totalAgentsTriggered} triggered, ${totalAgentsSkipped} skipped out of ${totalAgentsChecked} checked`,
    });

    console.log(
      `\n✅ Cron job completed: ${totalAgentsTriggered} triggered, ${totalAgentsSkipped} skipped`
    );
  } catch (err) {
    console.error("❌ Cron job error:", err.message);
    console.error(err);

    await AgentCronLogSchema.create({
      status: "failure",
      cronWindow: `UTC hour ${cronExecutionHour}:00`,
      cronExecutionTime: cronExecutionTime,
      cronExecutionHour: cronExecutionHour,
      message: `Cron job error at ${cronExecutionTime} UTC: ${err.message}`,
    });
  }
};

/**
 * Trigger Realtime agents every tick, and 15min agents when shouldTriggerAgent allows.
 * Invoked every 5 minutes by index.js (cron: every 5 minutes).
 */
const handleHourlyTaskAgentCronJob = async () => {
  const now = moment();
  const cronExecutionTime = now.format("YYYY-MM-DD HH:mm:ss");

  console.log(`⏰ 5-minute agent cron job started at ${cronExecutionTime}`);

  try {
    await AgentCronLogSchema.create({
      status: "cron_started",
      cronExecutionTime: cronExecutionTime,
      message: `5-minute agent cron job started at ${cronExecutionTime}`,
    });

    const allOrgs = await Organization.find();
    let totalAgentsChecked = 0;
    let totalAgentsTriggered = 0;
    let totalAgentsSkipped = 0;

    for (const org of allOrgs) {
      const activeAgents = await AgentModel.find({
        isAgent: true,
        active: true,
        organization: org._id,
        $or: [
          { frequency: { $in: ["Realtime", "realtime"] } },
          // Case-insensitive match for 15min / Every 15 Minutes / etc.
          { frequency: { $regex: /^(every\s+)?15\s*mins?(utes)?$/i } },
        ],
      });

      if (activeAgents.length === 0) continue;

      console.log(`🏢 Org ${org._id}: Found ${activeAgents.length} realtime/15min agents`);

      for (const agent of activeAgents) {
        totalAgentsChecked++;

        const is15Min = is15MinuteFrequency(agent.frequency);

        if (is15Min) {
          const { shouldTrigger, skipReason, agentTimezone } = shouldTriggerAgent(agent);
          console.log(`\n   Checking 15min agent: ${agent.name || agent._id}`);
          console.log(
            `      fromTime: ${agent.fromTime || "N/A"} | toTime: ${agent.toTime || "N/A"} | businessDays: ${!!agent.businessDays}`
          );
          console.log(`      Timezone: ${agentTimezone}`);
          console.log(`      lastTriggeredAt: ${agent.lastTriggeredAt || "Never"}`);

          if (!shouldTrigger) {
            totalAgentsSkipped++;
            console.log(`   ⏭️  SKIPPED: ${skipReason}`);
            await AgentCronLogSchema.create({
              organization: org._id,
              agent: agent._id,
              agentName: agent.name,
              status: "skipped",
              frequency: agent.frequency,
              timezone: agentTimezone,
              cronExecutionTime: cronExecutionTime,
              message: `Skipped 15min agent: ${agent.name} | Reason: ${skipReason} | Cron ran at: ${cronExecutionTime}`,
            });
            continue;
          }
        }

        try {
          const session_id = Math.floor(100000 + Math.random() * 900000).toString();
          const pythonServerUri = `${process.env.AI_AGENT_SERVER_URI}/ask/agent?agent_name=${encodeURIComponent(agent.name)}&org_id=${org._id}&query='run'&session_id=${session_id}`;

          console.log(`   🚀 TRIGGERING ${is15Min ? "15min" : "realtime"} agent: ${agent.name}`);
          console.log(`      Python API URL: ${pythonServerUri}`);
          console.log(`      Session ID: ${session_id}`);

          await AgentCronLogSchema.create({
            organization: org._id,
            agent: agent._id,
            agentName: agent.name,
            status: "triggered",
            frequency: agent.frequency,
            apiUrl: pythonServerUri,
            sessionId: session_id,
            cronExecutionTime: cronExecutionTime,
            message: `API called for ${is15Min ? "15min" : "realtime"} agent: ${agent.name} | Cron ran at: ${cronExecutionTime} | URL: ${pythonServerUri}`,
          });

          // Fire API call — update lastTriggeredAt only after success
          axios
            .get(pythonServerUri)
            .then(async (response) => {
              console.log(`   ✅ Agent API call successful: ${agent.name}`);
              console.log(`      Response Status: ${response.status}`);

              await AgentModel.findByIdAndUpdate(agent._id, {
                lastTriggeredAt: new Date(),
              });

              await AgentCronLogSchema.create({
                organization: org._id,
                agent: agent._id,
                agentName: agent.name,
                status: "success",
                frequency: agent.frequency,
                apiUrl: pythonServerUri,
                sessionId: session_id,
                cronExecutionTime: cronExecutionTime,
                message: `API call successful for ${is15Min ? "15min" : "realtime"} agent: ${agent.name} | Cron ran at: ${cronExecutionTime} | Status: ${response.status}`,
              });
            })
            .catch(async (err) => {
              const errorMessage = err.response
                ? `Status ${err.response.status}: ${err.response.statusText} - ${JSON.stringify(err.response.data)}`
                : err.message || "Unknown error";

              console.error(`   ❌ Agent API call failed: ${agent.name}`);
              console.error(`      Error: ${errorMessage}`);

              await AgentCronLogSchema.create({
                organization: org._id,
                agent: agent._id,
                agentName: agent.name,
                status: "failure",
                frequency: agent.frequency,
                apiUrl: pythonServerUri,
                sessionId: session_id,
                cronExecutionTime: cronExecutionTime,
                message: `API call failed for ${is15Min ? "15min" : "realtime"} agent: ${agent.name} | Cron ran at: ${cronExecutionTime} | Error: ${errorMessage}`,
              });
            });

          totalAgentsTriggered++;
        } catch (error) {
          const errorMessage = error?.message || "Unknown error";

          console.error(`   ❌ Failed to trigger agent: ${agent.name}`);
          console.error(`      Error: ${errorMessage}`);

          await AgentCronLogSchema.create({
            organization: org._id,
            agent: agent._id,
            agentName: agent.name,
            status: "failure",
            frequency: agent.frequency,
            cronExecutionTime: cronExecutionTime,
            message: `Error triggering ${is15Min ? "15min" : "realtime"} agent: ${agent.name} | Cron ran at: ${cronExecutionTime} | Error: ${errorMessage}`,
          });
        }
      }
    }

    await AgentCronLogSchema.create({
      status: "cron_completed",
      cronExecutionTime: cronExecutionTime,
      totalAgentsChecked,
      totalAgentsTriggered,
      totalAgentsSkipped,
      message: `5-minute agent cron completed at ${cronExecutionTime}: ${totalAgentsTriggered} triggered, ${totalAgentsSkipped} skipped out of ${totalAgentsChecked} checked`,
    });

    console.log(
      `\n✅ 5-minute agent cron job completed: ${totalAgentsTriggered} triggered, ${totalAgentsSkipped} skipped out of ${totalAgentsChecked} checked`
    );
  } catch (err) {
    console.error("❌ 5-minute agent cron job error:", err.message);
    console.error(err);

    await AgentCronLogSchema.create({
      status: "failure",
      cronExecutionTime: cronExecutionTime,
      message: `5-minute agent cron job error at ${cronExecutionTime}: ${err.message}`,
    });
  }
};

module.exports = {
  handleTaskAgentCronJob,
  handleHourlyTaskAgentCronJob,
  // Exported for unit tests
  shouldTriggerAgent,
  is15MinuteFrequency,
  isTimeInWindow,
  parseTimeToMinutes,
  normalizeFrequency,
};
