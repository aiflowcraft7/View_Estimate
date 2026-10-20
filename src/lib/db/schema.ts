import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { PricingConfig, PropertyFacts, QuoteResult, ServiceSelection } from "../pricing/types";

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export type ServiceArea = {
  zips?: string[];
  center?: { lat: number; lng: number; label?: string };
  radiusMiles?: number;
};

export type BusinessStatus = "demo" | "trial" | "active" | "past_due" | "paused" | "canceled";
export type Plan = "starter" | "pro" | "founding";

// ---------- Accounts ----------

export const users = pgTable(
  "users",
  {
    id: id(),
    clerkUserId: text("clerk_user_id"),
    email: text("email").notNull().unique(),
    name: text("name"),
    isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
    createdAt: createdAt(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_clerk_user_id_idx").on(t.clerkUserId)],
);

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 of the session token; the raw token only lives in the cookie. */
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** Admin "act as" target. Every switch is written to audit_log. */
    actingBusinessId: uuid("acting_business_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const loginTokens = pgTable("login_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  email: text("email").notNull(),
  redirectTo: text("redirect_to"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// ---------- Tenants ----------

export const businesses = pgTable(
  "businesses",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    logoUrl: text("logo_url"),
    brandColor: text("brand_color").notNull().default("#0f766e"),
    phone: text("phone"),
    website: text("website"),
    alertEmail: text("alert_email"),
    alertPhone: text("alert_phone"),
    smsAlertsEnabled: boolean("sms_alerts_enabled").notNull().default(false),
    timezone: text("timezone").notNull().default("America/New_York"),
    serviceArea: jsonb("service_area").$type<ServiceArea>().notNull().default({}),
    pricing: jsonb("pricing").$type<PricingConfig>().notNull(),
    headline: text("headline"),
    status: text("status").$type<BusinessStatus>().notNull().default("trial"),
    plan: text("plan").$type<Plan>().notNull().default("pro"),
    onboardingComplete: boolean("onboarding_complete").notNull().default(false),
    createdByAdmin: boolean("created_by_admin").notNull().default(false),
    claimTokenHash: text("claim_token_hash"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    poweredByHidden: boolean("powered_by_hidden").notNull().default(false),
    monthlyQuoteCap: integer("monthly_quote_cap").notNull().default(2000),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("businesses_slug_idx").on(t.slug)],
);

export const memberships = pgTable(
  "memberships",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    role: text("role").$type<"owner" | "staff">().notNull().default("owner"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.businessId] }), index("memberships_business_idx").on(t.businessId)],
);

// ---------- Property data ----------

export const propertiesCache = pgTable("properties_cache", {
  placeId: text("place_id").primaryKey(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  formattedAddress: text("formatted_address").notNull(),
  zip: text("zip"),
  state: text("state"),
  footprintSqft: integer("footprint_sqft"),
  roofSqft: integer("roof_sqft"),
  roofPitchAvg: doublePrecision("roof_pitch_avg"),
  perimeterFt: integer("perimeter_ft"),
  source: text("source").$type<"solar" | "none">().notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Quotes and leads ----------

export type QuoteChannel = "widget" | "hosted" | "qr" | "preview";

export const quotes = pgTable(
  "quotes",
  {
    id: id(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    sessionId: text("session_id"),
    placeId: text("place_id"),
    address: text("address"),
    zip: text("zip"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    property: jsonb("property").$type<PropertyFacts>().notNull(),
    selections: jsonb("selections").$type<ServiceSelection[]>().notNull(),
    result: jsonb("result").$type<QuoteResult>().notNull(),
    total: doublePrecision("total").notNull(),
    displayMode: text("display_mode").notNull(),
    channel: text("channel").$type<QuoteChannel>().notNull().default("widget"),
    referrer: text("referrer"),
    utm: jsonb("utm").$type<Record<string, string>>(),
    createdAt: createdAt(),
  },
  (t) => [index("quotes_business_created_idx").on(t.businessId, t.createdAt)],
);

export type LeadStatus = "new" | "contacted" | "booked" | "lost";

export const leads = pgTable(
  "leads",
  {
    id: id(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id").references(() => quotes.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull(),
    notes: text("notes"),
    preferredWindow: text("preferred_window"),
    photos: jsonb("photos").$type<string[]>().notNull().default([]),
    address: text("address"),
    total: doublePrecision("total"),
    smsConsent: boolean("sms_consent").notNull().default(false),
    consentText: text("consent_text"),
    consentAt: timestamp("consent_at", { withTimezone: true }),
    consentIp: text("consent_ip"),
    status: text("status").$type<LeadStatus>().notNull().default("new"),
    internalNotes: text("internal_notes"),
    crmSyncStatus: text("crm_sync_status").$type<"none" | "pending" | "synced" | "failed">().notNull().default("none"),
    bookedValue: doublePrecision("booked_value"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("leads_business_created_idx").on(t.businessId, t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    businessId: uuid("business_id").references(() => businesses.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    channel: text("channel").$type<"email" | "sms">().notNull(),
    kind: text("kind").notNull(),
    to: text("to").notNull(),
    status: text("status").$type<"queued" | "sent" | "failed" | "skipped">().notNull().default("queued"),
    providerId: text("provider_id"),
    error: text("error"),
    segments: integer("segments"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_business_idx").on(t.businessId, t.createdAt)],
);

// ---------- Integrations and background jobs ----------

export type IntegrationType = "webhook" | "ghl" | "jobber";

export const integrations = pgTable(
  "integrations",
  {
    id: id(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    type: text("type").$type<IntegrationType>().notNull(),
    /** AES-256-GCM encrypted JSON (OAuth tokens, webhook URLs, signing secrets). */
    credentials: text("credentials"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").$type<"active" | "error" | "disconnected">().notNull().default("active"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("integrations_business_type_idx").on(t.businessId, t.type)],
);

export type JobStatus = "pending" | "running" | "done" | "dead";

export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    type: text("type").notNull(),
    businessId: uuid("business_id").references(() => businesses.id, { onDelete: "cascade" }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").$type<JobStatus>().notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(6),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastError: text("last_error"),
    result: jsonb("result"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("jobs_due_idx").on(t.status, t.runAt)],
);

// ---------- Billing ----------

export const subscriptions = pgTable("subscriptions", {
  businessId: uuid("business_id").primaryKey().references(() => businesses.id, { onDelete: "cascade" }),
  paddleCustomerId: text("paddle_customer_id"),
  paddleSubscriptionId: text("paddle_subscription_id").unique(),
  priceId: text("price_id"),
  plan: text("plan").$type<Plan>(),
  status: text("status").notNull(),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  pastDueSince: timestamp("past_due_since", { withTimezone: true }),
  updatedAt: updatedAt(),
});

export const paddleEvents = pgTable("paddle_events", {
  eventId: text("event_id").primaryKey(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Analytics, audit, compliance ----------

export const widgetEvents = pgTable(
  "widget_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    sessionId: text("session_id"),
    event: text("event").$type<"view" | "address" | "quote" | "lead">().notNull(),
    channel: text("channel"),
    createdAt: createdAt(),
  },
  (t) => [index("widget_events_business_idx").on(t.businessId, t.createdAt)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorUserId: uuid("actor_user_id"),
    businessId: uuid("business_id"),
    action: text("action").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_business_idx").on(t.businessId, t.createdAt)],
);

export const optOuts = pgTable("opt_outs", {
  phone: text("phone").primaryKey(),
  createdAt: createdAt(),
});

/** Fixed-window rate limiter state (works across serverless instances). */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
});

/** Daily paid-API usage per business, for budgets and the admin cost view. */
export const apiUsage = pgTable(
  "api_usage",
  {
    day: date("day").notNull(),
    /** A business id, or "global". */
    scope: text("scope").notNull(),
    kind: text("kind").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.kind, t.scope] })],
);

/** Files uploaded while no storage provider is configured (development only). */
export const devFiles = pgTable("dev_files", {
  path: text("path").primaryKey(),
  contentType: text("content_type").notNull(),
  data: text("data").notNull(), // base64
  createdAt: createdAt(),
});

/** Emails and texts captured while Resend/Twilio keys are missing. */
export const devOutbox = pgTable("dev_outbox", {
  id: id(),
  channel: text("channel").$type<"email" | "sms">().notNull(),
  to: text("to").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  html: text("html"),
  createdAt: createdAt(),
});
