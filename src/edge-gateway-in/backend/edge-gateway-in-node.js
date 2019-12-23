const MQTTEvent = require('../mqtt-event');
const NodeEvent = require('../node-event');
const {
  EdgeGatewayInNodeStatusManager,
} = require('./edge-gateway-in-node-status-manager');
const MQTTConnectionManager = require('../mqtt-connection-manager');

module.exports = function createNode(RED) {
  class EdgeGatewayInNode {
    constructor(config) {
      RED.nodes.createNode(this, config);

      let { connioConfig: deploymentNodeId } = RED.nodes.getNode(
        config.accountNodeId,
      );
      let { mqttUrl } = RED.nodes.getNode(deploymentNodeId) || {};

      Object.assign(this, {
        mqttURL: mqttUrl,

        deviceId: config.deviceId,
        deviceName: config.deviceName,
        deviceApiKeyId: config.deviceApiKeyId,
        deviceApiKeySecret: config.deviceApiKeySecret,
        deviceApiKeyLinkedDevices: config.deviceApiKeyLinkedDevices,

        linkedDevices: config.deviceApiKeyLinkedDevices
          ? config.deviceApiKeyLinkedDevices.split(';')
          : [],

        statusManager: new EdgeGatewayInNodeStatusManager(this),
        connection: undefined,
      });

      this.on(NodeEvent.Close, this.onClose);

      this.onInit();
    }

    onInit() {
      this.debug('init');

      this.statusManager.setNotConnected();

      if (this.deviceId && this.deviceApiKeyId && this.deviceApiKeySecret) {
        this._connect({
          clientId: this.deviceId,
          username: this.deviceApiKeyId,
          password: this.deviceApiKeySecret,
        });
      } else {
        this.statusManager.setError();
      }
    }

    onClose() {
      this.debug(NodeEvent.Close);

      if (this.connection) {
        this.connection.disconnect(this.id);
      }
    }

    _connect({ clientId, username, password }) {
      this.debug('_connect');

      this.connection = MQTTConnectionManager()
        .useConnection(this.mqttURL, {
          clientId,
          username,
          password,
        })
        .connect(this.id);

      if (this.connection.client && this.connection.client.connected) {
        this.statusManager.setConnected();

        for (let deviceId of this.linkedDevices) {
          this.connection.client.subscribe(
            `connio/data/in/devices/${deviceId}/properties/#`,
          );
        }
      } else {
        this.statusManager.setConnecting();
      }

      this.connection.onConnect(this.id, () => {
        this.debug(`MQTT Client : connected`);

        this.statusManager.setConnected();

        for (let deviceId of this.linkedDevices) {
          this.connection.client.subscribe(
            `connio/data/in/devices/${deviceId}/properties/#`,
          );
        }
      });

      this.connection.onClose(this.id, () => {
        this.debug(`MQTT Client : closed`);

        this.statusManager.setDisconnected();
      });

      this.connection.onReconnect(this.id, () => {
        this.debug(`MQTT Client : reconnecting`);

        this.statusManager.setConnecting();
      });

      this.connection.onEnd(this.id, () => {
        this.debug(`MQTT Client : end`);

        this.statusManager.setDisconnected();
      });

      this.connection.onError(this.id, () => {
        this.debug(`MQTT Client : error`);

        this.statusManager.setError();
      });

      this.connection.onMessage(this.id, (topic, message) => {
        this.debug(
          `MQTT Client : ${this.connection.client.options.hostname} : ${MQTTEvent.Message}`,
        );

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
    }
  }

  RED.nodes.registerType('connio-edge-gateway-in', EdgeGatewayInNode);
};
