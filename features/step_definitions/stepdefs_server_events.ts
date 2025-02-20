import {Then, Given} from '@cucumber/cucumber';

import {OpcUaWorld} from '../../world/opcuaworld';
import {constructEventFilter} from 'node-opcua';
import assert from 'assert';

async function waitAndCheck(
  ms: number,
  count: number,
  check: () => boolean,
): Promise<void> {
  for (let i = 0; i < count; ++i) {
    if (check()) return;

    await new Promise<void>(resolve => {
      setTimeout(() => {
        resolve();
      }, ms);
    });
  }

  throw new Error('Condition was not fulfilled after waiting');
}

Given('an event monitored item', async function (this: OpcUaWorld) {
  await this.createEventMonitoredItem(
    await this.getRfidReaderNodeId(),
    constructEventFilter([
      'EventType',
      this.makeAutoIdBrowseName('ScanResult').toString(),
    ]),
  );
});

Then(
  'I should have received exactly {int} RfidScanEventType events after waiting {int} ms',
  async function (this: OpcUaWorld, expectedCount, waitTime) {
    await new Promise<void>(resolve => {
      setTimeout(() => {
        resolve();
      }, waitTime);
    });

    assert.strictEqual(
      this.receivedEvents.filter(
        e => e[0].value.toString() === this.rfidScanEventType.toString(),
      ).length,
      expectedCount,
    );
  },
);

Then(
  'I should receive a RfidScanEventType event with data {string} and RSSI {int}',
  async function (this: OpcUaWorld, data: string, rssi: number) {
    await waitAndCheck(
      50,
      10,
      () =>
        this.receivedEvents.find(e => {
          if (e[0].value.toString() !== this.rfidScanEventType.toString())
            return false;

          if (
            e[1]?.value?.scanData?.string === data &&
            e[1]?.value?.sighting?.length > 0 &&
            e[1]?.value?.sighting[0].strength === rssi
          ) {
            return true;
          }

          return false;
        }) !== undefined,
    );
  },
);
