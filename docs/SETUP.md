# Connecting the live relay on Vercel

The repository is a Jekyll website plus Node serverless functions in `api/`. Jekyll builds the interface; the functions handle login and schedule emails. No service keys appear in the generated website. The local preview is safe to explore without accounts or credentials.

## 1. Supabase: identity and durable history

1. Create a Supabase project and run [`supabase/schema.sql`](../supabase/schema.sql) in its SQL editor.
2. In Authentication, enable the Email provider and keep email verification enabled.
3. Under Authentication → Email Templates, change the **Magic Link** template to show the OTP token instead of a magic-link-only button. For example:

   ```html
   <h2>Your DELAY access code</h2>
   <p>Enter this code in the terminal: <strong>{{ .Token }}</strong></p>
   <p>If you did not request this code, ignore this email.</p>
   ```

4. Set the Site URL to the final Vercel URL. The app uses code verification, so no OAuth redirect handler is needed.
5. Configure custom SMTP for authentication emails. The built-in Supabase mailer only sends to project team addresses and is intended for testing. Resend can provide the SMTP connection; use the current settings in its dashboard. Authentication emails arrive immediately; the seven-day delay applies to correspondence only.
6. Copy the project URL, legacy `anon` API key, and legacy `service_role` key from the project's API settings. This implementation expects those key types. Keep the service key private and server-side.

References: [Supabase email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## 2. Resend: delayed correspondence

1. Create a Resend account and verify a domain you control by adding its required DNS records. Use a sending subdomain if preferred.
2. Create a sending API key for that domain.
3. Choose a From address on the verified domain, such as `DELAY <comms@mars.yourdomain.com>`.
4. The server submits a plain-text email with `scheduled_at` set by the database to **168 hours after reservation**. Resend manages dispatch while the site is closed. You do not need a Vercel cron job. Actual inbox delivery may occur later due to email processing or spam filtering.
5. Watch Resend's email dashboard for scheduled, delivered, bounced, or failed messages. The website confirms scheduling; it does not claim verified delivery.

Resend supports schedules up to 30 days ahead, so seven days fits. Idempotency keys are retained for 24 hours; this app refuses to retry an unconfirmed packet older than 23 hours. If that happens, check the Resend dashboard before sending a new transmission. Pending records are deliberately retained for diagnosis.

References: [scheduling](https://resend.com/docs/dashboard/emails/schedule-email), [idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), [domain verification](https://resend.com/docs/dashboard/domains/introduction).

## 3. Vercel environment variables

Import the repository, choose **Jekyll**, and use build command `bundle exec jekyll build` and output directory `_site` (already declared in `vercel.json`). Install dependencies with `bundle install` if Vercel requests an install-command override. Use Node 22 or newer for the serverless functions. If the build image requires a Linux entry in the lockfile, run `bundle lock --add-platform x86_64-linux` and commit the updated lockfile.

Set these environment variables in Project Settings → Environment Variables:

| Variable | Value |
| --- | --- |
| `APP_URL` | Exact origin, e.g. `https://your-project.vercel.app`, without a path |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase legacy anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase legacy service role key; server-only |
| `RESEND_API_KEY` | Resend sending key; server-only |
| `MAIL_FROM` | Sender on your verified domain |
| `CLASS_EMAILS` | The two participant emails, comma-separated |

Redeploy after setting them. Production fails with a configuration error if any are missing, rather than pretending to send messages. For preview deployments, keep services unconfigured to use demo mode; connecting a preview requires its exact URL as `APP_URL` and will schedule real emails.

`CLASS_EMAILS` is the server-side participant allowlist. A verified sender can only send to another allowed email, and cannot send to themselves. The atomic database reservation limits each sender to 10 transmissions in a rolling 24 hours. Supabase also rate-limits authentication requests. Never add service keys to `_config.yml`, `_data`, HTML, browser JavaScript, or Git.

No Gmail permissions or Google OAuth app are needed. Resend sends from the verified project domain, and Supabase verifies each participant's email ownership. A normal email Reply bypasses the simulation; recipients should return to the website to write their response.

## 4. Configure the mission

Edit `_data/mission.json`, using explicit UTC timestamps:

```json
{
  "name": "Ares I",
  "settlement": "Ares Outpost",
  "launchAt": "2026-10-01T12:00:00Z",
  "arrivalAt": "2026-11-16T00:00:00-05:00",
  "marsLongitudeEast": 0,
  "ttMinusUtcSeconds": 69.184,
  "delayDays": 7
}
```

The client switches to settlement automatically at `arrivalAt`, including if the page stays open. `marsLongitudeEast: 0` displays Airy Mean Time (MTC); another longitude displays local mean solar time (LMST). Earth time is explicitly UTC. The Mars calculation follows [NASA Mars24](https://www.giss.nasa.gov/tools/mars24/help/algorithm.html); `ttMinusUtcSeconds` is configurable if future leap seconds change the conversion. `delayDays` documents the classroom rule; the backend enforces seven days independently, so changing browser dates cannot shorten it.

The Mission config dialog saves browser-only date and phase overrides for demonstrations. Restore mission defaults to follow the shared configuration again. These overrides do not administer the shared deployment.

The shared mission also sets `settlementWindow` from November 16, 2026 at midnight through January 1, 2027 at midnight, both in New York time (`-05:00`). During that window the Mars settlement stage takes precedence over browser preview/date overrides. Afterward, normal mission/preview rules resume; the ship remains landed by default because its arrival has already occurred.

## 5. Verify live operation

1. Authenticate with one of the two allowed emails; confirm the OTP arrives and the callsign persists after reconnecting.
2. Schedule one intended test letter to the other participant. Confirm the outbox and Resend dashboard show the same dispatch timestamp seven days later.
3. Close the site. Delivery is managed by Resend, so the browser need not remain open.
4. If the UI reports scheduling interrupted, retry the unchanged draft. The reserved date and provider key remain stable, including across page reloads. A changed draft represents a new transmission.
5. Check delivery/bounce results in Resend after the scheduled time. This project does not include a webhook-based delivery receipt or inbound email inbox.

Stored messages are plain text in Supabase and Resend; HTTPS protects transport in production. This is not end-to-end encrypted. Browser drafts and local demo messages are saved in localStorage; avoid shared devices for private correspondence. Remove classroom records in the provider dashboards after the class if appropriate.
