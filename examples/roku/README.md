# Run the SolidTV Roku proof

This example keeps SolidTV `<view>` and `<text>` JSX, `Row`, flex layout, focus states, `For`, and `Show`. The Roku entry translates the existing logical tree to SDK SceneGraph transactions.

Use Node 24 or later and pnpm 10.33.4. From the repository root, run these commands.

```sh
pnpm install --frozen-lockfile
pnpm --dir examples/roku install --frozen-lockfile
pnpm test:roku
pnpm --dir examples/roku build
```

The test runs the actual screen through `@roku-sdk/testing-library` in Node, without `window` or `document`. It checks native text, poster URIs, flex coordinates, remote press and release, Row scrolling beyond the viewport, clipping, keyed native identity and order, repeated Show removal and insertion, and disposal. Repeated full mounts check input isolation and single delivery of each release. Separate checks exercise native Tween instructions, observed completion, cancellation, pause cleanup, and shared vector fields.

The build uses SDK tooling 2.19.1 and writes `dist-build/pkg-dir`. To produce the SDK's unsigned local test archive, install `squashfs-tools`, then run this command.

```sh
pnpm --dir examples/roku archive
```

The archive is `examples/roku/dist-build/package/package.bin`. To compile the program to Hermes bytecode as well, run `pnpm --dir examples/roku exec rk build --archive --compile-ts`.

On retail devices, sideloading Hermes bytecode requires an authorization token with the `rsg_typescript` claim. The default JavaScript build needs no token. See the [SDK prerequisites](https://developer.roku.com/dev/docs/rsg-sdk-standing-docs-getting-started-first-app).

On a compatible Roku, Left and Right move focus and scroll the row. OK reverses the numbered posters and updates the counter. Play hides and shows the details text. Right release updates the release counter. No device is required for the tests or build, and these commands do not sideload.

## Integration boundaries

`src/screen.tsx` and SolidTV source use the SolidTV universal JSX compiler. `src/native.tsx` and SDK components use the SDK compiler. `solidtv-plugin.mjs` runs before the SDK compiler, lowers SolidTV classes for Hermes, and resolves both renderers to one Solid 1.9.17 client runtime. It does not replace `solid-js` with `@roku-sdk/solid`.

The native shell supplies an initialized SDK host and connects SDK `KeyHandler` events to `createRokuKeyTarget`. `mountRoku` installs the backend and returns its disposer. Only one SolidTV root can be active. The backend owns native group and content handles, while `ElementNode` remains the logical tree for layout, states, and focus. SDK writes start a real transaction. The tests wait for SDK commits.

The example's type configuration selects the SDK's KeyHandler source for its component import. This avoids typechecking unrelated SDK component implementations against SolidTV's JSX declarations. The production bundle still imports the actual SDK component and its XML asset.

## Supported subset

The proof supports solid backgrounds, packaged poster URIs, explicitly sized system-font labels, position, size, alpha, scale, pivot, mount, rotation, rectangular clipping, and child order. `data={{ testId: 'name' }}` assigns the native group's `id` for queries.

Tween animations support `x`, `y`, `alpha`, `scale`, `scaleX`, and `scaleY`. Duration uses SolidTV milliseconds. Easing supports `linear`, `ease-in`, `ease-out`, and `ease-in-out`. The example overrides Row's default cubic-bezier transitions with a supported easing. Combined vector axes use one native Tween. Native completion comes from `onAnimationState`; no timer simulates completion. The SDK's compatibility package supplies its Tween fallback when firmware lacks the native Tween feature.

Use the animation controller's `waitUntilStopped()` for native completion. The existing `onAnimation.stopped` callback uses a timer and is outside this proof.

Custom fonts, automatic text or image measurement, shaders, textures, gradients, z-index ordering, text wrapping, and animation delay or repetition are outside this proof. Text requires explicit `w` and `h`. Font, shader, and texture inputs fail explicitly. Other advanced renderer properties are not implemented. A poster's packaged URI is verified; image decoding and image-load events are not.

## What the checks prove

The native mock verifies SDK transaction contents and lifecycle behavior. Tween completion events are simulated at the SDK field-event boundary. The mock does not render animation frames. Package and bytecode builds verify SDK packaging and compilation.

There is no hardware result. Screen appearance, font metrics, image decoding, remote timing, animation smoothness, and execution on the device's Hermes runtime remain unverified.

SDK testing-library 2.19.1 omits native move behavior in `appendNode` and `insertNodeBefore`. Its mock duplicates children when the real SDK reorders existing refs. The pinned patch in `patches/testing-library-moves.patch` corrects those two mock methods. `test/sdk-moves.ts` checks append, insert-before, and remove-and-reinsert directly through SDK transactions. The production SDK is unmodified.
