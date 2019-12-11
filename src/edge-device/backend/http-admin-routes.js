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
      '@connio/mqtt : httpAdmin : connioConfigMiddleware : secret credentials',
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
function devices(req, res) {
  return axios
    .get('/devices', req.ctx.connio)
    .then(({ data }) => {
      req.ctx.RED.log.debug('@connio/mqtt : httpAdmin : /devices : SUCCESS');

      res.json(data);
    })
    .catch(({ response = {} }) => {
      req.ctx.RED.log.debug('@connio/mqtt : httpAdmin : /devices : ERROR');

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
      req.ctx.RED.log.debug('@connio/mqtt : httpAdmin : /devices : SUCCESS');

      let { id, secret } = data;

      res.json({
        id,
        secret,
      });
    })
    .catch(({ response = {} }) => {
      req.ctx.RED.log.debug('@connio/mqtt : httpAdmin : /devices : ERROR');

      let { data: { error } = {}, status } = response;

      res.status(status).json(error);
    });
}

/**
 * @param {Object} req
 * @param {Object} res
 */
function properties(req, res) {
  let { ownerId } = req.query;

  return axios
    .get(`/properties?ownerId=${ownerId}`, req.ctx.connio)
    .then(({ data }) => {
      req.ctx.RED.log.debug('@connio/mqtt : httpAdmin : /properties : SUCCESS');

      res.json(data);
    })
    .catch(({ response = {} }) => {
      req.ctx.RED.log.debug('@connio/mqtt : httpAdmin : /properties : ERROR');

      let { data: { error } = {}, status } = response;

      res.status(status).json(error);
    });
}

/**
 * @param {Object} req
 * @param {Object} res
 */
function methods(req, res) {
  let { ownerId } = req.query;

  return axios
    .get(`/methods?ownerId=${ownerId}`, req.ctx.connio)
    .then(({ data }) => {
      req.ctx.RED.log.debug('@connio/mqtt : httpAdmin : /methods : SUCCESS');

      res.json(data);
    })
    .catch(({ response = {} }) => {
      req.ctx.RED.log.debug('@connio/mqtt : httpAdmin : /methods : ERROR');

      let { data: { error } = {}, status } = response;

      res.status(status).json(error);
    });
}

module.exports = function createRoutes(RED) {
  let httpAdminRouteList = [
    {
      method: 'get',
      path: '/connio/devices',
      controller: devices,
      middleware: [connioConfig],
    },
    {
      method: 'get',
      path: '/connio/devices/:id/api-key',
      controller: deviceApiKey,
      middleware: [connioConfig],
    },
    {
      method: 'get',
      path: '/connio/properties',
      controller: properties,
      middleware: [connioConfig],
    },
    {
      method: 'get',
      path: '/connio/methods',
      controller: methods,
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
