const axios = require('axios');
const { login: apiLogin } = require('../utils');

const AUTH_NODE_ID_TOKEN = 'auth-node-id';
const CONNIO_API_URL_TOKEN = 'connio-api-url';
const CONNIO_BACKEND_URL_TOKEN = 'connio-backend-url';
const CONNIO_KEY_ID_TOKEN = 'connio-key-id';
const CONNIO_KEY_SECRET_TOKEN = 'connio-key-secret';
const CONNIO_PASSWORD_TOKEN = 'connio-password';
const CONNIO_USERNAME_TOKEN = 'connio-username';

/**
 * @param {Object} headers
 * @returns {{ username: string, password: string }}
 */
function getCredentials(headers) {
  return {
    username: headers[CONNIO_KEY_ID_TOKEN],
    password: headers[CONNIO_KEY_SECRET_TOKEN],
  };
}

/**
 * @param {Object} headers
 * @returns {string}
 */
function getApiUrl(headers) {
  return headers[CONNIO_API_URL_TOKEN];
}

/**
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
function defineCtx(req, res, next) {
  Object.assign(req, {
    ctx: {},
  });

  next();
}

/**
 * @param {Object} RED
 * @returns {(Object, Object, Function) => void}
 */
function defineRED(RED) {
  return function(req, res, next) {
    Object.assign(req.ctx, {
      RED,
    });

    next();
  };
}

/**
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
function connioConfig(req, res, next) {
  let apiUrl = getApiUrl(req.headers);
  let { username, password } = getCredentials(req.headers);

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
function login(req, res) {
  let requestPayload = [];

  let authUrl = `${req.headers[CONNIO_BACKEND_URL_TOKEN]}/identity/login`;

  if (req.headers[AUTH_NODE_ID_TOKEN]) {
    let { email, credentials } = req.ctx.RED.nodes.getNode(
      req.headers[AUTH_NODE_ID_TOKEN],
    );

    requestPayload = [email, credentials.password, authUrl];
  } else {
    requestPayload = [
      req.headers[CONNIO_USERNAME_TOKEN],
      req.headers[CONNIO_PASSWORD_TOKEN],
      authUrl,
    ];
  }

  return apiLogin(...requestPayload)
    .then((response) => {
      req.ctx.RED.log.debug('@connio/mqtt : httpAdmin : /login : SUCCESS');

      res.json(response);
    })
    .catch(({ response = {} }) => {
      req.ctx.RED.log.debug('@connio/mqtt : httpAdmin : /login : ERROR');

      let { data: { error } = {}, status } = response;

      res.status(status).json(error);
    });
}

/**
 * @param {Object} req
 * @param {Object} res
 */
function apiClients(req, res) {
  return axios
    .get('/apiclients', req.ctx.connio)
    .then(({ data }) => {
      req.ctx.RED.log.debug(
        '@connio/mqtt : httpAdmin : /api-clients : SUCCESS',
      );

      let { results: apiClients } = data;

      res.json(apiClients);
    })
    .catch(({ response = {} }) => {
      req.ctx.RED.log.debug('@connio/mqtt : httpAdmin : /api-clients : ERROR');

      let { data: { error } = {}, status } = response;

      res.status(status).json(error);
    });
}

/**
 * @param {Object} req
 * @param {Object} res
 */
function apiKey(req, res) {
  let { clientId } = req.query;

  return axios
    .get(`/apiclients/${clientId}/apikey`, req.ctx.connio)
    .then(({ data }) => {
      req.ctx.RED.log.debug('@connio/mqtt : httpAdmin : /api-key : SUCCESS');

      let { id, secret, context } = data;

      res.json({
        id,
        secret,
        appList: context.type === 'app' ? context.ids : undefined,
      });
    })
    .catch(({ response = {} }) => {
      req.ctx.RED.log.debug('@connio/mqtt : httpAdmin : /api-key : ERROR');

      let { data: { error } = {}, status } = response;

      res.status(status).json(error);
    });
}

/**
 * @param {Object} req
 * @param {Object} res
 */
function app(req, res) {
  let { id } = req.query;

  return axios
    .get(`/apps/${id}`, req.ctx.connio)
    .then(({ data }) => {
      req.ctx.RED.log.debug('@connio/mqtt : httpAdmin : /app : SUCCESS');

      res.json({
        name: data.name,
        friendlyName: data.friendlyName,
      });
    })
    .catch(({ response = {} }) => {
      req.ctx.RED.log.debug('@connio/mqtt : httpAdmin : /app : ERROR');

      let { data: { error } = {}, status } = response;

      res.status(status).json(error);
    });
}

module.exports = function createRoutes(RED) {
  let httpAdminRouteList = [
    {
      method: 'get',
      path: '/login',
      controller: login,
    },
    {
      method: 'get',
      path: '/api-clients',
      controller: apiClients,
      middleware: [connioConfig],
    },
    {
      method: 'get',
      path: '/api-key',
      controller: apiKey,
      middleware: [connioConfig],
    },
    {
      method: 'get',
      path: '/app',
      controller: app,
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
