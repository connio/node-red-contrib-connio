const axios = require('axios');
const defineCtx = require('../define-ctx-middleware');
const defineRED = require('../define-red-middleware');
const HeaderKey = require('../header-key');

/**
 * @param {Object} headers
 * @returns {{ username: string, password: string }}
 */
function getCredentialsFromHeaders(headers) {
  return {
    username: headers[HeaderKey.Username],
    password: headers[HeaderKey.Password],
  };
}

/**
 * @param {Object} headers
 * @returns {string}
 */
function getApiUrl(headers) {
  return headers[HeaderKey.ApiURL];
}

/**
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
function connioConfig(req, res, next) {
  let apiUrl = getApiUrl(req.headers);
  let { username, password } = getCredentialsFromHeaders(req.headers);

  if (!username || !password) {
    req.ctx.RED.log.debug(
      '@connio/edge-gateway-out : httpAdmin : connioConfigMiddleware : secret credentials',
    );
    let nodeId = req.headers[HeaderKey.CredentialsNodeId];

    ({ apiKeyId: username, apiKeySecret: password } =
      req.ctx.RED.nodes.getCredentials(nodeId) || {});
  }

  Object.assign(req.ctx, {
    connio: {
      baseURL: apiUrl,
      auth: {
        username,
        password,
      },
    },
  });

  next();
}

/**
 * @param {Object} req
 * @param {Object} res
 */
function gatewayDevices(req, res) {
  return axios
    .get('/devices?is_a=Gateway', req.ctx.connio)
    .then(({ data }) => {
      req.ctx.RED.log.debug(
        '@connio/edge-gateway-out : httpAdmin : /gatewayDevices : SUCCESS',
      );

      res.json(data);
    })
    .catch(({ response = {} }) => {
      req.ctx.RED.log.debug(
        '@connio/edge-gateway-out : httpAdmin : /gatewayDevices : ERROR',
      );

      let { data: { error } = {}, status } = response;

      res.status(status).json(error);
    });
}

/**
 * @param {Object} req
 * @param {Object} res
 */
function deviceApiKey(req, res) {
  let { id: deviceId } = req.params;

  return axios
    .get(`/devices/${deviceId}/apikey`, req.ctx.connio)
    .then(({ data }) => {
      req.ctx.RED.log.debug(
        '@connio/edge-gateway-out : httpAdmin : /deviceApiKey : SUCCESS',
      );

      let {
        id,
        secret,
        context: { ids },
      } = data;

      res.json({
        id,
        secret,
        deviceIds: ids,
      });
    })
    .catch(({ response = {} }) => {
      req.ctx.RED.log.debug(
        '@connio/edge-gateway-out : httpAdmin : /deviceApiKey : ERROR',
      );

      let { data: { error } = {}, status } = response;

      res.status(status).json(error);
    });
}

module.exports = function createRoutes(RED) {
  let httpAdminRouteList = [
    {
      method: 'get',
      path: '/connio/edge-gateway-out/gateway-devices',
      controller: gatewayDevices,
      middleware: [connioConfig],
    },
    {
      method: 'get',
      path: '/connio/edge-gateway-out/devices/:id/api-key',
      controller: deviceApiKey,
      middleware: [connioConfig],
    },
  ];

  for (let route of httpAdminRouteList) {
    let { method, path, middleware, controller } = route;

    RED.httpAdmin.use(defineCtx, defineRED(RED));

    if (middleware) {
      RED.httpAdmin[method](path, ...middleware, controller);
    } else {
      RED.httpAdmin[method](path, controller);
    }
  }
};
