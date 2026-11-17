import { createRoot, type JSXElement } from 'solid-js';
import type { DomNode } from '@roku-sdk/interfaces';
import { Config } from '../core/config.js';
import { ElementNode } from '../core/elementNode.js';
import { setActiveElement } from '../core/activeElement.js';
import { setFocusPath, useFocusManager } from '../core/focusManager.js';
import { installRenderer, type RendererBackend } from '../core/renderer.js';
import { clearTasks, renderInto, setTasksEnabled } from '../renderCore.js';
import { RokuNode } from './node.js';
import { insertNative } from './native.js';
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
  const previousFontSettings = Config.fontSettings;
  const previousSetActiveElement = Config.setActiveElement;
  Config.fontSettings = {};
  let disposed = false;
  const stage = {
    get root(): RokuNode {
      return root;
    },
    reprocessUpdates() {
      queueMicrotask(() => {
        if (!disposed) setTasksEnabled(true);
      });
    },
  };
  const root = new RokuNode(
    stage,
    { w: options.width, h: options.height, color: 0 },
    'view',
    host,
  );
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
    insertNode(node, before) {
      const native = node.lng;
      const anchor = before?.lng;
      if (!(native instanceof RokuNode) || !native.parent) return;
      insertNative(
        native.parent.native,
        native.native,
        anchor instanceof RokuNode ? anchor.native : undefined,
      );
    },
  };
  installRenderer(backend);
  const rootNode = new ElementNode('App');
  rootNode.lng = root;
  rootNode.rendered = true;
  let dispose = () => {};
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    dispose();
    root.destroy();
    setActiveElement(undefined);
    setFocusPath([]);
    Config.fontSettings = previousFontSettings;
    Config.setActiveElement = previousSetActiveElement;
    mounted = false;
    options.keys.clear();
    clearTasks();
    setTasksEnabled(false);
  };
  try {
    dispose = createRoot((disposeOwner) => {
      try {
        useFocusManager({ Play: 'MediaPlayPause' }, options.keys);
        const disposeScreen = renderInto(screen, rootNode);
        return () => {
          disposeScreen();
          disposeOwner();
        };
      } catch (error) {
        disposeOwner();
        throw error;
      }
    });
  } catch (error) {
    cleanup();
    throw error;
  }
  setTasksEnabled(true);
  return cleanup;
}
