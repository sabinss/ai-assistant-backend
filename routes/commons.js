const Status = require('../models/Status.js');
const authUser = require('../middleware/authUser')['authenticate'];
const jwt = require('jsonwebtoken');
const OrganizationToken = require('../models/OrganizationToken.js');
const verifySameOrganization = require('../middleware/verifySameOrganization.js');

module.exports = (app) => {
  app.get(`${process.env.APP_URL}/status`, authUser, async (req, res) => {
    const status = await Status.find();
    res.status(200).json(status);
  });
  app.get(
    `${process.env.APP_URL}/generate/token`,
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
        res.status(200).json({token: accessToken});
      } else {
        res.status(200).json({token: exist.token});
      }
    }
  );
};
