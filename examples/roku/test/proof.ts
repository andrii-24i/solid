import { verifySdkMoves } from './sdk-moves';
import { verifyAnimation } from './animation';
import assert from 'node:assert/strict';
import { render } from '@roku-sdk/testing-library';
import { RokuProof } from '../src/native';

assert.equal(typeof document, 'undefined');
assert.equal(typeof window, 'undefined');
await verifySdkMoves();
await verifyAnimation();
const proof = await render(RokuProof);
const byId = (id: string) => proof.getByProp('id', id);
const queryId = (id: string) => proof.queryByProp('id', id);
const settle = async (tree = proof) => {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
    await tree.transaction();
  }
};
await settle();
assert.equal(byId('status').children[0].props.text, 'Updates 0 · Releases 0');
const cards = () =>
  byId('posters').children.filter((node) =>
    String(node.props.id).startsWith('poster-'),
  );
const initial = cards();
assert.equal(initial.length, 6);
assert.deepEqual(
  initial.map((node) => node.props.translation),
  [
    [0, 0],
    [270, 0],
    [540, 0],
    [810, 0],
    [1080, 0],
    [1350, 0],
  ],
);
assert.equal(proof.queryAllByTag('poster').length, 6);
assert.equal(
  proof.queryAllByTag('poster')[0].props.uri,
  'pkg:/images/poster.png',
);
assert.equal(proof.getByProp('text', 'Poster 1').props.text, 'Poster 1');
const viewport = proof
  .queryAllByTag('group')
  .find((node) => node.children.includes(byId('posters')));
assert(viewport);
assert.deepEqual(viewport.props.clippingRect, [0, 0, 1100, 450]);
const keys = proof.queryAllByTag('key-handler')[0];
const key = async (key: string, press = true) => {
  await proof.fireEvent(keys, 'onKeyEvent', { key, press });
  await settle();
};
await key('right');
assert(
  proof
    .queryAllByTag('tween')
    .some(
      (node) =>
        node.props.field === 'translation' && node.props.targetValue === -270,
    ),
);
await key('right', false);
assert.equal(byId('status').children[0].props.text, 'Updates 0 · Releases 1');
const tweens = proof.queryAllByTag('tween');
assert(
  tweens.some(
    (node) =>
      node.props.field === 'scale' &&
      JSON.stringify(node.props.targetVector) === '[1.08,1.08]' &&
      node.props.duration === 0.25,
  ),
);
for (const tween of tweens)
  await proof.fireEvent(tween, 'onAnimationState', [
    'stopped',
    tween.props.targetVector ?? tween.props.targetValue,
  ]);
await settle();
assert.equal(proof.queryAllByTag('tween').length, 0);
assert.deepEqual(byId('posters').props.translation, [-270, 0]);
await key('OK');
assert.equal(byId('status').children[0].props.text, 'Updates 1 · Releases 1');
assert.deepEqual(
  cards().map((node) => node.props.id),
  ['poster-6', 'poster-5', 'poster-4', 'poster-3', 'poster-2', 'poster-1'],
);
cards().forEach((node, index) => assert.equal(node.r, initial[5 - index].r));
for (let i = 0; i < 3; i++) {
  await key('play');
  assert.equal(queryId('details'), null);
  await key('play');
  assert.equal(byId('details').children[0].props.text, 'SolidTV JSX on Roku');
}
await key('left');
assert(proof.queryAllByTag('tween').length > 0);
proof.dispose();
await settle();
assert.equal(proof.queryAllByTag('group').length, 1);
assert.equal(proof.queryAllByTag('group')[0].children.length, 0);
assert.equal(proof.queryAllByTag('tween').length, 0);
await key('right');
assert.equal(proof.queryAllByTag('group')[0].children.length, 0);
for (let attempt = 0; attempt < 3; attempt++) {
  const remounted = await render(RokuProof);
  await settle(remounted);
  const status = () =>
    remounted.getByProp('id', 'status').children[0].props.text;
  assert.equal(status(), 'Updates 0 · Releases 0');
  await key('right', false);
  await settle(remounted);
  assert.equal(
    status(),
    'Updates 0 · Releases 0',
    'a disposed key bridge cannot drive a remounted screen',
  );
  const receiver = remounted.getByTag('key-handler');
  for (let index = 0; index < 5; index++) {
    await remounted.fireEvent(receiver, 'onKeyEvent', {
      key: 'right',
      press: true,
    });
    await remounted.fireEvent(receiver, 'onKeyEvent', {
      key: 'right',
      press: false,
    });
    await settle(remounted);
  }
  assert.equal(
    status(),
    'Updates 0 · Releases 5',
    'each release reaches one listener after remount',
  );
  const row = remounted.getByProp('id', 'posters');
  const scroll = remounted
    .queryAllByTag('tween')
    .find((node) => node.props.field === 'translation');
  assert(scroll);
  assert.equal(scroll.props.targetValue, -1350);
  for (const tween of remounted.queryAllByTag('tween')) {
    await remounted.fireEvent(tween, 'onAnimationState', [
      'stopped',
      tween.props.targetVector ?? tween.props.targetValue,
    ]);
  }
  await settle(remounted);
  assert.deepEqual(row.props.translation, [-1350, 0]);
  remounted.dispose();
  await settle(remounted);
  assert.equal(remounted.queryAllByTag('tween').length, 0);
  assert.equal(remounted.getByTag('group').children.length, 0);
}
console.log(
  'Roku native proof passed: layout, posters, text, keys, release, scroll, native Tween, keyed identity/order, Show, disposal.',
);
