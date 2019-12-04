/**
 * @param {Object} RED
 */
module.exports = function createNode(RED) {
  const NODE_ID = 'connio-credentials';

  const NODE_CONFIG = {
    credentials: {
      password: {
        type: 'password',
        required: true,
      },
      apiKeyId: {
        type: 'password',
        required: true,
      },
      apiKeySecret: {
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
