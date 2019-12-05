(function(window) {
  'use strict';

  /** @enum {string} */
  const ElementId = {
    AUTH: '#node-input-auth',

    CLIENT_ID: '#node-input-clientId',
    APP: '#node-input-app',

    TOPIC_PREFIX: '#topicPrefix',
    TOPIC_VALUE: '#node-input-topicValue',

    ACCOUNT: '#node-input-account',
    API_KEY_ID: '#node-input-apiKeyId',
    API_KEY_SECRET: '#node-input-apiKeySecret',
  };

  /** @enum {string} */
  const PropertyState = {
    Selected: ['selected', true],
    Disabled: ['disabled', true],
    Enabled: ['disabled', false],
  };

  /** @enum {string} */
  const EventType = {
    Click: 'click',
    Change: 'change',
  };

  Object.assign(window, {
    connio: {
      ElementId,
      PropertyState,
      EventType,
    },
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

  /**
   * @description
   * ---------------
   * Connio API auth
   * username: CredentialsNode#apiKeyId (secret)
   * password: CredentialsNode#apiKeySecret (secret)
   *
   * --------------
   * Connio API URL
   * apiURL: ConfigNode#apiUrl
   */
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
          url,
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
            reject(error);
          });
      });
    }

    fetchApiClients() {
      return this._get('api-clients');
    }

    fetchApiKey(clientId) {
      return this._get(`api-key?clientId=${clientId}`);
    }

    fetchApp(id) {
      return this._get(`app?id=${id}`);
    }

    fetchApps(appIdList = []) {
      const requests = appIdList.map(this.fetchApp.bind(this));

      return Promise.all(requests);
    }
  }

  Object.assign(connio, {
    ConnioAPI,
  });
})(window.$, window.connio);

(function(connio) {
  'use strict';
  class Topic {
    constructor() {
      Object.assign(this, {
        ACCOUNT_PLACEHOLDER: '{account}',
        APP_PLACEHOLDER: '{app}',
        DEFAULT_VALUE: '#',
      });
    }

    _getNodeValue(node) {
      return node.val();
    }

    parse(topicNode) {
      const [
        accountName,
        app,
        appName,
        devices,
        ...topicValue
      ] = this._getNodeValue(topicNode).split('/');

      return [
        `${accountName}/${app}/${appName}/${devices}/`,
        topicValue.join('/'),
      ];
    }

    build(prefixNode, valueNode) {
      const prefix = this._getNodeValue(prefixNode);
      const value = this._getNodeValue(valueNode);

      return `${prefix}${value}`;
    }

    buildPrefix(account, app) {
      return [
        account || this.ACCOUNT_PLACEHOLDER,
        'apps',
        app || this.APP_PLACEHOLDER,
        'devices',
        '',
      ]
        .join('/')
        .toLowerCase();
    }

    buildValue(value) {
      return value || this.DEFAULT_VALUE;
    }
  }

  Object.assign(connio, {
    Topic,
  });
})(window.connio);

(function(window, $, RED, connio) {
  'use strict';
  const { EventType, PropertyState, ElementId, Topic, ConnioAPI } = connio;

  const DEFAULT_NAME = 'Connio MQTT';

  /**
   * @param {string|number} value
   * @param {string} label
   * @param {boolean} selected
   */
  function makeOption(value, label, selected = false) {
    return $('<option></option>')
      .val(value)
      .text(label)
      .prop('selected', selected);
  }

  /**
   * @param {string} label
   */
  function makeDefaultOption(label) {
    return makeOption('', label)
      .prop(...PropertyState.Selected)
      .prop(...PropertyState.Disabled);
  }

  /**
   * @param {Object} _this
   * @returns {(node: any, valueName: string, value: string|number) => void}
   */
  function makeSyncValue(_this) {
    return function(node, valueName, value) {
      node.val(value);
      _this.state[valueName] = node.val();
    };
  }

  function getAccountNodeData(nodeId) {
    let { account, connioConfig, credentials = {} } = RED.nodes.node(nodeId);
    let { apiKeyId, apiKeySecret } = credentials;

    return {
      account,

      apiKeyId,
      apiKeySecret,

      configNodeId: connioConfig,
    };
  }

  function getDeploymentNodeData(nodeId) {
    let { apiUrl } = RED.nodes.node(nodeId);

    return {
      apiUrl,
    };
  }

  let MqttNode = {
    category: 'Connio Cloud',
    color: '#a6bbcf',
    defaults: {
      auth: {
        type: 'connio-credentials',
      },
      name: {
        value: DEFAULT_NAME,
      },
      account: {
        required: true,
      },
      clientId: {
        required: true,
      },
      apiKeyId: {
        required: true,
      },
      apiKeySecret: {
        required: true,
      },
      app: {
        required: true,
      },
      topicValue: {
        value: '#',
        required: true,
      },
    },
    inputs: 0,
    outputs: 1,
    icon: 'connio.png',
    label() {
      return this.name || DEFAULT_NAME;
    },
    oneditprepare() {
      let connioApi;

      let topicInstance = new Topic();
      let syncValue = makeSyncValue(this);

      let isFirstAuthChange = true;

      let $auth = $(ElementId.AUTH);

      let $clientId = $(ElementId.CLIENT_ID);
      let $app = $(ElementId.APP);

      let $topicPrefix = $(ElementId.TOPIC_PREFIX);
      let $topicValue = $(ElementId.TOPIC_VALUE);

      let $account = $(ElementId.ACCOUNT);
      let $apiKeyId = $(ElementId.API_KEY_ID);
      let $apiKeySecret = $(ElementId.API_KEY_SECRET);

      let makeApiClientSelector = (apiClientList = []) => {
        if (!apiClientList.length) {
          return $clientId
            .prop(...PropertyState.Disabled)
            .empty()
            .append(
              makeDefaultOption(
                this._('api-field.empty', {
                  entity: this._('glossary.api-client'),
                }),
              ),
            );
        }

        $clientId
          .empty()
          .append([
            makeDefaultOption(this._('api-client-field.placeholder')),
            ...apiClientList.map((item) =>
              makeOption(
                item.id,
                item.friendlyName || item.name,
                this.state.clientId === item.id,
              ),
            ),
          ])
          .prop(...PropertyState.Enabled);
      };

      let makeAppSelector = (appList = []) => {
        if (!appList.length) {
          return $app
            .prop(...PropertyState.Disabled)
            .empty()
            .append(
              makeDefaultOption(
                this._('app-field.empty', {
                  entity: this._('glossary.app'),
                }),
              ),
            );
        }

        return $app
          .empty()
          .append([
            makeDefaultOption(this._('app-field.placeholder')),
            ...appList.map((item) =>
              makeOption(
                item.name,
                item.friendlyName || item.name,
                this.state.app === item.name,
              ),
            ),
          ])
          .prop(...PropertyState.Enabled);
      };

      let authChangeHandler = () => {
        let nextAuth = $auth.val();

        if (nextAuth === '_ADD_') {
          syncValue($auth, 'auth', nextAuth);
          emptyAuthSelectionFlow();

          return;
        }

        if (
          this.state.auth === nextAuth &&
          !isFirstAuthChange &&
          !this.isCredentialsUpdated
        ) {
          return;
        }

        syncValue($auth, 'auth', nextAuth);

        let {
          account,
          apiKeyId,
          apiKeySecret,
          configNodeId,
        } = getAccountNodeData(nextAuth);
        let { apiUrl } = getDeploymentNodeData(configNodeId);

        syncValue($account, 'account', account);

        syncValue(
          $topicPrefix,
          'topicPrefix',
          topicInstance.buildPrefix(account, this.state.app),
        );

        connioApi = new ConnioAPI(apiUrl, {
          apiKeyId,
          apiKeySecret,
          credentialsNodeId: this.state.auth,
        });

        if (isFirstAuthChange || this.isCredentialsUpdated) {
          isFirstAuthChange = false;
          this.isCredentialsUpdated = false;

          loadingFlow();
        } else {
          authSelectionFlow();
        }
      };

      let clientIdChangeHandler = () => {
        let nextClientTd = $clientId.val();

        if (!nextClientTd) {
          return;
        }

        if (nextClientTd === this.state.clientId) {
          return;
        }

        syncValue($clientId, 'clientId', nextClientTd);

        apiClientSelectionFlow();
      };

      let appChangeHandler = () => {
        let nextApp = $app.val();

        if (!nextApp) {
          return;
        }

        if (nextApp === this.state.app) {
          return;
        }

        syncValue($app, 'app', nextApp);
        syncValue(
          $topicPrefix,
          'topicPrefix',
          topicInstance.buildPrefix(this.state.account, this.state.app),
        );
        syncValue($topicValue, 'topicValue', topicInstance.buildValue());

        $topicValue.prop(...PropertyState.Enabled);
      };

      /**
       * @description
       * …
       */
      let emptyAuthSelectionFlow = () => {
        $clientId.prop(...PropertyState.Disabled);
        $app.prop(...PropertyState.Disabled);
        $topicValue.prop(...PropertyState.Disabled);

        syncValue($clientId, 'clientId', '');
        syncValue($app, 'app', '');

        syncValue($topicPrefix, 'topicPrefix', topicInstance.buildPrefix());
        syncValue($topicValue, 'topicValue', topicInstance.buildValue());

        syncValue($account, 'account', '');
        syncValue($apiKeyId, 'apiKeyId', '');
        syncValue($apiKeySecret, 'apiKeySecret', '');

        $clientId
          .prop(...PropertyState.Disabled)
          .empty()
          .append(makeDefaultOption(this._('api-client-field.placeholder')));

        $app
          .prop(...PropertyState.Disabled)
          .empty()
          .append(makeDefaultOption(this._('app-field.placeholder')));
      };

      /**
       * @todo Make sure that fail fall through to the latests handler
       * @description
       * set "$account" to "Disabled" state
       * set "$clientId" to "Disabled" state
       * set "$app" to "Disabled" state
       * set "$topicValue" to "Disabled" state
       *
       * connioApi.login
       *  => SUCCESS
       *  => ERROR
       * …
       */
      let loadingFlow = () => {
        $auth.prop(...PropertyState.Disabled);

        $clientId
          .prop(...PropertyState.Disabled)
          .empty()
          .append(makeDefaultOption(this._('common.loading')));

        $app
          .prop(...PropertyState.Disabled)
          .empty()
          .append(makeDefaultOption(this._('app-field.placeholder')));

        $topicValue.prop(...PropertyState.Disabled);

        syncValue(
          $topicValue,
          'topicValue',
          topicInstance.buildValue(this.state.topicValue),
        );

        connioApi
          .fetchApiClients()
          .then((apiClientList) => {
            makeApiClientSelector(apiClientList);

            if (this.state.clientId) {
              $auth.prop(...PropertyState.Disabled);
              $clientId.prop(...PropertyState.Disabled);
              $topicValue.prop(...PropertyState.Disabled);

              $app
                .prop(...PropertyState.Disabled)
                .empty()
                .append(makeDefaultOption(this._('common.loading')));

              return connioApi
                .fetchApiKey(this.state.clientId)
                .then(({ appList: appIdList }) => {
                  return connioApi.fetchApps(appIdList).then((appList) => {
                    makeAppSelector(appList);
                  });
                })
                .catch(() => {
                  /** @todo Error handler */
                  $app
                    .prop(...PropertyState.Disabled)
                    .empty()
                    .append(makeDefaultOption('Error, please try again'));
                })
                .finally(() => {
                  $auth.prop(...PropertyState.Enabled);
                  $clientId.prop(...PropertyState.Enabled);
                  $topicValue.prop(...PropertyState.Enabled);
                });
            }

            $auth.prop(...PropertyState.Enabled);
          })
          .finally(() => {
          });
      };

      /**
       * @description
       * reset "account"
       * reset "clientId"
       * reset "apiKeyId"
       * reset "apiKeySecret"
       * reset "app"
       * reset "topicPrefix" to account only
       * reset "topicValue" to '#' (all)
       *
       * set "auth" selector to "Disabled"
       * set "account" to "Loading"
       * set "clientId" selector to "Initial (Disabled)" state
       * set "app" selector to "Initial" state
       * ↓
       * login
       *   => SUCCESS =>
       *   ↓
       *     => set "account" field
       *     => set "topicPrefix" field to "account"
       *     => set "clientId" selector to "Loading (Disabled)" state
       *     => fetchApiClients
       *       => SUCCESS
       *       ↓
       *         => create "clientId" selector
       *         => set "auth" selector to "Enabled"
       *       => ERROR => ?
       *   => ERROR => ?
       */
      let authSelectionFlow = () => {
        syncValue($clientId, 'clientId', '');
        syncValue($app, 'app', '');

        syncValue(
          $topicPrefix,
          'topicPrefix',
          topicInstance.buildPrefix(this.state.account),
        );
        syncValue($topicValue, 'topicValue', topicInstance.buildValue());

        $auth.prop(...PropertyState.Disabled);

        $clientId
          .prop(...PropertyState.Disabled)
          .empty()
          .append(makeDefaultOption(this._('common.loading')));

        $app
          .prop(...PropertyState.Disabled)
          .empty()
          .append(makeDefaultOption(this._('app-field.placeholder')));

        $topicValue.prop(...PropertyState.Disabled);

        connioApi
          .fetchApiClients()
          .then((apiClientList) => {
            makeApiClientSelector(apiClientList);
          })
          .catch(() => {
            /** @todo Error handler */
            $clientId
              .prop(...PropertyState.Disabled)
              .empty()
              .append(makeDefaultOption('Error, please try again'));
          })
          .finally(() => {
            $auth.prop(...PropertyState.Enabled);
          });
      };

      /**
       * @description
       * reset "apiKeyId"
       * reset "apiKeySecret"
       * reset "app"
       * reset "topicPrefix" to account only
       * reset "topicValue" to '#' (all)
       *
       * set "auth" to "Disabled" state
       * set "clientId" to "Disabled" state
       * set "app" selector to "Loading (Disabled)" state
       * ↓
       * fetch ApiKey
       *   => SUCCESS =>
       *   ↓
       *     set "apiKeyId" value
       *     set "apiKeySecret" value
       *
       *     fetch apps
       *       => SUCCESS =>
       *       ↓
       *         create "app" selector
       *         set "auth" to "Disabled" state
       *         set "clientId" selector to "Enabled" state
       *       => ERROR => ?
       *   => ERROR => ?
       */
      let apiClientSelectionFlow = () => {
        syncValue($apiKeyId, 'apiKeyId', '');
        syncValue($apiKeySecret, 'apiKeySecret', '');
        syncValue($app, 'app', '');

        syncValue(
          $topicPrefix,
          'topicPrefix',
          topicInstance.buildPrefix(this.state.account),
        );
        syncValue($topicValue, 'topicValue', topicInstance.buildValue());

        $auth.prop(...PropertyState.Disabled);
        $clientId.prop(...PropertyState.Disabled);
        $topicValue.prop(...PropertyState.Disabled);

        $app
          .prop(...PropertyState.Disabled)
          .empty()
          .append(makeDefaultOption(this._('common.loading')));

        connioApi
          .fetchApiKey(this.state.clientId)
          .then(({ id, secret, appList: appIdList }) => {
            syncValue($apiKeyId, 'apiKeyId', id);
            syncValue($apiKeySecret, 'apiKeySecret', secret);

            return connioApi.fetchApps(appIdList).then((appList) => {
              makeAppSelector(appList);
            });
          })
          .catch(() => {
            /** @todo Error handler */
            $app
              .prop(...PropertyState.Disabled)
              .empty()
              .append(makeDefaultOption('Error, please try again'));
          })
          .finally(() => {
            $auth.prop(...PropertyState.Enabled);
            $clientId.prop(...PropertyState.Enabled);
          });
      };

      /**
       * @description
       * …
       */
      let init = () => {
        let state = {
          auth: this.auth /** @todo Rename to "account" */,

          clientId: this.clientId,
          app: this.app,
          topicValue: this.topicValue,

          account: this.account,
          apiKeyId: this.apiKeyId,
          apiKeySecret: this.apiKeySecret,
        };

        Object.assign(this, {
          state,
        });

        this.handleCredentialsUpdate = () => {
          this.isCredentialsUpdated = true;

          emptyAuthSelectionFlow();

          window.setTimeout(authChangeHandler);
        };

        RED.events.on('@credentials/update', this.handleCredentialsUpdate);

        /** @event $auth change */
        $auth.on(EventType.Change, authChangeHandler.bind(this));

        /** @event $clientId change */
        $clientId.on(EventType.Change, clientIdChangeHandler.bind(this));

        /** @event $app change */
        $app.on(EventType.Change, appChangeHandler.bind(this));
      };

      init();
    },
    oneditcancel() {
      RED.events.off('@credentials/update', this.handleCredentialsUpdate);
    },
    oneditsave() {
      let topicInstance = new Topic();

      RED.events.off('@credentials/update', this.handleCredentialsUpdate);

      if (!this.topicValue) {
        makeSyncValue(this)(
          $('#node-input-topicValue'),
          'topicValue',
          topicInstance.buildValue(),
        );
      }
    },
  };

  RED.nodes.registerType('connio-mqtt', MqttNode);
})(window, window.$, window.RED, window.connio);
