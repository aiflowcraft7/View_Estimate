# ViewEstimate

Instant-quote widget for exterior-cleaning companies (house wash, roof wash, driveways, windows, gutters).
A homeowner types their address, the widget looks up the roof and house size from Google, shows a price from the owner's own price sheet, and captures the lead. The owner gets an email (and optionally SMS) alert, manages leads in a dashboard, and can push them to Jobber, GoHighLevel or Zapier.

## Run it locally (no keys needed)

Requires Node 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no `.env` file everything runs in stand-in mode: an embedded database in `.data/`, simulated addresses and house sizes, and emails/texts saved to the dev outbox.

| Page | What it is |
|---|---|
| `/` | Marketing site with a live demo widget |
| `/demo` | A full demo business to try the quote flow |
| `/login` | Sign in with Clerk |
| `/app` | Owner dashboard: leads, prices, install code, settings, integrations, billing |
| `/admin` | Admin console (for emails in `ADMIN_EMAILS`): businesses, demo builder with claim links, jobs, service health, audit log |
| `/dev/outbox` | Every email and text the app would have sent |

To get the admin console locally, create `.env` with `ADMIN_EMAILS=you@example.com` and restart.

Other commands:

```bash
npm test            # unit and integration tests (pricing, billing, security, leads)
npm run typecheck
npm run build       # production build
npm run db:seed     # optional: create the demo business up front
```

Delete the `.data` folder to reset the local database.

## Put it online (Vercel + Supabase)

1. **Supabase**: create a project. Copy the Transaction pooler connection string into `DATABASE_URL`. Create a private Storage bucket named `uploads`. Tables are created automatically on first start (or run `npm run db:migrate`). Row Level Security is switched on for every table so Supabase's public API can't read your data.
2. **Vercel**: import this folder (push it to a private Git repo first, or use `npx vercel`). Add the environment variables from `KEYS.md`, then deploy.
3. **Domain**: add your domain in Vercel and set `APP_URL` to it.
4. **Cron**: `vercel.json` schedules `/api/cron/jobs` every minute (alert retries) and `/api/cron/daily` once a day (trial reminders, monthly reports, cleanup). Every-minute crons need a Vercel Pro plan. On Hobby, new lead alerts still go out instantly; only retries wait for the daily run, or point a free service like cron-job.org at `APP_URL/api/cron/jobs` with header `Authorization: Bearer <CRON_SECRET>`.
5. **Webhooks**: Paddle and Twilio webhook URLs are listed in `KEYS.md`.
6. Open `/admin/health` to see which services are live.

## How a business installs the widget

From **Install** in the owner app, copy one line onto their website:

```html
<script src="https://YOUR_APP_URL/w.js" data-business="their-slug" async></script>
```

Add `data-mode="button"` for a floating "Instant quote" button instead of an inline form. They also get a hosted page (`/q/their-slug`) and a QR code for yard signs and trucks.

## Project layout

```
src/app/(marketing)   landing, pricing, privacy, terms, SMS terms
src/app/embed, q      the homeowner quote flow (iframe and hosted page)
src/app/api/public    widget API: autocomplete, lookup, quote, lead
src/app/app           owner app
src/app/admin         admin console
src/lib/pricing       pricing engine shared by browser and server
src/lib/property      Google Places + Solar lookups, size estimates, simulated provider
src/lib/billing       plans and Paddle
src/lib/jobs          Postgres job queue (alerts, CRM sync)
src/lib/integrations  Jobber, GoHighLevel, Zapier/webhook
src/widget/loader.ts  the embed script (built to public/w.js)
drizzle/              database migrations
tests/                vitest suites
```

## Plans

Defined in `src/lib/billing/plans.ts`: Starter $49/month, Pro $79/month (Jobber and GoHighLevel sync, more SMS alerts, hide "Powered by"), Founding $39/month. Every new business gets a 14-day trial with no card. If a trial ends or a payment fails, the widget keeps collecting requests without showing prices after a 7-day grace period, so a business never loses leads.
