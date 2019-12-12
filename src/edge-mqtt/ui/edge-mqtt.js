(function(window) {
  'use strict';

  if (!window.connio) {
    Object.assign(window, {
      connio: {},
    });
  }

  Object.assign(window.connio, {
    edgeMqttUI: {},
    shared: {
      ...window.connio.shared,
    },
    vueComponents: {
      ...window.connio.vueComponents,
    },
  });
})(window);

/**
 * @description
 * This is a main place to load a code into `connio.shared` variable
 * until JavaScript build pipeline is not implemented (not just a simple concatenation).
 * All other attempts of writing into this variable is at risk to be overridden
 */
(function(connio) {
  /** @enum {string} */
  const VueURL = {
    Development: 'https://cdn.jsdelivr.net/npm/vue@2.6.0/dist/vue.js',
    Production: 'https://cdn.jsdelivr.net/npm/vue@2.6.0',
  };

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

    return new Promise((resolve, reject) => {
      $.ajax(options)
        .done(resolve)
        .fail(reject);
    });
  }

  /**
   * @param {Object} $select
   * @returns {{ value: string, label: string }[]}
   */
  function getOptionList($select) {
    let $options = $select.find('option');

    return Array.from($options).map((element) => {
      return {
        value: element.value,
        label: element.label,
      };
    });
  }

  Object.assign(connio.shared, {
    VueURL,
    RedEvent,

    getScript,
    getOptionList,
  });
})(window.connio);

/**
 * @description
 * This is a main place to register shared Vue components
 * until JavaScript build pipeline is not implemented (not just a simple concatenation).
 * All other attempts of writing into this variable is at risk to be overridden
 */
(function(connio) {
  const IconicButton = {
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

  Object.assign(connio.vueComponents, {
    IconicButton,
  });
})(window.connio);

(function($, RED, connio) {
  'use strict';

  const { VueURL, RedEvent, getScript, getOptionList } = connio.shared;
  const { IconicButton } = connio.vueComponents;

  let vueApp;

  function onEditPrepare() {
    let $appContainer = $('#connio-edge-mqtt-vue-app-container');
    let $vueAppLoader = $('#connio-edge-mqtt-vue-app-loader');
    let $vueAppError = $('#connio-edge-mqtt-vue-app-error');

    let $name = $('#node-input-name');

    let $deploymentSelect = $('#node-input-deploymentNodeId');
    let $deploymentLookup = $('#node-input-lookup-deploymentNodeId');

    getScript(VueURL.Production)
      .then(() => {
        $vueAppLoader.hide();
        $appContainer.show();

        vueApp = new Vue({
          el: '#connio-edge-mqtt-vue-app-container',
          components: {
            [IconicButton.name]: IconicButton.def,
          },
          data: {
            name: $name.val(),

            deploymentList: getOptionList($deploymentSelect),
            deploymentNodeId: $deploymentSelect.val(),
          },
          watch: {
            name(value) {
              $name.val(value);
            },
            deploymentNodeId(value) {
              $deploymentSelect.val(value);
            },
          },
          methods: {
            handleDeploymentNodeActions(node) {
              window.setTimeout(() => {
                this.deploymentList = getOptionList($deploymentSelect);

                if (node) {
                  this.deploymentNodeId = node.id;
                }
              }, /** @description A magic value, 275 is enough */ 300);
            },
            handleDeploymentNodeRemove() {
              window.setTimeout(() => {
                this.deploymentList = getOptionList($deploymentSelect);
                this.deploymentNodeId = '_ADD_';
              }, /** @description A magic value, 275 is enough */ 300);
            },
            openDeploymentConfig() {
              $deploymentLookup.click();
            },
          },
          created() {
            RED.events.on(RedEvent.NodesAdd, this.handleDeploymentNodeActions);
            RED.events.on(
              RedEvent.NodesRemove,
              this.handleDeploymentNodeRemove,
            );
            RED.events.on(
              RedEvent.EditorSave,
              this.handleDeploymentNodeActions,
            );
          },
          beforeDestroy() {
            RED.events.off(RedEvent.NodesAdd, this.handleDeploymentNodeActions);
            RED.events.off(
              RedEvent.NodesRemove,
              this.handleDeploymentNodeRemove,
            );
            RED.events.off(
              RedEvent.EditorSave,
              this.handleDeploymentNodeActions,
            );
          },
        });
      })
      .catch(() => {
        $vueAppLoader.hide();
        $vueAppError.show();
      });
  }

  /**
   * @description
   * The App should be manually destroyed when editing is done, e.g.:
   * - oneditprepare
   * - oneditcancel
   * - oneditsave
   * - oneditdelete
   */
  function destroyVueApp() {
    if (vueApp) {
      vueApp.$destroy();
    }
  }

  Object.assign(connio.edgeMqttUI, {
    onEditPrepare,
    destroyVueApp,
  });
})(window.$, window.RED, window.connio);

(function(RED) {
  'use strict';

  const { onEditPrepare, destroyVueApp } = window.connio.edgeMqttUI;

  const DEFAULT_NAME = 'connio connector';

  let EdgeMQTTNode = {
    category: 'Connio Edge',
    color: '#a6bbcf',
    defaults: {
      deploymentNodeId: {
        type: 'connio-config',
      },
      name: {
        value: DEFAULT_NAME,
      },
    },
    inputs: 1,
    icon: 'connio.png',
    align: 'right',
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

  RED.nodes.registerType('connio-edge-mqtt', EdgeMQTTNode);
})(window.RED);
