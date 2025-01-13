const Role = require('../models/Role.js');
const rolePermission = require('../helper/rolePermission');

const checkPermissions = (moduleName, action) => {
  return async (req, res, next) => {
    const roleName = (await Role.findById(req.user.role))?.name || 'user';

    if (roleName === 'admin') {
      return next();
    }
    if (moduleName === 'organization') {
      return next();
    }

    if (action === 'like-dislike') {
      next();
    } else {
      if (rolePermission[roleName].includes(moduleName)) {
        next();
      } else {
        console.log(roleName, moduleName);
        return res.status(403).json({message: 'Not enough permission'});
      }
    }
  };
};
module.exports = checkPermissions;
