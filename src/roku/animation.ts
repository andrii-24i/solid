import type { DomNode } from '@roku-sdk/interfaces';
import type {
  AnimateProps,
  AnimationControllerState,
  AnimationSettings,
  IAnimationController,
} from '@solidtv/renderer';
import type { RokuNode } from './node.js';
import {
  createNative,
  insertNative,
  removeNative,
  setNative,
} from './native.js';

type AnimatedKey = 'x' | 'y' | 'alpha' | 'scale' | 'scaleX' | 'scaleY';
type NativeField = 'translation' | 'opacity' | 'scale';
type Target = { key: AnimatedKey; value: number; initial: number };
const fields = {
  x: 'translation',
  y: 'translation',
  alpha: 'opacity',
  scale: 'scale',
  scaleX: 'scale',
  scaleY: 'scale',
} satisfies Record<AnimatedKey, NativeField>;
const easings = new Map([
  ['linear', 'linear'],
  ['ease-in', 'inCubic'],
  ['ease-out', 'outCubic'],
  ['ease-in-out', 'inOutCubic'],
]);

function isAnimatedKey(key: string): key is AnimatedKey {
  return (
    key === 'x' ||
    key === 'y' ||
    key === 'alpha' ||
    key === 'scale' ||
    key === 'scaleX' ||
    key === 'scaleY'
  );
}

export class RokuAnimation implements IAnimationController {
  state: AnimationControllerState = 'scheduled';
  private readonly tracks = new Map<NativeField, Target[]>();
  private readonly tweens = new Set<DomNode>();
  private readonly easing: string;
  private stopped?: Promise<void>;
  private resolveStopped?: () => void;

  constructor(
    private readonly node: RokuNode,
    props: Partial<AnimateProps>,
    private readonly settings: Partial<AnimationSettings>,
  ) {
    if (
      settings.delay ||
      settings.loop ||
      settings.repeat ||
      settings.repeatDelay ||
      settings.stopMethod
    )
      throw new Error(
        'Roku proof supports one-shot Tween animations without delay or repetition.',
      );
    const easing =
      typeof settings.easing === 'string'
        ? easings.get(settings.easing)
        : settings.easing === undefined
          ? 'inOutCubic'
          : undefined;
    if (!easing)
      throw new Error(`Unsupported Roku easing: ${String(settings.easing)}`);
    this.easing = easing;
    for (const [key, value] of Object.entries(props)) {
      if (
        !isAnimatedKey(key) ||
        typeof value !== 'number' ||
        !Number.isFinite(value)
      )
        throw new Error(
          `Unsupported Roku animation property: ${key}=${String(value)}`,
        );
      const targets = this.tracks.get(fields[key]) ?? [];
      targets.push({ key, value, initial: node[key] ?? 1 });
      this.tracks.set(fields[key], targets);
    }
  }

  has(key: string) {
    return isAnimatedKey(key) && this.tracks.has(fields[key]);
  }

  start(): this {
    if (this.state === 'running') return this;
    if (this.state === 'paused') {
      for (const tween of this.tweens) setNative(tween, 'control', 'resume');
      this.state = 'running';
      return this;
    }
    if (this.state === 'stopped') this.stopped = undefined;
    for (const other of this.node.animations)
      if (
        [...this.tracks.values()].some((targets) =>
          targets.some((target) => other.has(target.key)),
        )
      )
        other.stop();
    this.node.animations.add(this);
    this.state = 'running';
    for (const [field, targets] of this.tracks) {
      const tween = createNative('tween');
      this.tweens.add(tween);
      insertNative(this.node.native, tween);
      setNative(tween, 'targetNode', this.node.native);
      setNative(tween, 'field', field);
      setNative(tween, 'duration', (this.settings.duration ?? 250) / 1000);
      setNative(tween, 'easeFunction', this.easing);
      const single = targets.length === 1 ? targets[0] : undefined;
      const axis =
        single?.key === 'x' || single?.key === 'scaleX'
          ? 'x'
          : single?.key === 'y' || single?.key === 'scaleY'
            ? 'y'
            : 'all';
      setNative(tween, 'axis', axis);
      setNative(tween, 'onAnimationState', (event: unknown) => {
        if (
          !Array.isArray(event) ||
          event[0] !== 'stopped' ||
          !this.tweens.has(tween)
        )
          return;
        for (const { key } of targets) {
          const index = key === 'y' || key === 'scaleY' ? 1 : 0;
          const reported: unknown = Array.isArray(event[1])
            ? event[1][index]
            : event[1];
          if (typeof reported !== 'number' || !Number.isFinite(reported))
            throw new Error('Invalid Roku Tween completion value.');
          const current =
            key === 'x'
              ? reported + this.node.mountX * this.node.w
              : key === 'y'
                ? reported + this.node.mountY * this.node.h
                : reported;
          this.node.props[key] = current;
          if (key === 'scale')
            this.node.props.scaleX = this.node.props.scaleY = current;
        }
        this.release(tween);
        if (this.tweens.size === 0) {
          this.finish();
          this.node.sync();
        }
      });
      if (field === 'opacity') {
        setNative(tween, 'targetValue', targets[0]!.value);
        continue;
      }
      const vector: [number, number] =
        field === 'translation'
          ? [
              this.node.x - this.node.mountX * this.node.w,
              this.node.y - this.node.mountY * this.node.h,
            ]
          : [this.node.scaleX, this.node.scaleY];
      for (const { key, value } of targets) {
        if (key === 'scale') vector[0] = vector[1] = value;
        else if (key === 'x')
          vector[0] = value - this.node.mountX * this.node.w;
        else if (key === 'y')
          vector[1] = value - this.node.mountY * this.node.h;
        else if (key === 'scaleX') vector[0] = value;
        else if (key === 'scaleY') vector[1] = value;
      }
      if (axis === 'all') setNative(tween, 'targetVector', vector);
      else {
        setNative(tween, 'preserveOther', vector[axis === 'x' ? 1 : 0]);
        setNative(tween, 'targetValue', vector[axis === 'x' ? 0 : 1]);
      }
    }
    if (this.tracks.size === 0) this.finish();
    return this;
  }

  private release(tween: DomNode) {
    setNative(tween, 'targetNode', null);
    removeNative(this.node.native, tween);
    this.tweens.delete(tween);
  }

  private finish() {
    this.state = 'stopped';
    this.node.animations.delete(this);
    this.resolveStopped?.();
    this.resolveStopped = undefined;
  }

  stop(): this {
    for (const tween of this.tweens) {
      setNative(tween, 'control', 'stop');
      this.release(tween);
    }
    this.finish();
    return this;
  }

  pause(): this {
    if (this.state === 'running') {
      for (const tween of this.tweens) setNative(tween, 'control', 'pause');
      this.state = 'paused';
    }
    return this;
  }

  restore(): this {
    this.stop();
    for (const targets of this.tracks.values())
      for (const { key, initial } of targets) this.node[key] = initial;
    return this;
  }

  waitUntilStopped(): Promise<void> {
    if (this.state === 'stopped') return Promise.resolve();
    return (this.stopped ??= new Promise((resolve) => {
      this.resolveStopped = resolve;
    }));
  }
}
