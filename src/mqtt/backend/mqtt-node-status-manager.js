const { NodeStatusManager } = require('../node-status-manager');

/** @enum {string} */
const StatusType = {
  Connected: 0,
  Connecting: 1,
  Disconnected: 2,
  Error: 3,
  NotConnected: 4,
};

/** @enum {string} */
const StatusColor = {
  Green: 'green',
  Grey: 'grey',
  Red: 'red',
  Yellow: 'yellow',
};

/** @enum {string} */
const StatusMessage = {
  Connected: 'node-red:common.status.connected',
  Connecting: 'node-red:common.status.connecting',
  Disconnected: 'node-red:common.status.disconnected',
  Error: 'node-red:common.status.error',
  NotConnected: 'node-red:common.status.not-connected',
};

class MQTTNodeStatusManager extends NodeStatusManager {
  constructor(node) {
    super(node);

    this.onInit();
  }

  onInit() {
    this._registerStatuses();
    this._registerMethods();
  }

  _registerStatuses() {
    this.register(
      {
        id: StatusType.Connected,
        message: StatusMessage.Connected,
        color: StatusColor.Green,
      },
      {
        id: StatusType.NotConnected,
        message: StatusMessage.NotConnected,
        color: StatusColor.Grey,
      },
      {
        id: StatusType.Connecting,
        message: StatusMessage.Connecting,
        color: StatusColor.Yellow,
      },
      {
        id: StatusType.Disconnected,
        message: StatusMessage.Disconnected,
        color: StatusColor.Red,
      },
      {
        id: StatusType.Error,
        message: StatusMessage.Error,
        color: StatusColor.Red,
      },
    );
  }

  _registerMethods() {
    for (let [id] of Object.entries(StatusType)) {
      let setterName = `set${id}`;

      Object.assign(this, {
        [setterName]() {
          this.set(StatusType[id]);
        },
      });
    }
  }
}

module.exports = {
  MQTTNodeStatusManager,
};
