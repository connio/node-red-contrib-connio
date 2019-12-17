(function(window) {
  'use strict';

  if (!window.connio) {
    Object.assign(window, {
      connio: {},
    });
  }

  Object.assign(window.connio, {
    edgeGatewayInUI: {},
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
          url: `connio/edge-gateway-in${url}`,
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

    fetchGatewayDevices() {
      return this._get('/devices');
    }

    fetchDeviceApiKey(deviceId) {
      return this._get(`/devices/${deviceId}/api-key`);
    }
  }

  Object.assign(connio.edgeGatewayInUI, {
    ConnioAPI,
  });
})(window.$, window.connio);

(function(window, $, RED, connio) {
  'use strict';

  let { ConnioAPI } = connio.edgeGatewayInUI;

  /** @enum {string} */
  const RedEvent = {
    NodesAdd: 'nodes:add',
    NodesRemove: 'nodes:remove',
    EditorSave: 'editor:save',
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

  /**
   * @param {string} type
   * @returns {Object[]}
   */
  function getNodeListByType(type) {
    let nodeList = [];

    RED.nodes.eachNode((node) => {
      if (node.type === type) {
        nodeList.push(node);
      }
    });

    return nodeList;
  }

  /**
   * @param {Object[]} nodeList
   * @returns {string[]}
   */
  function getDeviceIdListFromNodeList(nodeList) {
    return nodeList.map((node) => node.deviceId).filter((x) => x);
  }

  /**
   * @param {{Object[]}} devices
   * @param {string[]} selectedDeviceIdList
   * @returns {Object[]}
   */
  function removeSelectedDevicesFromList(devices, selectedDeviceIdList) {
    let _selectedDeviceIdList = [...selectedDeviceIdList];

    return devices.filter((device) => {
      if (_selectedDeviceIdList.length === 0) {
        return true;
      }

      let isSelected = _selectedDeviceIdList.some(
        (selectedId) => selectedId === device.id,
      );

      if (isSelected) {
        _selectedDeviceIdList = _selectedDeviceIdList.filter(
          (id) => id !== device.id,
        );
      }

      return !isSelected;
    });
  }

  let vueApp;

  function destroyVueApp() {
    if (vueApp) {
      vueApp.$destroy();
    }
  }

  function onEditPrepare() {
    let $accountSelect = $('#node-input-accountNodeId');
    let $accountLookup = $('#node-input-lookup-accountNodeId');

    let $deviceId = $('#node-input-deviceId');
    let $deviceName = $('#node-input-deviceName');
    let $deviceApiKeyId = $('#node-input-deviceApiKeyId');
    let $deviceApiKeySecret = $('#node-input-deviceApiKeySecret');

    let $name = $('#node-input-name');

    let $vueAppContainer = $('#connio-edge-gateway-in-vue-app-container');
    let $vueAppLoader = $('#connio-edge-gateway-in-vue-app-loader');
    let $vueAppError = $('#connio-edge-gateway-in-vue-app-error');

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
          el: '#connio-edge-gateway-in-vue-app-container',
          components: {
            [IconicButton.name]: IconicButton.def,
          },
          data: {
            name: $name.val(),

            isLoading: false,
            errorList: undefined,

            accountList: getAccountList($accountSelect),
            accountNodeId: $accountSelect.val(),

            device: undefined,
            deviceId: $deviceId.val(),
            deviceName: $deviceName.val(),
            deviceApiKeyId: $deviceApiKeyId.val(),
            deviceApiKeySecret: $deviceApiKeySecret.val(),

            deviceList: [],

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

              this.deviceApiKeyId = '';
              this.deviceApiKeySecret = '';

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
          },
          methods: {
            resetAppState() {
              this.errorList = undefined;

              this.accountNodeId = '';

              this.deviceId = '';
              this.deviceName = '';

              this.deviceApiKeyId = '';
              this.deviceApiKeySecret = '';
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
              this.deviceApiKeyId = '';
              this.deviceApiKeySecret = '';

              this.outputType = -1;
              this.propertyName = '';
              this.methodName = '';
            },
            async fetchDevices() {
              this.isLoading = true;

              try {
                const response = await this.connioAPIInstance.fetchGatewayDevices();
                const { results } = response;

                let nodeList = getNodeListByType('connio-edge-gateway-in');
                let selectedDeviceIdList = getDeviceIdListFromNodeList(
                  nodeList,
                ).filter((id) => id !== $deviceId.val());

                this.deviceList = removeSelectedDevicesFromList(
                  results,
                  selectedDeviceIdList,
                );
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
            if (this.accountNodeId && this.accountNodeId !== '_ADD_') {
              this.fetchDevices();
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

  Object.assign(connio.edgeGatewayInUI, {
    onEditPrepare,
    destroyVueApp,
  });
})(window, window.$, window.RED, window.connio);

(function(RED) {
  'use strict';

  const { onEditPrepare, destroyVueApp } = window.connio.edgeGatewayInUI;

  const DEFAULT_NAME = 'gateway in';

  let EdgeDeviceInNode = {
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
    },
    outputs: 1,
    icon: 'font-awesome/fa-sitemap',
    label() {
      if (this.deviceId && !this.name) {
        return `${this.deviceName}`;
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

  // RED.comms.subscribe(
  //   'connio/edge-gateway-in/input-device-unallowed',
  //   (topic, data) => {
  //     RED.notify(
  //       `
  //         <b>Connio</b>
  //         <br/>
  //         Edge Gateway
  //         <br/><br/>
  //         <b>${data.deviceName}</b> is not linked to <b>${data.gatewayName}</b>
  //       `,
  //       'error',
  //     );
  //   },
  // );

  RED.nodes.registerType('connio-edge-gateway-in', EdgeDeviceInNode);
})(window.RED);
