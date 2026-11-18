import assert from 'node:assert/strict';
import { createRoot } from 'solid-js';
import { createRokuKeyTarget, ElementNode } from '@solidtv/solid/roku';
import { useFocusManager, setFocusPath } from '../../../src/core/focusManager';

export function verifyKeys() {
  const keys = createRokuKeyTarget();
  let observed = 0;
  let idle = 0;
  const events: boolean[] = [];
  const offIdle = keys.onAfterDispatch(() => idle++);
  keys.addEventListener('keydown', (event) => {
    observed++;
    events.push(event.repeat);
  });
  const view = new ElementNode('node');
  view.onEnter = () => true;
  view.onEnterRelease = () => true;
  setFocusPath([view]);
  const dispose = createRoot((dispose) => {
    useFocusManager(undefined, keys);
    return dispose;
  });
  assert.equal(keys.dispatch({ key: 'back', press: true }), false);
  assert.equal(keys.dispatch({ key: 'OK', press: true }), true);
  assert.equal(keys.dispatch({ key: 'OK', press: true }), true);
  assert.equal(keys.dispatch({ key: 'OK', press: false }), true);
  assert.deepEqual(events, [false, false, true]);
  view.onBack = () => true;
  assert.equal(keys.dispatch({ key: 'back', press: false }), false);
  assert.equal(keys.dispatch({ key: 'back', press: true }), true);
  dispose();
  setFocusPath([]);
  assert.equal(keys.dispatch({ key: 'OK', press: true }), false);
  assert.equal(observed, 5, 'caller-owned listeners survive focus cleanup');
  assert.equal(idle, 7);
  offIdle();
  const failures = createRokuKeyTarget();
  failures.addEventListener('keydown', () => {
    throw new Error('key failure');
  });
  const offFailureIdle = failures.onAfterDispatch(() => idle++);
  assert.throws(
    () => failures.dispatch({ key: 'OK', press: true }),
    /key failure/,
  );
  assert.equal(idle, 8, 'idle notification runs after a throwing listener');
  offFailureIdle();
  const clock = Date.now;
  let now = 0;
  const repeats: boolean[] = [];
  const repeatKeys = createRokuKeyTarget();
  repeatKeys.addEventListener('keydown', (event) => {
    repeats.push(event.repeat);
  });
  Date.now = () => now;
  try {
    repeatKeys.dispatch({ key: 'OK', press: true });
    now = 200;
    repeatKeys.dispatch({ key: 'OK', press: true });
    now = 2000;
    repeatKeys.dispatch({ key: 'OK', press: true });
    repeatKeys.dispatch({ key: 'OK', press: false });
    repeatKeys.dispatch({ key: 'OK', press: true });
    assert.deepEqual(repeats, [false, true, false, false]);
  } finally {
    Date.now = clock;
  }
}
