const Customer = require('../models/Customer');
const CustomerFeature = require('../models/CustomerFeature');
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
      console.error('🌐 DNS lookup failed:', error.message);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('🚫 Connection refused:', error.message);
    } else {
      console.error('❌ Axios error:', error.message);
    }
    return Promise.reject(error);
  }
);

exports.getCustomerDetail = async (req, res) => {
  try {
    const { customer_id, updated_date, created_date } = req.query;
    let filter = {};
    if (customer_id) {
      filter._id = customer_id;
    }
    if (req.externalApiCall && req.organization) {
      filter.organization = req.organization;
    }
    if (updated_date) {
      const filterDate = new Date(updated_date);
      filterDate.setHours(0, 0, 0, 0); // Ensure it starts from midnight
      filter['updatedAt'] = { $gt: filterDate };
    }
    if (created_date) {
      const filterDate = new Date(created_date);
      filterDate.setHours(0, 0, 0, 0); // Ensure it starts from midnight
      searchCondition['createdAt'] = { $gt: filterDate };
    }
    const customerDetail = await Customer.find(filter);

    res.status(200).json({ data: customerDetail });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error });
  }
};

exports.createCustomer = async (req, res) => {
  try {
    const { name, organization, ...optionalFields } = req.body;
    if (req.externalApiCall && !req.organization) {
      res.status(400).json({ message: 'Organization required', error });
    }
    // Check if required fields are provided
    if (!name || !organization) {
      return res.status(400).json({
        message: 'Missing required fields: name,  organization',
      });
    }

    // Check if customer already exists for the same organization (case-insensitive)
    const existingCustomer = await Customer.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') }, // case-insensitive regex match
      organization: organization,
    });

    if (existingCustomer) {
      return res.status(400).json({
        message: 'Customer already exists for this organization',
        customer: existingCustomer,
      });
    }

    // Create a new customer with required and optional fields
    const customer = new Customer({
      name,
      organization,
      email: optionalFields?.email || '', // Ensure email is explicitly set to null if not provided
      ...optionalFields, // Spread operator adds any additional fields dynamically
    });

    await customer.save();

    res.status(201).json({
      message: 'Customer created successfully',
      customer,
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error });
  }
};

exports.getCustomerLoginDetail = async (req, res) => {
  try {
    const { customer_id, updated_date } = req.query;
    let filter = { feature: { $regex: /^Login$/i } };
    if (customer_id) {
      filter.customer = customer_id;
    }

    if (req?.organization) {
      filter.organization = organization;
    }

    if (updated_date) {
      const filterDate = new Date(updated_date);
      filterDate.setHours(0, 0, 0, 0); // Ensure it starts from midnight
      filter['updatedAt'] = { $gt: filterDate };
    }
    const customerLoginDetails = await CustomerFeature.find(filter);
    res.status(200).json({ data: customerLoginDetails });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error });
  }
};

exports.updateCustomerDetail = async (req, res) => {
  try {
    const { id } = req.params; // Customer ID
    const { stage } = req.body; // Fields to update

    if (!id) {
      return res.status(400).json({ message: 'Customer ID is required' });
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      id,
      { stage },
      { new: true, runValidators: true }
    );

    if (!updatedCustomer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    return res.status(200).json({
      message: 'Customer updated successfully',
      data: updatedCustomer,
    });
  } catch (err) {
    console.error('Error updating customer:', err);
    return res
      .status(500)
      .json({ message: 'Internal server error', error: err.message });
  }
};

exports.getCustomerAlertData = async (req, res) => {
  try {
    const session_id = Math.floor(1000 + Math.random() * 9000);
    const org_id = req.user.organization.toString();
    const sql_query = `SELECT * from  db${org_id}.alert_log_view`;
    let url =
      process.env.AI_AGENT_SERVER_URI +
      `/run-sql-query?sql_query=${sql_query}&session_id=${session_id}&org_id=${org_id}`;
    console.log('url', url);
    const response = await axiosInstance.post(
      url,
      {},
      {
        timeout: 300000, // 5 minutes
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );
    if (response?.data?.error) {
      res
        .status(500)
        .json({ message: response?.data?.error, error: response?.data?.error });
      return;
    }
    res.status(200).json({ data: response.data.result.result_set });
  } catch (err) {
    console.log('Err', err);
    res.status(500).json({ message: 'Internal Server Error', err });
  }
};

exports.getCustomerScore = async (req, res) => {
  try {
    const session_id = Math.floor(1000 + Math.random() * 9000);
    const org_id = req.user.organization.toString(); // e.g., '12'
    const customer_id = req.params.id || req.query.id; // e.g., '123123'

    if (!customer_id) {
      return res.status(400).json({ message: 'Missing customer_id' });
    }

    const sql_query = `
        SELECT * FROM db${org_id}.customer_score_view 
        WHERE customer_id = '${customer_id}' 
          AND year = EXTRACT(YEAR FROM DATEADD(MONTH, -1, CURRENT_DATE)) 
          AND month = EXTRACT(MONTH FROM DATEADD(MONTH, -1, CURRENT_DATE))
      `;

    const url = `${
      process.env.AI_AGENT_SERVER_URI
    }/run-sql-query?sql_query=${encodeURIComponent(
      sql_query
    )}&session_id=${session_id}&org_id=${org_id}`;

    console.log('Requesting URL:', url);

    const response = await axiosInstance.post(
      url,
      {},
      {
        timeout: 300000, // 5 minutes
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    if (response?.data?.error) {
      return res
        .status(500)
        .json({ message: response.data.error, error: response.data.error });
    }
    // has score and analysis
    let uniqueData = [];
    const map = new Map();
    response.data.result.result_set.forEach((item) => {
      if (!map.has(item.customer_id)) {
        map.set(item.customer_id, item);
        uniqueData.push(item);
      }
    });

    return res.status(200).json({ data: uniqueData });
  } catch (error) {
    console.error('Error fetching customer score:', error);
    return res.status(500).json({ message: 'Internal Server Error', error });
  }
};

exports.getCustomerScoreDetails = async (req, res) => {
  try {
    const session_id = Math.floor(1000 + Math.random() * 9000);
    const org_id = req.user.organization.toString(); // e.g. '12'
    const customer_id = req.params.id || req.query.id; // e.g. 'hilton'

    if (!customer_id) {
      return res.status(400).json({ message: 'Missing customer_id' });
    }

    const sql_query = `
        SELECT * FROM db${org_id}.score_details_view 
        WHERE customer_id = '${customer_id}' 
          AND year = EXTRACT(YEAR FROM DATEADD(MONTH, -1, CURRENT_DATE)) 
          AND month = EXTRACT(MONTH FROM DATEADD(MONTH, -1, CURRENT_DATE))
      `;

    const url = `${
      process.env.AI_AGENT_SERVER_URI
    }/run-sql-query?sql_query=${encodeURIComponent(
      sql_query
    )}&session_id=${session_id}&org_id=${org_id}`;

    console.log('Requesting URL:', url);

    const response = await axiosInstance.post(
      url,
      {},
      {
        timeout: 300000, // 5 minutes
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    if (response?.data?.error) {
      return res
        .status(500)
        .json({ message: response.data.error, error: response.data.error });
    }
    let uniqueData = [];
    const map = new Map();
    response.data.result.result_set.forEach((item) => {
      if (!map.has(item.customer_id)) {
        map.set(item.customer_id, item);
        uniqueData.push(item);
      }
    });
    return resstatus(200).json({ data: uniqueData });
  } catch (error) {
    console.error('Error fetching customer score details:', error);
    return res.status(500).json({ message: 'Internal Server Error', error });
  }
};
exports.getHighRiskChurnStatsBackup = async (req, res) => {
  try {
    const session_id = Math.floor(1000 + Math.random() * 9000);
    const org_id = req.user.organization.toString();
    const threshold = Number(req.query.threshold || 40);

    // Get current date info
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11

    // Calculate previous month (current month - 1)
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    // Calculate previous-1 month (current month - 2)
    const prevPrevMonth = prevMonth === 1 ? 12 : prevMonth - 1;
    const prevPrevYear = prevMonth === 1 ? prevYear - 1 : prevYear;

    const companyQuery = `
     SELECT *
            FROM db${org_id}.companies 
    `;

    // Fetch all data for previous month (current month - 1)
    const prevMonthQuery = `
            SELECT *
            FROM db${org_id}.customer_score_view 
            WHERE year = ${prevYear} AND month = ${prevMonth}
        `;

    // Fetch all data for previous-1 month (current month - 2)
    const prevPrevMonthQuery = `
            SELECT *
            FROM db${org_id}.customer_score_view 
            WHERE year = ${prevPrevYear} AND month = ${prevPrevMonth}
        `;

    // Fetch churn risk trend data for all months of current year
    const trendQuery = `
            SELECT 
                month,
                COUNT(DISTINCT customer_id) as total_customers,
                COUNT(DISTINCT CASE WHEN churn_risk_score > ${threshold} THEN customer_id END) as high_risk_customers,
                AVG(churn_risk_score) as avg_churn_score,
                SUM(CASE WHEN churn_risk_score > ${threshold} THEN arr ELSE 0 END) as high_risk_arr
            FROM db${org_id}.customer_score_view 
            WHERE year = ${currentYear}
            GROUP BY month
            ORDER BY month ASC
        `;

    // Fetch risk matrix data for all customers
    const riskMatrixQuery = `
            SELECT *
            FROM db${org_id}.customer_score_view 
            WHERE churn_risk_score IS NOT NULL 
              AND renewal_date IS NOT NULL
              AND  year = ${prevPrevYear} AND month = ${prevPrevMonth}
            ORDER BY churn_risk_score DESC, renewal_date ASC
        `;

    // Helper function to execute SQL query with retry logic
    const executeSqlQueryWithRetry = async (
      query,
      queryName,
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

    console.log('Fetching previous month data...');
    const prevMonthResponse = await executeSqlQueryWithRetry(
      prevMonthQuery,
      'Previous Month Query'
    );

    const companyResponse = await executeSqlQueryWithRetry(
      companyQuery,
      'Company Query'
    );

    console.log('companyResponse', companyResponse);

    console.log('Fetching previous-1 month data...');
    const prevPrevMonthResponse = await executeSqlQueryWithRetry(
      prevPrevMonthQuery,
      'Previous-Previous Month Query'
    );

    console.log('Fetching churn risk trend data...');
    const trendResponse = await executeSqlQueryWithRetry(
      trendQuery,
      'Churn Risk Trend Query'
    );

    console.log('Fetching risk matrix data...');
    const riskMatrixResponse = await executeSqlQueryWithRetry(
      riskMatrixQuery,
      'Risk Matrix Query'
    );

    // Extract data from responses
    const prevMonthData = prevMonthResponse?.data?.result?.result_set || [];
    const prevPrevMonthData =
      prevPrevMonthResponse?.data?.result?.result_set || [];
    const trendData = trendResponse?.data?.result?.result_set || [];
    const riskMatrixData = riskMatrixResponse?.data?.result?.result_set || [];

    // renewal_date
    console.log(`Previous month records: ${prevMonthData.length}`);
    console.log(`Previous-1 month records: ${prevPrevMonthData.length}`);
    console.log(`Trend data months: ${trendData.length}`);
    console.log(`Risk matrix data customers: ${riskMatrixData.length}`);

    // Process trend data for the line chart
    const processTrendData = (monthlyData) => {
      if (!monthlyData || monthlyData.length === 0) return [];

      const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
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
            avgChurnScore:
              Math.round(Number(row.avg_churn_score || 0) * 100) / 100,
            highRiskARR: Math.round(Number(row.high_risk_arr || 0) * 100) / 100,
          });
        }
      });

      // Sort by month to ensure chronological order
      processedData.sort((a, b) => a.month - b.month);

      return processedData;
    };

    const trendAnalysis = processTrendData(trendData);

    // Process risk matrix data for scatter plot
    const processRiskMatrixData = (data) => {
      if (!data || data.length === 0)
        return {
          customers: [],
          riskDistribution: { critical: 0, high: 0, healthy: 0 },
        };

      const today = moment();
      const processedCustomers = [];
      let criticalCount = 0,
        highCount = 0,
        healthyCount = 0;

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
          customer_id: row.customer_id,
          customer_name: row.customer_name || row.company_name || 'N/A',
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

    const {
      customers: riskMatrixCustomers,
      riskDistribution: matrixRiskDistribution,
    } = processRiskMatrixData(riskMatrixData);

    // Custom logic to calculate statistics
    const calculateStats = (data) => {
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

      // Calculate total sum of churn risk scores for customers >70
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
          ? churnScores.reduce((sum, score) => sum + score, 0) /
            churnScores.length
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
        totalCustomers,
        highRiskCount,
        highRiskPercent: Math.round(highRiskPercent * 100) / 100, // Round to 2 decimal places
        avgChurnScore: Math.round(avgChurnScore * 100) / 100,
        totalHighRiskScore: Math.round(totalHighRiskScore * 100) / 100, // Round to 2 decimal places
        churnScores,
        churnRiskDistribution,
        revenueAtRisk: revenueAtRisk ? revenueAtRisk : null,
      };
    };

    // Calculate stats for both months
    const prevMonthStats = calculateStats(prevMonthData);
    const prevPrevMonthStats = calculateStats(prevPrevMonthData);

    // Get detailed list of high-risk customers from previous month
    const getHighRiskCustomerList = (data) => {
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
          customer_id: row.customer_id,
          customer_name: row.customer_name || row.company_name || 'N/A',
          churn_risk_score: score,
          renewal_days: renewalDate.diff(today, 'days') || 'N/A',
          monetary_value: row.monetary_value || row.contract_value || 'N/A',
          risk_level: riskLevel,
          arr: row.arr,
        };
      });
    };

    const highRiskCustomerList = getHighRiskCustomerList(prevMonthData);

    // Calculate percentage changes
    const calculatePercentageChange = (current, previous) => {
      if (previous === 0) return null;
      return Math.round(((current - previous) / previous) * 100 * 100) / 100; // Round to 2 decimal places
    };

    const highRiskCountPctChange = calculatePercentageChange(
      prevMonthStats.highRiskCount,
      prevPrevMonthStats.highRiskCount
    );
    const highRiskPercentPctChange = calculatePercentageChange(
      prevMonthStats.highRiskPercent,
      prevPrevMonthStats.highRiskPercent
    );
    const avgChurnScorePctChange = calculatePercentageChange(
      prevMonthStats.avgChurnScore,
      prevPrevMonthStats.avgChurnScore
    );
    const revenueAtRiskPctChange = calculatePercentageChange(
      prevMonthStats.revenueAtRisk,
      prevPrevMonthStats.revenueAtRisk
    );

    // Additional insights
    const riskDistribution = prevMonthStats.churnRiskDistribution;

    // Calculate trend summary
    const trendSummary = {
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

    return res.status(200).json({
      data: {
        threshold,
        previousMonth: {
          year: prevYear,
          month: prevMonth,
          ...prevMonthStats,
        },
        previousPreviousMonth: {
          year: prevPrevYear,
          month: prevPrevMonth,
          ...prevPrevMonthStats,
        },
        deltas: {
          highRiskCountPctChange,
          highRiskPercentPctChange,
          avgChurnScorePctChange,
          revenueAtRiskPctChange,
        },
        insights: {
          riskDistribution,
          totalRecordsProcessed: {
            previous: prevMonthData.length,
            previousPrevious: prevPrevMonthData.length,
          },
        },
        highRiskCustomers: highRiskCustomerList,
        trendData: trendAnalysis,
        trendSummary: trendSummary,
        chartConfig: {
          xAxis: {
            type: 'category',
            data: trendAnalysis.map((d) => d.monthName),
          },
          series: [
            {
              name: 'Average Churn Score',
              data: trendAnalysis.map((d) => d.avgChurnScore),
              yAxisIndex: 0,
            },
            {
              name: 'High Risk Customers (>60)',
              data: trendAnalysis.map((d) => d.highRiskCustomers),
              yAxisIndex: 0,
            },
            {
              name: 'High Risk ARR',
              data: trendAnalysis.map((d) => d.highRiskARR),
              yAxisIndex: 1,
            },
          ],
        },
        // Add risk matrix data
        riskMatrix: {
          totalCustomers: riskMatrixCustomers.length,
          customers: riskMatrixCustomers,
          riskDistribution: matrixRiskDistribution,
          chartConfig: {
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
                  .map((c) => [
                    c.days_to_renewal,
                    c.churn_risk_score,
                    c.customer_name,
                  ]),
                itemStyle: { color: '#FF0000' },
                symbolSize: 8,
              },
              {
                name: 'High',
                type: 'scatter',
                data: riskMatrixCustomers
                  .filter((c) => c.risk_level === 'High')
                  .map((c) => [
                    c.days_to_renewal,
                    c.churn_risk_score,
                    c.customer_name,
                  ]),
                itemStyle: { color: '#FFA500' },
                symbolSize: 8,
              },
              {
                name: 'Healthy',
                type: 'scatter',
                data: riskMatrixCustomers
                  .filter((c) => c.risk_level === 'Healthy')
                  .map((c) => [
                    c.days_to_renewal,
                    c.churn_risk_score,
                    c.customer_name,
                  ]),
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
          },
        },
      },
    });
  } catch (error) {
    console.error('Error computing high risk churn stats:', error);

    // Handle specific socket hang up and connection errors
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        message: 'Request timeout - SQL query took too long to execute',
        error: 'Gateway Timeout',
        suggestion: 'Try again or contact support if the issue persists',
      });
    } else if (error.code === 'ECONNRESET') {
      return res.status(503).json({
        message:
          'Connection reset - AI Agent Server connection was interrupted',
        error: 'Service Unavailable',
        suggestion: 'The server may be experiencing issues. Please try again.',
      });
    } else if (error.code === 'ENOTFOUND') {
      return res.status(502).json({
        message: 'AI Agent Server not found - Check server configuration',
        error: 'Bad Gateway',
        suggestion: 'Verify AI_AGENT_SERVER_URI environment variable',
      });
    } else if (error.code === 'ECONNREFUSED') {
      return res.status(502).json({
        message: 'AI Agent Server connection refused - Server may be down',
        error: 'Bad Gateway',
        suggestion: 'Check if the AI Agent Server is running and accessible',
      });
    }

    return res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
      suggestion: 'Please try again or contact support if the issue persists',
    });
  }
};
exports.getHighRiskChurnStats = async (req, res) => {
  try {
    const session_id = Math.floor(1000 + Math.random() * 9000);
    const org_id = req.user.organization.toString();
    const threshold = Number(req.query.threshold || 40);

    // Get current date info
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11

    // Calculate previous month (current month - 1)
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    // Calculate previous-1 month (current month - 2)
    const prevPrevMonth = prevMonth === 1 ? 12 : prevMonth - 1;
    const prevPrevYear = prevMonth === 1 ? prevYear - 1 : prevYear;

    const companyQuery = `
     SELECT *
            FROM db${org_id}.companies 
    `;

    // Fetch all data for previous month (current month - 1)
    const prevMonthQuery = `
            SELECT *
            FROM db${org_id}.customer_score_view 
            WHERE year = ${prevYear} AND month = ${prevMonth}
        `;

    // Fetch all data for previous-1 month (current month - 2)
    const prevPrevMonthQuery = `
            SELECT *
            FROM db${org_id}.customer_score_view 
            WHERE year = ${prevPrevYear} AND month = ${prevPrevMonth}
        `;

    // Fetch churn risk trend data for all months of current year
    const trendQuery = `
            SELECT 
                month,
                COUNT(DISTINCT customer_id) as total_customers,
                COUNT(DISTINCT CASE WHEN churn_risk_score > ${threshold} THEN customer_id END) as high_risk_customers,
                AVG(churn_risk_score) as avg_churn_score,
                SUM(CASE WHEN churn_risk_score > ${threshold} THEN arr ELSE 0 END) as high_risk_arr
            FROM db${org_id}.customer_score_view 
            WHERE year = ${currentYear}
            GROUP BY month
            ORDER BY month ASC
        `;

    // Fetch risk matrix data for all customers
    const riskMatrixQuery = `
            SELECT *
            FROM db${org_id}.customer_score_view 
            WHERE churn_risk_score IS NOT NULL 
              AND renewal_date IS NOT NULL
              AND  year = ${prevPrevYear} AND month = ${prevPrevMonth}
            ORDER BY churn_risk_score DESC, renewal_date ASC
        `;

    // Helper function to execute SQL query with retry logic
    const executeSqlQueryWithRetry = async (
      query,
      queryName,
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

    console.log('Fetching previous month data...');
    const prevMonthResponse = await executeSqlQueryWithRetry(
      prevMonthQuery,
      'Previous Month Query'
    );

    const companyResponse = await executeSqlQueryWithRetry(
      companyQuery,
      'Company Query'
    );

    console.log('companyResponse', companyResponse);

    console.log('Fetching previous-1 month data...');
    const prevPrevMonthResponse = await executeSqlQueryWithRetry(
      prevPrevMonthQuery,
      'Previous-Previous Month Query'
    );

    console.log('Fetching churn risk trend data...');
    const trendResponse = await executeSqlQueryWithRetry(
      trendQuery,
      'Churn Risk Trend Query'
    );

    console.log('Fetching risk matrix data...');
    const riskMatrixResponse = await executeSqlQueryWithRetry(
      riskMatrixQuery,
      'Risk Matrix Query'
    );

    // Extract data from responses
    const prevMonthData = prevMonthResponse?.data?.result?.result_set || [];
    const prevPrevMonthData =
      prevPrevMonthResponse?.data?.result?.result_set || [];
    const trendData = trendResponse?.data?.result?.result_set || [];
    const riskMatrixData = riskMatrixResponse?.data?.result?.result_set || [];
    const companyData = companyResponse?.data?.result?.result_set || [];

    // renewal_date
    console.log(`Previous month records: ${prevMonthData.length}`);
    console.log(`Previous-1 month records: ${prevPrevMonthData.length}`);
    console.log(`Trend data months: ${trendData.length}`);
    console.log(`Risk matrix data customers: ${riskMatrixData.length}`);

    // Process trend data for the line chart
    const processTrendData = (monthlyData) => {
      if (!monthlyData || monthlyData.length === 0) return [];

      const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
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
            avgChurnScore:
              Math.round(Number(row.avg_churn_score || 0) * 100) / 100,
            highRiskARR: Math.round(Number(row.high_risk_arr || 0) * 100) / 100,
          });
        }
      });

      // Sort by month to ensure chronological order
      processedData.sort((a, b) => a.month - b.month);

      return processedData;
    };

    const trendAnalysis = processTrendData(trendData);

    // Process risk matrix data for scatter plot
    const processRiskMatrixData = (data) => {
      if (!data || data.length === 0)
        return {
          customers: [],
          riskDistribution: { critical: 0, high: 0, healthy: 0 },
        };

      const today = moment();
      const processedCustomers = [];
      let criticalCount = 0,
        highCount = 0,
        healthyCount = 0;

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
          customer_id: row.customer_id,
          customer_name: row.customer_name || row.company_name || 'N/A',
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

    const {
      customers: riskMatrixCustomers,
      riskDistribution: matrixRiskDistribution,
    } = processRiskMatrixData(riskMatrixData);

    // Custom logic to calculate statistics
    const calculateStats = (data) => {
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

      // Calculate total sum of churn risk scores for customers >70
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
          ? churnScores.reduce((sum, score) => sum + score, 0) /
            churnScores.length
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
        totalCustomers,
        highRiskCount,
        highRiskPercent: Math.round(highRiskPercent * 100) / 100, // Round to 2 decimal places
        avgChurnScore: Math.round(avgChurnScore * 100) / 100,
        totalHighRiskScore: Math.round(totalHighRiskScore * 100) / 100, // Round to 2 decimal places
        churnScores,
        churnRiskDistribution,
        revenueAtRisk: revenueAtRisk ? revenueAtRisk : null,
      };
    };

    // Calculate stats for both months
    const prevMonthStats = calculateStats(prevMonthData);
    const prevPrevMonthStats = calculateStats(prevPrevMonthData);

    // Get detailed list of high-risk customers from previous month
    const getHighRiskCustomerList = (data) => {
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
          customer_id: row.customer_id,
          customer_name: row.customer_name || row.company_name || 'N/A',
          churn_risk_score: score,
          renewal_days: renewalDate.diff(today, 'days') || 'N/A',
          monetary_value: row.monetary_value || row.contract_value || 'N/A',
          risk_level: riskLevel,
          arr: row.arr,
        };
      });
    };

    const highRiskCustomerList = getHighRiskCustomerList(prevMonthData);

    // Calculate percentage changes
    const calculatePercentageChange = (current, previous) => {
      if (previous === 0) return null;
      return Math.round(((current - previous) / previous) * 100 * 100) / 100; // Round to 2 decimal places
    };

    const highRiskCountPctChange = calculatePercentageChange(
      prevMonthStats.highRiskCount,
      prevPrevMonthStats.highRiskCount
    );
    const highRiskPercentPctChange = calculatePercentageChange(
      prevMonthStats.highRiskPercent,
      prevPrevMonthStats.highRiskPercent
    );
    const avgChurnScorePctChange = calculatePercentageChange(
      prevMonthStats.avgChurnScore,
      prevPrevMonthStats.avgChurnScore
    );
    const revenueAtRiskPctChange = calculatePercentageChange(
      prevMonthStats.revenueAtRisk,
      prevPrevMonthStats.revenueAtRisk
    );

    // Additional insights
    const riskDistribution = prevMonthStats.churnRiskDistribution;

    // Calculate trend summary
    const trendSummary = {
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

    return res.status(200).json({
      data: {
        threshold,
        previousMonth: {
          year: prevYear,
          month: prevMonth,
          ...prevMonthStats,
        },
        previousPreviousMonth: {
          year: prevPrevYear,
          month: prevPrevMonth,
          ...prevPrevMonthStats,
        },
        deltas: {
          highRiskCountPctChange,
          highRiskPercentPctChange,
          avgChurnScorePctChange,
          revenueAtRiskPctChange,
        },
        insights: {
          riskDistribution,
          totalRecordsProcessed: {
            previous: prevMonthData.length,
            previousPrevious: prevPrevMonthData.length,
          },
        },
        highRiskCustomers: highRiskCustomerList,
        trendData: trendAnalysis,
        trendSummary: trendSummary,
        chartConfig: {
          xAxis: {
            type: 'category',
            data: trendAnalysis.map((d) => d.monthName),
          },
          series: [
            {
              name: 'Average Churn Score',
              data: trendAnalysis.map((d) => d.avgChurnScore),
              yAxisIndex: 0,
            },
            {
              name: 'High Risk Customers (>60)',
              data: trendAnalysis.map((d) => d.highRiskCustomers),
              yAxisIndex: 0,
            },
            {
              name: 'High Risk ARR',
              data: trendAnalysis.map((d) => d.highRiskARR),
              yAxisIndex: 1,
            },
          ],
        },
        // Add risk matrix data
        riskMatrix: {
          totalCustomers: riskMatrixCustomers.length,
          customers: riskMatrixCustomers,
          riskDistribution: matrixRiskDistribution,
          chartConfig: {
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
                  .map((c) => [
                    c.days_to_renewal,
                    c.churn_risk_score,
                    c.customer_name,
                  ]),
                itemStyle: { color: '#FF0000' },
                symbolSize: 8,
              },
              {
                name: 'High',
                type: 'scatter',
                data: riskMatrixCustomers
                  .filter((c) => c.risk_level === 'High')
                  .map((c) => [
                    c.days_to_renewal,
                    c.churn_risk_score,
                    c.customer_name,
                  ]),
                itemStyle: { color: '#FFA500' },
                symbolSize: 8,
              },
              {
                name: 'Healthy',
                type: 'scatter',
                data: riskMatrixCustomers
                  .filter((c) => c.risk_level === 'Healthy')
                  .map((c) => [
                    c.days_to_renewal,
                    c.churn_risk_score,
                    c.customer_name,
                  ]),
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
          },
        },
      },
    });
  } catch (error) {
    console.error('Error computing high risk churn stats:', error);

    // Handle specific socket hang up and connection errors
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        message: 'Request timeout - SQL query took too long to execute',
        error: 'Gateway Timeout',
        suggestion: 'Try again or contact support if the issue persists',
      });
    } else if (error.code === 'ECONNRESET') {
      return res.status(503).json({
        message:
          'Connection reset - AI Agent Server connection was interrupted',
        error: 'Service Unavailable',
        suggestion: 'The server may be experiencing issues. Please try again.',
      });
    } else if (error.code === 'ENOTFOUND') {
      return res.status(502).json({
        message: 'AI Agent Server not found - Check server configuration',
        error: 'Bad Gateway',
        suggestion: 'Verify AI_AGENT_SERVER_URI environment variable',
      });
    } else if (error.code === 'ECONNREFUSED') {
      return res.status(502).json({
        message: 'AI Agent Server connection refused - Server may be down',
        error: 'Bad Gateway',
        suggestion: 'Check if the AI Agent Server is running and accessible',
      });
    }

    return res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
      suggestion: 'Please try again or contact support if the issue persists',
    });
  }
};

exports.fetchCustomerDetailsFromRedshift = async (req, res) => {
  try {
    const session_id = Math.floor(1000 + Math.random() * 9000);
    const org_id = req.user.organization.toString();
    const sql_query = `SELECT * from  db${org_id}.companies`;
    let url =
      process.env.AI_AGENT_SERVER_URI +
      `/run-sql-query?sql_query=${sql_query}&session_id=${session_id}&org_id=${org_id}`;
    console.log('url', url);
    const response = await axiosInstance.post(
      url,
      {},
      {
        timeout: 300000, // 5 minutes
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );
    if (response?.data?.error) {
      res
        .status(500)
        .json({ message: response?.data?.error, error: response?.data?.error });
      return;
    }
    res.status(200).json({ data: response.data.result.result_set });
  } catch (err) {
    console.log('Err', err);
    res.status(500).json({ message: 'Internal Server Error', err });
  }
};

exports.getCustomerFeatures = async (req, res) => {
  try {
    const { customer_id, updated_date, created_date } = req.query;
    let filter = { feature: { $not: { $regex: /^login$/i } } };
    if (customer_id) {
      filter.customer = customer_id;
    }
    if (req.externalApiCall && req.organization) {
      filter.organization = req.organization;
    }
    if (updated_date) {
      const filterDate = new Date(updated_date);
      filterDate.setHours(0, 0, 0, 0); // Ensure it starts from midnight
      filter['updatedAt'] = { $gt: filterDate };
    }
    if (created_date) {
      const filterDate = new Date(created_date);
      filterDate.setHours(0, 0, 0, 0); // Ensure it starts from midnight
      searchCondition['createdAt'] = { $gt: filterDate };
    }
    const customerLoginDetails = await CustomerFeature.find(filter);
    res.status(200).json({ data: customerLoginDetails });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error });
  }
};

exports.getAllCustomers = async (req, res) => {
  try {
    const { updated_date, created_date } = req.query;
    let filter = {};

    if (req.externalApiCall && req.organization) {
      filter.organization = req.organization;
    }

    if (updated_date) {
      const filterDate = new Date(updated_date);
      filterDate.setHours(0, 0, 0, 0); // Ensure it starts from midnight
      filter['updatedAt'] = { $gt: filterDate };
    }

    if (created_date) {
      const filterDate = new Date(created_date);
      filterDate.setHours(0, 0, 0, 0); // Ensure it starts from midnight
      filter['createdAt'] = { $gt: filterDate };
    }

    const customers = await Customer.find(filter);
    res.status(200).json({ data: customers });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error });
  }
};
