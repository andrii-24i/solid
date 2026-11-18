import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { solidtvPlugin } from '../solidtv-plugin.mjs';

const output = new URL('../.test/proof.mjs', import.meta.url);
await mkdir(new URL('../.test', import.meta.url), { recursive: true });
await build({
  entryPoints: [new URL('./proof.ts', import.meta.url).pathname],
  outfile: output.pathname,
  bundle: true,
  platform: 'node',
  format: 'esm',
  conditions: ['browser'],
  define: {
    __DEV__: 'false',
    __SIGNAL__: 'false',
    __BASE_LOG_LEVEL__: '"ERROR"',
    __CURRENT_LOG_LEVEL__: '"ERROR"',
  },
  plugins: [solidtvPlugin({ native: true })],
  loader: { '.xml': 'text', '.brs': 'text' },
});
const noop = () => {};
const perfetto = {
  beginEvent: noop,
  endEvent: noop,
  instantEvent: noop,
  flowEvent: noop,
  terminateFlow: noop,
};
globalThis.perfetto = perfetto;
globalThis.roku = {
  getRuntimeSingletonSync: () => ({
    getLoggerRef: () => 'test',
    logDevConsole: noop,
    logServer: noop,
    logConsole: noop,
    logScribe: noop,
    setCurrentLogLevelUpdateHandler: noop,
    setLogSourceFilterUpdateHandler: noop,
  }),
  getRuntimeSingleton: async () => ({}),
  Setup: { initApiObject: noop },
  LogLevel: { TRACE: 0, DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4, FATAL: 5 },
  perfetto,
};
await import(output.href);
