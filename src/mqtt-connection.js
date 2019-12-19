const mqtt = require('mqtt');
const MQTTEvent = require('./mqtt-event');

module.exports = class MQTTConnection {
  constructor(mqttURL, { clientId, username, password }, params = {}) {
    Object.assign(this, {
      clientId,
      username,
      password,

      connectionParams: {
        mqttURL,
        keepalive: 25,
        connectTimeout: 60 * 1000,
        ...params,
      },

      client: undefined,
      subscribers: new Set(),
      callbackMap: {},
    });

    this._createOnEvents();
  }

  _createOnEvents() {
    for (let [eventName, eventId] of Object.entries(MQTTEvent)) {
      this[`on${eventName}`] = function(id, callback) {
        if (!this.callbackMap[id]) {
          this.callbackMap[id] = {};
        }

        this.callbackMap[id][eventId] = callback;

        this._registerCallback(eventId, callback);
      };
    }
  }

  _log(...args) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[debug] [MQTTConnection]', args.join(' : '));
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

    return this;
  }

  _disconnect(cb) {
    this._log('_disconnect (start)');

    if (this.client.disconnecting) {
      return;
    }

    this.client.end(() => {
      this._log('_disconnect (success)', 'client', 'end');

      if (cb) {
        cb();
      }
    });
  }

  _addSubscriber(id) {
    this.subscribers.add(id);

    this._log('_addSubscriber', 'subscribers', this.subscribers.size);
  }

  _removeSubscriber(id) {
    this.subscribers.delete(id);

    this._log('_removeSubscriber', 'subscribers', this.subscribers.size);
  }

  _registerCallback(eventName, callback) {
    this.client.on(eventName, callback);
  }

  _unregisterCallback(eventName, callback) {
    this.client.off(eventName, callback);
  }

  _unregisterCallbacks(id) {
    this._log('_unregisterCallbacks');

    if (this.callbackMap[id]) {
      for (let eventId of Object.keys(this.callbackMap[id])) {
        this._unregisterCallback(eventId, this.callbackMap[id][eventId]);
      }

      this.callbackMap[id] = undefined;
    }
  }

  connect(id) {
    this._log('connect');
    this._addSubscriber(id);

    if (!this.client) {
      return this._connect();
    }

    if (!this.client.connected || this.client.disconnecting) {
      this._log('reconnect');
      this.client.reconnect();
    }

    return this;
  }

  disconnect(id) {
    this._log('disconnect');
    this._removeSubscriber(id);

    this._unregisterCallbacks(id);

    if (this.subscribers.size === 0) {
      this._disconnect();
    }
  }

  disconnectFromOutputNode(id) {
    this._log('disconnect');
    this._removeSubscriber(id);

    if (this.subscribers.size === 0) {
      this._disconnect(() => this._unregisterCallbacks(id));
    }
  }
};
