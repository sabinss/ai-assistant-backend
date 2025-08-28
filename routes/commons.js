const Status = require('../models/Status.js');
const authUser = require('../middleware/authUser')['authenticate'];
const jwt = require('jsonwebtoken');
const OrganizationToken = require('../models/OrganizationToken.js');
const verifySameOrganization = require('../middleware/verifySameOrganization.js');
const {SETTING_CONSTANT} = require('../constants/setting_constant.js');

module.exports = (app) => {
  app.get(`/api/v1/status`, authUser, async (req, res) => {
    const status = await Status.find();
    res.status(200).json(status);
  });

  app.get(`/api/v1/status`, authUser, async (req, res) => {
    const status = await Status.find();
    res.status(200).json(status);
  });

  app.get(
    `/api/v1/generate/token`,
    authUser,
    async (req, res) => {
      const exist = await OrganizationToken.findOne({email: req.user.email});
      console.log('exist', exist);
      if (!exist) {
        const accessToken = jwt.sign(
          {
            userId: req.user._id,
            orgnizationId: req.user.organization,
            email: req.user.email,
          },
          process.env.JWT_SECRET
        );
        await OrganizationToken.create({
          token: accessToken,
          email: req.user.email,
        });
        res.status(200).json({token: accessToken, settings: SETTING_CONSTANT});
      } else {
        res.status(200).json({token: exist.token, settings: SETTING_CONSTANT});
      }
    }
  );
};
