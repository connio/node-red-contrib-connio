const axios = require('axios');

/** @enum {string} */
const RequestHeader = {
  BackendURL: 'connio-backend-url',
};

/**
 * @param {Object} RED
 */
function createNode(RED) {
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
}

/**
 * @param {Object} RED
 */
function createRoutes(RED) {
  function connioSettings(req, res) {
    let baseURL = req.headers[RequestHeader.BackendURL];

    return axios
      .get('/settings', {
        baseURL,
      })
      .then(({ data }) => {
        RED.log.info('httpAdmin :: /connio-settings :: SUCCESS');

        if (!data.api || !data.mqtt) {
          return Promise.reject({
            response: {
              status: 404,
              data: {
                error: [
                  {
                    cause: '',
                    message: RED._('error.invalid-settings-format'),
                  },
                ],
              },
            },
          });
        }

        res.json(data);
      })
      .catch((error = {}) => {
        RED.log.info('httpAdmin :: /connio-settings :: ERROR');

        if (error.response) {
          let { data = {}, status } = error.response;

          res.status(status).json(data.error);
        } else if (error.request) {
          let { statusCode, statusMessage } = error.request;

          res.status(statusCode || 500).json([
            {
              message: statusCode ? statusMessage : error.message,
            },
          ]);
        } else {
          res.status(500).json([
            {
              message: statusCode ? statusMessage : error.message,
            },
          ]);
        }
      });
  }

  RED.httpAdmin.get('/connio-settings', connioSettings);
}

module.exports = function(RED) {
  createNode(RED);
  createRoutes(RED);
};
