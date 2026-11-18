import assert from 'node:assert/strict';
import { onCleanup } from 'solid-js';
import { render as renderNative } from '@roku-sdk/testing-library';
import { tmTransaction } from '@roku-sdk/solid';
import { transactionManager } from '@roku-sdk/common/transaction';
import type { DomNode } from '@roku-sdk/interfaces';
import {
  Config,
  View,
  Text,
  mountRoku,
  createRokuKeyTarget,
  rootNode,
  render,
  activeElement,
  scheduleTask,
  type ElementNode,
} from '@solidtv/solid/roku';
import { renderer } from '../../../src/core/renderer';
import { enqueueDelete } from '../../../src/core/elementNode';
import { Portal } from '../../../src/primitives/portal';

export async function verifyLifecycle() {
  let host!: DomNode;
  const tree = await renderNative(() => {
    transactionManager.startTransaction();
    host = tmTransaction.createElement('group');
    tmTransaction.setProperty(host, 'id', 'lifecycle-host');
    tmTransaction.setProperty(host, 'translation', [31, 47]);
    tmTransaction.setProperty(host, 'opacity', 0.6);
    return host;
  });
  const keys = createRokuKeyTarget();
  const options = { width: 1920, height: 1080, keys };
  let callerEvents = 0;
  keys.addEventListener('keydown', () => {
    callerEvents++;
  });
  const previous = {
    renderer,
    font: Config.fontSettings,
    setActiveElement: Config.setActiveElement,
    lng: rootNode.lng,
    rendered: rootNode.rendered,
    children: rootNode.children,
    states: rootNode._states,
  };
  const settle = async () => {
    for (let index = 0; index < 8; index++) {
      await Promise.resolve();
      await tree.transaction();
    }
  };
  const assertRestored = async () => {
    await settle();
    assert.equal(renderer, previous.renderer);
    assert.equal(Config.fontSettings, previous.font);
    assert.equal(Config.setActiveElement, previous.setActiveElement);
    assert.equal(rootNode.lng, previous.lng);
    assert.equal(rootNode.rendered, previous.rendered);
    assert.equal(rootNode.children, previous.children);
    assert.equal(rootNode._states, previous.states);
    const nativeHost = tree.getByProp('id', 'lifecycle-host');
    assert.equal(nativeHost.children.length, 0);
    assert.deepEqual(nativeHost.props.translation, [31, 47]);
    assert.equal(nativeHost.props.opacity, 0.6);
  };
  const remount = async () => {
    const dispose = mountRoku(() => View({ w: 30, h: 40 }), host, options);
    await settle();
    dispose();
    dispose();
    await assertRestored();
  };

  let constructionFailed = false;
  const setProperty = tmTransaction.setProperty;
  tmTransaction.setProperty = (...args) => {
    if (!constructionFailed) {
      constructionFailed = true;
      throw new Error('root construction failed');
    }
    return setProperty(...args);
  };
  try {
    assert.throws(
      () => mountRoku(() => null, host, options),
      /root construction failed/,
    );
  } finally {
    tmTransaction.setProperty = setProperty;
  }
  await assertRestored();
  await remount();

  let failedScreenCleaned = false;
  assert.throws(
    () =>
      mountRoku(
        () => {
          onCleanup(() => {
            failedScreenCleaned = true;
          });
          throw new Error('screen failed');
        },
        host,
        options,
      ),
    /screen failed/,
  );
  assert.equal(failedScreenCleaned, true);
  await assertRestored();
  await remount();

  const disposeThrowing = mountRoku(
    () => {
      onCleanup(() => {
        throw new Error('cleanup failed');
      });
      return View({ w: 30, h: 40, autofocus: true, onEnter: () => true });
    },
    host,
    options,
  );
  await settle();
  assert.equal(keys.dispatch({ key: 'OK', press: true }), true);
  assert.throws(disposeThrowing, /cleanup failed/);
  disposeThrowing();
  assert.equal(keys.dispatch({ key: 'OK', press: true }), false);
  assert.equal(
    callerEvents,
    2,
    'caller listeners remain registered after failed cleanup',
  );
  await assertRestored();
  await remount();

  const disposeNativeFailure = mountRoku(
    () => View({ w: 30, h: 40 }),
    host,
    options,
  );
  assert('destroy' in rootNode.lng);
  rootNode.lng.destroy = () => {
    throw new Error('native destroy failed');
  };
  assert.throws(disposeNativeFailure, /native destroy failed/);
  await assertRestored();
  await remount();

  const queued: Array<() => void> = [];
  const queue = globalThis.queueMicrotask;
  let staleNode: ElementNode | undefined;
  let freshNode: ElementNode | undefined;
  let staleTasks = 0;
  let staleDeletes = 0;
  let disposeFresh = () => {};
  let oldCount = 0;
  globalThis.queueMicrotask = (callback) => {
    queued.push(callback);
  };
  try {
    const disposeStale = mountRoku(
      () =>
        View({
          w: 30,
          h: 40,
          autofocus: true,
          onCreate: (node) => {
            staleNode = node;
          },
          onDestroy: () => {
            staleDeletes++;
          },
        }),
      host,
      options,
    );
    assert(staleNode);
    enqueueDelete(staleNode, -1);
    scheduleTask(() => {
      staleTasks++;
    });
    disposeStale();
    assert.equal(staleNode._queueDelete, undefined);
    oldCount = queued.length;
    disposeFresh = mountRoku(
      () =>
        View({
          w: 30,
          h: 40,
          autofocus: true,
          onCreate: (node) => {
            freshNode = node;
          },
        }),
      host,
      options,
    );
  } finally {
    globalThis.queueMicrotask = queue;
  }
  for (const callback of queued.slice(0, oldCount)) callback();
  assert.equal(
    activeElement(),
    undefined,
    'old callbacks cannot publish fresh or stale focus',
  );
  assert.equal(staleDeletes, 0);
  for (const callback of queued.slice(oldCount)) callback();
  await settle();
  assert.equal(activeElement(), freshNode);
  assert.equal(staleTasks, 0);
  disposeFresh();
  await assertRestored();

  const disposePortal = mountRoku(
    () => {
      Portal({
        children: View({ w: 10, h: 10, data: { testId: 'lifecycle-portal' } }),
      });
      return Text({
        w: 200,
        h: 40,
        text: 'Default native font',
        data: { testId: 'lifecycle-text' },
      });
    },
    host,
    options,
  );
  await settle();
  assert.equal(
    rootNode.lng,
    renderer.root,
    'public App binding belongs to the active Roku renderer',
  );
  assert(tree.getByProp('id', 'lifecycle-portal'));
  const disposeExtra = render(() =>
    View({ w: 12, h: 13, data: { testId: 'lifecycle-extra' } }),
  );
  await settle();
  assert(tree.getByProp('id', 'lifecycle-extra'));
  disposeExtra();
  disposePortal();
  await assertRestored();
  tree.dispose();
}
