import assert from 'node:assert/strict';
import { onCleanup } from 'solid-js';
import { render } from '@roku-sdk/testing-library';
import { registerSetPropertyObserver, tmTransaction } from '@roku-sdk/solid';
import { transactionManager } from '@roku-sdk/common/transaction';
import {
  createRokuKeyTarget,
  mountRoku,
  View,
  type ElementNode,
} from '@solidtv/solid/roku';

export async function verifyAnimation() {
  let view: ElementNode | undefined;
  const tree = await render(() => {
    transactionManager.startTransaction();
    const host = tmTransaction.createElement('group');
    onCleanup(
      mountRoku(
        () =>
          View({
            w: 240,
            h: 360,
            x: 200,
            y: 300,
            scale: 2,
            mount: 0.5,
            pivot: 0,
            rotation: Math.PI / 2,
            data: { testId: 'animated' },
            onCreate: (node) => {
              view = node;
            },
          }),
        host,
        { width: 1920, height: 1080, keys: createRokuKeyTarget() },
      ),
    );
    return host;
  });
  assert(view);
  const native = tree.getByProp('id', 'animated');
  assert.deepEqual(native.props.translation, [80, 120]);
  assert.deepEqual(native.props.scale, [2, 2]);
  assert.deepEqual(native.props.scaleRotateCenter, [0, 0]);
  assert.equal(native.props.rotation, -Math.PI / 2);
  view.rotation = 0;
  view.mount = 0;
  view.x = 0;
  view.y = 0;
  view.scale = 1;
  const scheduled = view.animate({ alpha: 0.75 }, { duration: 250 });
  const scheduledStopped = scheduled.waitUntilStopped();
  scheduled.start();
  assert.equal(
    scheduled.waitUntilStopped(),
    scheduledStopped,
    'starting a scheduled animation preserves its completion promise',
  );
  scheduled.stop();
  await scheduledStopped;
  const animation = view
    .animate({ scale: 1.08 }, { duration: 250, easing: 'ease-in-out' })
    .start();
  let stopped = false;
  animation.waitUntilStopped().then(() => {
    stopped = true;
  });
  await tree.transaction();
  await Promise.resolve();
  assert.equal(
    stopped,
    false,
    'native completion waits for the SDK field event',
  );
  const tween = tree.getByTag('tween');
  const writes: { name: string; value: unknown }[] = [];
  const unregister = registerSetPropertyObserver((_node, name, value) => {
    writes.push({ name, value });
  });
  view.alpha = 0.5;
  await tree.transaction();
  assert(
    writes.some((write) => write.name === 'opacity' && write.value === 0.5),
  );
  assert.equal(
    writes.filter((write) => write.name === 'scale').length,
    0,
    'an unrelated write does not reset a running scale Tween',
  );
  assert.equal(animation.state, 'running');
  await tree.fireEvent(tween, 'onAnimationState', ['stopped', [1.08, 1.08]]);
  await animation.waitUntilStopped();
  assert.equal(stopped, true);
  assert.equal(view.scale, 1.08);
  assert(
    writes.some((write) => write.name === 'targetNode' && write.value === null),
  );
  assert.equal(tree.queryAllByTag('tween').length, 0);
  const translate = view.animate({ x: 100, y: 200 }, { duration: 250 }).start();
  await tree.transaction();
  assert.equal(tree.queryAllByTag('tween').length, 1);
  assert.deepEqual(tree.getByTag('tween').props.targetVector, [100, 200]);
  await tree.fireEvent(tree.getByTag('tween'), 'onAnimationState', [
    'stopped',
    [100, 200],
  ]);
  await translate.waitUntilStopped();
  assert.equal(view.x, 100);
  assert.equal(view.y, 200);
  const scale = view
    .animate({ scaleX: 2, scaleY: 3 }, { duration: 250 })
    .start();
  await tree.transaction();
  assert.equal(tree.queryAllByTag('tween').length, 1);
  assert.deepEqual(tree.getByTag('tween').props.targetVector, [2, 3]);
  view.scale = 1;
  await tree.transaction();
  assert.equal(
    scale.state,
    'stopped',
    'a uniform scale write cancels both native scale axes',
  );
  const fade = view.animate({ alpha: 0 }, { duration: 250 }).start();
  await tree.transaction();
  view.alpha = 0.5;
  await tree.transaction();
  assert.equal(
    fade.state,
    'stopped',
    'writing the mirrored value cancels an in-flight animation',
  );
  assert.equal(tree.queryAllByTag('tween').length, 0);
  const paused = view.animate({ x: 100 }, { duration: 500 }).start().pause();
  await tree.transaction();
  assert.equal(tree.getByTag('tween').props.control, 'pause');
  tree.dispose();
  await paused.waitUntilStopped();
  await tree.transaction();
  assert.equal(paused.state, 'stopped');
  assert.equal(tree.queryAllByTag('tween').length, 0);
  assert.equal(tree.getByTag('group').children.length, 0);
  unregister();
}
