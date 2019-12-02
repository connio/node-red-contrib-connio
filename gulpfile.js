const browerSync = require('browser-sync');
const del = require('del');
const gulp = require('gulp');
const gulpHtmlmin = require('gulp-htmlmin');
const gulpIf = require('gulp-if');
const gulpTerser = require('gulp-terser');
const path = require('path');
const nodemon = require('nodemon');
const browserSync = require('browser-sync');

const gulpNodeRedNodes = require('./gulp-node-red-nodes');

let nodemonInstance;
let browserSyncInstance;

let config = {
  nodeRedUrl: 'http://localhost:1880',
  dist: path.resolve(__dirname, 'nodes'),
  src: path.resolve(__dirname, 'src'),
  nodeNamePrefix: 'connio',
};

function copyAssets() {
  let srcGlobs = [
    `${config.src}/**/*`,
    `!${config.src}/**/ui/**`,
    `!${config.src}/**/backend/**`,
  ];

  return gulp.src(srcGlobs)
    .pipe(gulp.dest(config.dist));
}

function copyBackendNode() {
  let srcGlobs = [
    `${config.src}/**/backend/**/*.js`,
    `!${config.src}/shared/**/*`,
  ];

  return gulp.src(srcGlobs)
    .pipe(gulp.dest((file) => {
      let [filename] = file.basename.split('.');

      file.path = path.join(file.base, filename, file.basename);

      return config.dist;
    }));
}

function buildUINode() {
  let srcGlobs = [
    `${config.src}/**/ui/**/*.js`,
    `${config.src}/**/ui/**/*.html`,
    `!${config.src}/shared/**/*`,
  ];

  return gulp.src(srcGlobs)
    .pipe(gulpIf(
      (file) => file.extname === '.js',
      gulpTerser({
        compress: {
          drop_debugger: false,
        },
      }),
    ))
    .pipe(gulpNodeRedNodes(config.nodeNamePrefix))
    .pipe(gulpHtmlmin({
      processScripts: [
        'text/x-red',
      ],
      collapseWhitespace: true,
      minifyCSS: true,
    }))
    .pipe(gulp.dest(config.dist));
}

function runNodemonAndBrowserSync(cb) {
  nodemonInstance = nodemon(`
    nodemon
    --ignore **/*
    --exec node-red -u .node-red
  `);

  nodemon
    .on('start', () => {
      if (!browserSyncInstance) {
        return;
      }

      browserSyncInstance.reload();

      console.log('SHOULD REFRESH')
    })
    .once('start', () => {
      browserSyncInstance = browserSync.create();

      browserSyncInstance.init({
        ui: false,
        proxy: {
          target: config.nodeRedUrl,
          ws: true
        },
        ghostMode: false,
        open: false,
        reloadDelay: 5000,
      });
    })
    .on('quit', process.exit)

  cb();
}

async function cleanDist() {
  await del(config.dist);
}

function restartNodemon(cb) {
  nodemonInstance.restart();

  cb();
};

const buildNodeRedNodes = gulp.parallel(
  copyAssets,
  copyBackendNode,
  buildUINode,
);

module.exports = {
  build: gulp.series(
    cleanDist,
    buildNodeRedNodes,
  ),

  start: gulp.series(
    cleanDist,
    buildNodeRedNodes,
    runNodemonAndBrowserSync,
    function watcher(cb) {
      gulp.watch(`${config.src}/**/*`, gulp.series(
        buildNodeRedNodes,
        restartNodemon,
      ))

      cb();
    }
  ),
};
