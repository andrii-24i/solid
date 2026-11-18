import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { checkPackageInputs } from './package-inputs.mjs';

const rootRequire = createRequire(
  new URL('../../../package.json', import.meta.url),
);
const metafile = JSON.parse(
  await readFile(
    new URL('../dist-build/bundle/metafile.json', import.meta.url),
    'utf8',
  ),
);
const { sdkModules } = checkPackageInputs(metafile);
for (const [canonical, source] of Object.entries(sdkModules)) {
  const mutant = structuredClone(metafile);
  const output = Object.values(mutant.outputs).find(
    ({ inputs }) => inputs[source]?.bytesInOutput > 0,
  );
  output.inputs[`duplicate/node_modules/${canonical}`] = { bytesInOutput: 1 };
  assert.throws(() => checkPackageInputs(mutant), /duplicate SDK module/);
}
const duplicateBundle = structuredClone(metafile);
const sdkOutput = Object.values(duplicateBundle.outputs).find(({ inputs }) =>
  Object.keys(inputs).some((path) => path.includes('/@roku-sdk/')),
);
duplicateBundle.outputs['duplicate-bundle.js'] = structuredClone(sdkOutput);
assert.throws(
  () => checkPackageInputs(duplicateBundle),
  /share one Solid client runtime|duplicate SDK module/,
);
const browserModules = [
  new URL('../../../src/core/dom-renderer/domRenderer.ts', import.meta.url)
    .pathname,
  new URL('../../../src/core/lightningInit.ts', import.meta.url).pathname,
  rootRequire
    .resolve('@solidtv/renderer')
    .replace(/exports\/index\.js$/, 'src/core/gl/GlBackend.js'),
];
for (const path of browserModules) {
  const { metafile: browser } = await build({
    entryPoints: [path],
    write: false,
    metafile: true,
    format: 'esm',
    logLevel: 'silent',
  });
  const mutant = structuredClone(metafile);
  Object.assign(mutant.outputs, browser.outputs);
  assert.throws(
    () => checkPackageInputs(mutant),
    /native bundle excludes browser renderer code/,
  );
}
console.log(
  `Package gate regressions passed: ${Object.keys(sdkModules).length} duplicate SDK mutations, a repeated bundle, and ${browserModules.length} real browser modules rejected.`,
);
