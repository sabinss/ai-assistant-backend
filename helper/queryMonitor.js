const nodemailer = require('nodemailer');
const moment = require('moment');

// Email configuration
const createEmailTransporter = () => {
  return nodemailer.createTransporter({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Email templates
const emailTemplates = {
  longQuery: (queryName, executionTime, orgId, sessionId) => ({
    subject: `⚠️ Long Running Query Alert - ${queryName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ff6b35;">⚠️ Query Performance Alert</h2>
        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #856404; margin-top: 0;">Query Taking Too Long</h3>
          <p><strong>Query Name:</strong> ${queryName}</p>
          <p><strong>Execution Time:</strong> ${executionTime} seconds</p>
          <p><strong>Organization ID:</strong> ${orgId}</p>
          <p><strong>Session ID:</strong> ${sessionId}</p>
          <p><strong>Timestamp:</strong> ${moment().format('YYYY-MM-DD HH:mm:ss')}</p>
        </div>
        <p style="color: #666;">This query has been running for more than 50 seconds and may need attention.</p>
      </div>
    `,
  }),
  
  queryError: (queryName, error, orgId, sessionId) => ({
    subject: `🚨 Query Execution Error - ${queryName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545;">🚨 Query Execution Failed</h2>
        <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #721c24; margin-top: 0;">Error Details</h3>
          <p><strong>Query Name:</strong> ${queryName}</p>
          <p><strong>Error Message:</strong> ${error.message || error}</p>
          <p><strong>Organization ID:</strong> ${orgId}</p>
          <p><strong>Session ID:</strong> ${sessionId}</p>
          <p><strong>Timestamp:</strong> ${moment().format('YYYY-MM-DD HH:mm:ss')}</p>
        </div>
        <p style="color: #666;">Please check the server logs and database connectivity.</p>
      </div>
    `,
  }),
  
  queryTimeout: (queryName, orgId, sessionId) => ({
    subject: `⏰ Query Timeout Alert - ${queryName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #fd7e14;">⏰ Query Timeout</h2>
        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #856404; margin-top: 0;">Query Did Not Complete</h3>
          <p><strong>Query Name:</strong> ${queryName}</p>
          <p><strong>Organization ID:</strong> ${orgId}</p>
          <p><strong>Session ID:</strong> ${sessionId}</p>
          <p><strong>Timeout Duration:</strong> 5 minutes</p>
          <p><strong>Timestamp:</strong> ${moment().format('YYYY-MM-DD HH:mm:ss')}</p>
        </div>
        <p style="color: #666;">This query timed out and may need optimization or the database may be experiencing issues.</p>
      </div>
    `,
  }),
};

/**
 * Send email notification
 * @param {string} to - Recipient email
 * @param {Object} emailData - Email template data
 */
const sendEmailNotification = async (to, emailData) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('⚠️ Email credentials not configured. Skipping email notification.');
      return false;
    }

    const transporter = createEmailTransporter();
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to || process.env.ADMIN_EMAIL || 'admin@example.com',
      subject: emailData.subject,
      html: emailData.html,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`📧 Email notification sent successfully: ${result.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send email notification:', error);
    return false;
  }
};

/**
 * Monitor query execution with timing and email alerts
 * @param {Function} queryFunction - The query function to execute
 * @param {string} queryName - Name of the query for logging
 * @param {string} orgId - Organization ID
 * @param {string} sessionId - Session ID
 * @param {Object} options - Configuration options
 * @returns {Promise} Query result
 */
const monitorQuery = async (queryFunction, queryName, orgId, sessionId, options = {}) => {
  const {
    timeoutThreshold = 50, // seconds
    emailRecipients = process.env.ADMIN_EMAIL,
    enableEmailAlerts = true,
    logLevel = 'info'
  } = options;

  const startTime = Date.now();
  const timeoutId = setTimeout(async () => {
    if (enableEmailAlerts) {
      console.log(`⏰ Query ${queryName} is taking longer than expected...`);
      await sendEmailNotification(
        emailRecipients,
        emailTemplates.longQuery(queryName, timeoutThreshold, orgId, sessionId)
      );
    }
  }, timeoutThreshold * 1000);

  try {
    console.log(`🚀 Starting query: ${queryName} (Org: ${orgId}, Session: ${sessionId})`);
    
    const result = await queryFunction();
    
    const executionTime = (Date.now() - startTime) / 1000;
    clearTimeout(timeoutId);
    
    console.log(`✅ Query ${queryName} completed in ${executionTime.toFixed(2)}s`);
    
    // Log performance metrics
    if (executionTime > 10) {
      console.warn(`⚠️ Slow query detected: ${queryName} took ${executionTime.toFixed(2)}s`);
    }
    
    return {
      success: true,
      result,
      executionTime,
      queryName,
      orgId,
      sessionId,
    };
    
  } catch (error) {
    clearTimeout(timeoutId);
    const executionTime = (Date.now() - startTime) / 1000;
    
    console.error(`❌ Query ${queryName} failed after ${executionTime.toFixed(2)}s:`, error.message);
    
    // Send error notification
    if (enableEmailAlerts) {
      await sendEmailNotification(
        emailRecipients,
        emailTemplates.queryError(queryName, error, orgId, sessionId)
      );
    }
    
    throw {
      success: false,
      error,
      executionTime,
      queryName,
      orgId,
      sessionId,
    };
  }
};

/**
 * Monitor multiple queries in parallel with individual timing
 * @param {Array} queries - Array of query objects
 * @param {Object} options - Configuration options
 * @returns {Promise<Array>} Results array
 */
const monitorParallelQueries = async (queries, options = {}) => {
  const {
    timeoutThreshold = 50,
    emailRecipients = process.env.ADMIN_EMAIL,
    enableEmailAlerts = true,
  } = options;

  console.log(`🔄 Starting ${queries.length} parallel queries...`);
  const startTime = Date.now();

  try {
    const results = await Promise.allSettled(
      queries.map(({ queryFunction, queryName, orgId, sessionId }) =>
        monitorQuery(queryFunction, queryName, orgId, sessionId, {
          timeoutThreshold,
          emailRecipients,
          enableEmailAlerts,
        })
      )
    );

    const totalExecutionTime = (Date.now() - startTime) / 1000;
    console.log(`📊 All queries completed in ${totalExecutionTime.toFixed(2)}s`);

    // Log individual results
    results.forEach((result, index) => {
      const query = queries[index];
      if (result.status === 'fulfilled') {
        console.log(`✅ ${query.queryName}: ${result.value.executionTime.toFixed(2)}s`);
      } else {
        console.log(`❌ ${query.queryName}: Failed - ${result.reason.error?.message || 'Unknown error'}`);
      }
    });

    return results;
  } catch (error) {
    console.error('❌ Parallel query execution failed:', error);
    throw error;
  }
};

/**
 * Create a query wrapper with monitoring
 * @param {string} queryName - Name of the query
 * @param {string} orgId - Organization ID
 * @param {string} sessionId - Session ID
 * @param {Object} options - Configuration options
 * @returns {Function} Wrapped query function
 */
const createMonitoredQuery = (queryName, orgId, sessionId, options = {}) => {
  return async (queryFunction) => {
    return monitorQuery(queryFunction, queryName, orgId, sessionId, options);
  };
};

/**
 * Log query performance summary
 * @param {Array} results - Query results array
 */
const logPerformanceSummary = (results) => {
  const successful = results.filter(r => r.status === 'fulfilled');
  const failed = results.filter(r => r.status === 'rejected');
  
  const totalTime = results.reduce((sum, r) => {
    if (r.status === 'fulfilled') {
      return sum + r.value.executionTime;
    }
    return sum;
  }, 0);

  console.log('\n📊 Query Performance Summary:');
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`⏱️ Total Time: ${totalTime.toFixed(2)}s`);
  console.log(`📈 Average Time: ${(totalTime / results.length).toFixed(2)}s`);
  
  if (failed.length > 0) {
    console.log('\n❌ Failed Queries:');
    failed.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.reason.queryName}: ${result.reason.error?.message}`);
    });
  }
};

module.exports = {
  monitorQuery,
  monitorParallelQueries,
  createMonitoredQuery,
  logPerformanceSummary,
  sendEmailNotification,
  emailTemplates,
};
