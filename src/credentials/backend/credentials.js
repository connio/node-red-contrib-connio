/**
 * @param {Object} RED
 */
function createNode(RED) {
  const NODE_ID = 'connio-credentials';

  const NODE_CONFIG = {
    credentials: {
      password: {
        type: 'password',
        required: true,
      },
    },
  };

  function CredentialsNode(config) {
    RED.nodes.createNode(this, config);

    Object.assign(this, {
      email: config.email,
      connioConfig: config.connioConfig,
    });
  }

  RED.nodes.registerType(NODE_ID, CredentialsNode, NODE_CONFIG);
};

module.exports = function(RED) {
  createNode(RED);
};
