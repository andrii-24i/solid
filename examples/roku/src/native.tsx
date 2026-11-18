import { KeyHandler } from '@roku-sdk/components';
import { onCleanup } from 'solid-js';
import { createRokuKeyTarget, mountRoku } from '@solidtv/solid/roku';
import { ProofScreen } from './screen';

export function RokuProof() {
  const keys = createRokuKeyTarget();
  return (
    <KeyHandler
      keys={['left', 'right', 'up', 'down', 'OK', 'play']}
      bubbleUnhandledKeys
      gainFocus
      onKeyEvent={keys.dispatch}
    >
      <group
        ref={(host) =>
          onCleanup(
            mountRoku(ProofScreen, host, { width: 1920, height: 1080, keys }),
          )
        }
      />
    </KeyHandler>
  );
}
