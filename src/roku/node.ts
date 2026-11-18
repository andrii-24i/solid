import type { DomNode } from '@roku-sdk/interfaces';
import type {
  AnimateProps,
  AnimationSettings,
  IAnimationController,
} from '@solidtv/renderer';
import {
  createNative,
  insertNative,
  removeNative,
  setNative,
} from './native.js';
import {
  RokuAnimation,
  type AnimationChannel,
  type NativeAnimationTarget,
} from './animation.js';
import { RokuPropMirror, defaults, type RokuProps } from './props.js';

type Axis = 'x' | 'y';
type NativeUpdate =
  | 'translation'
  | 'opacity'
  | 'scale'
  | 'rotation'
  | 'center'
  | 'clipping'
  | 'id'
  | 'content'
  | 'width'
  | 'height'
  | 'color'
  | 'text'
  | 'textAlign';

const updates: Partial<Record<keyof RokuProps, readonly NativeUpdate[]>> = {
  x: ['translation'],
  y: ['translation'],
  alpha: ['opacity'],
  scale: ['scale'],
  scaleX: ['scale'],
  scaleY: ['scale'],
  mount: ['translation'],
  mountX: ['translation'],
  mountY: ['translation'],
  w: ['translation', 'width', 'center', 'clipping'],
  h: ['translation', 'height', 'center', 'clipping'],
  rotation: ['rotation'],
  pivot: ['center'],
  pivotX: ['center'],
  pivotY: ['center'],
  clipping: ['clipping'],
  data: ['id'],
  src: ['content'],
  color: ['color'],
  text: ['text'],
  textAlign: ['textAlign'],
};
const channels: Partial<Record<keyof RokuProps, readonly AnimationChannel[]>> =
  {
    x: ['x'],
    y: ['y'],
    alpha: ['alpha'],
    scale: ['scaleX', 'scaleY'],
    scaleX: ['scaleX'],
    scaleY: ['scaleY'],
    mount: ['x', 'y'],
    mountX: ['x'],
    mountY: ['y'],
    w: ['x'],
    h: ['y'],
  };
// Props that change one axis of a vector field. Once the axes are split, their
// update must leave the other axis's group alone: a Tween may be driving it.
const axes: Partial<Record<keyof RokuProps, Axis>> = {
  x: 'x',
  scaleX: 'x',
  mountX: 'x',
  w: 'x',
  y: 'y',
  scaleY: 'y',
  mountY: 'y',
  h: 'y',
};
const channelUpdates: Record<AnimationChannel, readonly [NativeUpdate, Axis?]> =
  {
    x: ['translation', 'x'],
    y: ['translation', 'y'],
    alpha: ['opacity'],
    scaleX: ['scale', 'x'],
    scaleY: ['scale', 'y'],
  };

export class RokuNode extends RokuPropMirror {
  readonly native: DomNode;
  readonly props: RokuProps;
  // Set by splitAxes(). Until then `native` carries every field and hosts the
  // content and children. Afterwards `native` keeps x, opacity and id; `middle`
  // takes y, rotation and scaleX; `inner` takes scaleY, clipping and the
  // content and children.
  private split?: { middle: DomNode; inner: DomNode };
  private content?: DomNode;
  private contentKind?: 'label' | 'poster' | 'rectangle';
  private destroyed = false;
  private readonly animations = new Map<AnimationChannel, RokuAnimation>();
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
    for (const update of [
      'translation',
      'opacity',
      'scale',
      'rotation',
      'center',
      'clipping',
      'id',
      'content',
    ] satisfies NativeUpdate[])
      this.updateNative(update);
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

  get childHost(): DomNode {
    return this.split?.inner ?? this.native;
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
    if (key === 'scale' && typeof value === 'number') {
      if (this.scaleX === value && this.scaleY === value) {
        this.props.scale = value;
        return;
      }
    } else if (key === 'mount' && typeof value === 'number') {
      if (this.mountX === value && this.mountY === value) {
        this.props.mount = value;
        return;
      }
    } else if (key === 'pivot' && typeof value === 'number') {
      if (this.pivotX === value && this.pivotY === value) {
        this.props.pivot = value;
        return;
      }
    } else if (this.props[key] === value) return;
    if (
      key === 'shader' ||
      key === 'texture' ||
      key === 'fontFamily' ||
      key === 'fontSize' ||
      key === 'fontWeight'
    )
      this.validate({ [key]: value });
    for (const channel of channels[key] ?? []) {
      if (
        (key === 'w' && this.mountX === 0) ||
        (key === 'h' && this.mountY === 0)
      )
        continue;
      this.animations.get(channel)?.stop();
    }
    if (key === 'parent') {
      const parent = value instanceof RokuNode ? value : null;
      if (this.parent) {
        this.parent.children.delete(this);
        removeNative(this.parent.childHost, this.native);
      }
      this.props.parent = parent;
      if (parent) {
        parent.children.add(this);
        insertNative(parent.childHost, this.native);
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
    for (const update of updates[key] ?? []) {
      if (
        (key === 'w' && update === 'translation' && this.mountX === 0) ||
        (key === 'h' && update === 'translation' && this.mountY === 0) ||
        ((key === 'w' || key === 'h') &&
          update === 'clipping' &&
          !this.clipping)
      )
        continue;
      this.updateNative(update, axes[key]);
    }
  }

  claimAnimation(animation: RokuAnimation, owned: readonly AnimationChannel[]) {
    if (this.destroyed) return false;
    for (const channel of owned) this.animations.get(channel)?.stop();
    for (const channel of owned) this.animations.set(channel, animation);
    return true;
  }

  releaseAnimation(
    animation: RokuAnimation,
    owned: readonly AnimationChannel[],
  ) {
    for (const channel of owned)
      if (this.animations.get(channel) === animation)
        this.animations.delete(channel);
  }

  // An SDK Tween on one axis writes the whole vector and holds the other axis
  // at a constant, so two Tweens cannot share a field. Before the first
  // transform Tween, give each axis its own group. Opacity Tweens stay on
  // `native`, so no running Tween targets a field that moves here.
  private splitAxes() {
    if (this.split) return this.split;
    const middle = createNative('group');
    const inner = createNative('group');
    insertNative(middle, inner);
    const hosted = new Set<DomNode | undefined>([this.content]);
    for (const child of this.children) hosted.add(child.native);
    for (const child of [...(this.native.c ?? [])]) {
      if (!hosted.has(child)) continue;
      removeNative(this.native, child);
      insertNative(inner, child);
    }
    insertNative(this.native, middle);
    this.split = { middle, inner };
    setNative(this.native, 'scale', [1, 1]);
    setNative(this.native, 'rotation', 0);
    setNative(this.native, 'clippingRect', [0, 0, 0, 0]);
    for (const update of [
      'translation',
      'scale',
      'rotation',
      'center',
      'clipping',
    ] satisfies NativeUpdate[])
      this.updateNative(update);
    return this.split;
  }

  animationTarget(channel: AnimationChannel): NativeAnimationTarget {
    if (channel === 'alpha')
      return { node: this.native, field: 'opacity', axis: 'all', offset: 0 };
    const { middle, inner } = this.splitAxes();
    switch (channel) {
      case 'x':
        return {
          node: this.native,
          field: 'translation',
          axis: 'x',
          preserveOther: 0,
          offset: this.mountX * this.w,
        };
      case 'y':
        return {
          node: middle,
          field: 'translation',
          axis: 'y',
          preserveOther: 0,
          offset: this.mountY * this.h,
        };
      case 'scaleX':
        return {
          node: middle,
          field: 'scale',
          axis: 'x',
          preserveOther: 1,
          offset: 0,
        };
      case 'scaleY':
        return {
          node: inner,
          field: 'scale',
          axis: 'y',
          preserveOther: 1,
          offset: 0,
        };
    }
  }

  observeAnimation(channel: AnimationChannel, value: number) {
    this.props[channel] = value;
    if (
      (channel === 'scaleX' || channel === 'scaleY') &&
      this.scaleX === this.scaleY
    )
      this.props.scale = value;
    this.updateNative(...channelUpdates[channel]);
  }

  private updateNative(update: NativeUpdate, axis?: Axis) {
    const p = this.props;
    const split = this.split;
    switch (update) {
      case 'translation': {
        const x = p.x - p.mountX * p.w;
        const y = p.y - p.mountY * p.h;
        if (!split) setNative(this.native, 'translation', [x, y]);
        else {
          if (axis !== 'y') setNative(this.native, 'translation', [x, 0]);
          if (axis !== 'x') setNative(split.middle, 'translation', [0, y]);
        }
        return;
      }
      case 'opacity':
        setNative(this.native, 'opacity', p.alpha);
        return;
      case 'scale':
        if (!split) setNative(this.native, 'scale', [p.scaleX, p.scaleY]);
        else {
          if (axis !== 'y') setNative(split.middle, 'scale', [p.scaleX, 1]);
          if (axis !== 'x') setNative(split.inner, 'scale', [1, p.scaleY]);
        }
        return;
      case 'rotation':
        setNative(split?.middle ?? this.native, 'rotation', -p.rotation);
        return;
      case 'center':
        for (const group of split ? [split.middle, split.inner] : [this.native])
          setNative(group, 'scaleRotateCenter', [
            p.pivotX * p.w,
            p.pivotY * p.h,
          ]);
        return;
      case 'clipping':
        setNative(
          this.childHost,
          'clippingRect',
          p.clipping ? [0, 0, p.w, p.h] : [0, 0, 0, 0],
        );
        return;
      case 'id':
        setNative(
          this.native,
          'id',
          typeof p.data?.testId === 'string' ? p.data.testId : '',
        );
        return;
      case 'content':
        this.updateContent();
        return;
    }
    if (!this.content) return;
    switch (update) {
      case 'width':
        setNative(this.content, 'width', p.w);
        return;
      case 'height':
        setNative(this.content, 'height', p.h);
        return;
      case 'color':
        if (this.contentKind !== 'poster')
          setNative(
            this.content,
            'color',
            `0x${(p.color >>> 0).toString(16).padStart(8, '0')}`,
          );
        return;
      case 'text':
        if (this.contentKind === 'label')
          setNative(this.content, 'text', p.text ?? '');
        return;
      case 'textAlign':
        if (this.contentKind === 'label')
          setNative(this.content, 'horizAlign', p.textAlign ?? 'left');
        return;
    }
  }

  private updateContent() {
    const kind =
      this.kind === 'text' ? 'label' : this.src ? 'poster' : 'rectangle';
    if (kind === this.contentKind) {
      if (kind === 'poster' && this.content)
        setNative(this.content, 'uri', this.src ?? '');
      return;
    }
    if (this.content) removeNative(this.childHost, this.content);
    this.content = createNative(kind);
    this.contentKind = kind;
    insertNative(this.childHost, this.content, this.childHost.c?.[0]);
    this.updateNative('width');
    this.updateNative('height');
    if (kind === 'poster') {
      setNative(this.content, 'uri', this.src ?? '');
      setNative(this.content, 'loadDisplayMode', 'scaleToFit');
    } else this.updateNative('color');
    if (kind === 'label') {
      this.updateNative('text');
      this.updateNative('textAlign');
      setNative(this.content, 'font', 'font:MediumSystemFont');
      setNative(this.content, 'vertAlign', 'center');
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
    for (const animation of this.animations.values()) animation.stop();
    for (const child of this.children) child.destroy();
    this.parent = null;
    const hosted = this.split?.middle ?? this.content;
    if (hosted) removeNative(this.native, hosted);
    this.removeAllListeners();
    this.destroyed = true;
  }
}
