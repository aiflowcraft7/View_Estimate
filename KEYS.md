# Keys checklist

Everything below goes in `.env` locally, or in **Vercel > Project > Settings > Environment Variables** in production.
Locally the app runs with none of them. Each missing service switches to a stand-in, and **/admin/health** shows which services are live. Production refuses to serve pages until the required keys below are set, and it will not invent addresses.

Your public address is called `APP_URL` below (for example `https://viewestimate.com`).

## 1. Required to go live

| Key | Where to get it |
|---|---|
| `APP_URL` | Your production URL, no trailing slash. |
| `APP_SECRET` | Any random 32+ characters: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. **Never change it later**, because stored CRM credentials are encrypted with it. |
| `ADMIN_EMAILS` | Your own email. That account gets the `/admin` console. |
| `CRON_SECRET` | Any random string. Vercel sends it to the cron routes automatically. |
| `DATABASE_URL` | Supabase > Project settings > Database > Connection string > **Transaction pooler** (port 6543). Tables are created automatically on first start. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk application **`app_3KwbaRZNHJn2KADxdWfC3l3KzqA`** ([Dashboard](https://dashboard.clerk.com) > API Keys). Both must be from the same app. Sign-in UI is custom at `/login` (not Clerk hosted components). Set `NEXT_PUBLIC_CLERK_SIGN_IN_URL` and `NEXT_PUBLIC_CLERK_SIGN_UP_URL` to `/login`. **Do not run `clerk init` on this repo** — it can create a second app or overwrite keys. To refresh keys: `clerk auth login`, then `clerk link --app app_3KwbaRZNHJn2KADxdWfC3l3KzqA`, then `clerk env pull`. |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Clerk Dashboard > Webhooks > endpoint `APP_URL/api/webhooks/clerk` (events: `user.created`, `user.updated`, `user.deleted`). |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same Supabase project as `SUPABASE_URL`. Required if the app calls Supabase with the user's Clerk session (Clerk JWT template named `supabase` + Supabase third-party auth). |
| `RESEND_API_KEY` | resend.com > API Keys. First add and verify your sending domain under Domains (lead alerts and transactional email). |
| `EMAIL_FROM` | An address on that verified domain, e.g. `ViewEstimate <alerts@viewestimate.com>`. |
| `SUPPORT_EMAIL`, `LEGAL_ENTITY_NAME` | Shown in emails, the privacy policy and the terms. |
| `GOOGLE_MAPS_SERVER_KEY` | Google Cloud console > APIs & Services. Enable **Places API (New)**, **Solar API** and **Maps Static API**, then create an API key restricted to those three APIs. It is only ever used on the server. Set a budget alert in Billing. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Required. Without the secret, lead submit is rejected. Cloudflare > Turnstile > Add widget, mode "Managed". Because the widget is embedded on customers' sites, leave the hostname list open or add your domain (the form runs inside your iframe). |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project settings > API. Then create a **private** Storage bucket named `uploads` (or set `SUPABASE_STORAGE_BUCKET`). |

Without Google keys **locally**, homeowners see simulated addresses and sizes. Production will not do that. Without Resend locally, alert emails go to `/dev/outbox`. For Clerk locally, put **both** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in `.env.local` (from the Clerk Dashboard API keys page). You do **not** need to run the Clerk CLI for day-to-day dev.

## 2. Billing (Paddle)

1. Create a Paddle account and work in **Sandbox** first.
2. Catalog > Products: create "Starter", "Pro" and "Founding". Add prices: Starter $49/month and $490/year, Pro $79/month and $790/year, Founding $39/month. Copy each price id (`pri_...`) into the `PADDLE_PRICE_*` keys.
3. Developer tools > Authentication: create an **API key** with read and write access (`PADDLE_API_KEY`) and a **client-side token** (`NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`).
4. Developer tools > Notifications: add a destination `APP_URL/api/webhooks/paddle` with all `subscription.*` events. Copy its secret key into `PADDLE_WEBHOOK_SECRET`.
5. Checkout settings: set the default payment link to `APP_URL/app/billing` and approve your domain.
6. `NEXT_PUBLIC_PADDLE_ENV=sandbox` until tested, then switch every Paddle key to the live account's values and set it to `production`.

Without Paddle keys, the billing page shows a "simulated subscribe" button (local only).

## 3. Optional services

| Service | Keys | Setup |
|---|---|---|
| SMS lead alerts (Twilio) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID` | Buy a number and complete **A2P 10DLC** registration (use the text at `APP_URL/sms-terms` as your opt-in description). On the number or messaging service set the incoming message webhook to `APP_URL/api/webhooks/twilio/inbound` and status callback to `APP_URL/api/webhooks/twilio/status`. Until set, alerts go by email only. |
| Bot check (Cloudflare Turnstile) | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Required for production (section 1). Cloudflare > Turnstile > Add widget, mode "Managed". Because the widget is embedded on customers' sites, leave the hostname list open or add `APP_URL`'s domain (the form runs inside your iframe). |
| Jobber CRM | `JOBBER_CLIENT_ID`, `JOBBER_CLIENT_SECRET` | developer.getjobber.com > create an app with scopes for clients and requests (read/write). Callback URL: `APP_URL/api/integrations/jobber/callback`. Test with a Jobber sandbox account before turning it on for customers. |
| Error tracking (Sentry) | `SENTRY_DSN` | sentry.io > new project (Next.js) > Client Keys (DSN). |

GoHighLevel and Zapier need no keys from you: each business pastes its own webhook URL on its Integrations page.

## 4. Quick check after deploying

1. In Clerk application **`app_3KwbaRZNHJn2KADxdWfC3l3KzqA`**: **Allowed redirect URLs** `http://localhost:3000/*` and `APP_URL/*`; sign-in/sign-up paths `/login`; enable **Google** if using the button on `/login`; JWT template **`supabase`** if using Supabase third-party auth; webhook `APP_URL/api/webhooks/clerk` (optional).
2. In Supabase: enable **Clerk** third-party auth (same Clerk app). Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to match your project.
3. Open `APP_URL/api/health` (no secrets) and `APP_URL/admin/health`. Confirm `ok` is true and each service you configured says **Live**.
4. Sign up at `APP_URL/login` with a real email and finish onboarding.
5. Open your quote page (`APP_URL/q/your-slug`), quote a real address and submit; you should get the alert email (and SMS if Twilio is set).
6. Subscribe in Paddle sandbox with test card `4242 4242 4242 4242`, then confirm the billing page shows the plan.
