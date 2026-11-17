import { transactionManager } from '@roku-sdk/common/transaction';
import type { DomNode, TmValue } from '@roku-sdk/interfaces';
import { tmTransaction } from '@roku-sdk/solid';

export function createNative(tag: string): DomNode {
  transactionManager.startTransaction();
  return tmTransaction.createElement(tag);
}

export function setNative(node: DomNode, name: string, value: TmValue | null) {
  transactionManager.startTransaction();
  // The SDK implements null node-reference clearing but omits null from TmValue.
  // @ts-expect-error SDK Tween uses the same null targetNode cleanup.
  tmTransaction.setProperty(node, name, value);
}

export function insertNative(parent: DomNode, node: DomNode, before?: DomNode) {
  transactionManager.startTransaction();
  const siblings = parent.c ?? [];
  const index = siblings.indexOf(node);
  if (
    node.parent === parent &&
    ((before && siblings[index + 1] === before) ||
      (!before && index === siblings.length - 1))
  )
    return;
  tmTransaction.insertNode(parent, node, before);
}

export function removeNative(parent: DomNode, node: DomNode) {
  transactionManager.startTransaction();
  tmTransaction.removeNode(parent, node);
}
