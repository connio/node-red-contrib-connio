const createRoutes = require('./http-admin-routes');
const createNode = require('./mqtt-node');

module.exports = function(RED) {
  createNode(RED);
  createRoutes(RED);
};
