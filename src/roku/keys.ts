import type { KeyEventLike, KeyEventTarget } from '../core/focusManager.js';

const names: Record<string, string> = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  OK: 'Enter',
  back: 'Backspace',
  play: 'MediaPlayPause',
};

type KeyListener = Parameters<KeyEventTarget['addEventListener']>[1];

export function createRokuKeyTarget() {
  const listeners = {
    keydown: new Set<KeyListener>(),
    keyup: new Set<KeyListener>(),
  };
  const afterDispatch = new Set<() => void>();
  const held = new Map<string, number>();
  return {
    addEventListener(type, listener) {
      listeners[type].add(listener);
    },
    removeEventListener(type, listener) {
      listeners[type].delete(listener);
    },
    onAfterDispatch(listener: () => void) {
      afterDispatch.add(listener);
      return () => afterDispatch.delete(listener);
    },
    dispatch({ key, press }: { key: string; press: boolean }) {
      const now = Date.now();
      const previousPress = held.get(key);
      const event: KeyEventLike = {
        key: names[key] ?? key,
        keyCode: 0,
        repeat:
          press && previousPress !== undefined && now - previousPress < 1000,
      };
      if (press) held.set(key, now);
      else held.delete(key);
      let handled = false;
      try {
        for (const listener of listeners[press ? 'keydown' : 'keyup']) {
          if (listener(event) === true) handled = true;
        }
        return handled;
      } finally {
        for (const listener of afterDispatch) listener();
      }
    },
    clear() {
      held.clear();
      listeners.keydown.clear();
      listeners.keyup.clear();
      afterDispatch.clear();
    },
  } satisfies KeyEventTarget & {
    dispatch(event: { key: string; press: boolean }): boolean;
    onAfterDispatch(listener: () => void): () => void;
    clear(): void;
  };
}
