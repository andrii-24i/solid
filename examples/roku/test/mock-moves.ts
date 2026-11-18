import assert from 'node:assert/strict';
import { render } from '@roku-sdk/testing-library';
import { transactionManager } from '@roku-sdk/common/transaction';
import { tmTransaction } from '@roku-sdk/solid';
import type { DomNode } from '@roku-sdk/interfaces';

export async function verifyMockMoves() {
  let parent: DomNode;
  let first: DomNode;
  let second: DomNode;
  const tree = await render(() => {
    transactionManager.startTransaction();
    parent = tmTransaction.createElement('group');
    first = tmTransaction.createElement('rectangle');
    second = tmTransaction.createElement('rectangle');
    tmTransaction.insertNode(parent, first);
    tmTransaction.insertNode(parent, second);
    return parent;
  });
  const children = tree.getByTag('group').children;
  const firstRef = children[0].r;
  const secondRef = children[1].r;
  transactionManager.startTransaction();
  tmTransaction.insertNode(parent!, first!);
  await tree.transaction();
  assert.equal(
    children.length,
    2,
    'the patched SDK mock append moves an existing child without duplicating it',
  );
  assert.equal(children[0].r, secondRef);
  assert.equal(children[1].r, firstRef);
  transactionManager.startTransaction();
  tmTransaction.insertNode(parent!, first!, second!);
  await tree.transaction();
  assert.equal(
    children.length,
    2,
    'the patched SDK mock insert-before moves an existing child without duplicating it',
  );
  assert.equal(children[0].r, firstRef);
  assert.equal(children[1].r, secondRef);
  transactionManager.startTransaction();
  tmTransaction.removeNode(parent!, first!);
  tmTransaction.insertNode(parent!, first!, second!);
  await tree.transaction();
  assert.equal(children.length, 2);
  assert.equal(
    children[0].r,
    firstRef,
    'remove and reinsert in one transaction preserves identity',
  );
  tree.dispose();
}
