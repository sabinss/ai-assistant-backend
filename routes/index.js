module.exports = (app) => {
  require('./auth')(app);
  require('./customer')(app);
  require('./user')(app);
  require('./organization')(app);
  require('./notifications')(app);
  require('./feedback')(app);
  require('./role')(app);
  require('./commons')(app);
  require('./source')(app);
  require('./publicApi')(app);
  require('./docs')(app);
  require('./conversation')(app);
  require('./secret')(app);
  require('./activityLog')(app);
};
