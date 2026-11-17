import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('local preview renders Jekyll layout, fonts and config without exposing private files', async t => {
  const server = spawn(process.execPath, ['scripts/dev.mjs'], { env: { ...process.env, PORT: '4108', RESEND_API_KEY: '', VERCEL_ENV: '' }, stdio: ['ignore','pipe','pipe'] });
  t.after(() => server.kill());
  await once(server.stdout, 'data');
  const origin = 'http://127.0.0.1:4108';
  const html = await (await fetch(origin)).text();
  const secure = await fetch(origin);
  assert.match(secure.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(secure.headers.get('x-frame-options'), 'DENY');
  assert.match(html, /<!doctype html>/); assert.match(html, /id="message-form"/); assert.doesNotMatch(html, /\{\{ content \}\}|layout: default/);
  const config = await (await fetch(`${origin}/api/config`)).json(); assert.equal(config.demo, true);
  const mission = await (await fetch(`${origin}/mission.json`)).json(); assert.ok(Date.parse(mission.arrivalAt) > Date.parse(mission.launchAt));
  for (const path of ['/assets/css/tokens.css', '/assets/fonts/IBMPlexMono-Regular.ttf', '/assets/fonts/IBMPlexMono-Medium.ttf']) assert.equal((await fetch(origin + path)).status, 200);
  for (const path of ['/.env','/lib/server.js','/supabase/schema.sql','/assets/..%5c..%5c.env','/api/toString','/api/__proto__']) assert.equal((await fetch(origin + path)).status, 404);
  assert.equal((await fetch(`${origin}/api/messages`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: '{}' })).status, 503);
});
