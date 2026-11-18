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

export type AnimationChannel = 'x' | 'y' | 'alpha' | 'scaleX' | 'scaleY';
type AnimatedKey = AnimationChannel | 'scale';
export type NativeAnimationTarget =
  | { node: DomNode; field: 'opacity'; axis: 'all'; offset: 0 }
  | {
      node: DomNode;
      field: 'translation' | 'scale';
      axis: 'x' | 'y';
      preserveOther: number;
      offset: number;
    };
type Target = { value: number; initial: number };
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
  private readonly targets = new Map<AnimationChannel, Target>();
  private readonly channels: readonly AnimationChannel[];
  private readonly tweens = new Map<DomNode, (event: unknown) => void>();
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
    }
    const values = {
      x: props.x,
      y: props.y,
      alpha: props.alpha,
      scaleX: props.scaleX ?? props.scale,
      scaleY: props.scaleY ?? props.scale,
    };
    for (const channel of [
      'x',
      'y',
      'alpha',
      'scaleX',
      'scaleY',
    ] satisfies AnimationChannel[]) {
      const value = values[channel];
      if (typeof value === 'number')
        this.targets.set(channel, { value, initial: node[channel] });
    }
    this.channels = [...this.targets.keys()];
  }

  start(): this {
    if (this.state === 'running') return this;
    if (this.state === 'paused') {
      for (const tween of this.tweens.keys())
        setNative(tween, 'control', 'resume');
      this.state = 'running';
      return this;
    }
    if (this.state === 'stopped') this.stopped = undefined;
    if (!this.node.claimAnimation(this, this.channels)) {
      this.finish();
      return this;
    }
    this.state = 'running';
    for (const [channel, { value }] of this.targets) {
      const target = this.node.animationTarget(channel);
      const tween = createNative('tween');
      insertNative(this.node.native, tween);
      setNative(tween, 'targetNode', target.node);
      setNative(tween, 'field', target.field);
      setNative(tween, 'duration', (this.settings.duration ?? 250) / 1000);
      setNative(tween, 'easeFunction', this.easing);
      setNative(tween, 'axis', target.axis);
      if (target.field !== 'opacity')
        setNative(tween, 'preserveOther', target.preserveOther);
      const onAnimationState = (event: unknown) => {
        if (
          !this.tweens.has(tween) ||
          !Array.isArray(event) ||
          event[0] !== 'stopped'
        )
          return;
        const reported: unknown =
          target.field === 'opacity'
            ? event[1]
            : Array.isArray(event[1])
              ? event[1][target.axis === 'x' ? 0 : 1]
              : undefined;
        if (typeof reported !== 'number' || !Number.isFinite(reported))
          throw new Error('Invalid Roku Tween completion value.');
        this.node.observeAnimation(channel, reported + target.offset);
        this.release(tween);
        if (this.tweens.size === 0) this.finish();
      };
      this.tweens.set(tween, onAnimationState);
      setNative(tween, 'onAnimationState', onAnimationState);
      setNative(tween, 'targetValue', value - target.offset);
    }
    if (this.targets.size === 0) this.finish();
    return this;
  }

  private release(tween: DomNode) {
    const callback = this.tweens.get(tween);
    this.tweens.delete(tween);
    setNative(tween, 'onAnimationState', null, callback);
    setNative(tween, 'targetNode', null);
    removeNative(this.node.native, tween);
  }

  private finish() {
    this.state = 'stopped';
    this.node.releaseAnimation(this, this.channels);
    this.resolveStopped?.();
    this.resolveStopped = undefined;
  }

  stop(): this {
    for (const tween of this.tweens.keys()) {
      setNative(tween, 'control', 'stop');
      if (this.tweens.has(tween)) this.release(tween);
    }
    this.finish();
    return this;
  }

  pause(): this {
    if (this.state === 'running') {
      for (const tween of this.tweens.keys())
        setNative(tween, 'control', 'pause');
      this.state = 'paused';
    }
    return this;
  }

  restore(): this {
    this.stop();
    if (this.node.claimAnimation(this, this.channels)) {
      for (const [channel, { initial }] of this.targets)
        this.node.observeAnimation(channel, initial);
      this.finish();
    }
    return this;
  }

  waitUntilStopped(): Promise<void> {
    if (this.state === 'stopped') return Promise.resolve();
    return (this.stopped ??= new Promise((resolve) => {
      this.resolveStopped = resolve;
    }));
  }
}
