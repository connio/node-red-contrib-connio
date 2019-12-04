/**
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
module.exports = function defineCtx(req, res, next) {
  Object.assign(req, {
    ctx: {},
  });

  next();
};
