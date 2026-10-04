const axios = require("axios");

const axiosInstance = axios.create({
  timeout: 300000,
  maxRedirects: 5,
  validateStatus: (status) => status >= 200 && status < 300,
});

const escapeSqlLiteral = (value) => String(value).replace(/'/g, "''");

const runOrgSqlQuery = async (org_id, sql_query) => {
  const session_id = Math.floor(1000 + Math.random() * 9000);
  const url =
    process.env.AI_AGENT_SERVER_URI +
    `/run-sql-query?sql_query=${encodeURIComponent(
      sql_query
    )}&session_id=${session_id}&org_id=${org_id}`;
  const response = await axiosInstance.post(url, {}, { timeout: 300000 });
  /**
   * console in json structure
   */
  console.log("ActivityCtrl: runOrgSqlQuery response1", response?.data?.result ?? []);
  console.log(
    "ActivityCtrl: runOrgSqlQuery response2",
    JSON.stringify(response?.data?.result?.result_set ?? [], null, 2)
  );
  return response?.data?.result?.result_set ?? [];
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
      message: "Internal Server Error",
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
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
