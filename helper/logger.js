const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

class Logger {
  constructor() {
    this.logFile = path.join(logsDir, 'app.log');
  }

  // Structured logging function for Loki
  log(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...metadata,
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    // Write to file for Loki/Promtail to pick up
    fs.appendFileSync(this.logFile, logLine);

    // Also log to console for development
    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, metadata);
  }

  info(message, metadata = {}) {
    this.log('INFO', message, metadata);
  }

  error(message, metadata = {}) {
    this.log('ERROR', message, metadata);
  }

  warn(message, metadata = {}) {
    this.log('WARN', message, metadata);
  }

  debug(message, metadata = {}) {
    this.log('DEBUG', message, metadata);
  }

  // Special method for request logging
  logRequest(req, res, durationMs) {
    const metadata = {
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id,
      organizationId: req.user?.organizationId,
    };

    if (res.statusCode >= 400) {
      this.error('Request failed', metadata);
    } else {
      this.info('Request completed', metadata);
    }
  }

  // Special method for database operations
  logDatabase(operation, table, duration, metadata = {}) {
    this.info(`Database ${operation}`, {
      operation,
      table,
      duration,
      ...metadata,
    });
  }

  // Special method for authentication events
  logAuth(event, userId, metadata = {}) {
    this.info(`Auth ${event}`, {
      event,
      userId,
      ...metadata,
    });
  }
}

module.exports = new Logger();
