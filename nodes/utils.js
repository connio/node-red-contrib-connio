const axios = require('axios');

function log(...args) {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args);
  }
}

/**
 * @param {string} email
 * @param {string} password
 * @param {string} url
 * @returns {Promise<{ user: Object, apiKey: Object, account: Object }>}
 */
async function login(email, password, url) {
  log('utils :: login');

  try {
    let response = await axios.post(url, {
      email,
      password,
    });

    log('utils :: login :: SUCCESS');

    return response.data;
  } catch (error) {
    log('utils :: login :: ERROR');

    return Promise.reject(error);
  }
}

module.exports = {
  log,
  login,
};
