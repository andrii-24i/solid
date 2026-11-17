import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const output = new URL('../dist-build/', import.meta.url);
const manifest = await readFile(new URL('pkg-dir/manifest', output), 'utf8');
assert.match(manifest, /^rsg_version=2\.0$/m);
const entry = manifest.match(/^ts_path=pkg:\/(.+)$/m)?.[1];
assert(entry, 'SDK manifest names the native program');
await access(new URL(`pkg-dir/${entry}`, output));
await access(new URL('pkg-dir/images/poster.png', output));
const metafile = JSON.parse(
  await readFile(new URL('bundle/metafile.json', output), 'utf8'),
);
const clientRuntimes = Object.keys(metafile.inputs).filter((path) =>
  /solid-js\/dist\/solid\.js$/.test(path),
);
assert.equal(
  clientRuntimes.length,
  1,
  'application and SDK share one Solid client runtime',
);
for (const output of Object.values(metafile.outputs)) {
  for (const [path, contribution] of Object.entries(output.inputs)) {
    if (/domRenderer\.ts$|lightningInit\.ts$|\/WebGl[^/]*\.js$/.test(path)) {
      assert.equal(
        contribution.bytesInOutput,
        0,
        `native bundle excludes browser renderer code from ${path}`,
      );
    }
  }
}
console.log(
  'Roku package check passed: native manifest, program, packaged poster, one Solid client runtime, no browser renderer code.',
);
