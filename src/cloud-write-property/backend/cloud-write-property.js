const createNode = require('./cloud-write-property-node');
// const createRoutes = require('./http-admin-routes');

module.exports = function(RED) {
  createNode(RED);
  // createRoutes(RED);
};
