import { createRoot, type JSXElement } from 'solid-js';
import type { DomNode } from '@roku-sdk/interfaces';
import { Config } from '../core/config.js';
import { ElementNode } from '../core/elementNode.js';
import { setActiveElement } from '../core/activeElement.js';
import { setFocusPath, useFocusManager } from '../core/focusManager.js';
import { installRenderer, type RendererBackend } from '../core/renderer.js';
import {
  clearTasks,
  render,
  rootNode,
  setTasksEnabled,
} from '../renderCore.js';
import { RokuNode } from './node.js';
import { createNative, insertNative, removeNative } from './native.js';
import { createRokuKeyTarget } from './keys.js';

export * from '../renderCore.js';
export { Config } from '../core/config.js';
export { ElementNode } from '../core/elementNode.js';
export { activeElement } from '../core/activeElement.js';
export { combineStyles } from '../utils.js';
export { hasFocus } from '../core/utils.js';
export { renderer } from '../core/renderer.js';
export type { NodeStyles } from '../core/intrinsicTypes.js';
export type * from '../core/intrinsicTypes.js';
export { createRokuKeyTarget } from './keys.js';

let mounted = false;

export function mountRoku(
  screen: () => JSXElement,
  host: DomNode,
  options: {
    width: number;
    height: number;
    keys: ReturnType<typeof createRokuKeyTarget>;
  },
) {
  if (mounted)
    throw new Error('Only one SolidTV Roku root can be mounted at a time.');
  mounted = true;
  const releases: Array<() => void> = [];
  let disposed = false;
  let idleQueued = false;
  const resetPending = () => {
    ElementNode.resetPostMutation();
    setTasksEnabled(false);
    clearTasks();
  };
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    const errors: unknown[] = [];
    const release = (callback: () => void) => {
      try {
        callback();
      } catch (error) {
        errors.push(error);
      }
    };
    try {
      release(resetPending);
      for (let i = releases.length - 1; i >= 0; i--) release(releases[i]!);
      releases.length = 0;
      release(() => setActiveElement(undefined));
      release(() => setFocusPath([]));
      release(resetPending);
    } finally {
      mounted = false;
    }
    if (errors.length > 1)
      console.error('Additional Roku cleanup errors', errors.slice(1));
    if (errors.length) throw errors[0];
  };
  const scheduleIdle = () => {
    if (disposed || idleQueued) return;
    idleQueued = true;
    queueMicrotask(() => {
      idleQueued = false;
      if (!disposed) setTasksEnabled(true);
    });
  };

  try {
    const previousFontSettings = Config.fontSettings;
    const previousSetActiveElement = Config.setActiveElement;
    releases.push(() => {
      Config.fontSettings = previousFontSettings;
      Config.setActiveElement = previousSetActiveElement;
      ElementNode.resetFontTemplate();
    });
    Config.fontSettings = {};
    ElementNode.resetFontTemplate();
    resetPending();

    const group = createNative('group');
    releases.push(() => {
      if (group.parent === host) removeNative(host, group);
    });
    insertNative(host, group);
    const stage = {
      get root(): RokuNode {
        return root;
      },
      reprocessUpdates(callback?: () => void) {
        queueMicrotask(() => {
          if (disposed) return;
          try {
            callback?.();
          } finally {
            scheduleIdle();
          }
        });
      },
    };
    const root = new RokuNode(
      stage,
      { w: options.width, h: options.height, color: 0 },
      'view',
      group,
    );
    releases.push(() => root.destroy());
    const makeNode = (
      props: Parameters<RendererBackend['createNode']>[0],
      kind: 'view' | 'text',
    ) => {
      const { parent, ...values } = props;
      if (!(parent instanceof RokuNode))
        throw new Error('Roku nodes require a Roku parent.');
      return new RokuNode(stage, { ...values, parent }, kind);
    };
    const backend: RendererBackend = {
      root,
      stage,
      createNode: (props) => makeNode(props, 'view'),
      createTextNode: (props) => makeNode(props, 'text'),
      createShader() {
        throw new Error('Roku does not support SolidTV shaders.');
      },
      insertNode(node) {
        const native = node.lng;
        if (!(native instanceof RokuNode) || !native.parent || !node.parent)
          return;
        const siblings = node.parent.children;
        let anchor: DomNode | undefined;
        for (let i = siblings.indexOf(node) + 1; i < siblings.length; i++) {
          const sibling = siblings[i];
          if (sibling?.rendered && sibling.lng instanceof RokuNode) {
            anchor = sibling.lng.native;
            break;
          }
        }
        insertNative(native.parent.childHost, native.native, anchor);
      },
    };
    releases.push(installRenderer(backend));
    const previousBinding = {
      lng: rootNode.lng,
      rendered: rootNode.rendered,
      children: rootNode.children,
      _states: rootNode._states,
    };
    releases.push(() => Object.assign(rootNode, previousBinding));
    rootNode.lng = root;
    rootNode.rendered = true;
    rootNode.children = [];
    rootNode._states = undefined;
    releases.push(options.keys.onAfterDispatch(scheduleIdle));
    createRoot((disposeOwner) => {
      releases.push(disposeOwner);
      releases.push(useFocusManager({ Play: 'MediaPlayPause' }, options.keys));
      releases.push(render(screen));
    });
    scheduleIdle();
    return cleanup;
  } catch (error) {
    try {
      cleanup();
    } catch (cleanupError) {
      console.error('Roku mount cleanup failed', cleanupError);
    }
    throw error;
  }
}
