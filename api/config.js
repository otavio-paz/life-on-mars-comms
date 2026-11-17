import { environment, reply } from '../lib/server.js';
export default function handler(req, res) {
  if (req.method !== 'GET') return reply(res, 405, { error: 'Method not allowed.' });
  const env = environment();
  // Never silently turn a production installation into a demo when secrets are missing.
  if (process.env.VERCEL_ENV === 'production' && !env.configured) return reply(res, 503, { error: 'Mission operator: configure the required relay environment variables.' });
  return reply(res, 200, { demo: !env.configured });
}
