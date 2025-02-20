import {Then} from '@cucumber/cucumber';

import {OpcUaWorld} from '../../world/opcuaworld';
import assert from 'assert';

Then(
  'I should see an object named {string} in the Objects folder',
  async function (this: OpcUaWorld, expectedName: string) {
    const children = await this.browseChildNodes(this.objectsFolderId);
    assert(children.find(node => node.name === `1:${expectedName}`));
  },
);
