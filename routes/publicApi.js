const middleware = require("../middleware/sessionapi.js");
const ctl = require("../controllers/orgCtrl.js");

/**
 * @openapi
 * /organizationDetail/{org_id}:
 *   get:
 *     summary: Get organization details
 *     description: Retrieve details of a specific organization by its ID.
 *     parameters:
 *       - in: path
 *         name: org_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the organization
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       '200':
 *         description: A successful response
 *       '404':
 *         description: Organization not found
 *       '500':
 *         description: Internal server error
 *   securitySchemes:
 *     ApiKeyAuth:
 *       type: apiKey
 *       in: header
 *       name: X-Api-Key-Local
 */
module.exports = (app) => {
    app.get("/organizationDetail/:org_id", middleware, ctl.getOrgDetailByPublicApi);
};