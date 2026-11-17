import type { DomNode } from '@roku-sdk/interfaces';
import type {
  AnimateProps,
  AnimationSettings,
  IAnimationController,
} from '@solidtv/renderer';
import { EventEmitter } from '@solidtv/renderer/utils';
import type {
  IRendererNodeProps,
  IRendererTextNodeProps,
} from '../core/dom-renderer/domRendererTypes.js';
import {
  createNative,
  insertNative,
  removeNative,
  setNative,
} from './native.js';
import { RokuAnimation } from './animation.js';

type TextFields = Omit<IRendererTextNodeProps, keyof IRendererNodeProps>;
export type RokuProps = Omit<IRendererNodeProps, 'parent'> &
  Partial<TextFields> & { parent: RokuNode | null };

const defaults = {
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  alpha: 1,
  color: 0xffffffff,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  mount: 0,
  mountX: 0,
  mountY: 0,
  pivot: 0.5,
  pivotX: 0.5,
  pivotY: 0.5,
  zIndex: 0,
  clipping: false,
  parent: null,
  ignoreParentAlpha: false,
  placeholderColor: 0,
  autosize: false,
  rtl: null,
  data: null,
  src: null,
  texture: null,
  textureOptions: {},
  shader: null,
  colorTop: 0,
  colorBottom: 0,
  colorLeft: 0,
  colorRight: 0,
  colorTl: 0,
  colorTr: 0,
  colorBl: 0,
  colorBr: 0,
  text: '',
  textAlign: 'left',
  fontFamily: undefined,
  fontSize: undefined,
  fontWeight: undefined,
} satisfies RokuProps;

export interface RokuNode extends RokuProps {}

export class RokuNode extends EventEmitter {
  readonly native: DomNode;
  readonly props: RokuProps;
  private content?: DomNode;
  private contentKind?: 'label' | 'poster' | 'rectangle';
  private destroyed = false;
  readonly animations = new Set<RokuAnimation>();
  readonly children = new Set<RokuNode>();
  readonly id: number;
  private static nextId = 0;

  constructor(
    readonly stage: { root: RokuNode },
    props: Partial<RokuProps>,
    private readonly kind: 'view' | 'text',
    host?: DomNode,
  ) {
    super();
    this.id = ++RokuNode.nextId;
    this.props = {
      ...defaults,
      ...props,
      parent: null,
      scaleX: props.scaleX ?? props.scale ?? 1,
      scaleY: props.scaleY ?? props.scale ?? 1,
      mountX: props.mountX ?? props.mount ?? 0,
      mountY: props.mountY ?? props.mount ?? 0,
      pivotX: props.pivotX ?? props.pivot ?? 0.5,
      pivotY: props.pivotY ?? props.pivot ?? 0.5,
    };
    this.validate(props);
    this.native = host ?? createNative('group');
    this.sync();
    this.parent = props.parent ?? null;
  }

  private validate(props: Partial<RokuProps>) {
    if (props.shader || props.texture)
      throw new Error(
        'Roku does not support SolidTV shaders or textures. Use color and src.',
      );
    if (props.fontFamily || props.fontSize || props.fontWeight)
      throw new Error(
        'Roku proof uses the system font. Font selection and text measurement are unsupported.',
      );
    if (this.kind === 'text' && (!this.props.w || !this.props.h))
      throw new Error('Roku text requires explicit w and h.');
  }

  get absX(): number {
    return (this.parent?.absX ?? 0) + this.x - this.mountX * this.w;
  }
  get absY(): number {
    return (this.parent?.absY ?? 0) + this.y - this.mountY * this.h;
  }
  get width() {
    return this.w;
  }
  get height() {
    return this.h;
  }
  get renderState(): 2 | 8 {
    let parent = this.parent;
    while (parent) {
      if (
        parent.clipping &&
        (this.absX + this.w <= parent.absX ||
          this.absY + this.h <= parent.absY ||
          this.absX >= parent.absX + parent.w ||
          this.absY >= parent.absY + parent.h)
      )
        return 2;
      parent = parent.parent;
    }
    return 8;
  }

  write<K extends keyof RokuProps>(key: K, value: RokuProps[K]) {
    if (this.destroyed) return;
    let interrupted = false;
    for (const animation of this.animations)
      if (animation.has(key)) {
        animation.stop();
        interrupted = true;
      }
    if (!interrupted && this.props[key] === value) return;
    if (
      key === 'shader' ||
      key === 'texture' ||
      key === 'fontFamily' ||
      key === 'fontSize' ||
      key === 'fontWeight'
    )
      this.validate({ [key]: value });
    if (key === 'parent') {
      const parent = value instanceof RokuNode ? value : null;
      if (this.props.parent) {
        this.props.parent.children.delete(this);
        removeNative(this.props.parent.native, this.native);
      }
      this.props.parent = parent;
      if (parent) {
        parent.children.add(this);
        insertNative(parent.native, this.native);
      }
      return;
    }
    this.props[key] = value;
    if (key === 'scale' && typeof value === 'number')
      this.props.scaleX = this.props.scaleY = value;
    if (key === 'mount' && typeof value === 'number')
      this.props.mountX = this.props.mountY = value;
    if (key === 'pivot' && typeof value === 'number')
      this.props.pivotX = this.props.pivotY = value;
    this.sync();
  }

  sync() {
    const p = this.props;
    if (
      ![...this.animations].some(
        (animation) => animation.has('x') || animation.has('y'),
      )
    )
      setNative(this.native, 'translation', [
        p.x - p.mountX * p.w,
        p.y - p.mountY * p.h,
      ]);
    if (![...this.animations].some((animation) => animation.has('alpha')))
      setNative(this.native, 'opacity', p.alpha);
    if (
      ![...this.animations].some(
        (animation) =>
          animation.has('scale') ||
          animation.has('scaleX') ||
          animation.has('scaleY'),
      )
    )
      setNative(this.native, 'scale', [p.scaleX, p.scaleY]);
    setNative(this.native, 'rotation', -p.rotation);
    setNative(this.native, 'scaleRotateCenter', [
      p.pivotX * p.w,
      p.pivotY * p.h,
    ]);
    setNative(
      this.native,
      'clippingRect',
      p.clipping ? [0, 0, p.w, p.h] : [0, 0, 0, 0],
    );
    if (typeof p.data?.testId === 'string')
      setNative(this.native, 'id', p.data.testId);
    const kind =
      this.kind === 'text' ? 'label' : p.src ? 'poster' : 'rectangle';
    if (kind !== this.contentKind) {
      if (this.content) removeNative(this.native, this.content);
      this.content = createNative(kind);
      this.contentKind = kind;
      insertNative(this.native, this.content, this.native.c?.[0]);
    }
    const content = this.content;
    if (!content) return;
    setNative(content, 'width', p.w);
    setNative(content, 'height', p.h);
    if (kind === 'poster') {
      setNative(content, 'uri', p.src ?? '');
      setNative(content, 'loadDisplayMode', 'scaleToFit');
    } else {
      setNative(
        content,
        'color',
        `0x${(p.color >>> 0).toString(16).padStart(8, '0')}`,
      );
    }
    if (kind === 'label') {
      setNative(content, 'text', p.text ?? '');
      setNative(content, 'font', 'font:MediumSystemFont');
      setNative(content, 'horizAlign', p.textAlign ?? 'left');
      setNative(content, 'vertAlign', 'center');
    }
  }

  animate(
    props: Partial<AnimateProps>,
    settings: Partial<AnimationSettings>,
  ): IAnimationController {
    return new RokuAnimation(this, props, settings);
  }

  destroy() {
    if (this.destroyed) return;
    for (const animation of this.animations) animation.stop();
    for (const child of this.children) child.destroy();
    this.parent = null;
    if (this.content) removeNative(this.native, this.content);
    this.removeAllListeners();
    this.destroyed = true;
  }
}

for (const key of Object.keys(defaults) as (keyof RokuProps)[]) {
  Object.defineProperty(RokuNode.prototype, key, {
    get(this: RokuNode) {
      return this.props[key];
    },
    set(this: RokuNode, value: RokuProps[typeof key]) {
      this.write(key, value);
    },
  });
}
