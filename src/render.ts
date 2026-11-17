import { Config } from './core/config.js';
import { startLightningRenderer } from './core/lightningInit.js';
import type { RendererMainSettings } from '@solidtv/renderer';
import type { DomRendererMainSettings } from './core/dom-renderer/domRendererTypes.js';
import { rootNode, render, setTasksEnabled } from './renderCore.js';
export {
  rootNode,
  effect,
  memo,
  createComponent,
  createElement,
  createTextNode,
  insertNode,
  insert,
  spread,
  setProp,
  use,
  mergeProps,
  setTasksEnabled,
  clearTasks,
  scheduleTask,
  Dynamic,
  View,
  Text,
  registerDefaultShader,
} from './renderCore.js';

export function createRenderer(
  rendererOptions?: RendererMainSettings | DomRendererMainSettings,
  node?: HTMLElement | string,
) {
  const renderer = startLightningRenderer(
    rendererOptions || Config.rendererOptions!,
    node || 'app',
  );
  rootNode.lng = renderer.root!;
  rootNode.rendered = true;
  renderer.on('idle', () => setTasksEnabled(true));
  return { renderer, rootNode, render };
}
