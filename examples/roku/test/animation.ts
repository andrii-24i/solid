import assert from 'node:assert/strict';
import { onCleanup, type Component } from 'solid-js';
import { render, type TestNode } from '@roku-sdk/testing-library';
import { registerSetPropertyObserver, tmTransaction } from '@roku-sdk/solid';
import { transactionManager } from '@roku-sdk/common/transaction';
import type { DomNode } from '@roku-sdk/interfaces';
import { RokuNode } from '../../../src/roku/node';
import {
  childHost,
  localTransform,
  localTranslation,
  logicalChildren,
  multiply,
  transformPoint,
  tweenCompletionValue,
  visualContent,
} from './native-tree';

type NativeComponent = Component<Record<string, unknown>>;
type Write = { node: DomNode; name: string; value: unknown };

export async function verifyAnimation() {
  let node: RokuNode | undefined;
  let label: RokuNode | undefined;
  const writes: Write[] = [];
  const unregister = registerSetPropertyObserver((node, name, value) => {
    writes.push({ node, name, value });
  });
  const tree = await render(() => {
    transactionManager.startTransaction();
    const host = tmTransaction.createElement('group');
    const stage = {
      get root(): RokuNode {
        assert(node);
        return node;
      },
    };
    node = new RokuNode(
      stage,
      {
        w: 240,
        h: 360,
        x: 200,
        y: 300,
        mount: 0.5,
        pivot: 0.25,
        rotation: Math.PI / 2,
        scale: 2,
        scaleY: 3,
        alpha: 0.6,
        clipping: true,
        data: { testId: 'animated' },
      },
      'view',
      host,
    );
    label = new RokuNode(
      stage,
      {
        w: 100,
        h: 40,
        text: 'before',
        parent: node,
        data: { testId: 'label' },
      },
      'text',
    );
    onCleanup(() => node?.destroy());
    return host;
  });
  assert(node && label);
  const view = node;
  const text = label;
  const native = tree.getByProp<NativeComponent>('id', 'animated');
  const textNative = tree.getByProp<NativeComponent>('id', 'label');
  const tween = (field: string, axis: string) => {
    const result = tree
      .queryAllByTag<NativeComponent>('tween')
      .find(
        (entry) => entry.props.field === field && entry.props.axis === axis,
      );
    assert(result, `native ${field} ${axis} Tween exists`);
    return result;
  };
  const complete = async (entry: TestNode<NativeComponent>, value?: number) => {
    await tree.fireEvent(entry, 'onAnimationState', [
      'stopped',
      tweenCompletionValue(entry, value),
    ]);
    await tree.transaction();
  };
  const reset = async () => {
    view.x = 0;
    view.y = 0;
    view.scale = 1;
    view.alpha = 1;
    view.rotation = 0;
    view.mount = 0;
    view.pivot = 0;
    view.clipping = false;
    await tree.transaction();
  };
  try {
    for (const write of writes) {
      assert.equal(
        writes.filter(
          (other) => other.node === write.node && other.name === write.name,
        ).length,
        1,
        `initial ${write.name} is projected once per native node`,
      );
    }
    const initialOrigin = transformPoint(localTransform(native), [0, 0]);
    assert(
      Math.abs(initialOrigin[0] - 410) < 1e-9 &&
        Math.abs(initialOrigin[1] - 90) < 1e-9,
    );
    assert.deepEqual(
      [
        view.scaleX,
        view.scaleY,
        view.mountX,
        view.mountY,
        view.pivotX,
        view.pivotY,
      ],
      [2, 3, 0.5, 0.5, 0.25, 0.25],
    );
    assert.equal(native.props.opacity, 0.6);
    assert.deepEqual(childHost(native).props.clippingRect, [0, 0, 240, 360]);
    const scheduled = view.animate({ alpha: 0.75 }, { duration: 250 });
    const scheduledStopped = scheduled.waitUntilStopped();
    scheduled.start();
    assert.equal(scheduled.waitUntilStopped(), scheduledStopped);
    await tree.transaction();
    let resolved = false;
    void scheduledStopped.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    assert.equal(
      resolved,
      false,
      'completion waits for the native field event',
    );
    scheduled.stop();
    await scheduledStopped;
    assert.equal(resolved, true);

    for (const reverseStart of [false, true]) {
      for (const reverseComplete of [false, true]) {
        await reset();
        const horizontal = view.animate(
          { x: 100 },
          { duration: 250, easing: 'ease-in' },
        );
        const vertical = view.animate(
          { y: 50 },
          { duration: 700, easing: 'linear' },
        );
        for (const controller of reverseStart
          ? [vertical, horizontal]
          : [horizontal, vertical])
          controller.start();
        await tree.transaction();
        assert.equal(horizontal.state, 'running');
        assert.equal(vertical.state, 'running');
        const xTween = tween('translation', 'x');
        const yTween = tween('translation', 'y');
        assert.notEqual(xTween.props.targetNode, yTween.props.targetNode);
        assert.equal(xTween.props.duration, 0.25);
        assert.equal(yTween.props.duration, 0.7);
        assert.equal(xTween.props.easeFunction, 'inCubic');
        assert.equal(yTween.props.easeFunction, 'linear');
        horizontal.pause();
        await tree.transaction();
        assert.equal(xTween.props.control, 'pause');
        assert.equal(
          yTween.props.control,
          undefined,
          'pausing x leaves y running',
        );
        horizontal.start();
        await tree.transaction();
        assert.equal(xTween.props.control, 'resume');
        for (const entry of reverseComplete
          ? [yTween, xTween]
          : [xTween, yTween])
          await complete(entry);
        await Promise.all([
          horizontal.waitUntilStopped(),
          vertical.waitUntilStopped(),
        ]);
        assert.deepEqual([view.x, view.y], [100, 50]);
        assert.deepEqual(localTranslation(native), [100, 50]);
      }
    }

    for (const reverseStart of [false, true]) {
      for (const reverseComplete of [false, true]) {
        await reset();
        const horizontal = view.animate(
          { scaleX: 2 },
          { duration: 200, easing: 'ease-out' },
        );
        const vertical = view.animate(
          { scaleY: 3 },
          { duration: 900, easing: 'linear' },
        );
        for (const controller of reverseStart
          ? [vertical, horizontal]
          : [horizontal, vertical])
          controller.start();
        await tree.transaction();
        assert.equal(horizontal.state, 'running');
        assert.equal(vertical.state, 'running');
        const xTween = tween('scale', 'x');
        const yTween = tween('scale', 'y');
        assert.notEqual(xTween.props.targetNode, yTween.props.targetNode);
        assert.equal(xTween.props.duration, 0.2);
        assert.equal(yTween.props.duration, 0.9);
        for (const entry of reverseComplete
          ? [yTween, xTween]
          : [xTween, yTween])
          await complete(entry);
        assert.deepEqual(localTransform(native), [2, 0, 0, 3, 0, 0]);
      }
    }

    for (const axis of ['x', 'y'] satisfies ('x' | 'y')[]) {
      await reset();
      const other = axis === 'x' ? 'y' : 'x';
      const motion = view.animate({ [axis]: 100 }, { duration: 500 }).start();
      await tree.transaction();
      view[axis] = 0;
      view[other] = 0;
      view[other] = 50;
      await tree.transaction();
      assert.equal(
        motion.state,
        'running',
        'same-value writes and cross-axis writes preserve ownership',
      );
      await complete(tween('translation', axis));
      assert.deepEqual(
        localTranslation(native),
        axis === 'x' ? [100, 50] : [50, 100],
      );
    }
    for (const axis of ['scaleX', 'scaleY'] satisfies ('scaleX' | 'scaleY')[]) {
      await reset();
      const other = axis === 'scaleX' ? 'scaleY' : 'scaleX';
      const motion = view.animate({ [axis]: 2 }, { duration: 500 }).start();
      await tree.transaction();
      view[axis] = 1;
      view[other] = 1;
      view[other] = 3;
      await tree.transaction();
      assert.equal(motion.state, 'running');
      await complete(tween('scale', axis === 'scaleX' ? 'x' : 'y'));
      assert.deepEqual(
        [view.scaleX, view.scaleY],
        axis === 'scaleX' ? [2, 3] : [3, 2],
      );
    }

    await reset();
    const uniform = view.animate({ scale: 2 }, { duration: 400 }).start();
    const orthogonal = view.animate({ x: 100 }, { duration: 300 }).start();
    await tree.transaction();
    assert.equal(
      tree
        .queryAllByTag<NativeComponent>('tween')
        .filter((entry) => entry.props.field === 'scale').length,
      2,
    );
    view.scale = 1;
    assert.equal(
      uniform.state,
      'running',
      'same-value uniform scale does not cancel either axis',
    );
    const component = view.animate({ scaleX: 3 }, { duration: 200 }).start();
    assert.equal(
      uniform.state,
      'stopped',
      'an overlapping component replaces the whole prior controller',
    );
    assert.equal(orthogonal.state, 'running');
    const otherComponent = view
      .animate({ scaleY: 4 }, { duration: 600 })
      .start();
    const replacement = view.animate({ scale: 5 }, { duration: 500 }).start();
    assert.equal(component.state, 'stopped');
    assert.equal(otherComponent.state, 'stopped');
    assert.equal(orthogonal.state, 'running');
    await tree.transaction();
    await complete(tween('scale', 'x'), 2.5);
    assert.equal(replacement.state, 'running');
    await complete(tween('scale', 'y'), 2.5);
    assert.equal(
      view.scale,
      2.5,
      'completion uses observed values rather than the requested scale',
    );
    assert.deepEqual([view.scaleX, view.scaleY], [2.5, 2.5]);
    await complete(tween('translation', 'x'), 63);
    assert.deepEqual(localTranslation(native), [63, 0]);

    await reset();
    view.scaleX = 2;
    view.scaleY = 2;
    const identicalUniform = view
      .animate({ scaleX: 4 }, { duration: 500 })
      .start();
    view.scale = 2;
    assert.equal(
      identicalUniform.state,
      'running',
      'a uniform write compares both component values even when the alias is stale',
    );
    const independentScaleY = view
      .animate({ scaleY: 5 }, { duration: 500 })
      .start();
    view.scale = 3;
    assert.equal(identicalUniform.state, 'stopped');
    assert.equal(independentScaleY.state, 'stopped');
    await tree.transaction();
    assert.deepEqual(localTransform(native), [3, 0, 0, 3, 0, 0]);

    await reset();
    const faded = view.animate({ alpha: 0 }, { duration: 500 }).start();
    view.alpha = 1;
    assert.equal(faded.state, 'running');
    await tree.transaction();
    await complete(tween('opacity', 'all'), 0.4);
    assert.equal(view.alpha, 0.4);
    assert.equal(native.props.opacity, 0.4);

    const clearing = view.animate({ x: 90 }, { duration: 100 }).start();
    await tree.transaction();
    const clearingTween = tween('translation', 'x');
    let unregistered: Promise<void> | undefined;
    let attachedWhenCleared = false;
    let targetWhenCleared: unknown;
    const stopObserving = registerSetPropertyObserver(
      (written, name, value) => {
        if (
          written.r === clearingTween.r &&
          name === 'animationState' &&
          value === null
        ) {
          attachedWhenCleared = tree
            .queryAllByTag<NativeComponent>('tween')
            .includes(clearingTween);
          targetWhenCleared = clearingTween.props.targetNode;
          unregistered = assert.rejects(
            tree.fireEvent(clearingTween, 'onAnimationState', [
              'stopped',
              [90, 0],
            ]),
            /Event onAnimationState not registered on node/,
          );
        }
      },
    );
    clearing.stop();
    stopObserving();
    assert(
      unregistered,
      'clearing the callback reaches the SDK before removal',
    );
    await unregistered;
    assert(
      attachedWhenCleared && targetWhenCleared,
      'the handler is removed before clearing its target or removing the Tween',
    );
    await tree.transaction();

    const replacementX = view.animate({ x: 200 }, { duration: 500 }).start();
    await tree.transaction();
    const oldCallback = [...writes]
      .reverse()
      .find(
        (write) =>
          write.name === 'animationState' && typeof write.value === 'function',
      )?.value;
    assert(typeof oldCallback === 'function');
    replacementX.stop();
    await tree.transaction();
    replacementX.start();
    await tree.transaction();
    oldCallback(['stopped', [199, 0]]);
    assert.equal(
      view.x,
      0,
      'a removed Tween callback cannot publish into a restarted controller',
    );
    assert.equal(replacementX.state, 'running');
    view.x = 40;
    await tree.transaction();
    assert.equal(replacementX.state, 'stopped');
    oldCallback(['stopped', [199, 0]]);
    assert.equal(view.x, 40);
    assert(
      writes.some(
        (write) => write.name === 'animationState' && write.value === null,
      ),
    );
    assert(
      writes.some(
        (write) => write.name === 'targetNode' && write.value === null,
      ),
    );
    replacementX.restore();
    await tree.transaction();
    assert.equal(view.x, 0);
    assert.deepEqual(localTranslation(native), [0, 0]);

    await reset();
    view.mountX = 0.5;
    const mounted = view.animate({ x: 200 }, { duration: 500 }).start();
    await tree.transaction();
    assert.equal(tween('translation', 'x').props.targetValue, 80);
    await complete(tween('translation', 'x'), 30);
    assert.equal(
      view.x,
      150,
      'native translation completion restores the logical mount offset',
    );
    assert.deepEqual(localTranslation(native), [30, 0]);
    const changingWidth = view.animate({ x: 300 }, { duration: 500 }).start();
    const remainingY = view.animate({ y: 100 }, { duration: 500 }).start();
    view.w = 300;
    assert.equal(
      changingWidth.state,
      'stopped',
      'a width change interrupts its mounted x dependency',
    );
    assert.equal(remainingY.state, 'running');
    remainingY.stop();
    assert.equal(mounted.state, 'stopped');
    view.mountX = 0;
    const unmounted = view.animate({ x: 300 }, { duration: 500 }).start();
    view.w = 320;
    assert.equal(
      unmounted.state,
      'running',
      'width does not affect unmounted x motion',
    );
    unmounted.stop();

    await reset();
    const motion = view.animate({ x: 100 }, { duration: 500 }).start();
    const scale = view.animate({ scaleY: 2 }, { duration: 600 }).start();
    await tree.transaction();
    const expectWrites = async (
      change: () => void,
      fields: readonly string[],
    ) => {
      writes.length = 0;
      change();
      await tree.transaction();
      assert.deepEqual(
        [...new Set(writes.map((write) => write.name))].sort(),
        [...new Set(fields)].sort(),
      );
      assert.equal(motion.state, 'running');
      assert.equal(scale.state, 'running');
    };
    await expectWrites(() => {
      view.color = 0x123456ff;
    }, ['color']);
    assert.equal(visualContent(native).props.color, '0x123456ff');
    await expectWrites(() => {
      view.alpha = 0.7;
    }, ['opacity']);
    await expectWrites(() => {
      text.text = 'after';
    }, ['text']);
    assert.equal(visualContent(textNative).props.text, 'after');
    await expectWrites(() => {
      text.textAlign = 'right';
    }, ['horizAlign']);
    await expectWrites(() => {
      view.data = {};
    }, ['id']);
    assert.equal(native.props.id, '');
    await expectWrites(() => {
      view.y = 12;
    }, ['translation']);
    await expectWrites(() => {
      view.w = 350;
    }, ['width', 'scaleRotateCenter']);
    await expectWrites(() => {
      view.clipping = true;
    }, ['clippingRect']);
    await expectWrites(() => {
      view.h = 400;
    }, ['height', 'scaleRotateCenter', 'clippingRect']);
    assert.deepEqual(childHost(native).props.clippingRect, [0, 0, 350, 400]);
    const contentBefore = visualContent(native);
    writes.length = 0;
    view.src = 'pkg:/first.png';
    await tree.transaction();
    assert.deepEqual(writes.map((write) => write.name).sort(), [
      'height',
      'loadDisplayMode',
      'uri',
      'width',
    ]);
    assert.notEqual(visualContent(native).r, contentBefore.r);
    assert.deepEqual(
      logicalChildren(native).map((child) => child.r),
      [textNative.r],
    );
    await expectWrites(() => {
      view.src = 'pkg:/second.png';
    }, ['uri']);
    await expectWrites(() => {
      view.color = 0xff0000ff;
    }, []);
    motion.stop();
    scale.stop();

    view.x = 200;
    view.y = 300;
    view.w = 240;
    view.h = 360;
    view.mount = 0.5;
    view.pivot = 0.25;
    view.rotation = Math.PI / 2;
    view.scaleX = 2;
    view.scaleY = 3;
    label.x = 7;
    label.y = 11;
    label.mount = 0;
    label.pivot = 0;
    label.rotation = Math.PI / 2;
    label.scaleX = 0.5;
    label.scaleY = 2;
    await tree.transaction();
    const points: readonly (readonly [number, number])[] = [
      [0, 0],
      [60, 90],
      [240, 360],
      [-5, 13],
    ];
    for (const [x, y] of points) {
      const expected = [140 - 3 * (y - 90), 210 + 2 * (x - 60)];
      const actual = transformPoint(localTransform(native), [x, y]);
      assert(
        actual.every(
          (value, index) => Math.abs(value - expected[index]) < 1e-9,
        ),
      );
    }
    const world = multiply(localTransform(native), localTransform(textNative));
    const point = transformPoint(world, [10, 20]);
    assert(
      Math.abs(point[0] - 362) < 1e-9 && Math.abs(point[1] - 24) < 1e-9,
      'logical children receive both parent and local transforms',
    );
    assert.deepEqual(childHost(native).props.clippingRect, [0, 0, 240, 360]);
    assert.equal(logicalChildren(native)[0].r, textNative.r);
    assert.equal(
      native.r,
      view.native.r,
      'the supplied outer host remains the insertion identity',
    );

    const paused = view.animate({ x: 100 }, { duration: 500 }).start().pause();
    await tree.transaction();
    tree.dispose();
    await paused.waitUntilStopped();
    await tree.transaction();
    assert.equal(paused.state, 'stopped');
    assert.equal(tree.queryAllByTag<NativeComponent>('tween').length, 0);
    assert.equal(tree.getByTag<NativeComponent>('group').children.length, 0);
    paused.start();
    assert.equal(
      paused.state,
      'stopped',
      'destroyed nodes cannot acquire new native animations',
    );
    console.log(
      'Native axes passed. Independent timing, easing, order, pause, writes, overlap, observed completion, stale callbacks, transport scope, and transform composition.',
    );
  } finally {
    tree.dispose();
    unregister();
  }
}
