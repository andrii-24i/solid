import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ElementNode, enqueueDelete } from '../src/core/elementNode.js';
import { installRenderer, renderer } from '../src/core/renderer.js';
import './setup.js';
import { Config } from '../src/core/config.js';
import { rootNode } from '../src/renderCore.js';

let callbacks: Array<() => void>;
let microtasks: Array<() => void>;
let releaseRenderer: () => void;

beforeEach(() => {
  ElementNode.resetPostMutation();
  callbacks = [];
  microtasks = [];
  vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((callback) => {
    microtasks.push(callback);
  });
  releaseRenderer = installRenderer({
    root: renderer.root,
    createNode: renderer.createNode.bind(renderer),
    createTextNode: renderer.createTextNode.bind(renderer),
    createShader: renderer.createShader.bind(renderer),
    stage: {
      root: renderer.root,
      reprocessUpdates(callback) {
        if (callback) callbacks.push(callback);
      },
    },
  });
});
afterEach(() => {
  ElementNode.resetPostMutation();
  releaseRenderer();
  vi.restoreAllMocks();
});

function removed() {
  const node = new ElementNode('node');
  node.destroy = vi.fn();
  enqueueDelete(node, -1);
  return node;
}

describe('post-mutation ownership', () => {
  it('invalidates renderer and microtask callbacks across reset', () => {
    const disposed = removed();
    const oldCallback = callbacks[0]!;
    const oldMicrotask = microtasks[0]!;
    ElementNode.resetPostMutation();
    expect(disposed._queueDelete).toBeUndefined();
    const next = removed();
    oldCallback();
    oldMicrotask();
    expect(disposed.destroy).not.toHaveBeenCalled();
    expect(next.destroy).not.toHaveBeenCalled();
    microtasks[1]!();
    callbacks[1]!();
    expect(next.destroy).toHaveBeenCalledTimes(1);
  });

  it.each(['renderer', 'microtask'] as const)(
    'consumes a batch once when %s runs first',
    (first) => {
      const previous = removed();
      const runFirst = first === 'renderer' ? callbacks[0]! : microtasks[0]!;
      const runSecond = first === 'renderer' ? microtasks[0]! : callbacks[0]!;
      runFirst();
      const next = removed();
      runSecond();
      expect(previous.destroy).toHaveBeenCalledTimes(1);
      expect(next.destroy).not.toHaveBeenCalled();
      callbacks[1]!();
      microtasks[1]!();
      expect(next.destroy).toHaveBeenCalledTimes(1);
    },
  );

  it('rebuilds text defaults when temporary font settings end', () => {
    const fonts = Config.fontSettings;
    const texts: ElementNode[] = [];
    const text = () => {
      const node = new ElementNode('text');
      node.parent = rootNode;
      node.w = 100;
      node.h = 30;
      node.render();
      texts.push(node);
      return node.lng;
    };
    try {
      Config.fontSettings = {
        fontFamily: 'Before',
        fontWeight: 500,
        fontSize: 21,
      };
      ElementNode.resetFontTemplate();
      expect(text()).toMatchObject({ fontFamily: 'Before500', fontSize: 21 });
      Config.fontSettings = {};
      ElementNode.resetFontTemplate();
      expect(text()).not.toMatchObject({
        fontFamily: 'Before500',
        fontSize: 21,
      });
      Config.fontSettings = { fontFamily: 'After', fontSize: 27 };
      ElementNode.resetFontTemplate();
      expect(text()).toMatchObject({ fontFamily: 'After', fontSize: 27 });
    } finally {
      for (const node of texts) node.destroy();
      Config.fontSettings = fonts;
      ElementNode.resetFontTemplate();
    }
  });

  it('restores the previous renderer once', () => {
    const previous = renderer;
    const next = { ...previous };
    const restore = installRenderer(next);
    expect(renderer).toBe(next);
    restore();
    expect(renderer).toBe(previous);
    restore();
    expect(renderer).toBe(previous);
  });
});
