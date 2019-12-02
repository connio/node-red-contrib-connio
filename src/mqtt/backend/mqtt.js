const axios = require('axios');
const mqtt = require('mqtt');

const { log, login } = require('../utils');

const NODE_ID = 'connio-mqtt';

const AUTH_NODE_ID_TOKEN = 'auth-node-id';

const CONNIO_BACKEND_URL_TOKEN = 'connio-backend-url';
const CONNIO_API_URL_TOKEN = 'connio-api-url';
const CONNIO_USERNAME_TOKEN = 'connio-username';
const CONNIO_PASSWORD_TOKEN = 'connio-password';
const CONNIO_KEY_ID_TOKEN = 'connio-key-id';
const CONNIO_KEY_SECRET_TOKEN = 'connio-key-secret';

class Topic {
  static build({ account, app, value }) {
    const prefix = this._buildPrefix(account, app);

    return `${prefix}${value || '#'}`;
  }

  static _buildPrefix(account, app) {
    return [account, 'apps', app, 'devices', ''].join('/').toLowerCase();
  }
}

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
      account: config.account,
      app: config.app,
      topicValue: config.topicValue,
      mqttUrl,
    });

    this.on('close', () => this.client && this.client.end());

    this.status({
      fill: 'grey',
      shape: 'ring',
      text: 'node-red:common.status.not-connected',
    });

    if (!this.account || !this.app) {
      return;
    }

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
          text: 'node-red:common.status.connected',
        });

        let topic = Topic.build({
          account: this.account,
          app: this.app,
          value: this.topicValue,
        });

        this.client.subscribe(topic);
      });

      this.client.on('reconnect', () => {
        this.status({
          fill: 'yellow',
          shape: 'ring',
          text: 'node-red:common.status.connecting',
        });
      });

      this.client.on('end', () => {
        this.status({
          fill: 'red',
          shape: 'ring',
          text: 'node-red:common.status.disconnected',
        });
      });

      this.client.on('message', (topic, message) => {
        let msg = message.toString();

        try {
          this.send({
            topic,
            payload: JSON.parse(msg),
          });
        } catch (e) {
          this.send({
            topic,
            payload: msg,
          });
        }
      });

      this.client.on('error', (error) => {
        this.client.end(() => {
          this.send({
            payload: error,
          });

          this.status({
            fill: 'red',
            shape: 'ring',
            text: 'node-red:common.status.error',
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
        text: 'node-red:common.status.error',
      });
    }
  }

  RED.nodes.registerType(NODE_ID, MqttNode);

  RED.httpAdmin.get('/login', (req, res) => {
    log('httpAdmin :: /login');

    let requestPayload = [];

    let authUrl = `${req.headers[CONNIO_BACKEND_URL_TOKEN]}/identity/login`;

    if (req.headers[AUTH_NODE_ID_TOKEN]) {
      let { email, credentials } = RED.nodes.getNode(
        req.headers[AUTH_NODE_ID_TOKEN],
      );

      requestPayload = [email, credentials.password, authUrl];
    } else {
      requestPayload = [
        req.headers[CONNIO_USERNAME_TOKEN],
        req.headers[CONNIO_PASSWORD_TOKEN],
        authUrl,
      ];
    }

    return login(...requestPayload)
      .then((response) => {
        log('httpAdmin :: /login :: SUCCESS');

        res.json(response);
      })
      .catch(({ response = {} }) => {
        log('httpAdmin :: /login :: ERROR');

        let { data: { error } = {}, status } = response;

        res.status(status).json(error);
      });
  });

  RED.httpAdmin.get('/api-clients', function(req, res) {
    let apiUrl = getApiUrl(req.headers);
    let { username, password } = getCredentials(req.headers);

    return axios
      .get('/apiclients', {
        baseURL: apiUrl,
        auth: {
          username,
          password,
        },
      })
      .then(({ data }) => {
        log('httpAdmin :: /api-clients :: SUCCESS');

        let { results: apiClients } = data;

        res.json(apiClients);
      })
      .catch(({ response = {} }) => {
        log('httpAdmin :: /api-clients :: ERROR');

        let { data: { error } = {}, status } = response;

        res.status(status).json(error);
      });
  });

  RED.httpAdmin.get('/api-key', function(req, res) {
    let apiUrl = getApiUrl(req.headers);
    let { username, password } = getCredentials(req.headers);
    let { clientId } = req.query;

    return axios
      .get(`/apiclients/${clientId}/apikey`, {
        baseURL: apiUrl,
        auth: {
          username,
          password,
        },
      })
      .then(({ data }) => {
        log('httpAdmin :: /api-key :: SUCCESS');

        let { id, secret, context } = data;

        res.json({
          id,
          secret,
          appList: context.type === 'app' ? context.ids : undefined,
        });
      })
      .catch(({ response = {} }) => {
        log('httpAdmin :: /api-key :: ERROR');

        let { data: { error } = {}, status } = response;

        res.status(status).json(error);
      });
  });

  RED.httpAdmin.get('/app', function(req, res) {
    let apiUrl = getApiUrl(req.headers);
    let { username, password } = getCredentials(req.headers);
    let { id } = req.query;

    return axios
      .get(`/apps/${id}`, {
        baseURL: apiUrl,
        auth: {
          username,
          password,
        },
      })
      .then(({ data }) => {
        log('httpAdmin :: /app :: SUCCESS');

        res.json({
          name: data.name,
          friendlyName: data.friendlyName,
        });
      })
      .catch(({ response = {} }) => {
        log('httpAdmin :: /app :: ERROR');

        let { data: { error } = {}, status } = response;

        res.status(status).json(error);
      });
  });
};
