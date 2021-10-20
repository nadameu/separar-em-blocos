import type { BuildOptions } from 'esbuild';
import generateMetadataHeader from './generateMetadataHeader';
import meta from '../metadata';
import * as pkg from '../package.json';

const banner = generateMetadataHeader({
  name: pkg.name,
  version: pkg.version,
  author: pkg.author,
  ...meta,
});

export const filename = `${pkg.name}.user.js`;

export const settings: BuildOptions = {
  entryPoints: ['src/index.ts'],
  banner: { js: banner },
  external: ['preact', 'preact/hooks'],
  format: 'esm',
  target: 'firefox78',
  bundle: true,
  treeShaking: true,
  outfile: `./dist/${filename}`,
};
