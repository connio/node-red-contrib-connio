const createNode = require('./edge-gateway-in-node');
const createRoutes = require('./http-admin-routes');

module.exports = function(RED) {
  createNode(RED);
  createRoutes(RED);
};
