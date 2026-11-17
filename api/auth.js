import { handle, guard, reply, allowedEmail, supabase, userSession, sessionCookies, revokeSession, fail } from '../lib/server.js';

export default handle(async (req, res) => {
  guard(req, ['GET', 'POST']);
  if (req.method === 'GET') {
    let user;
    try { user = await userSession(req, res); } catch (error) { if (error.status === 401) return reply(res, 200, { identity: null }); throw error; }
    const profiles = await supabase(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=name`, { admin: true });
    return reply(res, 200, { identity: { name: profiles[0]?.name || 'Explorer', email: user.email } });
  }
  const { action, email, token, name } = req.body || {};
  if (action === 'signout') {
    // Revoke refresh sessions at the provider, not only in this browser.
    try { await revokeSession(req); } catch (error) { if (error.status !== 401) throw error; }
    sessionCookies(res, null); return reply(res, 200, { ok: true });
  }
  const cleanEmail = allowedEmail(email);
  if (action === 'request') {
    await supabase('/auth/v1/otp', { method: 'POST', body: { email: cleanEmail, create_user: true } });
    return reply(res, 200, { ok: true });
  }
  if (action === 'verify') {
    if (typeof token !== 'string' || !/^\d{6,10}$/.test(token)) fail('Enter the code from your email.');
    if (typeof name !== 'string' || !name.trim() || name.length > 40) fail('Callsign must be 1–40 characters.');
    const data = await supabase('/auth/v1/verify', { method: 'POST', body: { email: cleanEmail, token, type: 'email' } });
    if (!data.user?.id || !data.access_token || !data.refresh_token || !data.user.email_confirmed_at || data.user.email?.toLowerCase() !== cleanEmail) fail('Verification failed.', 401);
    await supabase('/rest/v1/profiles?on_conflict=id', { method: 'POST', admin: true, upsert: true, body: { id: data.user.id, name: name.trim() } });
    sessionCookies(res, data);
    return reply(res, 200, { identity: { name: name.trim(), email: cleanEmail } });
  }
  fail('Unknown authentication command.');
});
