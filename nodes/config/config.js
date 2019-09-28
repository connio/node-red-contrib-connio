module.exports = function(RED) {
  const NODE_ID = 'connio-config';

  function ConfigNode(config) {
    RED.nodes.createNode(this, config);

    const { apiUrl, backendUrl, mqttUrl, name } = config;

    Object.assign(this, {
      apiUrl,
      backendUrl,
      mqttUrl,
      name,
    });
  }

  RED.nodes.registerType(NODE_ID, ConfigNode);
};
