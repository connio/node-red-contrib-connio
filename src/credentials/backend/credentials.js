const createNode = require('./credentials-node');
const createRoutes = require('./http-admin-routes');

module.exports = function(RED) {
  createNode(RED);
  createRoutes(RED);
};
