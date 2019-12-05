const createNode = require('./edge-device-node');
const createRoutes = require('./http-admin-routes');

module.exports = function(RED) {
  createNode(RED);
  createRoutes(RED);
};
