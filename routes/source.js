const sourceCtrl = require("../controllers/sourceCtrl");
const authUser = require("../middleware/authUser")["authenticate"];

module.exports = (app) => {
    app.post(`${process.env.APP_URL}/sources`, authUser, sourceCtrl.createSource);
    app.get(`${process.env.APP_URL}/sources`, authUser, sourceCtrl.getSources);
    app.get(`${process.env.APP_URL}/sources/:id`, authUser, sourceCtrl.getSource);
    app.put(`${process.env.APP_URL}/sources/:id`, authUser, sourceCtrl.updateSource);
    app.delete(`${process.env.APP_URL}/sources/:id`, authUser, sourceCtrl.deleteSource);
};