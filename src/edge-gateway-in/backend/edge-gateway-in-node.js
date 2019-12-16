const mqtt = require('../edge-mqtt');

const MQTTEvent = require('../mqtt-event');
const NodeEvent = require('../node-event');
const {
  EdgeGatewayInNodeStatusManager,
} = require('./edge-gateway-in-node-status-manager');

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

        statusManager: new EdgeGatewayInNodeStatusManager(this),
        client: undefined,
      });

      this.on(NodeEvent.Close, this.onClose);

      this.onInit();
    }

    onInit() {
      this.debug('init');

      this.statusManager.setNotConnected();

      if (this.deviceId && this.deviceApiKeyId && this.deviceApiKeySecret) {
        this._runMQTT();
      } else {
        this.statusManager.setError();
      }
    }

    onClose() {
      this.debug(NodeEvent.Close);

      if (this.client) {
        this.client.__disconnect(this.id);
      }
    }

    _runMQTT() {
      this._connect({
        clientId: this.deviceId,
        username: this.deviceApiKeyId,
        password: this.deviceApiKeySecret,
      });
    }

    _connect({ clientId, username, password }) {
      this.debug('_connect');

      this.client = mqtt(this.mqttURL, {
        clientId,
        username,
        password,
      });

      if (this.client.connected) {
        this.statusManager.setConnected();

        this.client.subscribe(
          `connio/data/in/devices/${this.deviceId}/properties/#`,
        );
      } else {
        this.statusManager.setConnecting();
      }

      this.client.__onConnect(this.id, () => {
        this.debug(`MQTT Client : connected`);

        this.statusManager.setConnected();

        this.client.subscribe(
          `connio/data/in/devices/${this.deviceId}/properties/#`,
        );
      });

      this.client.__onClose(this.id, () => {
        this.debug(`MQTT Client : closed`);

        this.statusManager.setDisconnected();
      });

      this.client.__onReconnect(this.id, () => {
        this.debug(`MQTT Client : reconnecting`);

        this.statusManager.setConnecting();
      });

      this.client.__onEnd(this.id, () => {
        this.debug(`MQTT Client : end`);

        this.statusManager.setDisconnected();
      });

      this.client.__onError(this.id, () => {
        this.debug(`MQTT Client : error`);

        this.statusManager.setError();
      });

      this.client.__onMessage(this.id, (topic, message) => {
        this.debug(
          `MQTT Client : ${this.client.options.hostname} : ${MQTTEvent.Message}`,
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
