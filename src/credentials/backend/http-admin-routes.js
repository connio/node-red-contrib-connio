const axios = require('axios');
const defineCtxMiddleware = require('../define-ctx-middleware');
const defineREDMiddleware = require('../define-red-middleware');

/** @enum {string} */
const HeaderKey = {
  AuthNodeID: 'auth-node-id',
  APIAuthBackendURL: 'connio-backend-url',
  Password: 'connio-password',
  Username: 'connio-username',
};

/**
 * @param {Object} headers
 * @returns {string}
 */
function getAPIAuthBackendURLFromHeaders(headers) {
  return headers[HeaderKey.APIAuthBackendURL];
}

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
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
function connioConfigMiddleware(req, res, next) {
  let apiAuthBackendURL = getAPIAuthBackendURLFromHeaders(req.headers);
  let { username, password } = getCredentialsFromHeaders(req.headers);

  Object.assign(req.ctx, {
    connio: {
      baseURL: apiAuthBackendURL,
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
function login(req, res) {
  return axios
    .post(
      '/identity/login',
      {
        email: req.ctx.connio.auth.username,
        password: req.ctx.connio.auth.password,
      },
      {
        baseURL: req.ctx.connio.baseURL,
      },
    )
    .then((response) => {
      req.ctx.RED.log.debug(
        '@connio/credentials : httpAdmin : /login : SUCCESS',
      );

      res.json(response.data);
    })
    .catch(({ response = {} }) => {
      req.ctx.RED.log.debug('@connio/credentials : httpAdmin : /login : ERROR');

      let { data: { error } = {}, status } = response;

      res.status(status).json(error);
    });
}

/**
 * @param {Object} RED
 */
module.exports = function createRoutes(RED) {
  let httpAdminRouteList = [
    {
      method: 'get',
      path: '/connio/credentias/login',
      controller: login,
      middleware: [connioConfigMiddleware],
    },
  ];

  for (let route of httpAdminRouteList) {
    let { method, path, middleware, controller } = route;

    RED.httpAdmin.use(defineCtxMiddleware, defineREDMiddleware(RED));

    if (middleware) {
      RED.httpAdmin[method](path, ...middleware, controller);
    } else {
      RED.httpAdmin[method](path, controller);
    }
  }
};
