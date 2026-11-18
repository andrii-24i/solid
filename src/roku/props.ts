import { EventEmitter } from '@solidtv/renderer/utils';
import type {
  IRendererNodeProps,
  IRendererTextNodeProps,
} from '../core/dom-renderer/domRendererTypes.js';
import type { RokuNode } from './node.js';

type TextFields = Omit<IRendererTextNodeProps, keyof IRendererNodeProps>;
export type RokuProps = Omit<IRendererNodeProps, 'parent'> &
  Partial<TextFields> & { parent: RokuNode | null };

export const defaults = {
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

/** Mirrors each logical prop: reads come from `props`, writes go through `write`. */
export abstract class RokuPropMirror extends EventEmitter implements RokuProps {
  abstract readonly props: RokuProps;
  abstract write<K extends keyof RokuProps>(key: K, value: RokuProps[K]): void;

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
