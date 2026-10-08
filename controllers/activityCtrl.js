const axios = require("axios");
const http = require("http");
const https = require("https");
const AgentModel = require("../models/AgentModel");

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 60000,
});
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 60000,
});

const axiosInstance = axios.create({
  timeout: 60000,
  maxRedirects: 5,
  httpAgent,
  httpsAgent,
  validateStatus: (status) => status >= 200 && status < 300,
});

const escapeSqlLiteral = (value) => String(value).replace(/'/g, "''");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getSqlErrorMessage = (error) => {
  const sqlBody = error?.response?.data;
  const metadataError = sqlBody?.result?.metadata?.error;
  if (metadataError) return metadataError;
  if (sqlBody?.detail) {
    return typeof sqlBody.detail === "string" ? sqlBody.detail : JSON.stringify(sqlBody.detail);
  }
  if (sqlBody?.error)
    return typeof sqlBody.error === "string" ? sqlBody.error : JSON.stringify(sqlBody.error);
  if (sqlBody?.message) return sqlBody.message;
  if (error?.code === "ECONNREFUSED") {
    return `Cannot reach AI_AGENT_SERVER_URI (${process.env.AI_AGENT_SERVER_URI || "not set"}). SQL service is not running or the URL is missing a port.`;
  }
  return error?.message || "Unknown SQL error";
};

const isTransientSqlError = (error) => {
  const message = `${getSqlErrorMessage(error)} ${error?.code || ""}`;
  return /too many open files|Max retries exceeded|ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up/i.test(
    message
  );
};

const runOrgSqlQuery = async (org_id, sql_query) => {
  const session_id = Math.floor(1000 + Math.random() * 9000);
  const baseUri = process.env.AI_AGENT_SERVER_URI;
  if (!baseUri) {
    throw new Error("AI_AGENT_SERVER_URI is not configured");
  }

  const url =
    baseUri +
    `/run-sql-query?sql_query=${encodeURIComponent(
      sql_query
    )}&session_id=${session_id}&org_id=${org_id}`;

  const maxAttempts = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axiosInstance.post(url, {}, { timeout: 60000 });
      const result = response?.data?.result;
      if (result?.metadata?.status === "error" || result?.metadata?.status === "FAILED") {
        throw new Error(result?.metadata?.error || result?.metadata?.message || "SQL query failed");
      }
      return result?.result_set ?? [];
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts && isTransientSqlError(error)) {
        const waitMs = 1500 * attempt;
        console.warn(
          `ActivityCtrl SQL attempt ${attempt}/${maxAttempts} failed (will retry in ${waitMs}ms):`,
          getSqlErrorMessage(error)
        );
        await sleep(waitMs);
        continue;
      }
      if (error?.response?.data) {
        console.error("ActivityCtrl SQL error body:", JSON.stringify(error.response.data));
      }
      throw new Error(getSqlErrorMessage(error));
    }
  }

  throw new Error(getSqlErrorMessage(lastError));
};

const parsePagination = (req, defaultLimit = 10) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || defaultLimit;
  if (page < 1) {
    return { error: "Page number must be greater than 0" };
  }
  if (limit < 1 || limit > 100) {
    return { error: "Limit must be between 1 and 100" };
  }
  return { page, limit, offset: (page - 1) * limit };
};

const buildPagination = (page, limit, totalRecords) => {
  const totalPages = Math.ceil(totalRecords / limit);
  return {
    currentPage: page,
    totalPages,
    totalRecords,
    limit,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    nextPage: page < totalPages ? page + 1 : null,
    prevPage: page > 1 ? page - 1 : null,
  };
};

/**
 * GET /activity/company
 * Distinct outbound SMS recipients / companies for the org.
 */
exports.getActivityCompanies = async (req, res) => {
  try {
    if (!req.user?.organization) {
      return res.status(400).json({ message: "Organization id required" });
    }

    const { error, page, limit, offset } = parsePagination(req);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const org_id = req.user.organization.toString();

    const flagFilters = ["has_inbound_message", "need_reply", "handed_off"].filter(
      (flag) => String(req.query[flag]).toLowerCase() === "true"
    );

    if (flagFilters.length > 0) {
      const whereClause = flagFilters.map((flag) => `${flag} = TRUE`).join(" AND ");
      const flagDataQuery = `SELECT * FROM db${org_id}.sms_activities WHERE ${whereClause} LIMIT ${limit} OFFSET ${offset}`;
      const flagCountQuery = `SELECT COUNT(*) AS total FROM db${org_id}.sms_activities WHERE ${whereClause}`;

      const [flagResultSet, flagCountResultSet] = await Promise.all([
        runOrgSqlQuery(org_id, flagDataQuery),
        runOrgSqlQuery(org_id, flagCountQuery),
      ]);

      const flagTotal = parseInt(flagCountResultSet?.[0]?.total, 10) || 0;

      return res.status(200).json({
        data: Array.isArray(flagResultSet) ? flagResultSet : [],
        pagination: buildPagination(page, limit, flagTotal),
      });
    }

    const groupedQuery = `
 SELECT
    m.company_id,
    m.company_name,
    d.dealstage,
    c.phone_number AS "to",
    d.dealname,
    d.deal_id,
    d.handed_off,
    MAX(m.updated_at) AS latest_updated_at,
    case when d.dealstage in ('booking_req','got_symptoms','insurance_qns','billing_qns','got_issue') then true end as Need_Reply,
    BOOL_OR(m.direction = 'inbound') AS has_inbound_message
FROM db${org_id}.messages m
JOIN db${org_id}.companies c
    ON c.company_id = m.company_id
JOIN db${org_id}.deals d
    ON d.company_id = m.company_id
WHERE m."type" = 'SMS'
  AND d.dealstage NOT IN ('Skipped', 'Open')
GROUP BY
    m.company_id,
    m.company_name,
    d.dealstage,
    c.phone_number,
    d.deal_id,
    d.dealname,
    d.handed_off
    `;

    const dataQuery = `${groupedQuery}
ORDER BY latest_updated_at DESC NULLS last
LIMIT ${limit} OFFSET ${offset}`;

    const countQuery = `SELECT COUNT(*) AS total FROM (${groupedQuery}) AS activity_companies`;

    const [resultSet, countResultSet] = await Promise.all([
      runOrgSqlQuery(org_id, dataQuery),
      runOrgSqlQuery(org_id, countQuery),
    ]);

    const totalRecords = parseInt(countResultSet?.[0]?.total, 10) || 0;

    return res.status(200).json({
      data: Array.isArray(resultSet) ? resultSet : [],
      pagination: buildPagination(page, limit, totalRecords),
    });
  } catch (error) {
    console.error("Error fetching activity companies:", error.message);
    return res.status(500).json({
      message: "Failed to fetch activity companies",
      error: error.message,
    });
  }
};

/**
 * GET /activity/count
 * Aggregate counts for the org's SMS activities.
 */
exports.getActivityCount = async (req, res) => {
  try {
    if (!req.user?.organization) {
      return res.status(400).json({ message: "Organization id required" });
    }

    const org_id = req.user.organization.toString();

    const countQuery = `
      SELECT
        count(*) AS total_cnt,
        count(*) FILTER (WHERE handed_off) AS total_handed_off_cnt,
        count(*) FILTER (WHERE need_reply) AS total_need_reply_cnt,
        count(*) FILTER (WHERE has_inbound_message) AS total_has_inbound_msg_cnt
      FROM db${org_id}.sms_activities
    `;

    const resultSet = await runOrgSqlQuery(org_id, countQuery);
    const row = resultSet?.[0] || {};

    return res.status(200).json({
      total_cnt: parseInt(row.total_cnt, 10) || 0,
      total_handed_off_cnt: parseInt(row.total_handed_off_cnt, 10) || 0,
      total_need_reply_cnt: parseInt(row.total_need_reply_cnt, 10) || 0,
      total_has_inbound_msg_cnt: parseInt(row.total_has_inbound_msg_cnt, 10) || 0,
    });
  } catch (error) {
    console.error("Error fetching activity count:", error.message);
    return res.status(500).json({
      message: "Failed to fetch activity count",
      error: error.message,
    });
  }
};

/**
 * POST /activity/company/archive
 * Forwards archive flag update to agentic AI /deals/archive
 * Body: deal_id, dealname, dealstage, company_id, archive
 */
exports.updateCompanyArchive = async (req, res) => {
  try {
    if (!req.user?.organization) {
      return res.status(400).json({ message: "Organization id required" });
    }

    const { deal_id, dealname, dealstage, company_id, archive } = req.body || {};

    if (
      deal_id == null ||
      dealname == null ||
      dealstage == null ||
      company_id == null ||
      typeof archive !== "boolean"
    ) {
      return res.status(400).json({
        message: "deal_id, dealname, dealstage, company_id, and archive (boolean) are required",
      });
    }

    const baseUri = process.env.AI_AGENT_SERVER_URI;
    if (!baseUri) {
      return res.status(500).json({ message: "AI_AGENT_SERVER_URI is not configured" });
    }

    const tenant_id = req.user.organization.toString();
    const payload = {
      tenant_id,
      deal_id,
      dealname,
      dealstage,
      company_id,
      archive,
    };

    const url = `${baseUri}/deals/archive`;
    console.log("Update company archive", url);
    console.log("Payload", payload);
    const response = await axiosInstance.post(url, payload, {
      timeout: 60000,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
    });

    return res.status(200).json({
      message: "Company archive updated successfully",
      data: response?.data ?? null,
      success: true,
    });
  } catch (error) {
    const details = getSqlErrorMessage(error);
    console.error("Error updating company archive:", details);
    if (error?.response?.data) {
      console.error("Archive API error body:", JSON.stringify(error.response.data));
    }
    return res.status(error?.response?.status || 500).json({
      message: "Failed to update company archive",
      error: details,
      success: false,
    });
  }
};

/**
 * POST /activity/call/sms
 * Body: { message, phoneNumber }
 * Find org's Send_SMS agent and trigger /ask/agent with message + to query params
 */
exports.triggerSendSmsAgent = async (req, res) => {
  try {
    if (!req.user?.organization) {
      return res.status(400).json({ message: "Organization id required" });
    }

    const { message, phoneNumber } = req.body || {};
    if (!message || !phoneNumber) {
      return res.status(400).json({
        message: "message and phoneNumber are required",
      });
    }

    const org_id = req.user.organization.toString();
    const agent = await AgentModel.findOne({
      organization: org_id,
      isAgent: true,
      active: true,
      name: { $regex: /^send[_\s-]?sms$/i },
    });

    if (!agent) {
      return res.status(404).json({
        message: "Send_SMS agent not found for this organization",
      });
    }

    const session_id = Math.floor(100000 + Math.random() * 900000);
    const agent_name = encodeURIComponent(agent.name);
    const pythonServerUri =
      `${process.env.AI_AGENT_SERVER_URI}/ask/agent` +
      `?agent_name=${agent_name}` +
      `&org_id=${org_id}` +
      `&query='run'` +
      `&session_id=${session_id}` +
      `&message=${encodeURIComponent(message)}` +
      `&to=${encodeURIComponent(phoneNumber)}`;

    console.log("Triggering Send_SMS agent:", pythonServerUri);
    axios.get(pythonServerUri).catch((err) => {
      console.error("Send_SMS agent API call failed:", err?.response?.data || err.message);
    });

    return res.status(200).json({
      message: "Agent triggered successfully",
      agent: {
        _id: agent._id,
        name: agent.name,
      },
      session_id,
      success: true,
    });
  } catch (error) {
    console.error("Error triggering Send_SMS agent:", error.message);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
      success: false,
    });
  }
};

/**
 * GET /activity/company/customer/:id
 * Fetch company row from companies table by company_id
 */
exports.getActivityCompanyCustomer = async (req, res) => {
  try {
    if (!req.user?.organization) {
      return res.status(400).json({ message: "Organization id required" });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "company id is required" });
    }

    const org_id = req.user.organization.toString();
    const companyId = escapeSqlLiteral(id);
    const sql_query = `
      SELECT * FROM db${org_id}.companies
      WHERE company_id = '${companyId}'
    `;

    const resultSet = await runOrgSqlQuery(org_id, sql_query);
    return res.status(200).json({
      data: Array.isArray(resultSet) ? resultSet : [],
    });
  } catch (error) {
    console.error("Error fetching activity company customer:", error.message);
    return res.status(500).json({
      message: "Failed to fetch activity company customer",
      error: error.message,
    });
  }
};

/**
 * GET /activity/company/:inside
 * Same query filtered by company_id = :inside
 */
exports.getActivityCompanyById = async (req, res) => {
  try {
    if (!req.user?.organization) {
      return res.status(400).json({ message: "Organization id required" });
    }

    const { inside } = req.params;
    if (!inside) {
      return res.status(400).json({ message: "company id (inside) is required" });
    }

    const { error, page, limit, offset } = parsePagination(req);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const org_id = req.user.organization.toString();
    const companyId = escapeSqlLiteral(inside);

    const whereClause = `m."type" = 'SMS' AND m.company_id = '${companyId}'`;
    const dataQuery = `
      SELECT * FROM db${org_id}.messages m
      WHERE ${whereClause}
      ORDER BY m.updated_at ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const countQuery = `SELECT COUNT(*) AS total FROM db${org_id}.messages m WHERE ${whereClause}`;

    const [resultSet, countResultSet] = await Promise.all([
      runOrgSqlQuery(org_id, dataQuery),
      runOrgSqlQuery(org_id, countQuery),
    ]);

    const totalRecords = parseInt(countResultSet?.[0]?.total, 10) || 0;

    return res.status(200).json({
      data: Array.isArray(resultSet) ? resultSet : [],
      pagination: buildPagination(page, limit, totalRecords),
    });
  } catch (error) {
    console.error("Error fetching activity company by id:", error.message);
    return res.status(500).json({
      message: "Failed to fetch activity company messages",
      error: error.message,
    });
  }
};

/**
 * GET /activity/email
 * Rows from email_activities for the org (paginated).
 */
exports.getActivityEmails = async (req, res) => {
  try {
    if (!req.user?.organization) {
      return res.status(400).json({ message: "Organization id required" });
    }

    const { error, page, limit, offset } = parsePagination(req);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const org_id = req.user.organization.toString();

    const baseQuery = `SELECT * FROM db${org_id}.email_activities`;
    const dataQuery = `${baseQuery} LIMIT ${limit} OFFSET ${offset}`;
    const countQuery = `SELECT COUNT(*) AS total FROM db${org_id}.email_activities`;

    const [resultSet, countResultSet] = await Promise.all([
      runOrgSqlQuery(org_id, dataQuery),
      runOrgSqlQuery(org_id, countQuery),
    ]);

    const totalRecords = parseInt(countResultSet?.[0]?.total, 10) || 0;

    return res.status(200).json({
      data: Array.isArray(resultSet) ? resultSet : [],
      pagination: buildPagination(page, limit, totalRecords),
    });
  } catch (error) {
    console.error("Error fetching activity emails:", error.message);
    return res.status(500).json({
      message: "Failed to fetch activity emails",
      error: error.message,
    });
  }
};

/**
 * GET /activity/email/:inside
 * Email messages filtered by company_id = :inside
 */
exports.getActivityEmailById = async (req, res) => {
  try {
    if (!req.user?.organization) {
      return res.status(400).json({ message: "Organization id required" });
    }

    const { inside } = req.params;
    if (!inside) {
      return res.status(400).json({ message: "company id (inside) is required" });
    }

    const { error, page, limit, offset } = parsePagination(req);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const org_id = req.user.organization.toString();
    const companyId = escapeSqlLiteral(inside);

    const whereClause = `m."type" = 'Email' AND m.company_id = '${companyId}'`;
    const dataQuery = `
      SELECT * FROM db${org_id}.messages m
      WHERE ${whereClause}
      ORDER BY m.updated_at ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const countQuery = `SELECT COUNT(*) AS total FROM db${org_id}.messages m WHERE ${whereClause}`;

    const [resultSet, countResultSet] = await Promise.all([
      runOrgSqlQuery(org_id, dataQuery),
      runOrgSqlQuery(org_id, countQuery),
    ]);

    const totalRecords = parseInt(countResultSet?.[0]?.total, 10) || 0;

    return res.status(200).json({
      data: Array.isArray(resultSet) ? resultSet : [],
      pagination: buildPagination(page, limit, totalRecords),
    });
  } catch (error) {
    console.error("Error fetching activity email by id:", error.message);
    return res.status(500).json({
      message: "Failed to fetch activity email messages",
      error: error.message,
    });
  }
};
