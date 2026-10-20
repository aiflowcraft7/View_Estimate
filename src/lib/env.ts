/**
 * Central configuration. Every outside service is optional: when its keys are
 * missing the app switches that service to a stand-in mode, so the whole product
 * runs locally with zero keys. See KEYS.md for where each key comes from.
 */

function str(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export const env = {
  get appUrl() {
    return (str("APP_URL") ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get appName() {
    return str("APP_NAME") ?? "ViewEstimate";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  /** Real production runtime. False while `next build` is collecting pages. */
  get runtimeProduction() {
    return process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build";
  },
  /** Secret used to sign sessions, claim links and encrypt stored credentials. */
  get appSecret() {
    const s = str("APP_SECRET");
    if (s) return s;
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
      throw new Error("APP_SECRET must be set in production (any random 32+ character string).");
    }
    return "dev-only-secret-change-me-dev-only-secret";
  },
  /** Comma-separated emails that are platform admins (you). */
  get adminEmails(): string[] {
    return (str("ADMIN_EMAILS") ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  },

  // Database: Postgres (Supabase) in production, embedded PGlite when unset.
  get databaseUrl() {
    return str("DATABASE_URL");
  },
  get pgliteDir() {
    return str("PGLITE_DIR") ?? ".data/pglite";
  },

  // Google Maps Platform
  get googleServerKey() {
    return str("GOOGLE_MAPS_SERVER_KEY");
  },
  get googleStaticKey() {
    return str("GOOGLE_MAPS_STATIC_KEY") ?? str("GOOGLE_MAPS_SERVER_KEY");
  },
  get googleDailyCallBudget() {
    return Number(str("GOOGLE_DAILY_CALL_BUDGET") ?? 3000);
  },

  // Email (Resend)
  get resendKey() {
    return str("RESEND_API_KEY");
  },
  get emailFrom() {
    return str("EMAIL_FROM") ?? "ViewEstimate <alerts@viewestimate.com>";
  },
  /** Legal entity shown in the privacy policy and terms. */
  get legalName() {
    return str("LEGAL_ENTITY_NAME") ?? str("APP_NAME") ?? "ViewEstimate";
  },
  get supportEmail() {
    return str("SUPPORT_EMAIL") ?? "support@viewestimate.com";
  },

  // SMS (Twilio)
  get twilioSid() {
    return str("TWILIO_ACCOUNT_SID");
  },
  get twilioToken() {
    return str("TWILIO_AUTH_TOKEN");
  },
  get twilioFrom() {
    return str("TWILIO_FROM_NUMBER") ?? str("TWILIO_MESSAGING_SERVICE_SID");
  },

  // Billing (Paddle)
  get paddleApiKey() {
    return str("PADDLE_API_KEY");
  },
  get paddleWebhookSecret() {
    return str("PADDLE_WEBHOOK_SECRET");
  },
  get paddleClientToken() {
    return str("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN");
  },
  get paddleEnv(): "sandbox" | "production" {
    return str("NEXT_PUBLIC_PADDLE_ENV") === "production" ? "production" : "sandbox";
  },
  get paddlePrices() {
    return {
      starter_monthly: str("PADDLE_PRICE_STARTER_MONTHLY"),
      starter_annual: str("PADDLE_PRICE_STARTER_ANNUAL"),
      pro_monthly: str("PADDLE_PRICE_PRO_MONTHLY"),
      pro_annual: str("PADDLE_PRICE_PRO_ANNUAL"),
      founding: str("PADDLE_PRICE_FOUNDING_MONTHLY"),
    };
  },

  // Bot protection (Cloudflare Turnstile)
  get turnstileSiteKey() {
    return str("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
  },
  get turnstileSecret() {
    return str("TURNSTILE_SECRET_KEY");
  },

  // Auth (Clerk)
  get clerkPublishableKey() {
    return str("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  },
  get clerkSecretKey() {
    return str("CLERK_SECRET_KEY");
  },
  get clerkWebhookSecret() {
    return str("CLERK_WEBHOOK_SIGNING_SECRET");
  },

  // Jobber (CRM)
  get jobberClientId() {
    return str("JOBBER_CLIENT_ID");
  },
  get jobberClientSecret() {
    return str("JOBBER_CLIENT_SECRET");
  },

  // File storage (Supabase Storage); local disk when unset
  get supabaseUrl() {
    return str("SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return str("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get supabaseServiceKey() {
    return str("SUPABASE_SERVICE_ROLE_KEY");
  },
  get storageBucket() {
    return str("SUPABASE_STORAGE_BUCKET") ?? "uploads";
  },

  // Monitoring
  get sentryDsn() {
    return str("SENTRY_DSN");
  },

  /** Protects /api/cron/* routes. */
  get cronSecret() {
    return str("CRON_SECRET");
  },
};

export type ServiceStatus = { name: string; live: boolean; note: string };

/** Env vars that must exist before the app serves real customers. Empty outside production. */
export function productionConfigGaps(): string[] {
  if (!env.runtimeProduction) return [];
  const gaps: string[] = [];
  if (!env.databaseUrl) gaps.push("DATABASE_URL");
  if (!str("APP_SECRET")) gaps.push("APP_SECRET");
  if (!env.cronSecret) gaps.push("CRON_SECRET");
  if (!env.clerkPublishableKey || !env.clerkSecretKey) gaps.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY");
  if (!env.googleServerKey) gaps.push("GOOGLE_MAPS_SERVER_KEY");
  if (!env.resendKey) gaps.push("RESEND_API_KEY");
  return gaps;
}

/** Throws when production is missing a required service. No-op in local dev and during `next build`. */
export function assertProductionConfig(): void {
  const gaps = productionConfigGaps();
  if (gaps.length) throw new Error(`Production is missing required configuration: ${gaps.join(", ")}`);
}

/** Which services are live vs running in stand-in mode. Shown in the admin health view. */
export function serviceStatus(): ServiceStatus[] {
  return [
    { name: "Database", live: !!env.databaseUrl, note: env.databaseUrl ? "Postgres" : "Embedded PGlite (local only)" },
    { name: "Google Places + Solar", live: !!env.googleServerKey, note: env.googleServerKey ? "Live" : "Simulated addresses and sizes" },
    { name: "Email (Resend)", live: !!env.resendKey, note: env.resendKey ? "Live" : "Saved to the dev outbox at /dev/outbox" },
    { name: "SMS (Twilio)", live: !!(env.twilioSid && env.twilioToken && env.twilioFrom), note: env.twilioSid ? "Live" : "Off; texts saved to the dev outbox" },
    { name: "Billing (Paddle)", live: !!(env.paddleApiKey && env.paddleClientToken), note: env.paddleApiKey ? `Live (${env.paddleEnv})` : "Simulated checkout" },
    { name: "Bot check (Turnstile)", live: !!env.turnstileSecret, note: env.turnstileSecret ? "Live" : env.runtimeProduction ? "Required — lead submit is blocked until this is set" : "Skipped in local dev" },
    { name: "Auth (Clerk)", live: !!(env.clerkPublishableKey && env.clerkSecretKey), note: env.clerkPublishableKey ? "Live" : "Required in production" },
    { name: "Jobber", live: !!env.jobberClientId, note: env.jobberClientId ? "Live" : "Hidden until keys are added" },
    { name: "File storage", live: !!(env.supabaseUrl && env.supabaseServiceKey), note: env.supabaseUrl ? "Supabase Storage" : "Kept in the database (local only)" },
    { name: "Error tracking (Sentry)", live: !!env.sentryDsn, note: env.sentryDsn ? "Live" : "Console only" },
  ];
}
