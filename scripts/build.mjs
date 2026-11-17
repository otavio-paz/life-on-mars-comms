import { spawnSync } from 'node:child_process';
const result = spawnSync(process.platform === 'win32' ? 'bundle.bat' : 'bundle', ['exec', 'jekyll', 'build'], { stdio: 'inherit', shell: process.platform === 'win32' });
if (result.error) console.error(result.error.message);
if (result.status !== 0) console.error('Jekyll build requires a working Ruby installation and bundle install. npm run dev offers a dependency-free local layout preview.');
process.exit(result.status || (result.error ? 1 : 0));
