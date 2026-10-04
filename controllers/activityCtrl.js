const axios = require("axios");
const http = require("http");
const https = require("https");

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
  if (sqlBody?.error) return typeof sqlBody.error === "string" ? sqlBody.error : JSON.stringify(sqlBody.error);
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

    const groupedQuery = `
      SELECT
          m.company_id,
          m.company_name,
          d.dealstage,
          m."to" ,
          MAX(m.updated_at) AS latest_updated_at
      FROM db${org_id}.messages m
      JOIN db${org_id}.deals d
          ON d.company_id = m.company_id
      WHERE m."type" = 'SMS'
        AND m.direction = 'outbound'
        AND d.dealstage NOT IN ('Skipped', 'Open')
      GROUP BY m.company_id, m.company_name, d.dealstage, m."to"
    `;

    const dataQuery = `${groupedQuery} ORDER BY latest_updated_at DESC LIMIT ${limit} OFFSET ${offset};`;
    const countQuery = `SELECT COUNT(*) AS total FROM (${groupedQuery}) AS sub;`;

    const [resultSet, countResultSet] = await Promise.all([
      runOrgSqlQuery(org_id, dataQuery),
      runOrgSqlQuery(org_id, countQuery),
    ]);

    const totalRecords = parseInt(countResultSet?.[0]?.total) || 0;

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
      LIMIT ${limit} OFFSET ${offset};
    `;
    const countQuery = `SELECT COUNT(*) AS total FROM db${org_id}.messages m WHERE ${whereClause};`;

    const [resultSet, countResultSet] = await Promise.all([
      runOrgSqlQuery(org_id, dataQuery),
      runOrgSqlQuery(org_id, countQuery),
    ]);

    const totalRecords = parseInt(countResultSet?.[0]?.total) || 0;

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
