export const WEEK_MS = 604800000;
export function environment() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, MAIL_FROM, APP_URL, CLASS_EMAILS } = process.env;
  const configured = !!(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY && RESEND_API_KEY && MAIL_FROM && APP_URL && CLASS_EMAILS);
  return { configured, url: SUPABASE_URL, anon: SUPABASE_ANON_KEY, secret: SUPABASE_SERVICE_ROLE_KEY, resend: RESEND_API_KEY, from: MAIL_FROM, origin: APP_URL ? new URL(APP_URL).origin : null, emails: (CLASS_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean) };
}
export function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
export function reply(res, status, data) { res.setHeader('Cache-Control', 'no-store'); return res.status(status).json(data); }
export function guard(req, methods) {
  if (!methods.includes(req.method)) fail('Method not allowed.', 405);
  const env = environment();
  if (!env.configured) fail('Live relay is not configured. This server is in demo mode.', 503);
  if (req.method !== 'GET') {
    if (req.headers.origin !== env.origin) fail('Request origin is not authorized.', 403);
    if (!req.headers['content-type']?.startsWith('application/json')) fail('JSON required.', 415);
    if (Buffer.byteLength(JSON.stringify(req.body ?? {})) > 50000) fail('Packet too large.', 413);
  }
  return env;
}
export function allowedEmail(email, env = environment()) {
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter a valid email address.');
  const clean = email.toLowerCase().trim();
  if (!env.emails.includes(clean)) fail('This relay is limited to the class email addresses configured by its owner.', 403);
  return clean;
}
export async function supabase(path, { method = 'GET', body, token, admin = false, upsert = false } = {}) {
  const env = environment();
  const response = await fetch(`${env.url}${path}`, { method, headers: { apikey: admin ? env.secret : env.anon, Authorization: `Bearer ${token || (admin ? env.secret : env.anon)}`, 'Content-Type': 'application/json', ...(admin ? { Prefer: `return=representation${upsert ? ',resolution=merge-duplicates' : ''}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 429) fail('Relay busy. Please wait before trying again.', 429);
    if (response.status === 401 || response.status === 403) fail('Your session expired or the code is invalid. Connect again.', 401);
    if (data.message?.includes('Daily limit')) fail('Daily transmission limit reached (10 messages). Try again tomorrow.', 429);
    fail('Identity or storage request failed. Check your code or contact the mission operator.', 502);
  }
  return data;
}
function cookies(req) {
  const jar = Object.create(null);
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const name = part.slice(0, i).trim();
    if (!['delay_access', 'delay_refresh'].includes(name)) continue;
    try { jar[name] = decodeURIComponent(part.slice(i + 1)); } catch { /* Invalid cookies are not sessions. */ }
  }
  return jar;
}
export async function revokeSession(req) {
  const jar = cookies(req);
  let token = jar.delay_access;
  if (jar.delay_refresh) {
    const refreshed = await supabase('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: jar.delay_refresh } });
    token = refreshed.access_token;
  }
  if (token) await supabase('/auth/v1/logout?scope=local', { method: 'POST', token, body: {} });
}
export function sessionCookies(res, data) {
  const secure = environment().origin?.startsWith('https:') ? '; Secure' : '';
  const attrs = `; HttpOnly; SameSite=Strict; Path=/${secure}`;
  res.setHeader('Set-Cookie', data ? [
    `delay_access=${encodeURIComponent(data.access_token)}; Max-Age=${data.expires_in || 3600}${attrs}`,
    `delay_refresh=${encodeURIComponent(data.refresh_token)}; Max-Age=2592000${attrs}`
  ] : [`delay_access=; Max-Age=0${attrs}`, `delay_refresh=; Max-Age=0${attrs}`]);
}
export async function userSession(req, res) {
  const jar = cookies(req);
  let user;
  if (jar.delay_access) {
    try { user = await supabase('/auth/v1/user', { token: jar.delay_access }); }
    catch (error) { if (error.status !== 401) throw error; }
  }
  if (!user && jar.delay_refresh) {
    const data = await supabase('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: jar.delay_refresh } });
    sessionCookies(res, data); user = data.user;
  }
  if (!user?.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id) || !user.email_confirmed_at) fail('Connect and verify your email before transmitting.', 401);
  allowedEmail(user.email);
  return user;
}
export function validateMessage(input, user, env, now = Date.now()) {
  if (!input || typeof input !== 'object') fail('Missing packet.');
  if (typeof input.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.id)) fail('Invalid packet ID.');
  const recipient = allowedEmail(input.recipient, env);
  if (recipient === user.email.toLowerCase()) fail('Send to the other participant.');
  if (!['earth', 'mars'].includes(input.station)) fail('Choose Earth or Mars.');
  if (typeof input.subject !== 'string' || !input.subject.trim() || input.subject.length > 120 || /[\r\n]/.test(input.subject)) fail('Subject must be 1–120 characters on one line.');
  if (typeof input.body !== 'string' || !input.body.trim() || input.body.length > 10000) fail('Message must be 1–10,000 characters.');
  return { id: input.id, sender_id: user.id, sender: user.email.toLowerCase(), recipient, subject: input.subject.trim(), body: input.body.trim(), station: input.station, delivery_at: new Date(now + WEEK_MS).toISOString() };
}
export function handle(handler) {
  return async (req, res) => {
    try { await handler(req, res); }
    catch (error) { reply(res, error.status || 500, { error: error.status ? error.message : 'Relay unavailable. Your draft has been preserved; try again shortly.' }); }
  };
}
