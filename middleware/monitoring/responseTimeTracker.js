const client = require('prom-client');

const responseTimeHistogram = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

const responseTimeTracker = (req, res, next) => {
  const start = Date.now();
  console.log(`${req.method} ${req.url} started at ${start}`);

  res.on('finish', () => {
    const end = Date.now();
    const durationMs = end - start;
    const durationSec = durationMs / 1000;

    responseTimeHistogram.observe(
      {
        method: req.method,
        path: req.path,
        status_code: res.statusCode,
      },
      durationSec
    );

    console.log(
      `${req.method} ${
        req.url
      } completed in ${durationMs} ms | ${durationSec.toFixed(2)} sec`
    );
  });

  next();
};

module.exports = responseTimeTracker;
