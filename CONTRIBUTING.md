# Contributing to Node-RED nodes for the Connio platform

## Dependencies

- [Node.js](https://nodejs.org)

## Getting started

- Install Node.js
- Run
  ```bash
  $ npm install
  ```

## Available scripts

### start

Runs `nodemon`, `browser-sync` and `Node-RED` in development mode and watches for changes. <br/>
Node-RED configuration files are located in `./node-red` folder, see [Node-RED documentation](https://nodered.org/docs/user-guide/runtime/configuration) for futher reading.

```bash
$ npm start
```

### serve

Runs `Node-RED` with configuration files located in `./node-red` folder. Make sure to run `build` script first (see below).

```bash
$ npm run serve
```

### build

Builds `Node-RED` node’s sources into `nodes` folder

```bash
$ npm run build
```

## Publish on npm

In order to publish on `npm`, make sure that the version in `package.json` file is newer than the current one.
`prepublishOnly` script executed automatically before publishing.

Log in into your account (if you haven’t logged in already)

```bash
$ npm login
```

Then run the following command publish the package

```bash
$ npm publish
```

## Publish on Node-RED flows

See `Publish on npm` section. The new version of the package is available on `flows` within one hour.
