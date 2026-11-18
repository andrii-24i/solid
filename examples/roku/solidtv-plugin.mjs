import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { transformAsync } from '@babel/core';
import solid from 'babel-preset-solid';
import typescript from '@babel/preset-typescript';
import classProperties from '@babel/plugin-transform-class-properties';
import classStaticBlock from '@babel/plugin-transform-class-static-block';
import classes from '@babel/plugin-transform-classes';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('./package.json', import.meta.url));

export function solidtvPlugin({ native = false } = {}) {
  return {
    name: 'solidtv-jsx',
    setup(build) {
      build.initialOptions.define = {
        ...build.initialOptions.define,
        SOLIDTV_DOM_RENDERING: 'false',
        SOLIDTV_DISABLE_SHADERS: 'true',
        'import.meta.env': '{}',
      };
      build.onResolve({ filter: /^solid-js(?:\/.*)?$/ }, (args) => {
        const suffix = args.path.slice('solid-js'.length);
        const base = require
          .resolve('solid-js/package.json')
          .replace(/package.json$/, '');
        return {
          path: `${base}${suffix ? `${suffix.slice(1)}/` : ''}dist/${suffix ? suffix.slice(1) : 'solid'}.js`,
        };
      });
      build.onResolve(
        { filter: /^@solidtv\/solid(?:\/(?:roku|primitives))?$/ },
        (args) => {
          const suffix = args.path.slice('@solidtv/solid'.length);
          return {
            path: `${root}src/${suffix === '/primitives' ? 'primitives/index.ts' : 'roku/index.ts'}`,
          };
        },
      );
      build.onResolve(
        { filter: /^@roku-sdk\/(solid|common|interfaces)(\/.*)?$/ },
        (args) => ({ path: require.resolve(args.path) }),
      );
      build.onLoad({ filter: /\.[jt]sx?$/ }, async (args) => {
        const isSolidTV =
          args.path.startsWith(`${root}src/`) ||
          args.path.endsWith('/src/screen.tsx');
        if (!isSolidTV && (!native || !args.path.endsWith('x'))) return;
        const result = await transformAsync(await readFile(args.path, 'utf8'), {
          filename: args.path,
          babelrc: false,
          configFile: false,
          presets: [
            [
              solid,
              {
                generate: 'universal',
                moduleName: isSolidTV
                  ? '@solidtv/solid/roku'
                  : '@roku-sdk/solid',
                builtIns: [],
              },
            ],
            [typescript, { allowDeclareFields: true }],
          ],
        });
        const lowered = await transformAsync(result.code, {
          filename: args.path,
          babelrc: false,
          configFile: false,
          plugins: [classStaticBlock, classProperties, classes],
        });
        return { contents: lowered.code, loader: 'js' };
      });
    },
  };
}
