const NodeEvent = require('../node-event');
const {
  EdgeGatewayNodeStatusManager,
} = require('./edge-gateway-node-status-manager');

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
  class EdgeGatewayNode {
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

        statusManager: new EdgeGatewayNodeStatusManager(this),
      });

      this.on(NodeEvent.Input, this.onInput);
      this.on(NodeEvent.Close, this.onClose);

      this.onInit();
    }

    onInit() {
      this.debug('init');

      Object.assign(this, {
        inputDevices: getInputDevices(this),
      });

      this.statusManager.reset();

      this.inputDevices.forEach(({ deviceId, deviceName }) => {
        if (!this.connectedDevices.some((id) => id === deviceId)) {
          this.debug(
            `${deviceId} is not connected to the ${this.deviceName} gateway`,
          );

          RED.comms.publish('connio/edge-gateway/input-device-unallowed', {
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
      this.debug('EdgeGatewayNode : passthroughMessage');

      send({
        deviceId: this.deviceId,
        deviceApiKeyId: this.deviceApiKeyId,
        deviceApiKeySecret: this.deviceApiKeySecret,

        topic: msg.topic,
        payload: msg.payload,
      });
    }
  }

  RED.nodes.registerType('connio-edge-gateway', EdgeGatewayNode);
};
