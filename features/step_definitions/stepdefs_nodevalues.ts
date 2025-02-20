import {Then} from '@cucumber/cucumber';
import {OpcUaWorld} from '../../world/opcuaworld';
import assert from 'assert';
import {DataType} from 'node-opcua';

Then(
  'I should see that the DeviceStatus is {string}',
  async function (this: OpcUaWorld, expectedStatus: string) {
    const status = (
      await this.readChildVariableValue(
        this.makeAutoIdBrowseName('DeviceStatus'),
      )
    ).value;
    if (expectedStatus === 'Idle') assert.equal(status, 0);
    else if (expectedStatus === 'Error') assert.equal(status, 1);
    else if (expectedStatus === 'Scanning') assert.equal(status, 2);
    else if (expectedStatus === 'Busy') assert.equal(status, 3);
    else throw new Error('Unhandled enum string');
  },
);

Then(
  'I should see that the property {string} is {string}',
  async function (
    this: OpcUaWorld,
    propertyName: string,
    expectedString: string,
  ) {
    const value = await this.readChildVariableValue(propertyName);
    if (value.dataType === DataType.LocalizedText)
      assert.equal(value.value.text, expectedString);
    else assert.equal(value.value.toString(), expectedString);
  },
);
