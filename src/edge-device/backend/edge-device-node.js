const MQTTConnectionManager = require('../mqtt-connection-manager');
const NodeEvent = require('../node-event');
const { getOutputNodeId, getLeftoverNodes } = require('../red-nodes-utils');

/**
 * @param {{ deviceId: string, propertyName?: string, methodName?: string }} { propertyName, methodName }
 * @returns {string}
 */
function makeTopic({ deviceId, propertyName, methodName }) {
  const FIRST_PART = `connio/data/out/devices/${deviceId}`;

  if (methodName) {
    return `${FIRST_PART}/methods/${methodName}`;
  }

  return propertyName === '_data-feed-format_'
    ? `${FIRST_PART}/json`
    : `${FIRST_PART}/properties/${propertyName}`;
}

module.exports = function createNode(RED) {
  class EdgeDeviceNode {
    constructor(config) {
      RED.nodes.createNode(this, config);

      Object.assign(this, {
        deviceId: config.deviceId,
        deviceApiKeyId: config.deviceApiKeyId,
        deviceApiKeySecret: config.deviceApiKeySecret,

        propertyName: config.propertyName,
        methodName: config.methodName,

        edgeMqttNodeId: undefined,
      });

      this.on(NodeEvent.Input, this.onInput);
      this.on(NodeEvent.Close, this.onClose);

      this.onInit();
    }

    onInit() {
      this.debug('init');

      this._setupEdgeMQTTNodeId();
    }

    onClose() {
      this.debug(NodeEvent.Close);

      if (this.edgeMqttNodeId) {
        this.tryDisconnect();
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

      this.passthroughMessage(msg, _send);
    }

    /**
     * @param {any} msg
     * @param {Function} send
     */
    passthroughMessage(msg, send) {
      this.debug('EdgeDeviceNode : passthroughMessage');

      send({
        deviceId: this.deviceId,
        deviceApiKeyId: this.deviceApiKeyId,
        deviceApiKeySecret: this.deviceApiKeySecret,

        topic: makeTopic({
          deviceId: this.deviceId,
          propertyName: this.propertyName,
          methodName: this.methodName,
        }),
        payload: msg.payload,
      });
    }

    async _setupEdgeMQTTNodeId() {
      try {
        let nodeId = await getOutputNodeId('connio-edge-mqtt', {
          flow: this._flow,
          wires: this.wires,
        });

        Object.assign(this, {
          edgeMqttNodeId: nodeId,
        });
      } catch (error) {
        this.debug(`[error] : _setupEdgeMQTTNodeId : ${error}`);
      }
    }

    async tryDisconnect() {
      try {
        let leftoverNodes = await getLeftoverNodes('connio-edge-device', {
          flow: this._flow,
          clientId: this.deviceId,
          edgeMqttNodeId: this.edgeMqttNodeId,
        });

        if (leftoverNodes.length > 0) {
          this.debug('similar nodes found, keep connection open');

          return;
        }

        this.debug('no more similar nodes, disconnecting');

        MQTTConnectionManager().disconnectFromOutputNode(
          this.edgeMqttNodeId,
          this.deviceId,
        );
      } catch (error) {
        this.debug(`[error] : tryDisconnect : ${error}`);
      }
    }
  }

  RED.nodes.registerType('connio-edge-device', EdgeDeviceNode);
};
