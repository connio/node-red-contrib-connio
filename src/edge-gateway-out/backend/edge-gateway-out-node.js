const MQTTConnectionManager = require('../mqtt-connection-manager');
const NodeEvent = require('../node-event');
const { getOutputNodeId, getLeftoverNodes } = require('../red-nodes-utils');
const {
  EdgeGatewayOutNodeStatusManager,
} = require('./edge-gateway-out-node-status-manager');

/**
 * @param {Object} node
 * @returns {{ deviceId: string, deviceName: string }[]}
 */
function getInputDevices(node) {
  let devices = Object.entries(node._flow.flow.nodes)
    .filter(([, def]) => {
      return def.type === 'connio-edge-device' && def.wires[0][0] === node.id;
    })
    .map(([, def]) => {
      return {
        deviceId: def.deviceId,
        deviceName: def.deviceName,
      };
    });

  return devices;
}

module.exports = function createNode(RED) {
  class EdgeGatewayOutNode {
    constructor(config) {
      RED.nodes.createNode(this, config);

      Object.assign(this, {
        deviceId: config.deviceId,
        deviceName: config.deviceName,
        deviceApiKeyId: config.deviceApiKeyId,
        deviceApiKeySecret: config.deviceApiKeySecret,
        deviceApiKeyConnectedDevices: config.deviceApiKeyConnectedDevices,

        connectedDevices: config.deviceApiKeyConnectedDevices
          ? config.deviceApiKeyConnectedDevices.split(';')
          : [],
        inputDevices: [],

        statusManager: new EdgeGatewayOutNodeStatusManager(this),
        edgeMqttNodeId: undefined,
      });

      this.on(NodeEvent.Input, this.onInput);
      this.on(NodeEvent.Close, this.onClose);

      this.onInit();
    }

    onInit() {
      this.debug('init');

      this._setupEdgeMQTTNodeId();

      Object.assign(this, {
        inputDevices: getInputDevices(this),
      });

      this.statusManager.reset();

      this.inputDevices.forEach(({ deviceId, deviceName }) => {
        if (!this.connectedDevices.some((id) => id === deviceId)) {
          this.debug(
            `${deviceId} is not connected to the ${this.deviceName} gateway`,
          );

          RED.comms.publish('connio/edge-gateway-out/input-device-unallowed', {
            deviceName,
            gatewayName: this.deviceName,
          });

          this.statusManager.setError();

          return;
        }
      });
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
      this.debug('EdgeGatewayOutNode : passthroughMessage');

      send({
        deviceId: this.deviceId,
        deviceApiKeyId: this.deviceApiKeyId,
        deviceApiKeySecret: this.deviceApiKeySecret,

        topic: msg.topic,
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
        let leftoverNodes = await getLeftoverNodes('connio-edge-gateway-out', {
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

  RED.nodes.registerType('connio-edge-gateway-out', EdgeGatewayOutNode);
};
