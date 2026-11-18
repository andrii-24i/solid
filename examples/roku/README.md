# Run the SolidTV Roku proof

This example keeps SolidTV `<view>` and `<text>` JSX, `Row`, flex layout, focus states, `For`, and `Show`. The Roku entry translates the existing logical tree to SDK SceneGraph transactions.

Use Node 24 or later and pnpm 10.33.4. From the repository root, run these commands.

```sh
pnpm install --frozen-lockfile
pnpm --dir examples/roku install --frozen-lockfile
pnpm test:roku
pnpm --dir examples/roku build
```

The test runs the screen through `@roku-sdk/testing-library` in Node, without `window` or `document`. It checks text and poster commands, flex coordinates, remote press and release, Row scrolling beyond the viewport, clipping, keyed identity and order, repeated Show removal and insertion, and disposal. Separate checks cover independent animation axes, completion events, cancellation, pause, mount failures, public `render` and `Portal`, and background tasks after focus changes. These are mock checks, not firmware tests.

The build uses SDK tooling 2.19.1 and writes `dist-build/pkg-dir`. To produce the SDK's unsigned local test archive, install `squashfs-tools`, then run this command.

```sh
pnpm --dir examples/roku archive
```

The archive is `examples/roku/dist-build/package/package.bin`. To compile the program to Hermes bytecode as well, run these commands.

```sh
pnpm --dir examples/roku exec rk build --archive --compile-ts
pnpm --dir examples/roku check:package
```

On retail devices, sideloading Hermes bytecode requires an authorization token with the `rsg_typescript` claim. The default JavaScript build needs no token. See the [SDK prerequisites](https://developer.roku.com/dev/docs/rsg-sdk-standing-docs-getting-started-first-app).

On a compatible Roku, Left and Right move focus and scroll the row. OK reverses the numbered posters and updates the counter. Play hides and shows the details text. Right release updates the release counter. No device is required for the tests or build, and these commands do not sideload.

## Integration boundaries

`src/screen.tsx` and SolidTV source use the SolidTV universal JSX compiler. `src/native.tsx` and SDK components use the SDK compiler. `solidtv-plugin.mjs` runs first, lowers SolidTV classes for Hermes, and resolves all SDK packages and Solid from this example. The packaged app shares one initialized SDK runtime and one Solid 1.9.17 client runtime. The core test suite retains Solid 1.9.3. The plugin does not replace `solid-js` with `@roku-sdk/solid`.

The native shell supplies an initialized SDK host and connects scoped SDK `KeyHandler` events to `createRokuKeyTarget`. Back remains outside that handler so the native scene can handle exit. JavaScript callback return values cannot synchronously control the SDK's native key consumption.

`mountRoku` installs the backend, binds the public `rootNode`, and returns its disposer. Public `render` and `Portal` use that root. Only one SolidTV root can be active. The backend owns a group below the supplied host and restores its own renderer, focus, task, and font state on disposal, including when user cleanup throws. It preserves caller-owned key listeners and host styling. Solid may skip other user cleanup callbacks after a throwing callback; this adapter cannot guarantee their execution.

`ElementNode` remains the logical tree for layout, states, and focus. SDK writes start a real transaction. The tests wait for SDK commits. Native property updates write only the affected fields, including dependent geometry fields.

The example's type configuration selects the SDK's KeyHandler source for its component import. This avoids typechecking unrelated SDK component implementations against SolidTV's JSX declarations. The production bundle still imports the actual SDK component and its XML asset.

## Supported subset

The proof supports solid backgrounds, packaged poster URIs, explicitly sized system-font labels, position, size, alpha, scale, pivot, mount, rotation, rectangular clipping, and child order. `data={{ testId: 'name' }}` assigns the native group's `id` for queries.

Tween animations support `x`, `y`, `alpha`, `scale`, `scaleX`, and `scaleY`. Duration uses SolidTV milliseconds. Easing supports `linear`, `ease-in`, `ease-out`, and `ease-in-out`. The example overrides Row's default cubic-bezier transitions with a supported easing. Each transform axis has its own native group and Tween target. This adds internal groups but preserves independent timing, pause, and direct writes across axes. Uniform scale animates both scale axes. Unchanged writes leave running animations intact. Native completion comes from `onAnimationState`; the adapter does not simulate it with a timer. The SDK's compatibility package supplies its Tween fallback when firmware lacks the native Tween feature.

Use the animation controller's `waitUntilStopped()` for native completion. The existing `onAnimation.stopped` callback uses a timer and is outside this proof.

Custom fonts, automatic text or image measurement, shaders, textures, gradients, z-index ordering, text wrapping, and animation delay or repetition are outside this proof. Text requires explicit `w` and `h`. Font, shader, and texture inputs fail explicitly. Other advanced renderer properties are not implemented. A poster's packaged URI is verified; image decoding and image-load events are not.

## What the checks prove

The SDK mock checks transaction commands and lifecycle behavior. Tests inject completion events, including values other than the requested target, at the field-event boundary. The mock does not render animation frames.

`check:package` checks every emitted SDK module for duplicate copies and rejects browser renderer modules. Regression checks inject duplicates and bundle real browser modules to prove the gate rejects them. A separate check executes the manifest-selected packaged JavaScript through the real SDK bootstrap, mocking only hardware APIs. It verifies that SolidTV writes use the initialized string interner and transaction runtime. For a bytecode package, this check executes the compiler-input JavaScript and explicitly reports that bytecode was not executed.

The Node 24 CI job runs the Roku mock checks, the SDK production build, and all package checks. The existing core job remains on Node 22. Package and bytecode builds verify packaging and compilation, not device execution.

There is no hardware result. Screen appearance, font metrics, image decoding, remote timing, animation smoothness, and execution on the device's Hermes runtime remain unverified.

SDK testing-library 2.19.1 omits move behavior in `appendNode` and `insertNodeBefore`. Its mock duplicates children during reordering. The pinned patch in `patches/testing-library-moves.patch` changes those two mock methods. `test/mock-moves.ts` checks the patched mock's append, insert-before, and remove-and-reinsert bookkeeping through SDK transactions. This does not establish firmware move behavior. The production SDK is unmodified.
