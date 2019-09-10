const path = require('path');
const request = require('request-promise-native');

require('dotenv').config({
  path: path.resolve(__dirname, '..', '.env'),
});

function log(...args) {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args);
  }
}

/**
 * @param {string} username
 * @param {string} password
 * @param {{ url: string, username: string, password: string }}
 * @returns {Promise<{ user: Object, apiKey: Object }>}
 */
function login(email, password, url) {
  log('utils :: login');

  const defaultRequestParams = {
    method: 'POST',
    url,
    headers: {
      'Content-Type': 'application/json',
    },
    json: true,
  };

  return request({
    ...defaultRequestParams,
    body: {
      email,
      password,
    },
  })
    .then((response) => {
      log('utils :: login :: SUCCESS');

      return response;
    })
    .catch((error) => {
      log('utils :: login :: ERROR');

      return error;
    });
}

module.exports = {
  log,
  login,
};
