const NodeEvent = require('../node-event');

/**
 * @param {{ deviceId: string, propertyName?: string, methodName?: string }} { propertyName, methodName }
 * @returns {string}
 */
function makeTopic({ deviceId, propertyName, methodName }) {
  const FIRST_PART = `connio/data/out/devices/${deviceId}`;

  if (propertyName) {
    return `${FIRST_PART}/properties/${propertyName}`;
  }

  return `${FIRST_PART}/methods/${methodName}`;
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
      });

      this.on(NodeEvent.Input, this.onInput);
      this.on(NodeEvent.Close, this.onClose);

      this.onInit();
    }

    onInit() {
      this.debug('init');
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
  }

  RED.nodes.registerType('connio-edge-device', EdgeDeviceNode);
};
