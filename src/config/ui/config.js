/** @enum {string} */
const NotificationType = {
  ERROR: 'error',
};

/**
 * @param {string} message
 * @returns {string}
 */
function textErrorTpl(message = '') {
  return `
    <b>Connio</b>
    <br><br>

    ${message}
  `;
}

/**
 * @param {{ cause: string, message: string }} error
 * @returns {string}
 */
function jsonErrorTpl({ cause = '', message = '' } = {}) {
  return `
    <b>Connio</b>
    <br>

    <i>${cause}</i>
    <br><br>

    ${message}
  `;
}

const ConfigNode = {
  category: 'config',
  defaults: {
    apiUrl: {
      required: true,
    },
    backendUrl: {
      required: true,
    },
    mqttUrl: {
      required: true,
    },
    name: {
      value: 'Connio Cloud',
    },
  },
  label() {
    return this.name;
  },
  oneditprepare() {
    let $_submitButton = $('#node-config-dialog-ok');
    let $submitButton = $_submitButton.clone();

    let $backendUrl = $('#node-config-input-backendUrl');
    let $apiUrl = $('#node-config-input-apiUrl');
    let $mqttUrl = $('#node-config-input-mqttUrl');

    $_submitButton.after($submitButton);
    $_submitButton.hide();

    $submitButton.on('click', () => {
      if (!$backendUrl.val()) {
        RED.notify(
          textErrorTpl(this._('backend-url-field.error.empty')),
          NotificationType.ERROR,
        );

        return;
      }

      let submitText = $submitButton.text();

      $submitButton.text(this._('common.loading'));

      $.ajax({
        url: 'connio-settings',
        json: true,
        headers: {
          'connio-backend-url': $backendUrl.val(),
        },
      })
        .done((settings) => {
          $apiUrl.val(settings.api.public.url);
          $mqttUrl.val(settings.mqtt.tcp);

          $_submitButton.click();
        })
        .fail((error) => {
          $submitButton.text(submitText);

          if (!error.responseJSON) {
            RED.notify(
              textErrorTpl(error.statusText),
              NotificationType.ERROR,
            );
          } else {
            RED.notify(
              jsonErrorTpl(error.responseJSON[0]),
              NotificationType.ERROR,
            );
          }
        });
    });
  },
  oneditsave() {
    const nextConfig = {
      backendUrl: $('#node-config-input-backendUrl').val(),
      apiUrl: $('#node-config-input-apiUrl').val(),
      mqttUrl: $('#node-config-input-mqttUrl').val(),
    };

    if (
      nextConfig.backendUrl !== this.backendUrl ||
      nextConfig.apiUrl !== this.apiUrl ||
      nextConfig.mqttUrl !== this.mqttUrl
    ) {
      RED.events.emit('@config/update', nextConfig);
    }
  },
};

RED.nodes.registerType('connio-config', ConfigNode);
