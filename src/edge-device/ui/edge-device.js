(function(window) {
  'use strict';

  if (!window.connio) {
    Object.assign(window, {
      connio: {},
    });
  }

  Object.assign(window.connio, {
    edgeDeviceUI: {},
  });
})(window);

(function($, connio) {
  /** @enum {string} */
  const HeaderKey = {
    CredentialsNodeId: 'auth-node-id' /** @todo 'credentials-node-id' */,
    ApiURL: 'connio-api-url' /** @todo 'connio-api-url' */,
    Username: 'connio-key-id' /** @todo 'connio-api-username' */,
    Password: 'connio-key-secret' /** @todo 'connio-api-password' */,
  };

  class ConnioAPI {
    constructor(apiURL, { apiKeyId, apiKeySecret, credentialsNodeId } = {}) {
      Object.assign(this, {
        headers: {
          [HeaderKey.ApiURL]: apiURL,
          [HeaderKey.Username]: apiKeyId,
          [HeaderKey.Password]: apiKeySecret,
          [HeaderKey.CredentialsNodeId]: credentialsNodeId,
        },
      });
    }

    _get(url, { headers = {}, ...restConfig } = {}) {
      return new Promise((resolve, reject) => {
        $.ajax({
          url: `connio${url}`,
          json: true,
          headers: {
            ...this.headers,
            ...headers,
          },
          ...restConfig,
        })
          .done((response) => {
            resolve(response);
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
                case 401:
                  errorList = [
                    {
                      cause: error.statusText,
                      message:
                        error.responseText ||
                        'The authorization credentials provided for the request are invalid',
                    },
                  ];
                  break;
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

            reject(errorList);
          });
      });
    }

    fetchDevices() {
      return this._get('/devices');
    }

    fetchDeviceApiKey(deviceId) {
      return this._get(`/devices/${deviceId}/api-key`);
    }

    fetchProperties(ownerId, headers) {
      return this._get(`/properties?ownerId=${ownerId}`, { headers });
    }

    fetchMethods(ownerId, headers) {
      return this._get(`/methods?ownerId=${ownerId}`, { headers });
    }
  }

  Object.assign(connio.edgeDeviceUI, {
    ConnioAPI,
    HeaderKey,
  });
})(window.$, window.connio);

(function(window, $, RED, connio) {
  'use strict';

  let { ConnioAPI, HeaderKey } = connio.edgeDeviceUI;

  /** @enum {string} */
  const RedEvent = {
    NodesAdd: 'nodes:add',
    NodesRemove: 'nodes:remove',
    EditorSave: 'editor:save',
  };

  /** @enum {number} */
  const OutputType = {
    None: -1,
    Property: 0,
    Method: 1,
  };

  /**
   * @description
   * Use $.ajax() since it is more flexible than $.getScript
   * Return the jqXHR object so we can chain callbacks.
   * Allow user to set any option except for dataType, cache, and url
   */
  function getScript(url, options = {}) {
    options = $.extend(options, {
      dataType: 'script',
      cache: true,
      url,
    });

    return $.ajax(options);
  }

  /**
   * @param {Object} $select
   * @returns {{ value: string, label: string }[]}
   */
  function getAccountList($select) {
    let $options = $select.find('option');

    return Array.from($options).map((element) => {
      return {
        value: element.value,
        label: element.label,
      };
    });
  }

  function getOutputType(propertyName, methodName) {
    if (propertyName) {
      return OutputType.Property;
    } else if (methodName) {
      return OutputType.Method;
    } else {
      return OutputType.None;
    }
  }

  let vueApp;

  function destroyVueApp() {
    if (vueApp) {
      vueApp.$destroy();
    }
  }

  function onEditPrepare() {
    let $submitButton = $('#node-dialog-ok');

    let $accountSelect = $('#node-input-accountNodeId');
    let $accountLookup = $('#node-input-lookup-accountNodeId');

    let $deviceId = $('#node-input-deviceId');
    let $deviceName = $('#node-input-deviceName');
    let $deviceApiKeyId = $('#node-input-deviceApiKeyId');
    let $deviceApiKeySecret = $('#node-input-deviceApiKeySecret');

    let $propertyName = $('#node-input-propertyName');
    let $methodName = $('#node-input-methodName');

    let $name = $('#node-input-name');

    let $vueAppContainer = $('#connio-edge-device-vue-app-container');
    let $vueAppLoader = $('#connio-edge-device-vue-app-loader');
    let $vueAppError = $('#connio-edge-device-vue-app-error');

    let IconicButton = {
      name: 'co-iconic-button',
      def: {
        props: {
          click: {
            type: Function,
            required: true,
          },
          icon: {
            type: String,
            required: true,
          },
        },
        template: `
          <button type="button" class="red-ui-button" v-on:click="click">
            <i :class="'fa fa-' + icon"></i>
          </button>
        `,
      },
    };

    getScript('https://cdn.jsdelivr.net/npm/vue@2.6.0')
      .then(() => {
        $vueAppLoader.hide();
        $vueAppContainer.show();

        vueApp = new Vue({
          el: '#connio-edge-device-vue-app-container',
          components: {
            [IconicButton.name]: IconicButton.def,
          },
          data: {
            name: $name.val(),

            OutputType,

            isLoading: false,
            errorList: undefined,

            accountList: getAccountList($accountSelect),
            accountNodeId: $accountSelect.val(),

            deviceId: $deviceId.val(),
            deviceName: $deviceName.val(),
            deviceApiKeyId: $deviceApiKeyId.val(),
            deviceApiKeySecret: $deviceApiKeySecret.val(),

            outputType: getOutputType($propertyName.val(), $methodName.val()),
            propertyName: $propertyName.val(),
            methodName: $methodName.val(),

            deviceList: [],
            propertyList: [],
            methodList: [],

            connioAPIInstance: undefined,
          },
          filters: {
            name(value) {
              return value.friendlyName || value.name;
            },
          },
          watch: {
            name(value) {
              $name.val(value);
            },
            accountNodeId(value) {
              this.deselectDevice();

              $accountSelect.val(value);

              if (this.accountNodeId && this.accountNodeId !== '_ADD_') {
                this.initConnioAPI();

                this.fetchDevices();
              }
            },
            deviceId(value) {
              $deviceId.val(value);

              this.deviceName = '';
              this.deviceApiKeyId = '';
              this.deviceApiKeySecret = '';

              this.outputType = -1;
              this.propertyName = '';
              this.methodName = '';

              if (this.deviceId) {
                this.fetchDeviceApiKey();

                let device = this.deviceList.find((d) => d.id === value);
                this.deviceName = device.friendlyName || device.name;
              }
            },
            deviceName(value) {
              $deviceName.val(value);
            },
            deviceApiKeyId(value) {
              $deviceApiKeyId.val(value);
            },
            deviceApiKeySecret(value) {
              $deviceApiKeySecret.val(value);
            },
            propertyName(value) {
              $propertyName.val(value);

              if (value || (!value && this.methodName)) {
                $submitButton.show();
              } else {
                $submitButton.hide();
              }
            },
            methodName(value) {
              $methodName.val(value);

              if (value || (!value && this.propertyName)) {
                $submitButton.show();
              } else {
                $submitButton.hide();
              }
            },
            outputType(value) {
              switch (value) {
                case this.OutputType.Property:
                  {
                    this.fetchProperties();

                    this.methodName = '';
                    $methodName.val('');
                  }
                  break;
                case this.OutputType.Method:
                  {
                    this.fetchMethods();

                    this.propertyName = '';
                    $propertyName.val('');
                  }
                  break;
                default:
                  break;
              }
            },
          },
          methods: {
            resetAppState() {
              this.errorList = undefined;

              this.accountNodeId = '';
              this.deviceId = '';
              this.deviceName = '';
              this.deviceApiKeyId = '';
              this.deviceApiKeySecret = '';

              this.outputType = this.OutputType.None;
              this.propertyuName = '';
              this.methodName = '';
            },
            handleAccountNodeActions(node) {
              if (node && node.type !== 'connio-credentials') {
                return;
              }

              window.setTimeout(() => {
                this.accountList = getAccountList($accountSelect);

                if (node) {
                  this.accountNodeId = node.id;

                  if (this.accountNodeId !== '_ADD_') {
                    this.deselectDevice();

                    this.initConnioAPI();

                    this.fetchDevices();
                  }
                }
              }, 300);
            },
            handleAccountNodeRemove() {
              window.setTimeout(() => {
                this.accountList = getAccountList($accountSelect);
                this.accountNodeId = '_ADD_';

                /** @todo Add inputs validation via `redNode` */
              }, 300);
            },
            initConnioAPI() {
              let {
                credentials: userCredentials = {},
                connioConfig: deploymentNodeId,
              } = RED.nodes.node(this.accountNodeId);
              let { apiUrl: apiURL } = RED.nodes.node(deploymentNodeId);

              this.connioAPIInstance = new ConnioAPI(apiURL, {
                apiKeyId: userCredentials.apiKeyId,
                apiKeySecret: userCredentials.apiKeySecret,
                credentialsNodeId: this.accountNodeId,
              });
            },
            openAccountConfig() {
              $accountLookup.click();
            },
            deselectDevice() {
              this.deviceId = '';
              this.deviceName = '';
              this.deviceApiKeyId = '';
              this.deviceApiKeySecret = '';

              this.outputType = -1;
              this.propertyName = '';
              this.methodName = '';
            },
            async fetchDevices() {
              this.isLoading = true;

              try {
                const response = await this.connioAPIInstance.fetchDevices();
                const { results } = response;

                this.deviceList = results;
              } catch (errorList) {
                this.errorList = errorList;
              } finally {
                this.isLoading = false;
              }
            },
            async fetchDeviceApiKey() {
              this.isLoading = true;

              try {
                let {
                  id,
                  secret,
                } = await this.connioAPIInstance.fetchDeviceApiKey(
                  this.deviceId,
                );

                this.deviceApiKeyId = id;
                this.deviceApiKeySecret = secret;
              } catch (errorList) {
                this.errorList = errorList;
              } finally {
                this.isLoading = false;
              }
            },
            async fetchProperties() {
              this.isLoading = true;

              try {
                const response = await this.connioAPIInstance.fetchProperties(
                  this.deviceId,
                  {
                    [HeaderKey.Username]: this.deviceApiKeyId,
                    [HeaderKey.Password]: this.deviceApiKeySecret,
                  },
                );

                let { results } = response;

                this.propertyList = results;
              } catch (errorList) {
                this.errorList = errorList;
              } finally {
                this.isLoading = false;
              }
            },
            async fetchMethods() {
              this.isLoading = true;

              try {
                const response = await this.connioAPIInstance.fetchMethods(
                  this.deviceId,
                  {
                    [HeaderKey.Username]: this.deviceApiKeyId,
                    [HeaderKey.Password]: this.deviceApiKeySecret,
                  },
                );

                let { results } = response;

                this.methodList = results;
              } catch (errorList) {
                this.errorList = errorList;
              } finally {
                this.isLoading = false;
              }
            },
          },
          created() {
            RED.events.on(RedEvent.NodesAdd, this.handleAccountNodeActions);
            RED.events.on(RedEvent.NodesRemove, this.handleAccountNodeRemove);
            RED.events.on(RedEvent.EditorSave, this.handleAccountNodeActions);

            if (this.accountNodeId && this.accountNodeId !== '_ADD_') {
              this.initConnioAPI();
            }
          },
          async mounted() {
            if (!this.propertyName && !this.methodName) {
              $submitButton.hide();
            }

            if (this.accountNodeId && this.accountNodeId !== '_ADD_') {
              let requests = [this.fetchDevices()];

              if (this.deviceId) {
                if (this.outputType === this.OutputType.Property) {
                  requests.push(this.fetchProperties());
                } else if (this.outputType === this.OutputType.Method) {
                  requests.push(this.fetchMethods());
                }
              }

              await Promise.all(requests);
            }
          },
          beforeDestroy() {
            RED.events.off(RedEvent.NodesAdd, this.handleAccountNodeActions);
            RED.events.off(RedEvent.NodesRemove, this.handleAccountNodeRemove);
            RED.events.off(RedEvent.EditorSave, this.handleAccountNodeActions);
          },
        });
      })
      .catch(() => {
        $vueAppLoader.hide();
        $vueAppError.show();
      });
  }

  Object.assign(connio.edgeDeviceUI, {
    onEditPrepare,
    destroyVueApp,
  });
})(window, window.$, window.RED, window.connio);

(function(RED) {
  'use strict';

  const { onEditPrepare, destroyVueApp } = window.connio.edgeDeviceUI;

  const DEFAULT_NAME = 'device out';

  let EdgeDeviceNode = {
    category: 'Connio Edge',
    color: '#a6bbcf',
    defaults: {
      name: {
        value: '',
      },
      accountNodeId: {
        type: 'connio-credentials',
      },
      deviceId: {
        required: true,
      },
      deviceName: {
        required: true,
      },
      /** @todo Move to `credentials` */
      deviceApiKeyId: {
        required: true,
      },
      /** @todo Move to `credentials` */
      deviceApiKeySecret: {
        required: true,
      },
      propertyName: {},
      methodName: {},
    },
    inputs: 1,
    outputs: 1,
    icon: 'font-awesome/fa-microchip',
    label() {
      if (this.deviceId && !this.name) {
        return `${this.deviceName} # ${this.propertyName || this.methodName}`;
      }

      return this.name || DEFAULT_NAME;
    },
    paletteLabel() {
      return this._('node-config.palette-label');
    },
    oneditprepare: onEditPrepare,
    oneditcancel: destroyVueApp,
    oneditsave: destroyVueApp,
    oneditdelete: destroyVueApp,
  };

  RED.nodes.registerType('connio-edge-device', EdgeDeviceNode);
})(window.RED);
