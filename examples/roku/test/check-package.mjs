import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { checkPackageInputs } from './package-inputs.mjs';

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
checkPackageInputs(metafile);
console.log(
  'Roku package check passed: native manifest, program, packaged poster, one Solid client runtime, unique SDK modules, no browser renderer code.',
);
