const through = require('through2').obj;
const File = require('vinyl');
const { jsTemplate, htmlTemplate } = require('./templates');
const { isBalanced } = require('./utils');

/** @enum {string} */
const FileType = {
  JS: '.js',
  HTML: '.html',
};

/** @enum {string} */
const ErrorMessage = {
  UnbalancedInput: 'Missing JS/HTML files',
};

/**
 * @param {string} nodePrefix
 */
module.exports = function gulpNodeRed(nodePrefix) {
  'use strict';

  let nodeRedFiles = {
    [FileType.JS]: {},
    [FileType.HTML]: {},
  };

  function processFiles(file, enc, callback) {
    if (!nodeRedFiles[file.extname][file.stem]) {
      nodeRedFiles[file.extname][file.stem] = '';
    }

    nodeRedFiles[file.extname][file.stem] = `
      ${nodeRedFiles[file.extname][file.stem]}
      ${file.contents.toString()}
    `;

    callback();
  }

  function flushResult(callback) {
    let nodeNameList = Object.keys(nodeRedFiles[FileType.JS]);
    let isUnbalanced = !isBalanced(nodeRedFiles[FileType.JS], nodeRedFiles[FileType.HTML]);

    if (isUnbalanced) {
      callback(new Error(ErrorMessage.UnbalancedInput));
    }

    for (let nodeName of nodeNameList) {
      let js = jsTemplate(nodeRedFiles[FileType.JS][nodeName]);

      let html = htmlTemplate(
        nodeName,
        nodePrefix,
        nodeRedFiles[FileType.HTML][nodeName],
      );

      let output = new File({
        contents: Buffer.from(`${js}${html}`),
        base: process.cwd(),
        path: `${process.cwd()}/${nodeName}/${nodeName}.html`,
      });

      this.push(output);
    }

    callback();
  }

  return through(processFiles, flushResult);
};
