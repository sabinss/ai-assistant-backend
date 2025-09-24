const Customer = require('../models/Customer');
const CustomerFeature = require('../models/CustomerFeature');
const axios = require('axios');
const moment = require('moment');

const {
  calculateDateRanges,
  generateSqlQueries,
  executeSqlQueryWithRetry,
  executeSqlQueryWithMonitoring,
  executeParallelQueriesWithMonitoring,
  processTrendData,
  processRiskMatrixData,
  calculateStats,
  getHighRiskCustomerList,
  calculatePercentageChange,
  calculateTrendSummary,
  generateRiskMatrixChartConfig,
  handleChurnStatsError,
} = require('../helper/churnStatsHelper');


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

    const appCompanyId = optionalFields?.app_company_id;
    // Build query condition dynamically
    const query = {
      name: { $regex: new RegExp(`^${name}$`, 'i') }, // case-insensitive
      organization,
    };
    if (appCompanyId) {
      query.app_company_id = appCompanyId;
    }

    // Check if customer already exists for the same organization (case-insensitive)
    const existingCustomer = await Customer.findOne(query);

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
      csm_cust_id: optionalFields?.csm_cust_id
        ? optionalFields?.csm_cust_id.toString()
        : '',
      help_desk_cust_id: optionalFields?.help_desk_cust_id
        ? optionalFields?.help_desk_cust_id.toString()
        : '',
      app_company_id: optionalFields?.app_company_id
        ? optionalFields?.app_company_id.toString()
        : '',
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
    return res.status(200).json({ data: uniqueData });
  } catch (error) {
    console.error('Error fetching customer score details:', error);
    return res.status(500).json({ message: 'Internal Server Error', error });
  }
};

exports.getHighRiskChurnStats = async (req, res) => {
  try {
    // Initialize basic parameters
    const session_id = Math.floor(1000 + Math.random() * 9000);
    const org_id = req.user.organization.toString();
    const threshold = Number(req.query.threshold || 40);

    // Calculate date ranges
    const dateRanges = calculateDateRanges();
    const { prevYear, prevMonth, prevPrevYear, prevPrevMonth } = dateRanges;

    // Generate SQL queries
    const queries = generateSqlQueries(org_id, threshold, dateRanges);

    // Monitoring configuration
    const monitoringOptions = {
      enableMonitoring: true,
      timeoutThreshold: 50, // 50 seconds
      emailRecipients: process.env.ADMIN_EMAIL,
      enableEmailAlerts: true,
    };

    // Execute all queries in parallel with monitoring
    console.log('🔄 Executing SQL queries with monitoring...');
    const queryObjects = [
      { query: queries.prevMonthQuery, queryName: 'Previous Month Query' },
      { query: queries.scoreDashboardQuery, queryName: 'Score Dashboard Query' },
      { query: queries.companyQuery, queryName: 'Company Query' },
      { query: queries.prevPrevMonthQuery, queryName: 'Previous-Previous Month Query' },
      { query: queries.trendQuery, queryName: 'Churn Risk Trend Query' },
      { query: queries.riskMatrixQuery, queryName: 'Risk Matrix Query' },
    ];

    const results = await executeParallelQueriesWithMonitoring(
      queryObjects,
      session_id,
      org_id,
      monitoringOptions
    );

    // Extract successful results
    const [
      prevMonthResponse,
      scoreDashboardResponse,
      companyResponse,
      prevPrevMonthResponse,
      trendResponse,
      riskMatrixResponse,
    ] = results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value.result;
      } else {
        console.error('Query failed:', result.reason);
        throw result.reason.error;
      }
    });

    // Extract data from responses with null safety
    const prevMonthData = prevMonthResponse?.data?.result?.result_set || [];
    const prevPrevMonthData = prevPrevMonthResponse?.data?.result?.result_set || [];
    const trendData = trendResponse?.data?.result?.result_set || [];
    const riskMatrixData = riskMatrixResponse?.data?.result?.result_set || [];
    const companyData = companyResponse?.data?.result?.result_set || [];
    const scoreDashboardData = scoreDashboardResponse?.data?.result?.result_set?.[0] || null;

    // Log data counts for debugging
    console.log('📊 Data Summary:');
    console.log('  Previous month records: ' + prevMonthData.length);
    console.log('  Previous-1 month records: ' + prevPrevMonthData.length);
    console.log('  Trend data months: ' + trendData.length);
    console.log('  Risk matrix data customers: ' + riskMatrixData.length);
    console.log('  Company data records: ' + companyData.length);

    // Process data using helper functions
    const trendAnalysis = processTrendData(trendData);
    const { customers: riskMatrixCustomers, riskDistribution: matrixRiskDistribution } = 
      processRiskMatrixData(companyData);

    // Calculate statistics for both months
    const prevMonthStats = calculateStats(companyData, threshold, scoreDashboardData);
    const prevPrevMonthStats = calculateStats(prevPrevMonthData, threshold);

    // Get high-risk customer list
    const highRiskCustomerList = getHighRiskCustomerList(companyData, threshold);

    // Calculate percentage changes
    const deltas = {
      highRiskCountPctChange: calculatePercentageChange(
        prevMonthStats.highRiskCount,
        prevPrevMonthStats.highRiskCount
      ),
      highRiskPercentPctChange: calculatePercentageChange(
        prevMonthStats.highRiskPercent,
        prevPrevMonthStats.highRiskPercent
      ),
      avgChurnScorePctChange: calculatePercentageChange(
        prevMonthStats.avgChurnScore,
        prevPrevMonthStats.avgChurnScore
      ),
      revenueAtRiskPctChange: calculatePercentageChange(
        prevMonthStats.revenueAtRisk,
        prevPrevMonthStats.revenueAtRisk
      ),
    };

    // Calculate trend summary
    const trendSummary = calculateTrendSummary(trendAnalysis);

    // Generate chart configurations
    const chartConfig = {
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
    };

    const riskMatrixChartConfig = generateRiskMatrixChartConfig(riskMatrixCustomers);

    // Build response object
    const responseData = {
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
      deltas,
      insights: {
        riskDistribution: prevMonthStats.churnRiskDistribution,
        totalRecordsProcessed: {
          previous: prevMonthData.length,
          previousPrevious: prevPrevMonthData.length,
        },
      },
      highRiskCustomers: highRiskCustomerList,
      trendData: trendAnalysis,
      trendSummary,
      chartConfig,
      riskMatrix: {
        totalCustomers: riskMatrixCustomers.length,
        customers: riskMatrixCustomers,
        riskDistribution: matrixRiskDistribution,
        chartConfig: riskMatrixChartConfig,
      },
    };

    console.log('✅ Churn stats calculation completed successfully');
    return res.status(200).json({ data: responseData });

  } catch (error) {
    console.error('❌ Error in getHighRiskChurnStats:', error);
    const errorResponse = handleChurnStatsError(error);
    return res.status(errorResponse.status).json(errorResponse.response);
  }
};


exports.fetchCustomerDetailsFromRedshift = async (req, res) => {
  try {
    const session_id = Math.floor(1000 + Math.random() * 9000);
    const org_id = req.user.organization.toString();

    const totalCustomerQuery = `
      SELECT
          * 
      FROM db${org_id}.customer_score_dashboard;
        `;

    //pagination
    const search = req.query.search || '';
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const offset = (page - 1) * limit;

    // Validate pagination parameters
    if (page < 1) {
      return res.status(400).json({
        message: 'Page number must be greater than 0',
      });
    }

    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        message: 'Limit must be between 1 and 100',
      });
    }

    // Get total count for pagination metadata
    // const countQuery = `SELECT COUNT(*) as total FROM db${org_id}.companies`;
    const countQuery = `SELECT COUNT(*) as total FROM db${org_id}.active_companies`;
    const countUrl =
      process.env.AI_AGENT_SERVER_URI +
      `/run-sql-query?sql_query=${encodeURIComponent(
        countQuery
      )}&session_id=${session_id}&org_id=${org_id}`;

    const totalCustomerUrl =
      process.env.AI_AGENT_SERVER_URI +
      `/run-sql-query?sql_query=${encodeURIComponent(
        totalCustomerQuery
      )}&session_id=${session_id}&org_id=${org_id}`;

    console.log('Count URL:', countUrl);

    const countResponse = await axiosInstance.post(
      countUrl,
      {},
      {
        timeout: 300000, // 5 minutes
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    const totalCustomerResponse = await axiosInstance.post(
      totalCustomerUrl,
      {},
      {
        timeout: 300000, // 5 minutes
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    console.log('totalCustomerResponse', totalCustomerResponse);

    if (totalCustomerResponse?.data?.error) {
      return res.status(500).json({
        message: totalCustomerResponse?.data?.error,
        error: totalCustomerResponse?.data?.error,
      });
    }

    if (countResponse?.data?.error) {
      return res.status(500).json({
        message: countResponse?.data?.error,
        error: countResponse?.data?.error,
      });
    }
    // const totalCustomerData = totalCustomerResponse.data.result.result_set[0];
    const totalCustomerData =
      totalCustomerResponse?.data?.result?.result_set?.[0] ?? null;
    console.log('totalCustomerData', totalCustomerData);
    const totalRecords = countResponse.data.result.result_set[0]?.total || 0;
    const totalPages = Math.ceil(totalRecords / limit);

    // Main data query with pagination
    let base_query = `SELECT * FROM db${org_id}.active_companies`;
    let sql_query = '';
    if (search) {
      sql_query =
        base_query +
        ` WHERE name ILIKE '%${search}%'` +
        `LIMIT ${limit} OFFSET ${offset}`;
    } else {
      sql_query = `${base_query} LIMIT ${limit} OFFSET ${offset}`;
    }
    const url =
      process.env.AI_AGENT_SERVER_URI +
      `/run-sql-query?sql_query=${encodeURIComponent(
        sql_query
      )}&session_id=${session_id}&org_id=${org_id}`;
    console.log('Data URL:', url);
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
    const data = response.data.result.result_set || [];
    // Pagination metadata
    const pagination = {
      currentPage: page,
      totalPages: totalPages,
      totalRecords: totalRecords,
      limit: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
    };
    const formattedData = data.map((item) => ({
      ...item,
      churn_risk_score: Math.trunc(Number(item.churn_risk_score)),
      health_score: Math.trunc(Number(item.health_score)),
    }));
    res.status(200).json({
      data: formattedData,
      scoreDashboardData: totalCustomerData,
      pagination,
    });
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
