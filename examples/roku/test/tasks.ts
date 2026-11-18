import assert from 'node:assert/strict';
import { render } from '@roku-sdk/testing-library';
import { tmTransaction } from '@roku-sdk/solid';
import { transactionManager } from '@roku-sdk/common/transaction';
import {
  Config,
  View,
  mountRoku,
  createRokuKeyTarget,
  activeElement,
  scheduleTask,
  type ElementNode,
} from '@solidtv/solid/roku';
import { setActiveElementCore } from '../../../src/core/focusManager';

export async function verifyTasks() {
  const delay = Config.taskDelay;
  Config.taskDelay = 1;
  const keys = createRokuKeyTarget();
  let focused: ElementNode | undefined;
  let next: ElementNode | undefined;
  let dispose = () => {};
  const tree = await render(() => {
    transactionManager.startTransaction();
    const host = tmTransaction.createElement('group');
    dispose = mountRoku(
      () =>
        View({
          w: 200,
          h: 200,
          children: [
            View({
              w: 40,
              h: 40,
              autofocus: true,
              onCreate: (node) => {
                focused = node;
              },
              onRight: () => {
                assert(next);
                setActiveElementCore(next);
                return true;
              },
            }),
            View({
              w: 40,
              h: 40,
              onCreate: (node) => {
                next = node;
              },
            }),
          ],
        }),
      host,
      { width: 1920, height: 1080, keys },
    );
    return host;
  });
  const runTask = () =>
    new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('background task stalled')),
        1000,
      );
      scheduleTask(() => {
        clearTimeout(timeout);
        resolve();
      });
    });
  try {
    await runTask();
    assert(focused);
    assert.equal(
      activeElement(),
      focused,
      'autofocus is published before idle tasks run',
    );
    assert.equal(keys.dispatch({ key: 'right', press: true }), true);
    await runTask();
    assert.equal(
      activeElement(),
      next,
      'key-only focus changes return to idle',
    );
  } finally {
    dispose();
    tree.dispose();
    Config.taskDelay = delay;
  }
}
