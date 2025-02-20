import assert from 'assert';
import {When, Then} from '@cucumber/cucumber';

import {OpcUaWorld} from '../../world/opcuaworld';

When(
  'I call the ScanStart method with DataAvailable {string}',
  async function (this: OpcUaWorld, dataAvailable: string) {
    await this.callScanStartMethod(dataAvailable === 'true');
  },
);

When('I call the ScanStop method', async function (this: OpcUaWorld) {
  await this.callScanStopMethod();
});

Then(
  'I should see that the method returned {string}',
  async function (this: OpcUaWorld, expectedStatus: string) {
    assert.equal(
      this.methodCallStatus?.toString().split(' ')[0],
      expectedStatus,
    );
  },
);

Then(
  'I should see that the output argument of ScanStart is {int}',
  async function (this: OpcUaWorld, expectedValue: number) {
    assert.equal(this.startMethodOutputArg, expectedValue);
  },
);
