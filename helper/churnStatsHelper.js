const axios = require('axios');
const moment = require('moment');

// Configure axios with proper timeouts and retry logic
const axiosInstance = axios.create({
  timeout: 300000, // 5 minutes timeout
  maxRedirects: 5,
  validateStatus: function (status) {
    return status >= 200 && status < 300; // Accept only 2xx status codes
  },
});

// Add request interceptor for logging
axiosInstance.interceptors.request.use(
  (config) => {
    console.log(`🚀 Making request to: ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
axiosInstance.interceptors.response.use(
  (response) => {
    console.log(
      `✅ Response received from: ${response.config.url} (${response.status})`
    );
    return response;
  },
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('⏰ Request timeout:', error.message);
    } else if (error.code === 'ECONNRESET') {
      console.error('🔌 Connection reset:', error.message);
    } else if (error.code === 'ENOTFOUND') {
      console.error('�� DNS lookup failed:', error.message);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('🚫 Connection refused:', error.message);
    } else {
      console.error('❌ Axios error:', error.message);
    }
    return Promise.reject(error);
  }
);

/**
 * Calculate date ranges for churn analysis
 * @returns {Object} Date information for current, previous, and previous-previous months
 */
const calculateDateRanges = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11

  // Calculate previous month (current month - 1)
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  // Calculate previous-1 month (current month - 2)
  const prevPrevMonth = prevMonth === 1 ? 12 : prevMonth - 1;
  const prevPrevYear = prevMonth === 1 ? prevYear - 1 : prevYear;

  return {
    currentYear,
    currentMonth,
    prevMonth,
    prevYear,
    prevPrevMonth,
    prevPrevYear,
  };
};

/**
 * Generate SQL queries for churn analysis
 * @param {string} org_id - Organization ID
 * @param {number} threshold - Risk threshold
 * @param {Object} dateRanges - Date ranges object
 * @returns {Object} SQL queries object
 */
const generateSqlQueries = (org_id, threshold, dateRanges) => {
  const { currentYear, prevYear, prevMonth, prevPrevYear, prevPrevMonth } = dateRanges;

  return {
    scoreDashboardQuery: `
      SELECT *
      FROM db${org_id}.customer_score_dashboard;
    `,
    
    companyQuery: `
      SELECT *
      FROM db${org_id}.companies;
    `,
    
    prevMonthQuery: `
      SELECT *
      FROM db${org_id}.customer_score_view 
      WHERE year = ${prevYear} AND month = ${prevMonth};
    `,
    
    prevPrevMonthQuery: `
      SELECT *
      FROM db${org_id}.customer_score_view 
      WHERE year = ${prevPrevYear} AND month = ${prevPrevMonth};
    `,
    
    trendQuery: `
      SELECT 
        month,
        COUNT(DISTINCT customer_id) as total_customers,
        COUNT(DISTINCT CASE WHEN churn_risk_score > ${threshold} THEN customer_id END) as high_risk_customers,
        AVG(churn_risk_score) as avg_churn_score,
        SUM(CASE WHEN churn_risk_score > ${threshold} THEN arr ELSE 0 END) as high_risk_arr
      FROM db${org_id}.customer_score_view 
      WHERE year = ${currentYear}
      GROUP BY month
      ORDER BY month ASC;
    `,
    
    riskMatrixQuery: `
      SELECT *
      FROM db${org_id}.customer_score_view 
      WHERE churn_risk_score IS NOT NULL 
        AND renewal_date IS NOT NULL
        AND year = ${prevPrevYear} AND month = ${prevPrevMonth}
      ORDER BY churn_risk_score DESC, renewal_date ASC;
    `,
  };
};

/**
 * Execute SQL query with retry logic
 * @param {string} query - SQL query to execute
 * @param {string} queryName - Name for logging
 * @param {string} session_id - Session ID
 * @param {string} org_id - Organization ID
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<Object>} Query response
 */
const executeSqlQueryWithRetry = async (
  query,
  queryName,
  session_id,
  org_id,
  maxRetries = 3
) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 ${queryName} - Attempt ${attempt}/${maxRetries}`);

      const response = await axiosInstance.post(
        `${
          process.env.AI_AGENT_SERVER_URI
        }/run-sql-query?sql_query=${encodeURIComponent(
          query
        )}&session_id=${session_id}&org_id=${org_id}`,
        {},
        {
          timeout: 300000, // 5 minutes
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );

      // Check for API-level errors
      if (response?.data?.error) {
        throw new Error(`API Error: ${response.data.error}`);
      }

      // Check for query execution status
      if (response?.data?.result?.metadata?.status === 'FAILED') {
        throw new Error(
          `Query execution failed: ${
            response.data.result.metadata.message || 'Unknown error'
          }`
        );
      }

      console.log(`✅ ${queryName} - Success on attempt ${attempt}`);
      return response;
    } catch (error) {
      console.error(
        `❌ ${queryName} - Attempt ${attempt} failed:`,
        error.message
      );

      if (attempt === maxRetries) {
        throw new Error(
          `${queryName} failed after ${maxRetries} attempts: ${error.message}`
        );
      }

      // Wait before retrying (exponential backoff)
      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
      console.log(`⏳ Waiting ${waitTime}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
};

/**
 * Process trend data for the line chart
 * @param {Array} monthlyData - Raw monthly data
 * @returns {Array} Processed trend data
 */
const processTrendData = (monthlyData) => {
  if (!monthlyData || monthlyData.length === 0) return [];

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const processedData = [];

  // Only process months that have actual data
  monthlyData.forEach((row) => {
    const month = Number(row.month);
    if (month >= 1 && month <= 12) {
      processedData.push({
        month: month,
        monthName: monthNames[month - 1],
        totalCustomers: Number(row.total_customers || 0),
        highRiskCustomers: Number(row.high_risk_customers || 0),
        avgChurnScore: Math.round(Number(row.avg_churn_score || 0) * 100) / 100,
        highRiskARR: Math.round(Number(row.high_risk_arr || 0) * 100) / 100,
      });
    }
  });

  // Sort by month to ensure chronological order
  processedData.sort((a, b) => a.month - b.month);

  return processedData;
};

/**
 * Process risk matrix data for scatter plot
 * @param {Array} data - Raw risk matrix data
 * @returns {Object} Processed risk matrix data with customers and distribution
 */
const processRiskMatrixData = (data) => {
  if (!data || data.length === 0) {
    return {
      customers: [],
      riskDistribution: { critical: 0, high: 0, healthy: 0 },
    };
  }

  const today = moment();
  const processedCustomers = [];
  let criticalCount = 0, highCount = 0, healthyCount = 0;

  data.forEach((row) => {
    const churnScore = Number(row.churn_risk_score || 0);
    const renewalDate = moment(row.renewal_date, 'YYYY-MM-DD');
    const daysToRenewal = renewalDate.diff(today, 'days');

    // Determine risk level based on churn score
    let riskLevel = '';
    let riskColor = '';

    if (churnScore >= 81) {
      riskLevel = 'Critical';
      riskColor = '#FF0000'; // Red
      criticalCount++;
    } else if (churnScore >= 71) {
      riskLevel = 'High';
      riskColor = '#FFA500'; // Orange
      highCount++;
    } else {
      riskLevel = 'Healthy';
      riskColor = '#00FF00'; // Green
      healthyCount++;
    }

    processedCustomers.push({
      customer_id: row?.customer_id || row?.company_id,
      customer_name: row.customer_name || row.name || 'N/A',
      churn_risk_score: churnScore,
      renewal_date: row.renewal_date,
      days_to_renewal: daysToRenewal,
      arr: Number(row.arr || 0),
      monetary_value: Number(row.monetary_value || row.contract_value || 0),
      risk_level: riskLevel,
      risk_color: riskColor,
    });
  });

  return {
    customers: processedCustomers,
    riskDistribution: {
      critical: criticalCount,
      high: highCount,
      healthy: healthyCount,
    },
  };
};

/**
 * Calculate statistics for churn analysis
 * @param {Array} data - Raw customer data
 * @param {number} threshold - Risk threshold
 * @param {Object} scoreDashboardData - Dashboard data (optional)
 * @returns {Object} Calculated statistics
 */
const calculateStats = (data, threshold, scoreDashboardData = null) => {
  if (!data || data.length === 0) {
    return {
      totalCustomers: 0,
      highRiskCount: 0,
      highRiskPercent: 0,
      avgChurnScore: 0,
      totalHighRiskScore: 0,
      churnScores: [],
      churnRiskDistribution: {
        veryLow: 0, // 1-20
        low: 0, // 21-40
        medium: 0, // 41-60
        high: 0, // 61-80
        critical: 0, // 81-100
      },
    };
  }

  const uniqueCustomers = [...new Set(data.map((row) => row.customer_id))];
  const totalCustomers = uniqueCustomers.length;

  const churnScores = data.map((row) => Number(row.churn_risk_score || 0));
  const highRiskCustomers = data.filter(
    (row) => Number(row.churn_risk_score || 0) > threshold
  );
  const highRiskCount = [
    ...new Set(highRiskCustomers.map((row) => row.customer_id)),
  ].length;

  // Calculate total sum of churn risk scores for customers >threshold
  const totalHighRiskScore = highRiskCustomers.reduce(
    (sum, row) => sum + Number(row.churn_risk_score || 0),
    0
  );

  const revenueAtRisk = highRiskCustomers.reduce(
    (sum, row) => sum + Number(row.arr || 0),
    0
  );

  const highRiskPercent =
    totalCustomers > 0 ? (highRiskCount / totalCustomers) * 100 : 0;
  const avgChurnScore =
    churnScores.length > 0
      ? churnScores.reduce((sum, score) => sum + score, 0) / churnScores.length
      : 0;

  // Map customers to churn risk distribution chart ranges
  const churnRiskDistribution = {
    veryLow: data.filter((row) => {
      const score = Number(row.churn_risk_score || 0);
      return score >= 1 && score <= 20;
    }).length,
    low: data.filter((row) => {
      const score = Number(row.churn_risk_score || 0);
      return score >= 21 && score <= 40;
    }).length,
    medium: data.filter((row) => {
      const score = Number(row.churn_risk_score || 0);
      return score >= 41 && score <= 60;
    }).length,
    high: data.filter((row) => {
      const score = Number(row.churn_risk_score || 0);
      return score >= 61 && score <= 80;
    }).length,
    critical: data.filter((row) => {
      const score = Number(row.churn_risk_score || 0);
      return score >= 81 && score <= 100;
    }).length,
  };

  return {
    totalCustomers: scoreDashboardData?.customer_count || totalCustomers,
    highRiskCount: scoreDashboardData?.churned_customer_count || highRiskCount,
    highRiskPercent: Math.round(highRiskPercent * 100) / 100, // Round to 2 decimal places
    avgChurnScore:
      scoreDashboardData?.avg_churn_risk_score ||
      Math.round(avgChurnScore * 100) / 100,
    totalHighRiskScore: Math.round(totalHighRiskScore * 100) / 100, // Round to 2 decimal places
    churnScores,
    churnRiskDistribution,
    revenueAtRisk: revenueAtRisk ? revenueAtRisk : null,
  };
};

/**
 * Get detailed list of high-risk customers
 * @param {Array} data - Raw customer data
 * @param {number} threshold - Risk threshold
 * @returns {Array} High-risk customer list
 */
const getHighRiskCustomerList = (data, threshold) => {
  if (!data || data.length === 0) return [];

  const highRiskCustomers = data.filter(
    (row) => Number(row.churn_risk_score || 0) > threshold
  );

  return highRiskCustomers.map((row) => {
    const score = Number(row.churn_risk_score || 0);
    let riskLevel = '';

    // Determine risk level based on score ranges
    if (score >= 1 && score <= 20) riskLevel = 'Very Low';
    else if (score >= 21 && score <= 40) riskLevel = 'Low';
    else if (score >= 41 && score <= 60) riskLevel = 'Medium';
    else if (score >= 61 && score <= 80) riskLevel = 'High';
    else if (score >= 81 && score <= 100) riskLevel = 'Critical';
    else riskLevel = 'Unknown';
    
    const today = moment();
    const renewalDate = moment(row.renewal_date, 'YYYY-MM-DD');
    
    return {
      customer_id: row?.customer_id || row?.company_id,
      customer_name: row?.customer_name || row?.name || 'N/A',
      churn_risk_score: score,
      renewal_days: renewalDate.diff(today, 'days') || 'N/A',
      monetary_value: row?.monetary_value || row?.contract_value || 'N/A',
      risk_level: riskLevel,
      arr: row.arr,
    };
  });
};

/**
 * Calculate percentage changes between two values
 * @param {number} current - Current value
 * @param {number} previous - Previous value
 * @returns {number|null} Percentage change
 */
const calculatePercentageChange = (current, previous) => {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100 * 100) / 100; // Round to 2 decimal places
};

/**
 * Calculate trend summary from trend analysis data
 * @param {Array} trendAnalysis - Processed trend data
 * @returns {Object} Trend summary
 */
const calculateTrendSummary = (trendAnalysis) => {
  return {
    totalMonths: trendAnalysis.length,
    avgChurnScore:
      trendAnalysis.length > 0
        ? Math.round(
            (trendAnalysis.reduce((sum, d) => sum + d.avgChurnScore, 0) /
              trendAnalysis.length) *
              100
          ) / 100
        : 0,
    totalHighRiskCustomers: trendAnalysis.reduce(
      (sum, d) => sum + d.highRiskCustomers,
      0
    ),
    totalHighRiskARR:
      Math.round(
        trendAnalysis.reduce((sum, d) => sum + d.highRiskARR, 0) * 100
      ) / 100,
  };
};

/**
 * Generate chart configuration for risk matrix
 * @param {Array} riskMatrixCustomers - Risk matrix customers data
 * @returns {Object} Chart configuration
 */
const generateRiskMatrixChartConfig = (riskMatrixCustomers) => {
  return {
    title: 'Risk Matrix: Churn Score vs Time to Renewal',
    xAxis: {
      type: 'value',
      name: 'Days to Renewal',
      nameLocation: 'middle',
      nameGap: 30,
    },
    yAxis: {
      type: 'value',
      name: 'Churn Risk Score',
      nameLocation: 'middle',
      nameGap: 30,
    },
    series: [
      {
        name: 'Critical',
        type: 'scatter',
        data: riskMatrixCustomers
          .filter((c) => c.risk_level === 'Critical')
          .map((c) => [c.days_to_renewal, c.churn_risk_score, c.customer_name]),
        itemStyle: { color: '#FF0000' },
        symbolSize: 8,
      },
      {
        name: 'High',
        type: 'scatter',
        data: riskMatrixCustomers
          .filter((c) => c.risk_level === 'High')
          .map((c) => [c.days_to_renewal, c.churn_risk_score, c.customer_name]),
        itemStyle: { color: '#FFA500' },
        symbolSize: 8,
      },
      {
        name: 'Healthy',
        type: 'scatter',
        data: riskMatrixCustomers
          .filter((c) => c.risk_level === 'Healthy')
          .map((c) => [c.days_to_renewal, c.churn_risk_score, c.customer_name]),
        itemStyle: { color: '#00FF00' },
        symbolSize: 8,
      },
    ],
    legend: {
      data: ['Critical', 'High', 'Healthy'],
      top: 10,
      right: 10,
    },
    tooltip: {
      formatter: function (params) {
        const customer = riskMatrixCustomers.find(
          (c) =>
            c.days_to_renewal === params.value[0] &&
            c.churn_risk_score === params.value[1]
        );
        if (customer) {
          return `
            <strong>${customer.customer_name}</strong><br/>
            Churn Score: ${customer.churn_risk_score}<br/>
            Days to Renewal: ${customer.days_to_renewal}<br/>
            Risk Level: ${customer.risk_level}<br/>
            ARR: $${customer.arr.toLocaleString()}
          `;
        }
        return `${params.seriesName}<br/>Days: ${params.value[0]}, Score: ${params.value[1]}`;
      },
    },
  };
};

/**
 * Handle specific error types and return appropriate error response
 * @param {Error} error - The error object
 * @returns {Object} Error response object
 */
const handleChurnStatsError = (error) => {
  console.error('Error computing high risk churn stats:', error);

  // Handle specific socket hang up and connection errors
  if (error.code === 'ECONNABORTED') {
    return {
      status: 504,
      response: {
        message: 'Request timeout - SQL query took too long to execute',
        error: 'Gateway Timeout',
        suggestion: 'Try again or contact support if the issue persists',
      },
    };
  } else if (error.code === 'ECONNRESET') {
    return {
      status: 503,
      response: {
        message: 'Connection reset - AI Agent Server connection was interrupted',
        error: 'Service Unavailable',
        suggestion: 'The server may be experiencing issues. Please try again.',
      },
    };
  } else if (error.code === 'ENOTFOUND') {
    return {
      status: 502,
      response: {
        message: 'AI Agent Server not found - Check server configuration',
        error: 'Bad Gateway',
        suggestion: 'Verify AI_AGENT_SERVER_URI environment variable',
      },
    };
  } else if (error.code === 'ECONNREFUSED') {
    return {
      status: 502,
      response: {
        message: 'AI Agent Server connection refused - Server may be down',
        error: 'Bad Gateway',
        suggestion: 'Check if the AI Agent Server is running and accessible',
      },
    };
  }

  return {
    status: 500,
    response: {
      message: 'Internal Server Error',
      error: error.message,
      suggestion: 'Please try again or contact support if the issue persists',
    },
  };
};

module.exports = {
  calculateDateRanges,
  generateSqlQueries,
  executeSqlQueryWithRetry,
  processTrendData,
  processRiskMatrixData,
  calculateStats,
  getHighRiskCustomerList,
  calculatePercentageChange,
  calculateTrendSummary,
  generateRiskMatrixChartConfig,
  handleChurnStatsError,
};

// Import query monitoring
const {
  monitorQuery,
  monitorParallelQueries,
  logPerformanceSummary,
} = require('./queryMonitor');

/**
 * Enhanced SQL query execution with monitoring
 * @param {string} query - SQL query to execute
 * @param {string} queryName - Name for logging
 * @param {string} session_id - Session ID
 * @param {string} org_id - Organization ID
 * @param {number} maxRetries - Maximum retry attempts
 * @param {Object} monitoringOptions - Monitoring configuration
 * @returns {Promise<Object>} Query response
 */
const executeSqlQueryWithMonitoring = async (
  query,
  queryName,
  session_id,
  org_id,
  maxRetries = 3,
  monitoringOptions = {}
) => {
  const {
    enableMonitoring = true,
    timeoutThreshold = 50,
    emailRecipients = process.env.ADMIN_EMAIL,
    enableEmailAlerts = true,
  } = monitoringOptions;

  const queryFunction = async () => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 ${queryName} - Attempt ${attempt}/${maxRetries}`);

        const response = await axiosInstance.post(
          `${
            process.env.AI_AGENT_SERVER_URI
          }/run-sql-query?sql_query=${encodeURIComponent(
            query
          )}&session_id=${session_id}&org_id=${org_id}`,
          {},
          {
            timeout: 300000, // 5 minutes
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          }
        );

        // Check for API-level errors
        if (response?.data?.error) {
          throw new Error(`API Error: ${response.data.error}`);
        }

        // Check for query execution status
        if (response?.data?.result?.metadata?.status === 'FAILED') {
          throw new Error(
            `Query execution failed: ${
              response.data.result.metadata.message || 'Unknown error'
            }`
          );
        }

        console.log(`✅ ${queryName} - Success on attempt ${attempt}`);
        return response;
      } catch (error) {
        console.error(
          `❌ ${queryName} - Attempt ${attempt} failed:`,
          error.message
        );

        if (attempt === maxRetries) {
          throw new Error(
            `${queryName} failed after ${maxRetries} attempts: ${error.message}`
          );
        }

        // Wait before retrying (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  };

  if (enableMonitoring) {
    return monitorQuery(queryFunction, queryName, org_id, session_id, {
      timeoutThreshold,
      emailRecipients,
      enableEmailAlerts,
    });
  } else {
    return queryFunction();
  }
};

/**
 * Execute multiple SQL queries in parallel with monitoring
 * @param {Array} queries - Array of query objects
 * @param {string} session_id - Session ID
 * @param {string} org_id - Organization ID
 * @param {Object} monitoringOptions - Monitoring configuration
 * @returns {Promise<Array>} Query results
 */
const executeParallelQueriesWithMonitoring = async (
  queries,
  session_id,
  org_id,
  monitoringOptions = {}
) => {
  const {
    enableMonitoring = true,
    timeoutThreshold = 50,
    emailRecipients = process.env.ADMIN_EMAIL,
    enableEmailAlerts = true,
  } = monitoringOptions;

  const queryObjects = queries.map(({ query, queryName }) => ({
    queryFunction: () => executeSqlQueryWithRetry(query, queryName, session_id, org_id),
    queryName,
    orgId: org_id,
    sessionId: session_id,
  }));

  if (enableMonitoring) {
    const results = await monitorParallelQueries(queryObjects, {
      timeoutThreshold,
      emailRecipients,
      enableEmailAlerts,
    });

    // Log performance summary
    logPerformanceSummary(results);

    return results;
  } else {
    // Fallback to original parallel execution
    return Promise.all(
      queries.map(({ query, queryName }) =>
        executeSqlQueryWithRetry(query, queryName, session_id, org_id)
      )
    );
  }
};

// Export the new monitoring functions
module.exports = {
  ...module.exports,
  executeSqlQueryWithMonitoring,
  executeParallelQueriesWithMonitoring,
};
