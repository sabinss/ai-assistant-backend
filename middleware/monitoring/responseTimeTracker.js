const client = require('prom-client');
const logger = require('../../helper/logger');

const responseTimeHistogram = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

const responseTimeTracker = (req, res, next) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);

  // Add request ID to request object for correlation
  req.requestId = requestId;

  // Log request start
  logger.info('Request started', {
    requestId,
    method: req.method,
    url: req.url,
    path: req.path,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
  });

  res.on('finish', () => {
    const end = Date.now();
    const durationMs = end - start;
    const durationSec = durationMs / 1000;

    // Update Prometheus metrics
    responseTimeHistogram.observe(
      {
        method: req.method,
        path: req.path,
        status_code: res.statusCode,
      },
      durationSec
    );

    // Use the logger's built-in request logging
    logger.logRequest(req, res, durationMs);
  });

  next();
};

module.exports = responseTimeTracker;
