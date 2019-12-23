/**
 * @todo
 * Current implementation looking only for direct connections.
 * If nodes are connected via `link` node (or something else), there is
 * no way detect that. The algorithm should be improved for such cases.
 * @param {{ flow: Object, wires: string[][] }} { flow, wires }
 * @returns {Promise<string>}
 */
function getOutputNodeId(nodeType, { flow, wires: [wires] = [] }) {
  return new Promise((resolve, reject) => {
    for (let nodeId of wires) {
      let node = flow.getNode(nodeId);

      if (node && node.type === nodeType) {
        resolve(nodeId);
      }
    }

    reject(`No "${nodeType}" node connected`);
  });
}

/**
 * @param {{ flow: Object, clientId: string, edgeMqttNodeId: string }}  { flow, clientId, edgeMqttNodeId }
 * @returns {Promise<Array>}
 */
function getLeftoverNodes(nodeType, { flow, clientId, edgeMqttNodeId }) {
  return new Promise((resolve) => {
    let leftoverNodes = Object.entries(flow.activeNodes).filter(([, def]) => {
      if (def.type !== nodeType) {
        return false;
      }

      if (def.deviceId !== clientId) {
        return false;
      }

      let [wires = []] = def.wires;

      return wires.some((nodeId) => nodeId === edgeMqttNodeId);
    });

    resolve(leftoverNodes);
  });
}

module.exports = {
  getLeftoverNodes,
  getOutputNodeId,
};
