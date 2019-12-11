module.exports = {
  extends: ['eslint:recommended', 'plugin:prettier/recommended'],
  env: {
    es2020: true,
    node: true,
    browser: true,
    jquery: true,
  },
  globals: {
    RED: 'readable',
    Vue: 'readable',
  },
};
