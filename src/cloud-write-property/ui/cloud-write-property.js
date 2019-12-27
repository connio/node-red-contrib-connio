(function(window) {
  'use strict';

  if (!window.connio) {
    Object.assign(window, {
      connio: {},
    });
  }

  Object.assign(window.connio, {
    cloudWritePropertyUI: {},
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

    fetchApiClients() {
      return this._get('/api-clients');
    }

    fetchApiClientApiKey(clientId) {
      return this._get(`/api-key?clientId=${clientId}`);
    }

    fetchDevice(id) {
      return this._get(`/device?id=${id}`);
    }

    fetchDevices() {
      return this._get('/devices');
    }

    fetchDevicesById(...ids) {
      let requests = ids.map((id) => this.fetchDevice(id));

      return Promise.all(requests);
    }

    fetchApp(id) {
      return this._get(`/app?id=${id}`);
    }

    fetchApps() {
      return this._get('/apps');
    }

    fetchAppsById(...ids) {
      let requests = ids.map((id) => this.fetchApp(id));

      return Promise.all(requests);
    }

    fetchProperties(ownerId, headers) {
      return this._get(`/properties?ownerId=${ownerId}`, { headers });
    }
  }

  Object.assign(connio.cloudWritePropertyUI, {
    ConnioAPI,
  });
})(window.$, window.connio);

(function(window, $, RED, connio) {
  'use strict';

  let { ConnioAPI } = connio.cloudWritePropertyUI;

  /** @enum {string} */
  const RedEvent = {
    NodesAdd: 'nodes:add',
    NodesRemove: 'nodes:remove',
    EditorSave: 'editor:save',
  };

  /** @enum {number} */
  const TargetType = {
    None: 0,
    App: 1,
    Device: 2,
  };

  /**
   * @param {string} url
   * @returns {Promise}
   */
  function loadScript(url, { id = '' }) {
    return new Promise((resolve, reject) => {
      let exisitingScript = document.getElementById(id);

      if (exisitingScript) {
        return resolve();
      }

      let script = document.createElement('script');

      script.onload = resolve;
      script.onerror = reject;
      script.type = 'text/javascript';
      script.id = id;
      script.src = url;

      document.body.appendChild(script);
    });
  }

  /**
   * @returns {Promise}
   */
  function loadVueJs() {
    return loadScript('https://cdn.jsdelivr.net/npm/vue@2.6.0', {
      id: 'vue-js-2-6-0',
    });
  }

  /**
   * @param {...Element} elements
   */
  function hide(...elements) {
    elements.forEach((element) => {
      element.style.display = 'none';
    });
  }

  function show(...elements) {
    elements.forEach((element) => {
      element.style.display = '';
    });
  }

  /**
   * @param {Element} $select
   * @returns {Element[]}
   */
  function getOptionList($select) {
    let $options = $select.querySelectorAll('option');

    return Array.from($options);
  }

  /**
   * @param {Element} $select
   * @returns {{ value: string, label: string }[]}
   */
  function getAccountList($select) {
    return getOptionList($select).map((element) => {
      return {
        value: element.value,
        label: element.label,
      };
    });
  }

  let vueApp;

  function destroyVueApp() {
    if (vueApp) {
      vueApp.$destroy();
    }
  }

  function onEditPrepare() {
    let $submitButton = document.getElementById('node-dialog-ok');

    let $accountSelect = document.getElementById('node-input-accountNodeId');
    let $accountLookup = document.getElementById(
      'node-input-lookup-accountNodeId',
    );

    let $requesterId = document.getElementById('node-input-requesterId');
    let $requesterKey = document.getElementById('node-input-requesterKey');

    let $targetType = document.getElementById('node-input-targetType');
    let $targetId = document.getElementById('node-input-targetId');

    let $propertyId = document.getElementById('node-input-propertyId');

    let $name = document.getElementById('node-input-name');

    let $vueAppLoader = document.getElementById(
      'connio-cloud-write-property-vue-app-loader',
    );
    let $vueAppError = document.getElementById(
      'connio-cloud-write-property-vue-app-error',
    );

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

    let nodeRedEventsMixin = {
      created() {
        RED.events.on(RedEvent.NodesAdd, this.handleAccountNodeActions);
        RED.events.on(RedEvent.NodesRemove, this.handleAccountNodeRemove);
        RED.events.on(RedEvent.EditorSave, this.handleAccountNodeActions);
      },
      beforeDestroy() {
        RED.events.off(RedEvent.NodesAdd, this.handleAccountNodeActions);
        RED.events.off(RedEvent.NodesRemove, this.handleAccountNodeRemove);
        RED.events.off(RedEvent.EditorSave, this.handleAccountNodeActions);
      },
    };

    loadVueJs()
      .then(() => {
        vueApp = new Vue({
          el: '#connio-cloud-write-property-vue-app-container',
          components: {
            [IconicButton.name]: IconicButton.def,
          },
          mixins: [nodeRedEventsMixin],
          data: {
            isLoading: false,
            errorList: undefined,

            name: $name.value,

            accountList: getAccountList($accountSelect),
            accountNodeId: $accountSelect.value,

            TargetType,

            requesterId: $requesterId.value,
            requesterKey: $requesterKey.value,

            targetType: Number.parseInt($targetType.value, 10),
            targetId: $targetId.value,

            propertyId: $propertyId.value,

            apiClientList: [],

            appIdList: [],
            deviceIdList: [],
            targetList: [],

            propertyList: [],

            connioAPIInstance: undefined,
          },
          filters: {
            name(value) {
              return value.friendlyName || value.name;
            },
          },
          watch: {
            name(value) {
              $name.value = value;
            },
            async accountNodeId(value) {
              this.deselectRequester();

              $accountSelect.value = value;

              if (this.accountNodeId && this.accountNodeId !== '_ADD_') {
                this.initConnioAPI();

                await this.loadResource(this.fetchApiClients);
              }
            },
            async requesterId(value) {
              $requesterId.value = value;

              this.requesterKey = '';

              this.deselectTargetType();

              if (value && value !== '_CURRENT_USER_') {
                await this.loadResource(this.fetchApiClientApiKey);

                if (this.appIdList.length > 0) {
                  this.targetType = this.TargetType.App;
                } else if (this.deviceIdList.length > 0) {
                  this.targetType = this.TargetType.Device;
                }
              }
            },
            async targetType(value) {
              $targetType.value = value;

              this.targetList = [];

              this.deselectTarget();

              if (value === this.TargetType.None) {
                return;
              }

              await this.loadResource(this.fetchTargetList);

              if (this.targetList.length === 1) {
                this.targetId = this.targetList[0].id;
              }
            },
            async targetId(value) {
              $targetId.value = value;

              this.deselectProperty();

              if (value) {
                await this.loadResource(this.fetchProperties);

                if (this.propertyList.length === 1) {
                  this.propertyId = this.propertyList[0].id;
                }
              }
            },
            propertyId(value) {
              $propertyId.value = value;

              if (value) {
                show($submitButton);
              } else {
                hide($submitButton);
              }
            },
            requesterKey(value) {
              $requesterKey.value = value;
            },
          },
          computed: {
            currentUser() {
              let account = this.accountList.find(
                (x) => x.value === this.accountNodeId,
              );

              if (!account) {
                return '';
              }

              if (account.value === '_ADD_') {
                return '';
              }

              return account.label.split('(')[1].split(')')[0];
            },
          },
          methods: {
            openAccountConfig() {
              $accountLookup.click();
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
                    this.deselectRequester();

                    this.initConnioAPI();

                    this.loadResource(this.fetchApiClients);
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
            resetAppState() {
              this.isLoading = false;
              this.errorList = undefined;

              this.accountNodeId = '';

              this.deselectRequester();
            },
            deselectRequester() {
              this.requesterId = '';
              this.requesterKey = '';

              this.deselectTargetType();
            },
            deselectTargetType() {
              this.targetType = this.TargetType.None;

              this.appIdList = [];
              this.deviceIdList = [];

              this.deselectTarget();
            },
            deselectTarget() {
              this.targetId = '';

              this.deselectProperty();
            },
            deselectProperty() {
              this.propertyId = '';
            },
            async fetchApiClients() {
              let apiClientList = await this.connioAPIInstance.fetchApiClients();

              this.apiClientList = apiClientList;
            },
            async fetchTargetList(isInitial = false) {
              const CURRENT_USER = '_CURRENT_USER_';

              if (this.targetType === this.TargetType.App) {
                if (this.requesterId === CURRENT_USER) {
                  return this.fetchUserApps();
                }

                if (isInitial) {
                  await this.fetchApiClientApiKey();
                }

                return this.fetchApiClientApps();
              } else if (this.targetType === this.TargetType.Device) {
                if (this.requesterId === CURRENT_USER) {
                  return this.fetchUserDevices();
                }

                if (isInitial) {
                  await this.fetchApiClientApiKey();
                }

                return this.fetchApiClientDevices();
              }
            },
            async fetchUserApps() {
              const response = await this.connioAPIInstance.fetchApps();
              const { results } = response;

              this.targetList = results;
            },
            async fetchApiClientApps() {
              let response = await this.connioAPIInstance.fetchAppsById(
                ...this.appIdList,
              );

              this.targetList = response;
            },
            async fetchUserDevices() {
              const response = await this.connioAPIInstance.fetchDevices();
              const { results } = response;

              this.targetList = results;
            },
            async fetchApiClientDevices() {
              let response = await this.connioAPIInstance.fetchDevicesById(
                ...this.deviceIdList,
              );

              this.targetList = response;
            },
            async fetchApiClientApiKey() {
              let {
                id,
                secret,
                appList = [],
                deviceList = [],
              } = await this.connioAPIInstance.fetchApiClientApiKey(
                this.requesterId,
              );

              this.requesterKey = `${id}:${secret}`;
              this.appIdList = appList;
              this.deviceIdList = deviceList;
            },
            async fetchProperties() {
              const response = await this.connioAPIInstance.fetchProperties(
                this.targetId,
              );

              let { results } = response;

              this.propertyList = results.filter(
                (property) => property.access === 'public',
              );
            },
            async loadResource(resource, ...params) {
              this.isLoading = true;

              try {
                await resource(...params);
              } catch (error) {
                this.errorList = error;
              } finally {
                this.isLoading = false;
              }
            },
          },
          created() {
            if (this.accountNodeId && this.accountNodeId !== '_ADD_') {
              this.initConnioAPI();
            }
          },
          mounted() {
            if (!this.propertyId) {
              hide($submitButton);
            }

            if (this.accountNodeId && this.accountNodeId !== '_ADD_') {
              let requests = [this.fetchApiClients()];

              if (this.requesterId) {
                requests.push(this.fetchTargetList(true));

                if (this.targetId) {
                  requests.push(this.fetchProperties());
                }
              }

              this.loadResource(Promise.all.bind(Promise), requests);
            }
          },
        });
      })
      .catch(() => {
        hide($vueAppLoader);
        show($vueAppError);
      });
  }

  Object.assign(connio.cloudWritePropertyUI, {
    onEditPrepare,
    destroyVueApp,
  });
})(window, window.$, window.RED, window.connio);

(function(RED) {
  'use strict';

  const { onEditPrepare, destroyVueApp } = window.connio.cloudWritePropertyUI;

  const DEFAULT_NAME = 'write property';

  let CloudWritePropertyNode = {
    category: 'Connio Cloud',
    color: '#a6bbcf',
    defaults: {
      name: {
        value: undefined,
      },
      accountNodeId: {
        type: 'connio-credentials',
      },
      requesterId: {
        value: undefined,
        required: true,
      },
      requesterKey: {
        value: undefined,
      },
      targetType: {
        value: undefined,
        required: true,
      },
      targetId: {
        value: undefined,
        required: true,
      },
      propertyId: {
        value: undefined,
        required: true,
      },
    },
    inputs: 1,
    icon: 'property.svg',
    label() {
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

  RED.nodes.registerType('connio-cloud-write-property', CloudWritePropertyNode);
})(window.RED);
