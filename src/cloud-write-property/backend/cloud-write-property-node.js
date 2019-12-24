const axios = require('axios');
const NodeEvent = require('../node-event');

module.exports = function createNode(RED) {
  class CloudWritePropertyNode {
    constructor(config) {
      RED.nodes.createNode(this, config);

      Object.assign(this, {
        name: config.name,

        accountNodeId: config.accountNodeId,

        requesterId: config.requesterId,
        requesterKey: config.requesterKey,

        targetType: config.targetType,
        targetId: config.targetId,
        propertyId: config.propertyId,
      });

      this.onInit();
    }

    onInit() {
      this.debug('init');

      this.on(NodeEvent.Input, this.onInput);
      this.on(NodeEvent.Close, this.onClose);

      let { credentials, connioConfig: deploymentNodeId } = RED.nodes.getNode(
        this.accountNodeId,
      );
      let { apiUrl } = RED.nodes.getNode(deploymentNodeId);

      this.dataApiUrl = `${apiUrl}/data`;

      if (!this.requesterKey.includes(':')) {
        this.requesterKey = `${credentials.apiKeyId}:${credentials.apiKeySecret}`;
      }
    }

    onClose() {
      this.debug(NodeEvent.Close);
    }

    onInput(msg, send, done) {
      this.debug(NodeEvent.Input);

      /**
       * @description
       * For maximum backwards compatibility, check that send exists.
       * If this node is installed in Node-RED 0.x, it will need to
       * fallback to using `this.send`
       */
      let _send = send || this.send.bind(this);

      this.sendPropertyValue(msg, _send, done);
    }

    sendPropertyValue(msg, send, done) {
      let [username, password] = this.requesterKey.split(':');

      let targetType = this.targetType === '1' ? 'apps' : 'devices';

      return axios
        .post(
          `/${targetType}/${this.targetId}/properties/${this.propertyId}`,
          {
            dps: [
              {
                t: new Date().toISOString(),
                v: msg.payload,
              },
            ],
          },
          {
            baseURL: this.dataApiUrl,
            auth: {
              username,
              password,
            },
          },
        )
        .finally(done);
    }
  }

  RED.nodes.registerType('connio-cloud-write-property', CloudWritePropertyNode);
};
