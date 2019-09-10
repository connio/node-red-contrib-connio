module.exports = function(RED) {
  const NODE_ID = 'connio-config';

  function ConfigNode(config) {
    RED.nodes.createNode(this, config);

    const { url, apiUrl, mqttUrl, name } = config;

    Object.assign(this, {
      url,
      apiUrl,
      mqttUrl,
      name,
    });
  }

  RED.nodes.registerType(NODE_ID, ConfigNode);
};
