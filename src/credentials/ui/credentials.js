const CredentialsNode = {
  category: 'config',
  defaults: {
    connioConfig: {
      type: 'connio-config',
    },
    email: {
      required: true,
    },
  },
  credentials: {
    password: {
      type: 'password',
      required: true,
    },
  },
  label() {
    return this.email;
  },
  oneditsave() {
    const nextConfig = {
      connioConfig: $('#node-config-input-connioConfig').val(),
      email: $('#node-config-input-email').val(),
      password: $('#node-config-input-password').val(),
    };

    if (
      nextConfig.connioConfig !== this.connioConfig ||
      nextConfig.email !== this.email ||
      (nextConfig.password !== '__PWRD__' &&
        nextConfig.password !== this.credentials.password)
    ) {
      RED.events.emit('@credentials/update', nextConfig);
    }
  },
};

RED.nodes.registerType('connio-credentials', CredentialsNode);
