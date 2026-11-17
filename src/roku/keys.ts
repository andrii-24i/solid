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

export function createRokuKeyTarget() {
  const listeners = {
    keydown: new Set<(event: KeyEventLike) => void>(),
    keyup: new Set<(event: KeyEventLike) => void>(),
  };
  const held = new Set<string>();
  return {
    addEventListener(type, listener) {
      listeners[type].add(listener);
    },
    removeEventListener(type, listener) {
      listeners[type].delete(listener);
    },
    dispatch({ key, press }: { key: string; press: boolean }) {
      const event = {
        key: names[key] ?? key,
        keyCode: 0,
        repeat: press && held.has(key),
      };
      if (press) held.add(key);
      else held.delete(key);
      for (const listener of listeners[press ? 'keydown' : 'keyup'])
        listener(event);
    },
    clear() {
      held.clear();
      listeners.keydown.clear();
      listeners.keyup.clear();
    },
  } satisfies KeyEventTarget & {
    dispatch(event: { key: string; press: boolean }): void;
    clear(): void;
  };
}
