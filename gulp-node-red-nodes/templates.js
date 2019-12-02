/**
 * @param {string} nodeName
 * @param {string?} nodePrefix
 * @returns {string}
 */
function _makeTemplateName(nodeName, nodePrefix) {
  if (!nodePrefix) {
    return nodeName;
  }

  return `${nodePrefix}-${nodeName}`;
}

/**
 * @param {string} content
 * @returns {string}
 */
function jsTemplate(content) {
  return `
    <script type="text/javascript">
      ${content}
    </script>
  `;
}

/**
 * @param {string} nodeName
 * @param {string?} nodePrefix
 * @param {string} content
 * @returns {string}
 */
function htmlTemplate(nodeName, nodePrefix, content) {
  let templateName = _makeTemplateName(nodeName, nodePrefix);

  return `
    <script type="text/x-red" data-template-name="${templateName}">
      ${content}
    </script>
  `;
}

module.exports = {
  jsTemplate,
  htmlTemplate,
};
