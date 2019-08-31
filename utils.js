const request = require('request-promise-native');
const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '.env'),
});

function _makeBasicHttpAuth(username, password) {
  let token = new Buffer.from(`${username}:${password}`).toString('base64');

  return `Basic ${token}`;
}

/**
 * @param {string} username
 * @param {string} password
 * @param {{ url: string, username: string, password: string }}
 * @returns {Promise<{ user: Object, apiKey: Object }>}
 */
function login(email, password, url) {
  console.log('utils :: login');

  const defaultRequestParams = {
    method: 'POST',
    url,
    headers: {
      'Content-Type': 'application/json',
    },
    json: true,
  };

  if (process.env.NODE_ENV === 'development') {
    /** @desc Remove once public auth API is ready */
    Object.assign(defaultRequestParams.headers, {
      Authorization: _makeBasicHttpAuth(
        process.env.IAPI_USERNAME,
        process.env.IAPI_PASSWORD,
      ),
    });
  }

  return request({
    ...defaultRequestParams,
    body: {
      email,
      password,
    },
  })
    .then((response) => {
      console.log('utils :: login :: SUCCESS');

      return response;
    })
    .catch((error) => {
      console.log('utils :: login :: ERROR');

      return error;
    });
}

module.exports = {
  login,
};
