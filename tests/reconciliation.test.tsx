import { createSignal, For } from 'solid-js';
import { expect, test } from 'vitest';
import { ElementNode, insertNode, isElementNode } from '@solidtv/solid';
import { renderer } from './setup.js';

test.each([6, 7, 8])(
  'keyed reversal preserves all %i children and their identities',
  async (length) => {
    const initial = Array.from({ length }, (_, index) => `item-${index}`);
    const [items, setItems] = createSignal(initial);
    let parent!: ElementNode;
    const destroyed: string[] = [];
    const dispose = renderer.render(() => (
      <view ref={parent} w={1000} h={20}>
        <For each={items()}>
          {(id) => (
            <view
              id={id}
              w={10}
              h={10}
              onDestroy={(node) => destroyed.push(node.id!)}
            />
          )}
        </For>
      </view>
    ));
    try {
      await Promise.resolve();
      const original = new Map(
        parent.children.filter(isElementNode).map((node) => [node.id, node]),
      );
      for (const order of [[...initial].reverse(), initial]) {
        setItems(order);
        await Promise.resolve();
        const children = parent.children.filter(isElementNode);
        expect(children.map((node) => node.id)).toEqual(order);
        for (const node of children) expect(node).toBe(original.get(node.id));
        expect(destroyed).toEqual([]);
      }
    } finally {
      dispose();
    }
  },
);

test('inserting a rendered child before itself preserves scene order', async () => {
  let parent!: ElementNode;
  const dispose = renderer.render(() => (
    <view ref={parent} w={100} h={20}>
      <view id="first" w={10} h={10} />
      <view id="middle" w={10} h={10} />
      <view id="last" w={10} h={10} />
    </view>
  ));
  try {
    await Promise.resolve();
    const before = parent.children.slice();
    const middle = parent.getChildById('middle');
    expect(middle).toBeDefined();
    insertNode(parent, middle!, middle!);
    await Promise.resolve();
    expect(
      parent.children.filter(isElementNode).map((node) => node.id),
    ).toEqual(['first', 'middle', 'last']);
    parent.children.forEach((node, index) => expect(node).toBe(before[index]));
  } finally {
    dispose();
  }
});
