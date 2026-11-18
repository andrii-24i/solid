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
import {
  RokuAnimation,
  type AnimationChannel,
  type NativeAnimationTarget,
} from './animation.js';

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

type NativeUpdate =
  | 'translationX'
  | 'translationY'
  | 'opacity'
  | 'scaleX'
  | 'scaleY'
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
  x: ['translationX'],
  y: ['translationY'],
  alpha: ['opacity'],
  scale: ['scaleX', 'scaleY'],
  scaleX: ['scaleX'],
  scaleY: ['scaleY'],
  mount: ['translationX', 'translationY'],
  mountX: ['translationX'],
  mountY: ['translationY'],
  w: ['translationX', 'width', 'center', 'clipping'],
  h: ['translationY', 'height', 'center', 'clipping'],
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

export class RokuNode extends EventEmitter implements RokuProps {
  readonly native: DomNode;
  readonly childHost: DomNode;
  readonly props: RokuProps;
  private readonly vertical: DomNode;
  private readonly horizontalScale: DomNode;
  private readonly verticalScale: DomNode;
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
    this.vertical = createNative('group');
    this.horizontalScale = createNative('group');
    this.verticalScale = createNative('group');
    this.childHost = createNative('group');
    insertNative(this.native, this.vertical);
    insertNative(this.vertical, this.horizontalScale);
    insertNative(this.horizontalScale, this.verticalScale);
    insertNative(this.verticalScale, this.childHost);
    for (const update of [
      'translationX',
      'translationY',
      'opacity',
      'scaleX',
      'scaleY',
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
        (key === 'w' && update === 'translationX' && this.mountX === 0) ||
        (key === 'h' && update === 'translationY' && this.mountY === 0) ||
        ((key === 'w' || key === 'h') &&
          update === 'clipping' &&
          !this.clipping)
      )
        continue;
      this.updateNative(update);
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

  animationTarget(channel: AnimationChannel): NativeAnimationTarget {
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
          node: this.vertical,
          field: 'translation',
          axis: 'y',
          preserveOther: 0,
          offset: this.mountY * this.h,
        };
      case 'scaleX':
        return {
          node: this.horizontalScale,
          field: 'scale',
          axis: 'x',
          preserveOther: 1,
          offset: 0,
        };
      case 'scaleY':
        return {
          node: this.verticalScale,
          field: 'scale',
          axis: 'y',
          preserveOther: 1,
          offset: 0,
        };
      case 'alpha':
        return { node: this.native, field: 'opacity', axis: 'all', offset: 0 };
    }
  }

  observeAnimation(channel: AnimationChannel, value: number) {
    this.props[channel] = value;
    if (
      (channel === 'scaleX' || channel === 'scaleY') &&
      this.scaleX === this.scaleY
    )
      this.props.scale = value;
    const update: Record<AnimationChannel, NativeUpdate> = {
      x: 'translationX',
      y: 'translationY',
      alpha: 'opacity',
      scaleX: 'scaleX',
      scaleY: 'scaleY',
    };
    this.updateNative(update[channel]);
  }

  private updateNative(update: NativeUpdate) {
    const p = this.props;
    switch (update) {
      case 'translationX':
        setNative(this.native, 'translation', [p.x - p.mountX * p.w, 0]);
        return;
      case 'translationY':
        setNative(this.vertical, 'translation', [0, p.y - p.mountY * p.h]);
        return;
      case 'opacity':
        setNative(this.native, 'opacity', p.alpha);
        return;
      case 'scaleX':
        setNative(this.horizontalScale, 'scale', [p.scaleX, 1]);
        return;
      case 'scaleY':
        setNative(this.verticalScale, 'scale', [1, p.scaleY]);
        return;
      case 'rotation':
        setNative(this.vertical, 'rotation', -p.rotation);
        return;
      case 'center':
        for (const group of [
          this.vertical,
          this.horizontalScale,
          this.verticalScale,
        ])
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
    removeNative(this.native, this.vertical);
    this.removeAllListeners();
    this.destroyed = true;
  }

  get x(): RokuProps['x'] {
    return this.props.x;
  }
  set x(value: RokuProps['x']) {
    this.write('x', value);
  }
  get y(): RokuProps['y'] {
    return this.props.y;
  }
  set y(value: RokuProps['y']) {
    this.write('y', value);
  }
  get w(): RokuProps['w'] {
    return this.props.w;
  }
  set w(value: RokuProps['w']) {
    this.write('w', value);
  }
  get h(): RokuProps['h'] {
    return this.props.h;
  }
  set h(value: RokuProps['h']) {
    this.write('h', value);
  }
  get alpha(): RokuProps['alpha'] {
    return this.props.alpha;
  }
  set alpha(value: RokuProps['alpha']) {
    this.write('alpha', value);
  }
  get color(): RokuProps['color'] {
    return this.props.color;
  }
  set color(value: RokuProps['color']) {
    this.write('color', value);
  }
  get scale(): RokuProps['scale'] {
    return this.props.scale;
  }
  set scale(value: RokuProps['scale']) {
    this.write('scale', value);
  }
  get scaleX(): RokuProps['scaleX'] {
    return this.props.scaleX;
  }
  set scaleX(value: RokuProps['scaleX']) {
    this.write('scaleX', value);
  }
  get scaleY(): RokuProps['scaleY'] {
    return this.props.scaleY;
  }
  set scaleY(value: RokuProps['scaleY']) {
    this.write('scaleY', value);
  }
  get rotation(): RokuProps['rotation'] {
    return this.props.rotation;
  }
  set rotation(value: RokuProps['rotation']) {
    this.write('rotation', value);
  }
  get mount(): RokuProps['mount'] {
    return this.props.mount;
  }
  set mount(value: RokuProps['mount']) {
    this.write('mount', value);
  }
  get mountX(): RokuProps['mountX'] {
    return this.props.mountX;
  }
  set mountX(value: RokuProps['mountX']) {
    this.write('mountX', value);
  }
  get mountY(): RokuProps['mountY'] {
    return this.props.mountY;
  }
  set mountY(value: RokuProps['mountY']) {
    this.write('mountY', value);
  }
  get pivot(): RokuProps['pivot'] {
    return this.props.pivot;
  }
  set pivot(value: RokuProps['pivot']) {
    this.write('pivot', value);
  }
  get pivotX(): RokuProps['pivotX'] {
    return this.props.pivotX;
  }
  set pivotX(value: RokuProps['pivotX']) {
    this.write('pivotX', value);
  }
  get pivotY(): RokuProps['pivotY'] {
    return this.props.pivotY;
  }
  set pivotY(value: RokuProps['pivotY']) {
    this.write('pivotY', value);
  }
  get zIndex(): RokuProps['zIndex'] {
    return this.props.zIndex;
  }
  set zIndex(value: RokuProps['zIndex']) {
    this.write('zIndex', value);
  }
  get clipping(): RokuProps['clipping'] {
    return this.props.clipping;
  }
  set clipping(value: RokuProps['clipping']) {
    this.write('clipping', value);
  }
  get parent(): RokuProps['parent'] {
    return this.props.parent;
  }
  set parent(value: RokuProps['parent']) {
    this.write('parent', value);
  }
  get ignoreParentAlpha(): RokuProps['ignoreParentAlpha'] {
    return this.props.ignoreParentAlpha;
  }
  set ignoreParentAlpha(value: RokuProps['ignoreParentAlpha']) {
    this.write('ignoreParentAlpha', value);
  }
  get placeholderColor(): RokuProps['placeholderColor'] {
    return this.props.placeholderColor;
  }
  set placeholderColor(value: RokuProps['placeholderColor']) {
    this.write('placeholderColor', value);
  }
  get autosize(): RokuProps['autosize'] {
    return this.props.autosize;
  }
  set autosize(value: RokuProps['autosize']) {
    this.write('autosize', value);
  }
  get rtl(): RokuProps['rtl'] {
    return this.props.rtl;
  }
  set rtl(value: RokuProps['rtl']) {
    this.write('rtl', value);
  }
  get data(): RokuProps['data'] {
    return this.props.data;
  }
  set data(value: RokuProps['data']) {
    this.write('data', value);
  }
  get src(): RokuProps['src'] {
    return this.props.src;
  }
  set src(value: RokuProps['src']) {
    this.write('src', value);
  }
  get texture(): RokuProps['texture'] {
    return this.props.texture;
  }
  set texture(value: RokuProps['texture']) {
    this.write('texture', value);
  }
  get textureOptions(): RokuProps['textureOptions'] {
    return this.props.textureOptions;
  }
  set textureOptions(value: RokuProps['textureOptions']) {
    this.write('textureOptions', value);
  }
  get shader(): RokuProps['shader'] {
    return this.props.shader;
  }
  set shader(value: RokuProps['shader']) {
    this.write('shader', value);
  }
  get colorTop(): RokuProps['colorTop'] {
    return this.props.colorTop;
  }
  set colorTop(value: RokuProps['colorTop']) {
    this.write('colorTop', value);
  }
  get colorBottom(): RokuProps['colorBottom'] {
    return this.props.colorBottom;
  }
  set colorBottom(value: RokuProps['colorBottom']) {
    this.write('colorBottom', value);
  }
  get colorLeft(): RokuProps['colorLeft'] {
    return this.props.colorLeft;
  }
  set colorLeft(value: RokuProps['colorLeft']) {
    this.write('colorLeft', value);
  }
  get colorRight(): RokuProps['colorRight'] {
    return this.props.colorRight;
  }
  set colorRight(value: RokuProps['colorRight']) {
    this.write('colorRight', value);
  }
  get colorTl(): RokuProps['colorTl'] {
    return this.props.colorTl;
  }
  set colorTl(value: RokuProps['colorTl']) {
    this.write('colorTl', value);
  }
  get colorTr(): RokuProps['colorTr'] {
    return this.props.colorTr;
  }
  set colorTr(value: RokuProps['colorTr']) {
    this.write('colorTr', value);
  }
  get colorBl(): RokuProps['colorBl'] {
    return this.props.colorBl;
  }
  set colorBl(value: RokuProps['colorBl']) {
    this.write('colorBl', value);
  }
  get colorBr(): RokuProps['colorBr'] {
    return this.props.colorBr;
  }
  set colorBr(value: RokuProps['colorBr']) {
    this.write('colorBr', value);
  }
  get text(): RokuProps['text'] {
    return this.props.text;
  }
  set text(value: RokuProps['text']) {
    this.write('text', value);
  }
  get textAlign(): RokuProps['textAlign'] {
    return this.props.textAlign;
  }
  set textAlign(value: RokuProps['textAlign']) {
    this.write('textAlign', value);
  }
  get fontFamily(): RokuProps['fontFamily'] {
    return this.props.fontFamily;
  }
  set fontFamily(value: RokuProps['fontFamily']) {
    this.write('fontFamily', value);
  }
  get fontSize(): RokuProps['fontSize'] {
    return this.props.fontSize;
  }
  set fontSize(value: RokuProps['fontSize']) {
    this.write('fontSize', value);
  }
  get fontWeight(): RokuProps['fontWeight'] {
    return this.props.fontWeight;
  }
  set fontWeight(value: RokuProps['fontWeight']) {
    this.write('fontWeight', value);
  }
}
