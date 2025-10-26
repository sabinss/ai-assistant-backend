# Loki Setup Guide - Complete Monitoring Stack

## What is Loki?

**Loki** is a horizontally-scalable, highly-available log aggregation system inspired by Prometheus. It's designed to be very cost-effective and easy to operate.

### How Loki Fits in Your Stack:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Your Node.js  │    │   Prometheus    │    │     Loki       │
│   Application   │───▶│   (Metrics)     │    │    (Logs)      │
│                 │    │                 │    │                │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Grafana                                 │
│              (Visualization & Dashboards)                      │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Start the Monitoring Stack

```bash
# Start all services
docker-compose up -d

# Check if all services are running
docker-compose ps
```

### 2. Access Your Services

- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Loki**: http://localhost:3100

### 3. Configure Loki in Grafana

1. Go to Grafana → Configuration → Data Sources
2. Add Loki data source:
   - URL: `http://loki:3100`
   - Click "Save & Test"

## Understanding the Components

### 1. **Loki** - Log Storage

- Stores your application logs
- Similar to Elasticsearch but much simpler
- Uses labels for indexing (like Prometheus)

### 2. **Promtail** - Log Shipper

- Collects logs from your application
- Sends them to Loki
- Similar to Filebeat for Elasticsearch

### 3. **Your Application** - Log Producer

- Now generates structured JSON logs
- Each log entry includes metadata for better querying

## Log Structure

Your logs now look like this:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "message": "Request completed",
  "requestId": "abc123def",
  "method": "GET",
  "url": "/api/users",
  "statusCode": 200,
  "durationMs": 150,
  "userId": "user123"
}
```

## Querying Logs in Grafana

### Basic Queries

```logql
# All logs from your app
{job="nodejs-app"}

# Only error logs
{job="nodejs-app"} |= "ERROR"

# Logs from specific user
{job="nodejs-app"} | json | userId="user123"

# Slow requests (>1 second)
{job="nodejs-app"} | json | durationMs > 1000
```

### Advanced Queries

```logql
# Error rate over time
rate({job="nodejs-app"} |= "ERROR" [5m])

# Most common error messages
sum by (message) (count_over_time({job="nodejs-app"} |= "ERROR" [1h]))

# Request patterns by method
sum by (method) (count_over_time({job="nodejs-app"} | json [1h]))
```

## Practical Examples

### 1. Debug a User Issue

```logql
# Find all logs for a specific user
{job="nodejs-app"} | json | userId="user123"
```

### 2. Monitor API Performance

```logql
# Slow API calls
{job="nodejs-app"} | json | durationMs > 500

# API errors
{job="nodejs-app"} | json | statusCode >= 400
```

### 3. Track Authentication Events

```logql
# Login attempts
{job="nodejs-app"} | json | message="User login attempt"

# Failed logins
{job="nodejs-app"} | json | message="User login attempt" | json | statusCode=401
```

## Using the Logger in Your Code

```javascript
const logger = require('./helper/logger');

// Basic logging
logger.info('User created successfully', { userId: '123' });
logger.error('Database error', { error: 'Connection failed' });

// Request logging (automatic in middleware)
// Already handled by responseTimeTracker middleware

// Database operations
logger.logDatabase('create', 'users', 150, { userId: '123' });

// Authentication events
logger.logAuth('login_success', 'user123', { ip: '192.168.1.1' });
```

## Dashboard Setup

1. Import the provided dashboard JSON
2. Configure data sources:
   - Prometheus: `http://prometheus:9090`
   - Loki: `http://loki:3100`

## Benefits of This Setup

### 1. **Unified Monitoring**

- Metrics (Prometheus) + Logs (Loki) in one place
- Correlate metrics with logs easily

### 2. **Cost Effective**

- Loki is much cheaper than Elasticsearch
- Uses less storage and memory

### 3. **Easy Querying**

- LogQL is similar to PromQL
- Powerful filtering and aggregation

### 4. **Real-time Insights**

- See what's happening right now
- Debug issues quickly

## Troubleshooting

### Check if logs are being generated:

```bash
# View your application logs
tail -f logs/app.log
```

### Check Promtail is working:

```bash
# View Promtail logs
docker-compose logs promtail
```

### Check Loki is receiving logs:

```bash
# Query Loki directly
curl "http://localhost:3100/loki/api/v1/query?query={job=\"nodejs-app\"}"
```

## Next Steps

1. **Set up alerts** based on log patterns
2. **Create custom dashboards** for your specific needs
3. **Add more log sources** (database logs, system logs)
4. **Implement log retention policies**
5. **Set up log forwarding** to external systems

## Common Use Cases

### 1. **Debugging Production Issues**

- Find all logs related to a specific request
- Trace user actions through the system
- Identify error patterns

### 2. **Performance Monitoring**

- Track slow requests
- Monitor database query performance
- Identify bottlenecks

### 3. **Security Monitoring**

- Track authentication events
- Monitor failed login attempts
- Detect suspicious activity

### 4. **Business Analytics**

- Track user behavior
- Monitor feature usage
- Analyze user journeys
