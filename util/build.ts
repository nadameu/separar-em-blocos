import * as esbuild from 'esbuild';
import { settings } from './settings';

esbuild.build(settings).catch(e => {
  console.error(e);
});
