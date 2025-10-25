const client = require('prom-client');

const requestCounter = new client.Counter({
  name: 'request_count',
  help: 'Total number of requests',
  labelNames: ['method', 'path', 'route'],
});

const requestCount = (req, res, next) => {
  requestCounter.inc({
    method: req.method,
    route: req?.route ? req.route.path : req.path,
    path: req.path,
  });
  next();
};

module.exports = requestCount;
