import assert from 'node:assert/strict';

export function checkPackageInputs(metafile) {
  const emitted = [];
  for (const output of Object.values(metafile.outputs)) {
    for (const [path, { bytesInOutput }] of Object.entries(output.inputs)) {
      if (bytesInOutput > 0) emitted.push(path.replaceAll('\\', '/'));
    }
  }
  const clientRuntimes = emitted.filter((path) =>
    /\/solid-js\/dist\/solid\.js$/.test(path),
  );
  assert.equal(
    clientRuntimes.length,
    1,
    'application and SDK share one Solid client runtime',
  );
  const sdkModules = new Map();
  for (const path of emitted) {
    const canonical = path.match(
      /(?:^|\/)node_modules\/(@roku-sdk\/[^/]+\/.+)$/,
    )?.[1];
    if (canonical) {
      const previous = sdkModules.get(canonical);
      assert(
        !previous,
        `duplicate SDK module ${canonical}: ${previous} and ${path}`,
      );
      sdkModules.set(canonical, path);
    }
    assert(
      !/(?:^|\/)src\/core\/(?:dom-renderer\/|lightningInit\.ts$)/.test(path) &&
        !/\/@solidtv\/renderer\/(?:dist\/)?(?:src\/(?:core\/gl\/|core\/RendererCore\.|Renderer\.|platform\/WebPlatform\.)|exports\/webgl-shaders\.)/.test(
          path,
        ),
      `native bundle excludes browser renderer code from ${path}`,
    );
  }
  assert(
    sdkModules.has('@roku-sdk/common/src/string-interner.ts'),
    'SDK string interner is emitted',
  );
  assert(
    sdkModules.has('@roku-sdk/common/src/transaction.ts'),
    'SDK transaction manager is emitted',
  );
  assert(
    sdkModules.has('@roku-sdk/solid/src/solid.ts'),
    'SDK renderer is emitted',
  );
  return { clientRuntimes, sdkModules: Object.fromEntries(sdkModules) };
}
