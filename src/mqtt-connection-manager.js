const MQTTConnection = require('./mqtt-connection');

let mqttConnectionManagerInstance;

class MQTTConnectionManager {
  constructor() {
    Object.assign(this, {
      connections: new Map(),
    });
  }

  _log(...args) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[debug] [MQTTConnectionManager]', args.join(' : '));
    }
  }

  add(url, { clientId, username, password }) {
    this._log('add', clientId);

    this.connections.set(
      clientId,
      new MQTTConnection(url, { clientId, username, password }),
    );
  }

  useConnection(url, { clientId, username, password }) {
    this._log(
      'useConnection',
      'use previous connection',
      this.connections.has(clientId),
    );

    if (!this.connections.has(clientId)) {
      this.add(url, { clientId, username, password });
    }

    return this.connections.get(clientId);
  }

  disconnectFromOutputNode(nodeId, clientId) {
    this._log('disconnect (start)', nodeId, clientId);

    let connection = this.connections.get(clientId);

    if (connection) {
      connection.disconnectFromOutputNode(nodeId);
    } else {
      this._log('disconnect', 'connection not found', nodeId, clientId);
    }
  }

  disconnectAll(nodeId) {
    this._log('disconnectAll');

    for (let [clientId, connection] of this.connections) {
      this._log('disconnectAll', 'connection', clientId, 'from', nodeId);

      connection.disconnect(nodeId);
    }
  }
}

module.exports = function MQTTConnectionManagerSingleton() {
  if (!mqttConnectionManagerInstance) {
    mqttConnectionManagerInstance = new MQTTConnectionManager();
  }

  return mqttConnectionManagerInstance;
};
