# Security review — November 16, 2026

## Result and scope

17 automated regression checks pass, and the Jekyll production build succeeds. The OSV dependency scan found **no reported matches across 38 Ruby lockfile entries** at the time checked. There are no third-party npm dependencies. Re-run `node scripts/security-audit.mjs` to refresh the advisory check; its machine-readable result is saved in `.local/dependency-audit.json`.

This is a source review and local test pass, **not a guarantee of zero vulnerabilities or an independent penetration-test certification**. Supabase, Resend, DNS, TLS, production access controls, and actual database permissions have not been tested against live accounts: none are connected here. Database SQL was reviewed but not executed against a live PostgreSQL service.

## Reviewed protections

- **SQL injection:** database writes use structured REST/RPC JSON parameters and static SQL statements. There is no dynamically assembled SQL or PL/pgSQL EXECUTE. Database access is server-only; RLS is enabled, browser roles have table permissions revoked, and the reservation RPC is restricted to service_role. Apply the schema and verify these permissions in the actual project.
- **XSS and HTML injection:** message content is rendered into ordinary DOM elements with textContent, and correspondence is sent as plain text. No HTML rendering, eval, or command execution processes message input. CSP restricts scripts to this origin, blocks objects, and forbids framing. Inline style attributes are allowed for the flight progress indicator; inline scripts are not.
- **Prompt injection:** this application has no LLM, agent, prompt processor, or AI tool execution path. Instructions written in letters are ordinary text. If a recipient later passes a letter to a separate AI service, that service needs its own untrusted-content protections.
- **Authentication/authorization:** verified Supabase identities, server-side participant allowlist, recipient restriction, UUID validation, and sender-scoped history. Client-provided sender and delivery timestamps are ignored. OTP responses must match the requested verified email.
- **CSRF/session handling:** exact Origin checks on writes, JSON-only bodies, HttpOnly/SameSite=Strict cookies, Secure on HTTPS, no-store API responses. Disconnect revokes the current refresh session at Supabase before clearing cookies, including when the access cookie has expired. Already-issued access JWTs can remain valid until their provider expiry; use a short expiry appropriate for the class.
- **Abuse/retries:** bounded inputs, server-side rolling 24-hour message quota using an atomic reservation, provider OTP rate limits, fixed seven-day delay, stable provider idempotency keys, and refusal to replay uncertain packets past the key retention window. Configure Supabase auth rate limits and Vercel traffic controls for the deployed installation; provider limits are not a complete DDoS defense.
- **Secrets/files:** keys are server environment variables; .env, server code and SQL sources are not public preview routes or Jekyll build outputs. The preview binds only to loopback. Unknown API paths cannot resolve inherited object properties.

## Fixed during this review

Malformed cookies now fail authentication without crashing parsing. Authentication checks the verified email returned by the provider. User UUIDs are checked before building database filters. Disconnect now revokes the provider refresh session rather than only deleting browser cookies. Prototype-property API paths return 404. Local preview now applies security headers matching production, and the production CSP has stricter style, object and base restrictions.

Regression coverage includes absent/malformed sessions, forged IDs, cross-origin writes, invalid methods, oversized messages, recipient restrictions, literal SQL/script/prompt payloads, OTP identity mismatch, logout revocation, private-file access, prototype paths, duplicate scheduling, and dispatch date integrity. Literal-payload unit checks do not simulate every possible browser exploit or a live SQL injection attack.

## Before real correspondence

Complete [SETUP.md](SETUP.md), verify the database permissions using anon/authenticated identities, verify OTP and scheduling with the two intended participants, inspect deployed response headers, and keep Ruby/Node dependencies and provider settings current. Messages in Supabase/Resend and browser drafts are not end-to-end encrypted. Do not store sensitive material on a shared device. No live emails were sent during this review.

Reference guidance: [OWASP SQL injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html), [XSS prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html), [LLM prompt injection](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).
