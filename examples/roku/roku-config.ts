import type { RokuConfig } from '@roku-sdk/rsg-ts/roku-config';
import { solidtvPlugin } from './solidtv-plugin.mjs';

export default {
  app: {
    entryPoint: 'src/index.ts',
    manifestEntries: {
      title: 'SolidTV Roku proof',
      major_version: 1,
      minor_version: 0,
      build_version: 0,
      ui_resolutions: 'fhd',
      rsg_version: '2.0',
    },
  },
  pipeline: {
    build: {
      plugins: [{ position: { before: 'solid' }, plugin: solidtvPlugin() }],
    },
    startDev: {
      plugins: [{ position: { before: 'solid' }, plugin: solidtvPlugin() }],
    },
  },
} satisfies RokuConfig;
