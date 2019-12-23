const MQTTConnectionManager = require('../mqtt-connection-manager');

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

        connection: undefined,
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

        if (this.connection) {
          this.statusManager.setConnected();
        }
      } else {
        this.debug('onInit: No mqttURL provided');

        this.statusManager.setError();
      }
    }

    onClose() {
      this.debug(NodeEvent.Close);

      if (this.connection) {
        MQTTConnectionManager().disconnectAll(this.id);
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

      if (!this.connection) {
        this.debug(`new connection : ${msg.deviceId}`);

        this._connect({
          clientId: msg.deviceId,
          username: msg.deviceApiKeyId,
          password: msg.deviceApiKeySecret,
        });
      } else if (this.connection.clientId !== msg.deviceId) {
        this.debug(`new deviceId : ${msg.deviceId}`);

        this._connect({
          clientId: msg.deviceId,
          username: msg.deviceApiKeyId,
          password: msg.deviceApiKeySecret,
        });
      } else if (this.connection.client.disconnected) {
        this.debug('client was disconnected');

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

      this.connection.client.publish(topic, formattedPayload, (error) => {
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

      this.connection = MQTTConnectionManager()
        .useConnection(this.mqttURL, {
          clientId,
          username,
          password,
        })
        .connect(this.id);

      if (this.connection.client && this.connection.client.connected) {
        this.statusManager.setConnected();
      } else {
        this.statusManager.setConnecting();
      }

      this.connection.onConnect(this.id, () => {
        this.debug(`MQTT Client : connected`);

        this.statusManager.setConnected();
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
    }
  }

  RED.nodes.registerType('connio-edge-mqtt', EdgeMQTTNode);
};
