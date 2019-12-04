/**
 * @param {Object} RED
 * @returns {(Object, Object, Function) => void}
 */
module.exports = function defineRED(RED) {
  return function(req, res, next) {
    Object.assign(req.ctx, {
      RED,
    });

    next();
  };
};
