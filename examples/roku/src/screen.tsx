/** @jsxImportSource @solidtv/solid */
import { createSignal, For, Show } from 'solid-js';
import { Row } from '@solidtv/solid/primitives';

const posters = [1, 2, 3, 4, 5, 6];

export function ProofScreen() {
  const [items, setItems] = createSignal(posters);
  const [updates, setUpdates] = createSignal(0);
  const [releases, setReleases] = createSignal(0);
  const [details, setDetails] = createSignal(true);
  return (
    <view
      w={1920}
      h={1080}
      color={0x121a2bff}
      onEnter={() => {
        setUpdates((value) => value + 1);
        setItems((value) => [...value].reverse());
        return true;
      }}
      onRightRelease={() => {
        setReleases((value) => value + 1);
        return true;
      }}
      onPlay={() => {
        setDetails((value) => !value);
        return true;
      }}
    >
      <text
        data={{ testId: 'status' }}
        x={80}
        y={60}
        w={1400}
        h={80}
        color={0xffffffff}
      >
        {`Updates ${updates()} · Releases ${releases()}`}
      </text>
      <view x={80} y={200} w={1100} h={450} clipping>
        <Row
          data={{ testId: 'posters' }}
          autofocus
          h={360}
          scroll="always"
          gap={30}
          transitionLeft={{ x: { duration: 180, easing: 'ease-out' } }}
          transitionRight={{ x: { duration: 180, easing: 'ease-out' } }}
        >
          <For each={items()}>
            {(item) => (
              <view
                data={{ testId: `poster-${item}` }}
                w={240}
                h={360}
                src="pkg:/images/poster.png"
                style={{ scale: 1 }}
                pivot={0.5}
                transition={{ scale: { duration: 250, easing: 'ease-in-out' } }}
                $focus={{ scale: 1.08 }}
              >
                <text
                  x={12}
                  y={290}
                  w={216}
                  h={60}
                  color={0xffffffff}
                >{`Poster ${item}`}</text>
              </view>
            )}
          </For>
        </Row>
      </view>
      <Show when={details()}>
        <text
          data={{ testId: 'details' }}
          x={80}
          y={740}
          w={1600}
          h={80}
          color={0xffffffff}
        >
          SolidTV JSX on Roku
        </text>
      </Show>
      <text x={80} y={870} w={1700} h={80} color={0xbac8ddff}>
        Left/Right navigate · OK reverses posters · Play toggles details
      </text>
    </view>
  );
}
