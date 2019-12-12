const mqtt = require('mqtt');
const MQTTEvent = require('./mqtt-event');

let mqttClientManager;

class MQTTClientManager {
  constructor(mqttURL, { clientId, username, password }) {
    Object.assign(this, {
      clientId,
      username,
      password,

      connectionParams: {
        mqttURL,
        keepalive: 25,
        connectTimeout: 60 * 1000,
      },

      client: undefined,
      subscribers: 0,
      callbackMap: {},
    });

    this._createOnEvents();
  }

  _createOnEvents() {
    for (let [eventName, eventId] of Object.entries(MQTTEvent)) {
      this[`on${eventName}`] = function(nodeId, callback) {
        if (!this.callbackMap[nodeId]) {
          this.callbackMap[nodeId] = {};
        }

        this.callbackMap[nodeId][eventId] = callback;

        this._registerCallback(eventId, callback);
      };
    }
  }

  _log(...args) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[debug] [MQTTClientManager]', args.join(' : '));
    }
  }

  _connect() {
    this._log('_connect');

    this.client = mqtt.connect(this.connectionParams.mqttURL, {
      clientId: this.clientId,
      username: this.username,
      password: this.password,

      keepalive: 25,
      connectTimeout: 60 * 1000,
    });

    this.client.__disconnect = this.disconnect.bind(this);

    for (let eventName of Object.keys(MQTTEvent)) {
      this.client[`__on${eventName}`] = this[`on${eventName}`].bind(this);
    }

    return this.client;
  }

  _disconnect() {
    this._log('_disconnect');

    this.client.end(true, () => {
      this._log('client', 'end');
    });
  }

  _addSubscriber() {
    this.subscribers += 1;

    this._log('_addSubscriber', 'subscribers', this.subscribers);
  }

  _removeSubscriber(nodeId) {
    this.subscribers -= 1;

    this._log('_removeSubscriber', 'subscribers', this.subscribers);

    for (let eventId of Object.keys(this.callbackMap[nodeId])) {
      this._unregisterCallback(eventId, this.callbackMap[nodeId][eventId]);
    }

    this.callbackMap[nodeId] = undefined;
  }

  _registerCallback(eventName, callback) {
    this.client.on(eventName, callback);
  }

  _unregisterCallback(eventName, callback) {
    this.client.off(eventName, callback);
  }

  connect() {
    this._log('connect');
    this._addSubscriber();

    if (!this.client) {
      return this._connect();
    }

    if (!this.client.connected || this.client.disconnecting) {
      this._log('reconnect');
      this.client.reconnect();
    }

    return this.client;
  }

  disconnect(nodeId) {
    this._log('disconnect');
    this._removeSubscriber(nodeId);

    if (this.subscribers === 0) {
      this._disconnect();
    }
  }
}

module.exports = function EdgeMQTTClientManager(
  url,
  { clientId, username, password },
) {
  if (!mqttClientManager) {
    mqttClientManager = new MQTTClientManager(url, {
      clientId,
      username,
      password,
    });
  }

  mqttClientManager.connect();

  return mqttClientManager.client;
};
