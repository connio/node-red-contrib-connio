class Topic {
  static build({ account, app, value }) {
    const prefix = this._buildPrefix(account, app);

    return `${prefix}${value || '#'}`;
  }

  static _buildPrefix(account, app) {
    return [account, 'apps', app, 'devices', ''].join('/').toLowerCase();
  }
}

module.exports = {
  Topic,
};
