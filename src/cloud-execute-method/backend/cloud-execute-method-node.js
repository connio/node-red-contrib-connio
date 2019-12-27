const axios = require('axios');
const NodeEvent = require('../node-event');

module.exports = function createNode(RED) {
  class CloudExecuteMethodNode {
    constructor(config) {
      RED.nodes.createNode(this, config);

      Object.assign(this, {
        name: config.name,

        accountNodeId: config.accountNodeId,

        requesterId: config.requesterId,
        requesterKey: config.requesterKey,

        targetType: config.targetType,
        targetId: config.targetId,
        methodId: config.methodId,
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

      this.executeMethod(msg, _send, done);
    }

    executeMethod(msg, send, done) {
      let [username, password] = this.requesterKey.split(':');

      let targetType = this.targetType === '1' ? 'apps' : 'devices';

      return axios
        .post(
          `/${targetType}/${this.targetId}/methods/${this.methodId}`,
          {
            value: msg.payload,
          },
          {
            baseURL: this.dataApiUrl,
            auth: {
              username,
              password,
            },
          },
        )
        .then(({ data } = {}) => {
          send({
            payload: data,
          });
        })
        .catch((error = {}) => {
          let { response: { data } = {} } = error;

          send({
            payload: data || error,
          });
        })
        .finally(done);
    }
  }

  RED.nodes.registerType('connio-cloud-execute-method', CloudExecuteMethodNode);
};
