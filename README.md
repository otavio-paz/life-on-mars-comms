# DELAY — Earth / Mars correspondence

A Jekyll-based classroom experiment in staying in touch across a seven-day delay. A black terminal, two mission phases, an animated flight path, Earth/Mars clocks, remembered callsigns, and a persistent outbox.

## See it locally

With Node 22+ installed:

```sh
npm run dev
```

Open **http://localhost:4000**. No install, email account, or API key is required. The development server renders this project's Jekyll layout and serves local API routes; it is a preview helper, not a replacement Jekyll implementation. Unconfigured local services use an explicitly labeled demo: letters stay in this browser and no email is sent or scheduled.

Connect a callsign and email, write a letter, then check Outbox. Open **Mission config** to preview the Mars settlement or adjust local launch/arrival dates. The top-right theme control switches the surrounding interface; the terminal always stays black. Local drafts, identity, theme, and mission overrides survive reloads.

## Real Jekyll build

With Ruby, Bundler and native build tools installed:

```sh
bundle install
bundle exec jekyll build
```

Output is `_site/`. To preview only the generated static interface with Jekyll, run `bundle exec jekyll serve`; for functional demo/live API routes, use `npm run dev`. The static-only Jekyll server does not execute the Node API routes. Fonts are committed locally with their OFL licenses; `npm run fonts` refreshes them from upstream.

## Live email and Vercel

The Node functions use **Supabase email OTP** for identity and durable history, and **Resend scheduling** for correspondence. The database fixes dispatch at 168 hours after submission; Resend handles it with the browser closed. Authentication emails are immediate. No browser timers or daily cron are used for real delivery.

Follow [the complete setup guide](docs/SETUP.md) for domain verification, SMTP, authentication templates, environment variables, mission dates, and Vercel deployment. `.env.example` lists all configuration. Never commit credentials. No deployment has been made by this build.

## Project map

- `index.html`, `_layouts/`, `_data/`: Jekyll page, layout, shared mission configuration.
- `assets/css/tokens.css`: semantic design tokens and both themes.
- `assets/css/site.css`: responsive layout and terminal styling.
- `assets/js/`: local demo, terminal interactions, mission and Mars time calculations.
- `api/`, `lib/`: authenticated serverless API and scheduling validation.
- `supabase/schema.sql`: tables, restricted access, atomic reservations and rate limits.
- `tests/`: scheduling, auth, validation, NASA clock example, and local HTTP checks.

Run `npm test` for the verification suite. See [DESIGN.md](DESIGN.md) for the visual contract, token usage, and explicit ban on generic AI design tropes.
