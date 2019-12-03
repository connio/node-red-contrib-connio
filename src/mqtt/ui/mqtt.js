window.connio = {};

const ElementId = {
  AUTH: makeId('node-input-auth'),

  ACCOUNT: makeId('node-input-account'),
  ACCOUNT_FRIENDLY: makeId('node-input-account-friendly'),

  CLIENT_ID: makeId('node-input-clientId'),
  API_KEY_ID: makeId('node-input-apiKeyId'),
  API_KEY_SECRET: makeId('node-input-apiKeySecret'),

  APP: makeId('node-input-app'),

  TOPIC_PREFIX: makeId('topicPrefix'),
  TOPIC_VALUE: makeId('node-input-topicValue'),
};

const PropertyState = {
  SELECTED: ['selected', true],
  DISABLED: ['disabled', true],
  ENABLED: ['disabled', false],
};

const EventType = {
  CLICK: 'click',
  CHANGE: 'change',
};

function makeId(name) {
  return `#${name}`;
}

Object.assign(window.connio, {
  ElementId,
  PropertyState,
  EventType,
});

class ConnioAPI {
  constructor({ $, authNodeId, username, password, url: backendUrl, apiUrl }) {
    Object.assign(this, {
      authNodeId: undefined,
      credentials: {
        username: undefined,
        password: undefined,
      },
      apiKey: {
        id: undefined,
        secret: undefined,
      },
    });

    Object.assign(this, {
      $,
      apiUrl,
      backendUrl,
      headers: {
        'connio-backend-url': backendUrl,
        'connio-api-url': apiUrl,
      },
    });

    if (username && password) {
      Object.assign(this, {
        credentials: {
          username,
          password,
        },
        headers: {
          ...this.headers,
          'connio-username': username,
          'connio-password': password,
        },
      });
    } else {
      Object.assign(this, {
        authNodeId,
        headers: {
          ...this.headers,
          'auth-node-id': authNodeId,
        },
      });
    }
  }

  _get(url) {
    return this.$.ajax({
      url,
      json: true,
      headers: this.headers,
    });
  }

  login() {
    return this._get('login')
      .done((response) => {
        Object.assign(this, {
          accountId: response.user.accountId,
          apiKey: {
            username: response.apiKey.id,
            password: response.apiKey.secret,
          },
          headers: {
            ...this.headers,
            'connio-key-id': response.apiKey.id,
            'connio-key-secret': response.apiKey.secret,
          },
        });

        return response;
      })
      .fail((error) => {
        return error;
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
    return new Promise((resolve) => {
      const requests = Promise.all(appIdList.map((id) => this.fetchApp(id)));

      return requests.then(resolve);
    });
  }
}

Object.assign(window.connio, {
  ConnioAPI,
});

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

Object.assign(window.connio, {
  Topic,
});

const DEFAULT_NAME = 'Connio MQTT';

function makeOption(value, label, selected = false) {
  return $('<option></option>')
    .val(value)
    .text(label)
    .prop('selected', selected);
}

function makeDefaultOption(label) {
  return makeOption('', label)
    .prop(...window.connio.PropertyState.SELECTED)
    .prop(...window.connio.PropertyState.DISABLED);
}

function makeSyncValue(_this) {
  return function(node, valueName, value) {
    node.val(value);
    _this.state[valueName] = node.val();
  };
}

function handleConfigUpdate(payload) {
  try {
    let { email, credentials, connioConfig } = RED.nodes.node(this.auth);

    if (!connioConfig) {
      return;
    }

    let { apiUrl, backendUrl } = payload;

    if (!backendUrl || !apiUrl) {
      return;
    }

    /** @todo Fix ESLint error */
    // eslint-disable-next-line no-undef
    connioApi = new window.connio.ConnioAPI({
      $,
      url: backendUrl,
      apiUrl,
      username: email,
      password: credentials && credentials.password,
      authNodeId: this.auth,
    });

    this.isConfigUpdated = true;
  } catch (error) {
    console.error(error);
  }
}

function handleCredentialsUpdate(payload) {
  try {
    let { email, credentials, connioConfig } = payload;

    if (!connioConfig) {
      return;
    }

    let { apiUrl, backendUrl } = RED.nodes.node(connioConfig);

    if (!backendUrl || !apiUrl) {
      return;
    }

    /** @todo Fix ESLint error */
    // eslint-disable-next-line no-undef
    connioApi = new window.connio.ConnioAPI({
      $,
      url: backendUrl,
      apiUrl,
      username: email,
      password: credentials && credentials.password,
      authNodeId: this.auth,
    });

    this.isCredentialsUpdated = true;
  } catch (error) {
    console.error(error);
  }
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
    let topicInstance = new window.connio.Topic();
    let syncValue = makeSyncValue(this);

    let isFirstAuthChange = true;

    let $auth = $(window.connio.ElementId.AUTH);
    let $account = $(window.connio.ElementId.ACCOUNT);
    let $accountFriendly = $(window.connio.ElementId.ACCOUNT_FRIENDLY);

    let $clientId = $(window.connio.ElementId.CLIENT_ID);
    let $apiKeyId = $(window.connio.ElementId.API_KEY_ID);
    let $apiKeySecret = $(window.connio.ElementId.API_KEY_SECRET);

    let $app = $(window.connio.ElementId.APP);

    let $topicPrefix = $(window.connio.ElementId.TOPIC_PREFIX);
    let $topicValue = $(window.connio.ElementId.TOPIC_VALUE);

    let makeApiClientSelector = (apiClientList = []) => {
      if (!apiClientList.length) {
        return $clientId
          .prop(...window.connio.PropertyState.DISABLED)
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
        .prop(...window.connio.PropertyState.ENABLED);
    };

    let makeAppSelector = (appList = []) => {
      if (!appList.length) {
        return $app
          .prop(...window.connio.PropertyState.DISABLED)
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
        .prop(...window.connio.PropertyState.ENABLED);
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
        !this.isConfigUpdated &&
        !this.isCredentialsUpdated
      ) {
        return;
      }

      syncValue($auth, 'auth', nextAuth);

      let { email, credentials, connioConfig } = RED.nodes.node(nextAuth);

      if (!connioConfig) {
        return;
      }

      let { apiUrl, backendUrl } = RED.nodes.node(connioConfig);

      if (!backendUrl || !apiUrl) {
        return;
      }

      connioApi = new window.connio.ConnioAPI({
        $,
        url: backendUrl,
        apiUrl,
        username: email,
        password: credentials && credentials.password,
        authNodeId: this.state.auth,
      });

      if (
        isFirstAuthChange ||
        this.isConfigUpdated ||
        this.isCredentialsUpdated
      ) {
        isFirstAuthChange = false;
        this.isConfigUpdated = false;
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
    };

    /**
     * @description
     * …
     */
    let emptyAuthSelectionFlow = () => {
      $accountFriendly.prop(...window.connio.PropertyState.DISABLED);
      $clientId.prop(...window.connio.PropertyState.DISABLED);
      $app.prop(...window.connio.PropertyState.DISABLED);
      $topicValue.prop(...window.connio.PropertyState.DISABLED);

      syncValue($account, 'account', '');
      syncValue($accountFriendly, 'accountFriendly', '');
      syncValue($clientId, 'clientId', '');
      syncValue($apiKeyId, 'apiKeyId', '');
      syncValue($apiKeySecret, 'apiKeySecret', '');
      syncValue($app, 'app', '');
      syncValue($topicPrefix, 'topicPrefix', topicInstance.buildPrefix());
      syncValue($topicValue, 'topicValue', topicInstance.DEFAULT_VALUE);
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
      $auth.prop(...window.connio.PropertyState.DISABLED);

      $accountFriendly.prop(...window.connio.PropertyState.DISABLED);
      syncValue($accountFriendly, 'account', this._('common.loading'));

      $clientId
        .prop(...window.connio.PropertyState.DISABLED)
        .empty()
        .append(makeDefaultOption(this._('api-client-field.placeholder')));

      $app
        .prop(...window.connio.PropertyState.DISABLED)
        .empty()
        .append(makeDefaultOption(this._('app-field.placeholder')));

      $topicValue.prop(...window.connio.PropertyState.DISABLED);

      connioApi
        .login()
        .then(({ account }) => {
          syncValue($account, 'account', account.name);
          syncValue(
            $accountFriendly,
            'accountFriendly',
            account.friendlyName || account.name,
          );

          syncValue(
            $topicPrefix,
            'topicPrefix',
            topicInstance.buildPrefix(account.name, this.state.app),
          );
          syncValue(
            $topicValue,
            'topicValue',
            topicInstance.buildValue(this.state.topicValue),
          );

          $topicValue.prop(...window.connio.PropertyState.ENABLED);

          $clientId
            .prop(...window.connio.PropertyState.DISABLED)
            .empty()
            .append(makeDefaultOption(this._('common.loading')));

          connioApi.fetchApiClients().then((apiClientList) => {
            makeApiClientSelector(apiClientList);

            if (this.state.clientId) {
              $auth.prop(...window.connio.PropertyState.DISABLED);
              $clientId.prop(...window.connio.PropertyState.DISABLED);

              $app
                .prop(...window.connio.PropertyState.DISABLED)
                .empty()
                .append(makeDefaultOption(this._('common.loading')));

              return connioApi
                .fetchApiKey(this.state.clientId)
                .then(({ appList: appIdList }) => {
                  connioApi.fetchApps(appIdList).then((appList) => {
                    $auth.prop(...window.connio.PropertyState.ENABLED);
                    $clientId.prop(...window.connio.PropertyState.ENABLED);

                    makeAppSelector(appList);
                  });
                });
            }

            $auth.prop(...window.connio.PropertyState.ENABLED);
          });
        })
        .fail((error) => {
          $auth.prop(...window.connio.PropertyState.ENABLED);

          syncValue(
            $accountFriendly,
            'accountFriendly',
            this._('error.unknown'),
          );

          RED.notify(
            `
              <b>Connio</b>
              <br>

              <i>${error.responseJSON[0].cause}</i>
              <br><br>

              ${error.responseJSON[0].message}
            `,
            'error',
          );
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
      syncValue($account, 'account', '');
      syncValue($accountFriendly, 'accountFriendly', '');
      syncValue($clientId, 'clientId', '');
      syncValue($apiKeyId, 'apiKeyId', '');
      syncValue($apiKeySecret, 'apiKeySecret', '');
      syncValue($app, 'app', '');

      syncValue(
        $topicPrefix,
        'topicPrefix',
        topicInstance.buildPrefix(this.state.account),
      );
      syncValue($topicValue, 'topicValue', window.connio.Topic.DEFAULT_VALUE);

      $auth.prop(...window.connio.PropertyState.DISABLED);

      $accountFriendly.val(this._('common.loading'));

      $clientId
        .prop(...window.connio.PropertyState.DISABLED)
        .empty()
        .append(makeDefaultOption(this._('api-client-field.placeholder')));

      $app
        .prop(...window.connio.PropertyState.DISABLED)
        .empty()
        .append(makeDefaultOption(this._('app-field.placeholder')));

      connioApi
        .login()
        .then(({ account }) => {
          syncValue($account, 'account', account.name);
          syncValue(
            $accountFriendly,
            'accountFriendly',
            account.friendlyName || account.name,
          );

          syncValue(
            $topicPrefix,
            'topicPrefix',
            topicInstance.buildPrefix(this.state.account),
          );

          $clientId
            .prop(...window.connio.PropertyState.DISABLED)
            .empty()
            .append(makeDefaultOption(this._('common.loading')));

          connioApi.fetchApiClients().then((apiClientList) => {
            makeApiClientSelector(apiClientList);

            $auth.prop(...window.connio.PropertyState.ENABLED);
          });
        })
        .fail(() => {
          $auth.prop(...window.connio.PropertyState.ENABLED);

          syncValue($accountFriendly, 'accountFriendly', this._('error.auth'));
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
      syncValue($topicValue, 'topicValue', window.connio.Topic.DEFAULT_VALUE);

      $auth.prop(...window.connio.PropertyState.DISABLED);
      $clientId.prop(...window.connio.PropertyState.DISABLED);

      $app
        .prop(...window.connio.PropertyState.DISABLED)
        .empty()
        .append(makeDefaultOption(this._('common.loading')));

      connioApi
        .fetchApiKey(this.state.clientId)
        .then(({ id, secret, appList: appIdList }) => {
          syncValue($apiKeyId, 'apiKeyId', id);
          syncValue($apiKeySecret, 'apiKeySecret', secret);

          return connioApi.fetchApps(appIdList).then((appList) => {
            makeAppSelector(appList);

            $auth.prop(...window.connio.PropertyState.ENABLED);
            $clientId.prop(...window.connio.PropertyState.ENABLED);
          });
        });
    };

    /**
     * @description
     * …
     */
    let init = () => {
      let state = {
        account: this.account,
        apiKeyId: this.apiKeyId,
        apiKeySecret: this.apiKeySecret,
        app: this.app,
        auth: this.auth,
        clientId: this.clientId,
        topicValue: this.topicValue,
      };

      Object.assign(this, {
        state,
        backup: {
          ...state,
        },
      });

      this.handleCredentialsUpdate = handleCredentialsUpdate.bind(this);
      this.handleConfigUpdate = handleConfigUpdate.bind(this);

      RED.events.on('@credentials/update', this.handleCredentialsUpdate);
      RED.events.on('@config/update', this.handleConfigUpdate);

      /** @event $auth change */
      $auth.on(window.connio.EventType.CHANGE, authChangeHandler.bind(this));

      /** @event $clientId change */
      $clientId.on(
        window.connio.EventType.CHANGE,
        clientIdChangeHandler.bind(this),
      );

      /** @event $app change */
      $app.on(window.connio.EventType.CHANGE, appChangeHandler.bind(this));
    };

    init();
  },
  oneditcancel() {
    RED.events.off('@credentials/update', this.handleCredentialsUpdate);
    RED.events.off('@config/update', this.handleConfigUpdate);

    Object.assign(this, {
      ...this.backup,
    });
  },
  oneditsave() {
    let topicInstance = new window.connio.Topic();

    RED.events.off('@credentials/update', this.handleCredentialsUpdate);
    RED.events.off('@config/update', this.handleConfigUpdate);

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
