(function(window) {
  'use strict';

  if (!window.connio) {
    window.connio = {};
  }
})(window);

(function($, connio) {
  'use strict';

  /** @enum {string} */
  const HeaderKey = {
    APIAuthBackendURL: 'connio-backend-url',
    Username: 'connio-username',
    Password: 'connio-password',
  };

  class ConnioAuthAPI {
    /**
     * @param {string} apiAuthBackendURL
     */
    constructor(apiAuthBackendURL) {
      Object.assign(this, {
        headers: {
          [HeaderKey.APIAuthBackendURL]: apiAuthBackendURL,
        },
      });
    }

    /**
     * @param {string} url
     * @param {{ headers: Object }} { headers }
     * @returns {Promise<Object|Object[]>}
     */
    _get(url, { headers }) {
      return new Promise((resolve, reject) => {
        $.ajax({
          url,
          json: true,
          headers: {
            ...this.headers,
            ...headers,
          },
        })
          .done((response) => {
            return resolve(response);
          })
          .fail((error) => {
            let errorList = error.responseJSON;

            /**
             * @todo
             * `503` error returns `responseJSON` with string.
             * Maybe it's reasonable to check type of `responseJSON` field as well
             */
            if (!error.responseJSON) {
              switch (error.status) {
                case 404:
                  errorList = [
                    {
                      cause: error.statusText,
                      message:
                        error.responseText || 'Please provide a valid URL',
                    },
                  ];
                  break;
                default:
                  errorList = [
                    {
                      cause: error.statusText,
                      message: error.responseText || 'Error, please try again',
                    },
                  ];
              }
            }

            return reject(errorList);
          });
      });
    }

    /**
     * @param {string} username
     * @param {string} password
     * @returns {Promise<Object|Object[]>}
     */
    login(username, password) {
      return this._get('connio/credentias/login', {
        headers: {
          [HeaderKey.Username]: username,
          [HeaderKey.Password]: password,
        },
      });
    }
  }

  Object.assign(connio, {
    ConnioAuthAPI,
  });
})(window.$, window.connio);

(function(window, RED, connio) {
  'use strict';

  const { ConnioAuthAPI } = connio;

  /** @enum {string} */
  const EventType = {
    Click: 'click',
  };

  /** @enum {string} */
  const NotificationType = {
    Error: 'error',
  };

  /** @type {string} */
  const HTMLProperty = {
    Disabled: 'disabled',
    Readonly: 'readonly',
  };

  /** @type {string} */
  const EMPTY_SELECT_VALUE = '_ADD_';

  /**
   * @param {string} message
   * @returns {string}
   */
  function textErrorNotificationTemplate(message = '') {
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
  function jsonErrorNotificationTemplate({ cause = '', message = '' } = {}) {
    return `
      <b>Connio</b>
      <br>

      <i>${cause}</i>
      <br><br>

      ${message}
    `;
  }

  /**
   * @param {string} nodeId
   * @returns {Object}
   */
  function getREDNodeByID(nodeId) {
    return RED.nodes.node(nodeId);
  }

  const CredentialsNode = {
    category: 'config',
    defaults: {
      connioConfig: {
        type: 'connio-config',
      },
      email: {
        required: true,
      },
      account: {
        required: true,
      },
      accountUI: {
        required: true,
      },
    },
    credentials: {
      password: {
        type: 'password',
        required: true,
      },
      apiKeyId: {
        type: 'password',
        required: true,
      },
      apiKeySecret: {
        type: 'password',
        required: true,
      },
    },
    label() {
      let accountName = this.accountUI || '';

      return accountName ? `${accountName} (${this.email})` : this.email;
    },
    oneditprepare() {
      let $submitButton = $('#node-config-dialog-ok');

      let $loginButton = $('#connio-button-login');
      let $logoutButton = $('#connio-button-logout');

      let $connioConfig = $('#node-config-input-connioConfig');
      let $connioConfigLookup = $('#node-config-input-lookup-connioConfig');

      let $email = $('#node-config-input-email');
      let $password = $('#node-config-input-password');

      let $accountUI = $('#node-config-input-accountUI');

      let $account = $('#node-config-input-account');
      let $apiKeyId = $('#node-config-input-apiKeyId');
      let $apiKeySecret = $('#node-config-input-apiKeySecret');

      let translate = this._.bind(this);

      if ($account.val() && $connioConfig.val() !== EMPTY_SELECT_VALUE) {
        $submitButton.hide();
      }

      if ($account.val()) {
        $loginButton.hide();
        $logoutButton.show();

        $email.prop(HTMLProperty.Readonly, true);
        $password.prop(HTMLProperty.Readonly, true);

        $connioConfig.prop(HTMLProperty.Disabled, true);
        $connioConfigLookup.css({
          backgroundColor: '#f9f9f9',
          pointerEvents: 'none',
        });
      } else {
        $loginButton.show();
        $logoutButton.hide();

        $email.prop(HTMLProperty.Readonly, false);
        $password.prop(HTMLProperty.Readonly, false);

        $connioConfig.prop(HTMLProperty.Disabled, false);
        $connioConfigLookup.css({
          backgroundColor: 'white',
          pointerEvents: 'initial',
        });

        $submitButton.hide();
      }

      $loginButton.on(EventType.Click, () => {
        if ($connioConfig.val() === EMPTY_SELECT_VALUE) {
          RED.notify(
            textErrorNotificationTemplate(
              'Please add deployment configuration',
            ),
            NotificationType.Error,
          );

          return;
        }

        if (!$email.val() || !$password.val()) {
          RED.notify(
            textErrorNotificationTemplate('Please provide e-mail and password'),
            NotificationType.Error,
          );

          return;
        }

        let username = $email.val();
        let password = $password.val();

        let { backendUrl: apiAuthBackendURL } = getREDNodeByID(
          $connioConfig.val(),
        );

        let _loginButtonText = $loginButton.text();

        $loginButton.text(translate('common.loading'));
        $loginButton.prop(HTMLProperty.Disabled, true);

        new ConnioAuthAPI(apiAuthBackendURL)
          .login(username, password)
          .then((response) => {
            let { account, apiKey } = response;

            $submitButton.show();

            $loginButton.hide();
            $logoutButton.show();

            $email.prop(HTMLProperty.Readonly, true);
            $password.prop(HTMLProperty.Readonly, true);

            $connioConfig.prop(HTMLProperty.Disabled, true);
            $connioConfigLookup.css({
              backgroundColor: '#f9f9f9',
              pointerEvents: 'none',
            });

            $accountUI.val(account.friendlyName || account.name);
            $account.val(account.name);
            $apiKeyId.val(apiKey.id);
            $apiKeySecret.val(apiKey.secret);
          })
          .catch((errorList) => {
            $loginButton.text('Error, please try again');

            errorList.forEach((error) => {
              RED.notify(
                jsonErrorNotificationTemplate(error),
                NotificationType.Error,
              );
            });
          })
          .finally(() => {
            window.setTimeout(() => {
              $loginButton.text(_loginButtonText);
              $loginButton.prop(HTMLProperty.Disabled, false);
            }, 1250);
          });
      });

      $logoutButton.on(EventType.Click, () => {
        $email.val(undefined);
        $password.val(undefined);
        $accountUI.val(undefined);
        $account.val(undefined);
        $apiKeyId.val(undefined);
        $apiKeySecret.val(undefined);

        $submitButton.hide();

        $loginButton.show();
        $logoutButton.hide();

        $email.prop(HTMLProperty.Readonly, false);
        $password.prop(HTMLProperty.Readonly, false);

        $connioConfig.prop(HTMLProperty.Disabled, false);
        $connioConfigLookup.css({
          backgroundColor: 'white',
          pointerEvents: 'initial',
        });
      });
    },
    oneditsave() {
      RED.events.emit('@credentials/update');
    },
  };

  RED.nodes.registerType('connio-credentials', CredentialsNode);
})(window, window.RED, window.connio);
