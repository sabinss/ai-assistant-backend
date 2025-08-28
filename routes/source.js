const sourceCtrl = require("../controllers/sourceCtrl");
const authUser = require("../middleware/authUser")["authenticate"];

module.exports = (app) => {
    app.post(`/api/v1/sources`, authUser, sourceCtrl.createSource);
    app.get(`/api/v1/sources`, authUser, sourceCtrl.getSources);
    app.get(`/api/v1/sources/:id`, authUser, sourceCtrl.getSource);
    app.put(`/api/v1/sources/:id`, authUser, sourceCtrl.updateSource);
    app.delete(`/api/v1/sources/:id`, authUser, sourceCtrl.deleteSource);
};