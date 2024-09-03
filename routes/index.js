module.exports = (app) => {
  require("./auth")(app);
  require("./user")(app);
  require("./organization")(app);
  require("./feedback")(app);
  require("./role")(app);
  require("./commons")(app);
  require("./source")(app);
  require("./publicApi")(app);
  require("./docs")(app);
  require("./conversation")(app);
  require("./secret")(app)
};

