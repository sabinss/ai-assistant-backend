const cron = require('node-cron');
const moment = require('moment-timezone');
const axios = require('axios');
const AgentModel = require('../models/AgentModel');
const AgentCronLogSchema = require('../models/AgentCronLogSchema');

// Timezone abbreviation to IANA mapping
const timezoneMapping = {
  EST: 'America/New_York',
  PST: 'America/Los_Angeles',
  CST: 'America/Chicago',
  MST: 'America/Denver',
  UTC: 'UTC',
  GMT: 'Europe/London',
  CET: 'Europe/Paris',
  JST: 'Asia/Tokyo',
  AEST: 'Australia/Sydney',
  IST: 'Asia/Kolkata',
};

class AgentCronJobManager {
  constructor() {
    this.activeJobs = new Map(); // Store active cron jobs
    this.isInitialized = false;
  }
  // Convert timezone abbreviation to IANA timezone
  convertTimezone(abbreviation) {
    return timezoneMapping[abbreviation] || 'UTC';
  }

  generateCronExpression() {
    const { frequency, schedule_time } = agent;
    if (!schedule_time || !frequency) {
      console.log(`Invalid schedule_time for frequency: ${frequency}`);
      return;
    }
    const { hour, minute } = schedule_time.split(':');
  }
}
