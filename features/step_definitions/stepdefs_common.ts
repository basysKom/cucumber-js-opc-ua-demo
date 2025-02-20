import {After, Before, Given, When} from '@cucumber/cucumber';

import {OpcUaWorld} from '../../world/opcuaworld';

Given('a connected OPC UA client', async function (this: OpcUaWorld) {
  await this.connectToServer(process.env.OPCUA_SERVER_URL!);
});

Given('the reader goes offline', async function (this: OpcUaWorld) {
  await this.readerSimulator.shutdown();
});

Given('the reader comes online', async function (this: OpcUaWorld) {
  this.readerSimulator.initialize();
});

Given('a running scan', async function (this: OpcUaWorld) {
  await this.callScanStartMethod(true);
});

When(
  'a tag with data {string} is read with RSSI {int}',
  function (this: OpcUaWorld, data: string, rssi: number) {
    this.readerSimulator.simulateRead(data, rssi);
  },
);

When('I wait {int} ms', async (timeout: number) => {
  await new Promise<void>(resolve => {
    setTimeout(() => {
      resolve();
    }, timeout);
  });
});

Before(async function (this: OpcUaWorld) {
  await this.initialize();
});

After(async function (this: OpcUaWorld) {
  await this.shutdown();
});
