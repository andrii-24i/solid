import type { EventEmitter } from '@solidtv/renderer/utils';
import type {
  INodeProps,
  ITextNodeProps,
  IAnimationController,
  AnimateProps,
  AnimationSettings,
  RendererMain,
} from '@solidtv/renderer';
import type { ElementNode } from './elementNode.js';
import type {
  IRendererNodeProps,
  IRendererTextNodeProps,
} from './dom-renderer/domRendererTypes.js';

export interface BackendNode
  extends
    Omit<IRendererNodeProps, 'parent'>,
    Partial<Omit<IRendererTextNodeProps, keyof IRendererNodeProps>> {
  parent: BackendNode | null;
  props: Omit<IRendererNodeProps, 'parent'> & { parent: BackendNode | null };
  stage: { root: BackendNode };
  readonly absX: number;
  readonly absY: number;
  readonly renderState: 0 | 2 | 4 | 8;
  destroy(): void;
  animate(
    props: Partial<AnimateProps>,
    settings: Partial<AnimationSettings>,
  ): IAnimationController;
  on: EventEmitter['on'];
  once: EventEmitter['once'];
  off: EventEmitter['off'];
}

export interface RendererBackend {
  root: ElementNode['lng'];
  stage: {
    root: ElementNode['lng'];
    reprocessUpdates?: (callback?: () => void) => void;
  };
  createNode(
    props: Partial<IRendererNodeProps> & Partial<INodeProps>,
  ): ElementNode['lng'];
  createTextNode(
    props: Partial<IRendererTextNodeProps> & Partial<ITextNodeProps>,
  ): ElementNode['lng'];
  createShader: RendererMain['createShader'];
  insertNode?: (node: ElementNode) => void;
}

export let renderer: RendererBackend;

export function installRenderer(backend: RendererBackend) {
  const previous = renderer;
  renderer = backend;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (renderer === backend) renderer = previous;
  };
}
