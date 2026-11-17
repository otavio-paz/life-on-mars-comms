import { handle, guard, reply, supabase, userSession, validateMessage, fail } from '../lib/server.js';

export default handle(async (req, res) => {
  const env = guard(req, ['GET', 'POST']);
  const user = await userSession(req, res);
  if (req.method === 'GET') {
    const messages = await supabase(`/rest/v1/messages?sender_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc&limit=100&select=id,recipient,subject,body,station,created_at,delivery_at,status`, { admin: true });
    return reply(res, 200, { messages });
  }
  const packet = validateMessage(req.body, user, env);
  const profiles = await supabase(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=name`, { admin: true });
  packet.sender_name = profiles[0]?.name || 'Explorer';
  packet.email_from = env.from;
  packet.reply_url = env.origin;
  // Atomic reservation enforces rate limiting and freezes delivery time across retries.
  const rows = await supabase('/rest/v1/rpc/reserve_message', { method: 'POST', admin: true, body: { packet } });
  const message = rows[0];
  if (!message || message.sender_id !== user.id) fail('Packet ID unavailable.', 409);
  if (['recipient', 'subject', 'body', 'station'].some(k => message[k] !== packet[k])) fail('A different transmission already uses this ID.', 409);
  if (message.status === 'scheduled') return reply(res, 200, { message });
  // Resend keys last 24h. Never retry an uncertain packet outside that window.
  if (Date.now() - Date.parse(message.created_at) > 23 * 3600000) fail('This unconfirmed packet needs operator review in Resend before resending.', 409);
  const name = message.sender_name;
  let response;
  try {
    response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.resend}`, 'Content-Type': 'application/json', 'Idempotency-Key': `delay-${message.id}` }, body: JSON.stringify({
      from: message.email_from, to: [message.recipient], reply_to: message.sender,
      subject: `[DELAY / ${message.station.toUpperCase()}] ${message.subject}`,
      text: `${name} / ${message.sender}\nTransmitted from ${message.station.toUpperCase()}\nDeparture: ${message.created_at}\nScheduled dispatch: ${message.delivery_at}\n\n${message.body}\n\n---\nDELAY — Life on Mars correspondence experiment.\nTo preserve the seven-day return delay, reply through ${message.reply_url}, rather than replying to this email.`,
      scheduled_at: message.delivery_at
    }), signal: AbortSignal.timeout(18000) });
  } catch { fail('Scheduling confirmation was interrupted. Retry this unchanged transmission to safely confirm it.', 502); }
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.id) fail('The email relay could not confirm scheduling. Retry this unchanged transmission or ask the operator to check Resend.', 502);
  const updated = await supabase(`/rest/v1/messages?id=eq.${message.id}&sender_id=eq.${user.id}`, { method: 'PATCH', admin: true, body: { status: 'scheduled', provider_id: result.id } });
  return reply(res, 201, { message: updated[0] });
});
