class NodeStatusManager {
  /**
   * @param {Object} node NodeRED node
   */
  constructor(node) {
    Object.assign(this, {
      managedNode: node,
      status: new Map(),
    });
  }

  /**
   * @param {...{ id: StatusType, message: StatusMessage, color: StatusColor }} status
   */
  register(...statusList) {
    for (let { id, ...config } of statusList) {
      this.status.set(id, config);
    }
  }

  /**
   * @param {string} id
   */
  set(id) {
    let { message, color } = this.status.get(id);

    this.managedNode.status({
      fill: color,
      shape: 'ring',
      text: message,
    });
  }
}

module.exports = {
  NodeStatusManager,
};
