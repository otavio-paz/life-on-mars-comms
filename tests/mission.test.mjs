import test from 'node:test';
import assert from 'node:assert/strict';
import { missionState, marsTime, deliveryAt, WEEK_MS, SOL_MS } from '../assets/js/mission.js';

const config = { launchAt: '2026-10-01T12:00:00Z', arrivalAt: '2027-04-01T12:00:00Z' };
test('class dates require settlement, including stale travel overrides and December 31 evening', async () => {
  const { readFile } = await import('node:fs/promises');
  const shared = JSON.parse(await readFile('_data/mission.json', 'utf8'));
  for (const date of ['2026-11-16T00:00:00-05:00','2026-12-31T23:59:59-05:00']) {
    assert.equal(missionState({ ...shared, arrivalAt: config.arrivalAt }, Date.parse(date), 'travel').settled, true);
  }
  assert.equal(missionState(shared, Date.parse('2026-11-15T23:59:59-05:00')).settled, false);
});
test('flight position clamps and switches phase at arrival', () => {
  assert.equal(missionState(config, Date.parse(config.launchAt) - 1000).progress, 0);
  assert.equal(missionState(config, Date.parse(config.launchAt) - 1000).beforeLaunch, true);
  assert.equal(missionState(config, Date.parse(config.arrivalAt) - 1).settled, false);
  const landed = missionState(config, Date.parse(config.arrivalAt));
  assert.equal(landed.settled, true); assert.equal(landed.progress, 1); assert.equal(landed.sol, 1);
  assert.equal(missionState(config, Date.parse(config.arrivalAt) + SOL_MS + 1).sol, 2);
});
test('local phase preview overrides appearance without changing delivery delay', () => {
  assert.equal(missionState(config, Date.parse(config.launchAt), 'settlement').settled, true);
  assert.equal(missionState(config, Date.parse(config.arrivalAt) + 1000, 'travel').settled, false);
  const now = Date.parse('2026-10-30T12:00:00Z');
  assert.equal(Date.parse(deliveryAt(now)) - now, WEEK_MS);
  assert.equal(deliveryAt(now), '2026-11-06T12:00:00.000Z');
});
test('Mars clock matches NASA Mars24 worked example within one second', () => {
  const mars = marsTime(Date.parse('2000-01-06T00:00:00Z'), 0, 64.184);
  assert.equal(mars.clock, '23:59:39');
  assert.ok(Math.abs(mars.msd - 44795.99976) < 0.00002);
  assert.equal(marsTime(Date.parse('2000-01-06T00:00:00Z'), 15, 64.184).clock, '00:59:39');
});
