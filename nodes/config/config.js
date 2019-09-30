let axios = require('axios');
let { log } = require('../utils');

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

  RED.httpAdmin.get('/connio-settings', function(req, res) {
    let baseURL = req.headers['connio-backend-url'];

    return axios
      .get('/settings', {
        baseURL,
      })
      .then(({ data }) => {
        log('httpAdmin :: /connio-settings :: SUCCESS');

        res.json(data);
      })
      .catch(({ response = {} }) => {
        log('httpAdmin :: /connio-settings :: ERROR');
        let { data: { error } = {}, status } = response;

        res.status(status).json(error);
      });
  });
};
