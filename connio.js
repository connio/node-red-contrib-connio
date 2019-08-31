const request = require('request-promise-native');
const mqtt = require('mqtt');

const { login } = require('./utils');

const NODE_ID = 'connio-mqtt';

const AUTH_NODE_ID_TOKEN = 'auth-node-id';

const CONNIO_AUTH_URL_TOKEN = 'connio-auth-url';
const CONNIO_API_URL_TOKEN = 'connio-api-url';
const CONNIO_USERNAME_TOKEN = 'connio-username';
const CONNIO_PASSWORD_TOKEN = 'connio-password';
const CONNIO_KEY_ID_TOKEN = 'connio-key-id';
const CONNIO_KEY_SECRET_TOKEN = 'connio-key-secret';

function getCredentials(headers) {
  return {
    username: headers[CONNIO_KEY_ID_TOKEN],
    password: headers[CONNIO_KEY_SECRET_TOKEN],
  };
}

function getApiUrl(headers) {
  return headers[CONNIO_API_URL_TOKEN];
}

module.exports = function(RED) {
  function MqttNode(config) {
    RED.nodes.createNode(this, config);

    let { connioConfig } = RED.nodes.getNode(config.auth);
    let { mqttUrl } = RED.nodes.getNode(connioConfig);

    Object.assign(this, {
      clientId: config.clientId,
      apiKeyId: config.apiKeyId,
      apiKeySecret: config.apiKeySecret,
      topic: config.topic,
      mqttUrl,
    });

    this.on('close', () => this.client && this.client.end());

    this.status({
      fill: 'yellow',
      shape: 'ring',
      text: 'Connecting',
    });

    try {
      this.client = mqtt.connect(this.mqttUrl, {
        clientId: this.clientId,
        username: this.apiKeyId,
        password: this.apiKeySecret,
        keepalive: 25,
        connectTimeout: 60 * 1000,
      });

      this.client.on('connect', () => {
        this.status({
          fill: 'green',
          shape: 'ring',
          text: 'Connected',
        });

        this.client.subscribe(this.topic);
      });

      this.client.on('reconnect', () => {
        this.status({
          fill: 'yellow',
          shape: 'ring',
          text: 'Connecting',
        });
      });

      this.client.on('end', () => {
        this.status({
          fill: 'red',
          shape: 'ring',
          text: 'Disconnected',
        });
      });

      this.client.on('message', (topic, message) => {
        this.send({
          topic,
          payload: message.toString(),
        });
      });

      this.client.on('error', (error) => {
        this.client.end(() => {
          this.send({
            payload: error,
          });

          this.status({
            fill: 'red',
            shape: 'ring',
            text: 'Error',
          });
        });
      });
    } catch (error) {
      this.send({
        payload: error,
      });

      this.status({
        fill: 'red',
        shape: 'ring',
        text: 'Error',
      });
    }
  }

  RED.nodes.registerType(NODE_ID, MqttNode);

  RED.httpAdmin.get('/login', (req, res) => {
    console.log('httpAdmin :: /login');

    let requestPayload = [];

    if (req.headers[AUTH_NODE_ID_TOKEN]) {
      let { email, credentials } = RED.nodes.getNode(
        req.headers[AUTH_NODE_ID_TOKEN],
      );

      requestPayload = [
        email,
        credentials.password,
        req.headers[CONNIO_AUTH_URL_TOKEN],
      ];
    } else {
      requestPayload = [
        req.headers[CONNIO_USERNAME_TOKEN],
        req.headers[CONNIO_PASSWORD_TOKEN],
        req.headers[CONNIO_AUTH_URL_TOKEN],
      ];
    }

    return login(...requestPayload)
      .then((response) => {
        console.log('httpAdmin :: /login :: SUCCESS');

        if (response.statusCode === 401) {
          return Promise.reject(response);
        }

        res.json(response);
      })
      .catch((error) => {
        res.status(500).json(error);
      });
  });

  RED.httpAdmin.get('/accounts', function(req, res) {
    console.log('httpAdmin :: /accounts');

    let apiUrl = getApiUrl(req.headers);
    let { username, password } = getCredentials(req.headers);
    let { id } = req.query;

    return request
      .get({
        url: `${apiUrl}/accounts/${id}`,
        json: true,
      })
      .auth(username, password)
      .then((response) => {
        console.log('httpAdmin :: /accounts :: SUCCESS');

        res.json({
          name: response.name,
          friendlyName: response.friendlyName,
        });
      })
      .catch((error) => res.status(500).json(error));
  });

  RED.httpAdmin.get('/api-clients', function(req, res) {
    let apiUrl = getApiUrl(req.headers);
    let { username, password } = getCredentials(req.headers);

    return request
      .get({
        url: `${apiUrl}/apiclients`,
        json: true,
      })
      .auth(username, password)
      .then(({ results: apiClients }) => {
        res.json(apiClients);
      })
      .catch((error) => res.status(500).json(error));
  });

  RED.httpAdmin.get('/api-key', function(req, res) {
    let apiUrl = getApiUrl(req.headers);
    let { username, password } = getCredentials(req.headers);
    let { clientId } = req.query;

    return request
      .get({
        url: `${apiUrl}/apiclients/${clientId}/apikey`,
        json: true,
      })
      .auth(username, password)
      .then(({ id, secret, context }) => {
        res.json({
          id,
          secret,
          appList: context.type === 'app' ? context.ids : undefined,
        });
      })
      .catch((error) => res.status(500).json(error));
  });

  RED.httpAdmin.get('/app', function(req, res) {
    let apiUrl = getApiUrl(req.headers);
    let { username, password } = getCredentials(req.headers);
    let { id } = req.query;

    return request
      .get({
        url: `${apiUrl}/apps/${id}`,
        json: true,
      })
      .auth(username, password)
      .then((response) => {
        res.json({
          name: response.name,
          friendlyName: response.friendlyName,
        });
      })
      .catch((error) => res.status(500).json(error));
  });
};
