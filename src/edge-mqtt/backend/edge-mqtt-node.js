const mqtt = require('../edge-mqtt');

const NodeEvent = require('../node-event');
const {
  EdgeMQTTNodeStatusManager,
} = require('./edge-mqtt-node-status-manager');

module.exports = function createNode(RED) {
  class EdgeMQTTNode {
    constructor(config) {
      RED.nodes.createNode(this, config);

      let { mqttUrl } = RED.nodes.getNode(config.deploymentNodeId) || {};

      Object.assign(this, {
        mqttURL: mqttUrl,

        client: undefined,
        statusManager: new EdgeMQTTNodeStatusManager(this),
      });

      this.on(NodeEvent.Input, this.onInput);
      this.on(NodeEvent.Close, this.onClose);

      this.onInit();
    }

    onInit() {
      this.debug('onInit');

      if (this.mqttURL) {
        this.statusManager.setListening();
      } else {
        this.debug('onInit: No mqttURL provided');

        this.statusManager.setError();
      }
    }

    onClose() {
      this.debug(NodeEvent.Close);

      if (this.client) {
        this.client.__disconnect(this.id);
      }
    }

    onInput(msg, send /* , done */) {
      this.debug(NodeEvent.Input);

      /**
       * @description
       * For maximum backwards compatibility, check that send exists.
       * If this node is installed in Node-RED 0.x, it will need to
       * fallback to using `this.send`
       */
      let _send = send || this.send.bind(this);

      this.addMessage(msg, _send);
    }

    addMessage(msg) {
      this.debug(`addMessage : ${msg.payload}`);

      if (!this.client) {
        this._connect({
          clientId: msg.deviceId,
          username: msg.deviceApiKeyId,
          password: msg.deviceApiKeySecret,
        });
      }

      this._publish(msg.topic, msg.payload);
    }

    _publish(topic, payload) {
      this.debug('_publish');

      this.statusManager.setSending();

      let formattedPayload;

      try {
        this.debug('_publish : stringify the payload');
        formattedPayload = JSON.stringify(payload);
      } catch (error) {
        this.debug('_publish : error : unable to strigify payload');

        this.statusManager.setError();
      }

      this.client.publish(topic, formattedPayload, (error) => {
        if (error) {
          this.debug('_publish : error');

          setTimeout(() => {
            this.statusManager.setError();
          }, 300);

          return;
        }

        this.debug('_publish : success');

        setTimeout(() => {
          this.statusManager.setConnected();
        }, 300);
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
      } else {
        this.statusManager.setConnecting();
      }

      this.client.__onConnect(this.id, () => {
        this.debug(`MQTT Client : connected`);

        this.statusManager.setConnected();
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
    }
  }

  RED.nodes.registerType('connio-edge-mqtt', EdgeMQTTNode);
};
