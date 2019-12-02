const mqtt = require('mqtt');
const { Topic } = require('./topic');
const { MQTTNodeStatusManager } = require('./mqtt-node-status-manager');

const NODE_ID = 'connio-mqtt';

/** @type {string} */
const NodeEvent = {
  Close: 'close',
}

/** @enum {string} */
const MQTTEvent = {
  Close: 'close',
  Connect: 'connect',
  Reconnect: 'reconnect',
  End: 'end',
  Error: 'error',
};

module.exports = function createNode(RED) {
  class MqttNode {
    constructor(config) {
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

        statusManager: new MQTTNodeStatusManager(this),
      });

      this.on(NodeEvent.Close, this.onClose);

      this.onInit();
    }

    onInit() {
      this.statusManager.setNotConnected();

      if (this.account && this.app) {
        this._runMQTT();
      }
    }

    onClose() {
      RED.log.debug(`MQTT node : ${NodeEvent.Close}`);

      if (this.client) {
        this.client.end();
      }
    }

    _runMQTT() {
      try {
        this.client = mqtt.connect(this.mqttUrl, {
          clientId: this.clientId,
          username: this.apiKeyId,
          password: this.apiKeySecret,
          keepalive: 25,
          connectTimeout: 60 * 1000,
        });

        this.client.on(MQTTEvent.Connect, () => {
          RED.log.debug(
            `@connio/mqtt : MQTT Client : ${this.client.options.hostname} : ${MQTTEvent.Connect}`,
          );

          this.statusManager.setConnected();

          let topic = Topic.build({
            account: this.account,
            app: this.app,
            value: this.topicValue,
          });

          this.client.subscribe(topic);
        });

        this.client.on(MQTTEvent.Reconnect, () => {
          RED.log.debug(
            `@connio/mqtt : MQTT Client : ${this.client.options.hostname} : ${MQTTEvent.Reconnect}`,
          );

          this.statusManager.setConnecting();
        });

        this.client.on(MQTTEvent.End, () => {
          RED.log.debug(
            `@connio/mqtt : MQTT Client : ${this.client.options.hostname} : ${MQTTEvent.End}`,
          );

          this.statusManager.setDisconnected();
        });

        this.client.on(MQTTEvent.Message, (topic, message) => {
          RED.log.debug(
            `@connio/mqtt : MQTT Client : ${this.client.options.hostname} : ${MQTTEvent.Message}`,
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

        this.client.on(MQTTEvent.Error, (error) => {
          RED.log.debug(
            `@connio/mqtt : MQTT Client : ${this.client.options.hostname} : ${MQTTEvent.Error}`,
          );

          this.client.end(() => {
            this.send({
              payload: error,
            });

            this.statusManager.setError();
          });
        });
      } catch (error) {
        this.send({
          payload: error,
        });

        this.statusManager.setError();
      }
    }
  }

  RED.nodes.registerType(NODE_ID, MqttNode);
}
