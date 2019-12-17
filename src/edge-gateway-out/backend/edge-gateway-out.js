const createNode = require('./edge-gateway-out-node');
const createRoutes = require('./http-admin-routes');

module.exports = function(RED) {
  createNode(RED);
  createRoutes(RED);
};
