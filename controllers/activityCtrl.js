const axios = require("axios");

const axiosInstance = axios.create({
  timeout: 300000,
  maxRedirects: 5,
  validateStatus: (status) => status >= 200 && status < 300,
});

const escapeSqlLiteral = (value) => String(value).replace(/'/g, "''");

const getSqlErrorMessage = (error) => {
  const sqlBody = error?.response?.data;
  const metadataError = sqlBody?.result?.metadata?.error;
  if (metadataError) return metadataError;
  if (sqlBody?.error) return typeof sqlBody.error === "string" ? sqlBody.error : JSON.stringify(sqlBody.error);
  if (sqlBody?.message) return sqlBody.message;
  if (error?.code === "ECONNREFUSED") {
    return `Cannot reach AI_AGENT_SERVER_URI (${process.env.AI_AGENT_SERVER_URI || "not set"}). SQL service is not running or the URL is missing a port.`;
  }
  return error?.message || "Unknown SQL error";
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

  try {
    const response = await axiosInstance.post(url, {}, { timeout: 300000 });
    const result = response?.data?.result;
    if (result?.metadata?.status === "error" || result?.metadata?.status === "FAILED") {
      throw new Error(result?.metadata?.error || result?.metadata?.message || "SQL query failed");
    }
    return result?.result_set ?? [];
  } catch (error) {
    const details = getSqlErrorMessage(error);
    if (error?.response?.data) {
      console.error("ActivityCtrl SQL error body:", JSON.stringify(error.response.data));
    }
    throw new Error(details);
  }
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

    const org_id = req.user.organization.toString();
    // const sql_query = `
    //   SELECT DISTINCT m."to", m.company_name, m.company_id
    //   FROM db${org_id}.messages m
    //   WHERE m."type" = 'SMS' AND m.direction = 'outbound'
    // `;

    const sql_query = `
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
      ORDER BY latest_updated_at DESC;
    `;

    const resultSet = await runOrgSqlQuery(org_id, sql_query);
    return res.status(200).json({
      data: Array.isArray(resultSet) ? resultSet : [],
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

    const org_id = req.user.organization.toString();
    const companyId = escapeSqlLiteral(inside);
    const sql_query = `
     select *  from   db${org_id}.messages m  where m."type" ='SMS' 
     and m.company_id ='${companyId}' order by m.updated_at ASC
    `;

    const resultSet = await runOrgSqlQuery(org_id, sql_query);
    return res.status(200).json({
      data: Array.isArray(resultSet) ? resultSet : [],
    });
  } catch (error) {
    console.error("Error fetching activity company by id:", error.message);
    return res.status(500).json({
      message: "Failed to fetch activity company messages",
      error: error.message,
    });
  }
};
