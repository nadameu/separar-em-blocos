import * as esbuild from 'esbuild';
import { filename, settings } from './settings';

async function main() {
  const server = await esbuild.serve({ host: 'localhost' }, settings);
  const url = `http://${server.host}:${server.port}/${filename}`;
  console.log(`Script available at ${url}`);
}

main().catch(e => {
  console.error(e);
});
