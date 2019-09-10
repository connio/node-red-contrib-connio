module.exports = {
  ui: false,
  files: ['nodes/**/*.js', 'nodes/**/*.html', 'nodes/**/*.json'],
  proxy: {
    target: 'localhost:1880',
    ws: true,
  },
  ghostMode: false,
  open: false,
  reloadDelay: 5000,
  minify: false,
};
