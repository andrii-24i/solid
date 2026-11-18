import assert from 'node:assert/strict';
import type { TestNode } from '@roku-sdk/testing-library';

type NativeNode = Pick<TestNode, keyof TestNode>;

export type Matrix = readonly [number, number, number, number, number, number];
const identity: Matrix = [1, 0, 0, 1, 0, 0];

export function multiply(left: Matrix, right: Matrix): Matrix {
  const [a, b, c, d, x, y] = left;
  const [e, f, g, h, u, v] = right;
  return [
    a * e + c * f,
    b * e + d * f,
    a * g + c * h,
    b * g + d * h,
    a * u + c * v + x,
    b * u + d * v + y,
  ];
}

function vector(
  value: unknown,
  fallback: readonly [number, number],
): readonly [number, number] {
  if (value === undefined) return fallback;
  assert(
    Array.isArray(value) &&
      value.length === 2 &&
      value.every((entry) => typeof entry === 'number'),
  );
  return [value[0], value[1]];
}

function nativeMatrix(node: NativeNode): Matrix {
  const [x, y] = vector(node.props.translation, [0, 0]);
  const [sx, sy] = vector(node.props.scale, [1, 1]);
  const [px, py] = vector(node.props.scaleRotateCenter, [0, 0]);
  const rotation = node.props.rotation ?? 0;
  assert.equal(typeof rotation, 'number');
  assert(typeof rotation === 'number');
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const a = cos * sx;
  const b = -sin * sx;
  const c = sin * sy;
  const d = cos * sy;
  return [a, b, c, d, x + px - a * px - c * py, y + py - b * px - d * py];
}

export function contentPath(node: NativeNode): TestNode[] {
  if (node.tag === 'rectangle' || node.tag === 'label' || node.tag === 'poster')
    return [node];
  for (const child of node.children) {
    if (child.tag === 'tween') continue;
    const path = contentPath(child);
    if (path.length) return [node, ...path];
  }
  return [];
}

export function visualContent(node: NativeNode): TestNode {
  const content = contentPath(node).at(-1);
  assert(content, 'the logical node has native visual content');
  return content;
}

export function childHost(node: NativeNode): TestNode {
  const host = contentPath(node).at(-2);
  assert(host, 'the logical node has a native content host');
  return host;
}

export function logicalChildren(node: NativeNode): TestNode[] {
  return childHost(node).children.filter((child) => child.tag === 'group');
}

export function localTransform(node: NativeNode): Matrix {
  return contentPath(node).reduce(
    (matrix, part) => multiply(matrix, nativeMatrix(part)),
    identity,
  );
}

export function localTranslation(node: NativeNode): readonly [number, number] {
  const matrix = localTransform(node);
  return [matrix[4], matrix[5]];
}

export function transformPoint(
  matrix: Matrix,
  point: readonly [number, number],
): readonly [number, number] {
  const [a, b, c, d, x, y] = matrix;
  return [a * point[0] + c * point[1] + x, b * point[0] + d * point[1] + y];
}

export function tweenCompletionValue(
  tween: NativeNode,
  value = tween.props.targetValue,
): number | [number, number] {
  assert(typeof value === 'number');
  if (tween.props.field === 'opacity') return value;
  const preserved = tween.props.preserveOther;
  assert(typeof preserved === 'number');
  return tween.props.axis === 'x' ? [value, preserved] : [preserved, value];
}
