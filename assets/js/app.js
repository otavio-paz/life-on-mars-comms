import { missionState, marsTime, deliveryAt } from './mission.js';

const $ = id => document.getElementById(id);
const storage = {
  get(key, fallback = null) { try { return JSON.parse(localStorage.getItem(`delay.${key}`)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`delay.${key}`, JSON.stringify(value)); } catch { /* Private browsing can disable persistence. */ } },
  remove(key) { try { localStorage.removeItem(`delay.${key}`); } catch {} }
};
const formatDate = iso => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).toUpperCase() + ' UTC';
let config, defaults, service = { demo: true }, identity = null, messages = [], phasePreview = 'auto', currentPhase;
let pendingId = null, pendingSignature = null;

async function api(path, body) {
  const response = await fetch(`/api/${path}`, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The relay could not complete this request.');
  return data;
}
function feedback(message, error = false) { $('terminal-feedback').textContent = message; $('terminal-feedback').classList.toggle('error', error); }
function renderIdentity() {
  $('identity-form').hidden = !!identity;
  $('otp-form').hidden = true;
  $('identity-connected').hidden = !identity;
  $('identity-name').textContent = identity ? `${identity.name} / ${identity.email}` : '';
  $('compose-prompt').textContent = `${identity?.name.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'guest'}@relay:~$`;
  $('terminal-title').textContent = `${identity?.name.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'guest'}@${currentPhase?.settled ? 'ares-outpost' : 'ares-i'}: ~/comms`;
}
function renderMission() {
  currentPhase = missionState(config, Date.now(), phasePreview);
  const s = currentPhase;
  document.documentElement.dataset.phase = s.settled ? 'settlement' : 'travel';
  $('mission-heading').textContent = (s.settled ? config.settlement : config.name).toUpperCase();
  $('phase-badge').textContent = s.settled ? 'SETTLEMENT' : 'IN TRANSIT';
  document.documentElement.style.setProperty('--flight-progress', `${s.progress * 100}%`);
  $('flight-percent').textContent = `${Math.round(s.progress * 100)}%`;
  $('flight-day').textContent = s.settled ? `SOL ${String(s.sol).padStart(3, '0')}` : s.beforeLaunch ? 'PRE-LAUNCH' : `DAY ${String(s.day).padStart(3, '0')}`;
  $('arrival-countdown').textContent = s.settled ? 'LANDED' : `T−${s.daysLeft} DAYS`;
  $('ship').textContent = s.settled ? '[+]' : '>=>';
  $('remote-station-label').textContent = s.settled ? 'MARS' : config.name.toUpperCase();
  updateRoute(); renderIdentity();
}
function updateRoute() {
  const station = document.querySelector('input[name="station"]:checked').value;
  $('route-label').textContent = station === 'mars' ? '→ EARTH' : currentPhase?.settled ? '→ MARS' : `→ ${config.name.toUpperCase()}`;
  if (identity) storage.set('station', station);
}
function updateClocks() {
  if (!config) return;
  const now = new Date();
  $('earth-clock').textContent = now.toISOString().slice(11, 19);
  $('earth-date').textContent = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).toUpperCase();
  const mars = marsTime(now.getTime(), config.marsLongitudeEast, config.ttMinusUtcSeconds);
  $('mars-clock').textContent = mars.clock;
  $('mars-sol').textContent = `MSD ${mars.msd.toFixed(3)}`;
  $('mars-clock-zone').textContent = config.marsLongitudeEast === 0 ? 'MTC' : 'LMST';
  $('estimated-arrival').textContent = formatDate(deliveryAt());
  const next = missionState(config, now.getTime(), phasePreview);
  if (next.settled !== currentPhase?.settled || next.day !== currentPhase?.day || next.daysLeft !== currentPhase?.daysLeft) renderMission();
}
function updatePayload() {
  $('char-count').textContent = $('message').value.length.toLocaleString('en-US');
  $('packet-size').textContent = `${new TextEncoder().encode($('message').value).length.toLocaleString('en-US')} B`;
}
function showTab(name) {
  document.querySelectorAll('[data-tab]').forEach(tab => { const active = tab.dataset.tab === name; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; $(`panel-${tab.dataset.tab}`).hidden = !active; });
  feedback('');
  $('demo-controls').hidden = name !== 'guide' || !service.demo;
  if (name === 'outbox') renderOutbox();
}
function node(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }
function renderOutbox() {
  $('outbox-count').textContent = messages.length;
  $('buffer-count').textContent = messages.filter(m => new Date(m.delivery_at) > new Date()).length;
  const list = $('outbox-list'); list.replaceChildren();
  if (!identity) { list.append(node('p', 'empty-outbox', 'Connect to view your outbox.')); return; }
  if (!messages.length) { list.append(node('p', 'empty-outbox', 'No transmissions.')); return; }
  for (const m of messages) {
    const item = node('article', 'outbox-item');
    const due = new Date(m.delivery_at) <= new Date();
    let status = m.status === 'scheduled' ? due ? 'DISPATCH TIME PASSED · CHECK EMAIL' : 'SCHEDULED FOR DISPATCH' : m.status === 'failed' ? 'SCHEDULING FAILED · RETRY TRANSMISSION' : 'SCHEDULING UNCONFIRMED · RETRY SAME TRANSMISSION';
    if (service.demo) status = due ? 'DEMO · SIMULATED ARRIVAL' : 'DEMO · IN TRANSIT';
    item.append(node('p', 'outbox-tag', status), node('h3', '', m.subject), node('p', '', `TO ${m.recipient} / ${m.station.toUpperCase()} → ${m.station === 'earth' ? 'MARS' : 'EARTH'}`), node('p', '', `DEPARTED ${formatDate(m.created_at)}`), node('p', '', `DISPATCH ${formatDate(m.delivery_at)}`));
    const details = node('details'); details.append(node('summary', '', 'READ TRANSMISSION'), node('pre', '', m.body)); item.append(details); list.append(item);
  }
}
async function loadMessages() {
  if (service.demo) messages = storage.get('messages', []).filter(m => m.sender === identity?.email);
  else messages = identity ? (await api('messages')).messages : [];
  renderOutbox();
}
function saveDraft() { storage.set('draft', { recipient: $('recipient').value, subject: $('subject').value, body: $('message').value }); pendingId = null; storage.remove('pending'); }

async function init() {
  try {
    defaults = await (await fetch('/mission.json')).json();
    const overrides = storage.get('mission', {});
    config = { ...defaults, ...overrides }; phasePreview = storage.get('phase', 'auto');
    if (!Number.isFinite(Date.parse(config.launchAt)) || Date.parse(config.arrivalAt) <= Date.parse(config.launchAt)) { config = { ...defaults }; phasePreview = 'auto'; }
    service = await api('config');
    if (service.demo) {
      identity = storage.get('identity');
      $('callsign').value = identity?.name || storage.get('callsign', '');
      $('sender-email').value = identity?.email || '';
    } else {
      $('mode-description').textContent = 'LIVE · email verification required';
      $('identity-submit').firstChild.textContent = 'GET CODE ';
      identity = (await api('auth')).identity;
      $('callsign').value = identity?.name || storage.get('callsign', '');
    }
    const draft = storage.get('draft', {});
    $('recipient').value = draft.recipient || storage.get('recipient', ''); $('subject').value = draft.subject || ''; $('message').value = draft.body || '';
    const pending = storage.get('pending');
    if (pending && identity && pending.sender === identity.email) { pendingId = pending.id; pendingSignature = pending.signature; }
    const station = storage.get('station', 'earth');
    document.querySelector(`input[name="station"][value="${station === 'mars' ? 'mars' : 'earth'}"]`).checked = true;
    renderMission(); updateClocks(); updatePayload(); await loadMessages();
    const log = $('boot-log').lastElementChild; log.classList.add('boot-typing');
  } catch (error) {
    feedback(`INIT ERROR: ${error.message}. Start the local server with npm run dev.`, true);
    $('transmit-button').disabled = true; $('identity-submit').disabled = true;
  }
}

const theme = storage.get('theme', 'dark');
function applyTheme(value) { document.documentElement.dataset.theme = value; $('theme-toggle').setAttribute('aria-label', `Switch to ${value === 'dark' ? 'light' : 'dark'} theme`); }
applyTheme(theme);
$('theme-toggle').addEventListener('click', () => { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; storage.set('theme', next); applyTheme(next); });
document.querySelectorAll('[data-tab]').forEach((tab, i, tabs) => {
  tab.addEventListener('click', () => showTab(tab.dataset.tab));
  tab.addEventListener('keydown', e => { let target; if (e.key === 'ArrowRight') target = (i + 1) % tabs.length; if (e.key === 'ArrowLeft') target = (i + tabs.length - 1) % tabs.length; if (e.key === 'Home') target = 0; if (e.key === 'End') target = tabs.length - 1; if (target !== undefined) { e.preventDefault(); showTab(tabs[target].dataset.tab); tabs[target].focus(); } });
});
$('identity-form').addEventListener('submit', async e => {
  e.preventDefault(); const button = $('identity-submit'); button.disabled = true;
  const name = $('callsign').value.trim(), email = $('sender-email').value.trim().toLowerCase();
  if (!name) { feedback('Enter a callsign to connect.', true); button.disabled = false; return; }
  try {
    storage.set('callsign', name);
    if (service.demo) { identity = { name, email }; storage.set('identity', identity); renderIdentity(); await loadMessages(); feedback(`[ AUTH ] Welcome aboard, ${name}. Local identity established.`); }
    else { await api('auth', { action: 'request', email }); $('identity-form').hidden = true; $('otp-form').hidden = false; $('otp').focus(); feedback('[ AUTH ] Code sent. Check your email to authorize this terminal.'); }
  } catch (error) { feedback(error.message, true); } finally { button.disabled = false; }
});
$('otp-form').addEventListener('submit', async e => {
  e.preventDefault(); const button = e.submitter; button.disabled = true;
  try { const result = await api('auth', { action: 'verify', email: $('sender-email').value.trim().toLowerCase(), token: $('otp').value.trim(), name: $('callsign').value.trim() }); identity = result.identity; renderIdentity(); await loadMessages(); $('otp').value = ''; feedback(`[ AUTH ] Identity verified. Welcome, ${identity.name}.`); }
  catch (error) { feedback(error.message, true); } finally { button.disabled = false; }
});
$('otp-back').addEventListener('click', () => { $('otp-form').hidden = true; $('identity-form').hidden = false; feedback(''); });
$('disconnect').addEventListener('click', async () => {
  try { if (!service.demo) await api('auth', { action: 'signout' }); identity = null; messages = []; pendingId = null; pendingSignature = null; storage.remove('identity'); storage.remove('draft'); storage.remove('pending'); $('message-form').reset(); updatePayload(); updateRoute(); renderIdentity(); renderOutbox(); feedback('[ AUTH ] Session closed. Callsign remembered for next time.'); }
  catch (error) { feedback(error.message, true); }
});
document.querySelectorAll('input[name="station"]').forEach(input => input.addEventListener('change', updateRoute));
$('message').addEventListener('input', () => { updatePayload(); saveDraft(); });
$('recipient').addEventListener('input', saveDraft); $('subject').addEventListener('input', saveDraft);
$('message-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!identity) { feedback('Establish your identity above before transmitting.', true); $('callsign').focus(); return; }
  const button = $('transmit-button'); button.disabled = true;
  const payload = { recipient: $('recipient').value.trim().toLowerCase(), subject: $('subject').value.trim(), body: $('message').value.trim(), station: document.querySelector('input[name="station"]:checked').value };
  if (!payload.body || !payload.subject) { feedback('Add a subject and message before transmitting.', true); button.disabled = false; return; }
  if (payload.recipient === identity.email) { feedback('Choose the other person’s email. This relay is for two worlds.', true); button.disabled = false; return; }
  const signature = JSON.stringify(payload);
  if (signature !== pendingSignature) { pendingId = crypto.randomUUID(); pendingSignature = signature; }
  if (!pendingId) pendingId = crypto.randomUUID();
  storage.set('pending', { id: pendingId, signature, sender: identity.email });
  try {
    $('relay-status').textContent = 'PACKET ENCODING'; feedback('[ TX ] Encoding UTF-8 payload… establishing store-and-forward relay.');
    let message;
    if (service.demo) {
      await new Promise(resolve => setTimeout(resolve, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 850));
      message = { ...payload, id: pendingId, sender: identity.email, created_at: new Date().toISOString(), delivery_at: deliveryAt(), status: 'scheduled' };
      const all = storage.get('messages', []); all.unshift(message); storage.set('messages', all);
    } else message = (await api('messages', { ...payload, id: pendingId })).message;
    storage.set('recipient', payload.recipient); storage.remove('draft'); storage.remove('pending'); $('subject').value = ''; $('message').value = ''; pendingId = null; pendingSignature = null; updatePayload();
    // Scheduling succeeded; a subsequent history fetch failure must not invite a duplicate transmission.
    messages.unshift(message); renderOutbox();
    feedback(service.demo ? `[ DEMO ] Queued for ${formatDate(message.delivery_at)}. Email disabled.` : `[ TX OK ] Scheduled for ${formatDate(message.delivery_at)}.`);
    $('relay-status').textContent = service.demo ? 'DEMO PACKET BUFFERED' : 'EMAIL SCHEDULE CONFIRMED';
  } catch (error) { feedback(`${error.message} Your draft is intact. Retrying unchanged uses the same packet ID.`, true); $('relay-status').textContent = 'TRANSMISSION UNCONFIRMED'; }
  finally { button.disabled = false; }
});
function localInput(iso) { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
$('mission-button').addEventListener('click', () => { if (!config) return; $('launch-date').value = localInput(config.launchAt); $('arrival-date').value = localInput(config.arrivalAt); $('preview-phase').value = phasePreview; $('mission-error').textContent = ''; $('mission-dialog').showModal(); });
$('close-mission').addEventListener('click', () => $('mission-dialog').close());
$('mission-form').addEventListener('submit', e => {
  e.preventDefault(); const launch = new Date($('launch-date').value), arrival = new Date($('arrival-date').value);
  if (arrival <= launch) { $('mission-error').textContent = 'Arrival must be after launch.'; return; }
  const override = { launchAt: launch.toISOString(), arrivalAt: arrival.toISOString() }; storage.set('mission', override); config = { ...defaults, ...override }; phasePreview = $('preview-phase').value; storage.set('phase', phasePreview); renderMission(); updateClocks(); $('mission-dialog').close();
});
$('reset-mission').addEventListener('click', () => { storage.remove('mission'); storage.remove('phase'); config = { ...defaults }; phasePreview = 'auto'; renderMission(); updateClocks(); $('mission-dialog').close(); });
$('reset-demo').addEventListener('click', () => {
  if (!service.demo) return;
  for (const key of ['identity', 'callsign', 'messages', 'draft', 'pending', 'recipient', 'station', 'mission', 'phase']) storage.remove(key);
  identity = null; messages = []; pendingId = null; pendingSignature = null; config = { ...defaults }; phasePreview = 'auto';
  $('identity-form').reset(); $('message-form').reset(); renderMission(); renderOutbox(); updateClocks(); updatePayload(); showTab('compose'); feedback('[ DEMO ] Local session reset. Ready for a new correspondent.');
});
setInterval(updateClocks, 1000);
init();
