# Query Monitoring and Email Notifications

This document explains the query monitoring functionality that has been added to track database query performance and send email notifications for long-running queries or errors.

## 🚀 Features

### 1. Query Timing
- **Real-time timing**: Every query execution is timed and logged
- **Performance metrics**: Detailed logging of execution times
- **Slow query detection**: Automatic detection of queries taking >10 seconds

### 2. Email Notifications
- **Long-running queries**: Email alerts for queries taking >50 seconds
- **Error notifications**: Immediate email alerts for query failures
- **Timeout alerts**: Notifications for queries that don't complete
- **Rich HTML emails**: Professional email templates with detailed information

### 3. Parallel Query Monitoring
- **Batch monitoring**: Monitor multiple queries running in parallel
- **Performance summary**: Detailed reports on query execution times
- **Individual tracking**: Each query is monitored independently

## 📧 Email Configuration

### Environment Variables
Add these to your `.env` file:

```env
# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
ADMIN_EMAIL=admin@yourcompany.com

# Query Monitoring Settings
QUERY_TIMEOUT_THRESHOLD=50
ENABLE_EMAIL_ALERTS=true
```

### Gmail Setup
1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
3. Use the app password as `EMAIL_PASS`

## 🔧 Usage

### Basic Query Monitoring
```javascript
const { monitorQuery } = require('./helper/queryMonitor');

const result = await monitorQuery(
  () => executeSqlQuery(query, sessionId, orgId),
  'My Query Name',
  orgId,
  sessionId,
  {
    timeoutThreshold: 50,
    emailRecipients: 'admin@company.com',
    enableEmailAlerts: true
  }
);
```

### Parallel Query Monitoring
```javascript
const { monitorParallelQueries } = require('./helper/queryMonitor');

const queries = [
  { queryFunction: () => query1(), queryName: 'Query 1', orgId, sessionId },
  { queryFunction: () => query2(), queryName: 'Query 2', orgId, sessionId },
];

const results = await monitorParallelQueries(queries, {
  timeoutThreshold: 50,
  emailRecipients: 'admin@company.com',
  enableEmailAlerts: true
});
```

## 📊 Monitoring Output

### Console Logs
```
🚀 Starting query: Previous Month Query (Org: 123, Session: 4567)
✅ Query Previous Month Query completed in 2.34s
⚠️ Slow query detected: Company Query took 15.67s
📊 Query Performance Summary:
✅ Successful: 5
❌ Failed: 1
⏱️ Total Time: 45.23s
📈 Average Time: 7.54s
```

### Email Notifications

#### Long-Running Query Alert
- **Subject**: ⚠️ Long Running Query Alert - [Query Name]
- **Content**: Query details, execution time, organization info
- **Trigger**: Query takes longer than 50 seconds

#### Query Error Alert
- **Subject**: 🚨 Query Execution Error - [Query Name]
- **Content**: Error details, query info, troubleshooting suggestions
- **Trigger**: Any query execution failure

#### Timeout Alert
- **Subject**: ⏰ Query Timeout Alert - [Query Name]
- **Content**: Timeout details, query info, optimization suggestions
- **Trigger**: Query doesn't complete within timeout period

## 🛠️ Configuration Options

### Monitoring Options
```javascript
const monitoringOptions = {
  enableMonitoring: true,        // Enable/disable monitoring
  timeoutThreshold: 50,         // Seconds before email alert
  emailRecipients: 'admin@company.com', // Email recipients
  enableEmailAlerts: true,      // Enable/disable email alerts
  logLevel: 'info'             // Logging level
};
```

### Email Templates
The system includes three email templates:
1. **Long Query Alert**: For queries taking too long
2. **Error Alert**: For query execution failures
3. **Timeout Alert**: For queries that don't complete

## 🔍 Troubleshooting

### Common Issues

1. **Email not sending**
   - Check EMAIL_USER and EMAIL_PASS in .env
   - Verify Gmail app password is correct
   - Check EMAIL_SERVICE is set to 'gmail'

2. **Monitoring not working**
   - Ensure enableMonitoring is true
   - Check that helper files are properly imported
   - Verify queryMonitor.js is in helper/ directory

3. **False alerts**
   - Adjust timeoutThreshold for your environment
   - Consider database performance optimization
   - Review query complexity

### Debug Mode
Enable detailed logging by setting:
```javascript
const monitoringOptions = {
  logLevel: 'debug',
  enableEmailAlerts: false  // Disable emails for testing
};
```

## 📈 Performance Impact

- **Minimal overhead**: Monitoring adds <1ms per query
- **Async notifications**: Email sending doesn't block queries
- **Efficient logging**: Console logs are optimized for performance
- **Configurable**: Can be disabled in production if needed

## 🔒 Security Considerations

- **Email credentials**: Store securely in environment variables
- **Sensitive data**: Query results are not included in emails
- **Access control**: Limit email recipients to authorized personnel
- **Logging**: Consider log retention policies for sensitive queries

## 📝 Integration

The monitoring is automatically integrated into:
- `getHighRiskChurnStats` function
- All SQL query executions
- Parallel query processing
- Error handling workflows

No additional code changes are required - monitoring works out of the box!
