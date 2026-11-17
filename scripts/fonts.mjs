import { mkdir, writeFile } from 'node:fs/promises';
const dir = new URL('../assets/fonts/', import.meta.url);
await mkdir(dir, { recursive: true });
// Pin to the upstream Google Fonts catalog; keep OFL licenses beside the assets.
const files = [
  ['https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexmono/IBMPlexMono-Regular.ttf', 'IBMPlexMono-Regular.ttf'],
  ['https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexmono/IBMPlexMono-Medium.ttf', 'IBMPlexMono-Medium.ttf'],
  ['https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexmono/OFL.txt', 'IBMPlexMono-OFL.txt']
];
for (const [url, name] of files) {
  const response = await fetch(url); if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  await writeFile(new URL(name, dir), Buffer.from(await response.arrayBuffer())); console.log(`Saved ${name}`);
}
