const { NodeStatusManager } = require('../node-status-manager');

/** @enum {string} */
const StatusType = {
  Error: 0,
};

/** @enum {string} */
const StatusColor = {
  Red: 'red',
};

/** @enum {string} */
const StatusMessage = {
  Error: 'Error, invalid input devices',
};

class EdgeGatewayOutNodeStatusManager extends NodeStatusManager {
  constructor(node) {
    super(node);

    this.onInit();
  }

  onInit() {
    this._registerStatuses();
    this._registerMethods();
  }

  _registerStatuses() {
    this.register({
      id: StatusType.Error,
      message: StatusMessage.Error,
      color: StatusColor.Red,
    });
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
  EdgeGatewayOutNodeStatusManager,
};
