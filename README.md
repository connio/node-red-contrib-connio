# Node-RED nodes for the Connio platform

## Overview

A collection of Node-RED nodes to communicate with the Connio platform. The first group of nodes (Connio Edge) allows you to bi-directionally communicate with the platform from your devices and gateways. You can use these nodes from a Node-RED instance installed within your device. The second group (Connio Cloud) allows you to connect external services to the platform to consume device data and send device commands easily.

Connio offers an Internet of Things (IoT) platform that enables businesses to quickly connect, integrate and orchestrate their products and operations within IoT ecosystem.

You can register to the Connio platform at https://app.connio.cloud. <br/>
Check the platform documentation at https://docs.connio.com.

## Install

If installing from within Node-RED, use the Manage Palette menu command and search for `node-red-contrib-connio`.

Or, from a command line within your Node-RED user directory, enter:

```
npm install node-red-contrib-connio
```

## Configuration

Connio nodes will have an Account and Deployment property which must be configured. Deployment property allows you to select the Connio deployment or host that you like to use in your flow. Account property allows you to select the Connio account you like to use. You only have to set this configuration once and use it in all your nodes.

<img width="510" alt="Screen Shot 2019-12-11 at 6 29 25 PM" src="https://user-images.githubusercontent.com/2756202/70677497-2efe6800-1c44-11ea-8d19-b59e6ea773a3.png">

<img width="514" alt="Screen Shot 2019-12-11 at 6 26 15 PM" src="https://user-images.githubusercontent.com/2756202/70677503-358cdf80-1c44-11ea-911b-988019ba63cf.png">

## Usage

**Connio Edge** nodes are designed to be used by remote devices for communicating with the platform.

**Connio Cloud** nodes are designed to be used by external systems (web services, mobile apps, etc...) for communicating with the platform.

See node documentation to better understand each node usage.
