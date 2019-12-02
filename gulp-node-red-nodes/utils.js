/**
 * @description
 * Check that amount of JS files is even with the amount of HTML templates
 * @param  {...Object} targets
 * @returns {boolean}
 */
function isBalanced(...targets) {
  if (!targets.length) {
    return false;
  }

  let [firstItem, ...restItems] = targets;
  let firstItemLength = Object.keys(firstItem).length;

  return restItems.every((t) => Object.keys(t).length === firstItemLength);
}

module.exports = {
  isBalanced,
};
