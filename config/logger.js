// logger.js
const { createLogger, format, transports } = require("winston");
const { combine, timestamp, printf } = format;

const logFormat = printf(({ level, message, timestamp }) => {
  return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
});

const logger = createLogger({
  level: "info",
  format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), logFormat),
  transports: [
    // new transports.File({ filename: 'logs/cron.log' }), // ensure `logs/` folder exists
    // new transports.File({ filename: 'logs/error.log', level: 'error' })
  ],
});

module.exports = logger;
