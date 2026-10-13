import "server-only";
import { env } from "../env";
import { PermanentJobError } from "../jobs/queue";
import type { LeadPayload } from "./payload";

/**
 * Jobber: OAuth 2 + GraphQL. Creates a client and a request for each lead.
 * Needs a Jobber developer app (developer.getjobber.com). Access tokens last
 * about an hour and refresh tokens rotate, so new tokens are saved every refresh.
 */
const AUTH_URL = "https://api.getjobber.com/api/oauth/authorize";
const TOKEN_URL = "https://api.getjobber.com/api/oauth/token";
const GRAPHQL_URL = "https://api.getjobber.com/api/graphql";
const API_VERSION = process.env.JOBBER_API_VERSION ?? "2025-04-16";

export type JobberTokens = { accessToken: string; refreshToken: string; expiresAt?: number };

export function jobberEnabled(): boolean {
  return !!(env.jobberClientId && env.jobberClientSecret);
}

export function jobberRedirectUri(): string {
  return `${env.appUrl}/api/integrations/jobber/callback`;
}

export function jobberAuthorizeUrl(state: string): string {
  const u = new URL(AUTH_URL);
  u.searchParams.set("client_id", env.jobberClientId!);
  u.searchParams.set("redirect_uri", jobberRedirectUri());
  u.searchParams.set("response_type", "code");
  u.searchParams.set("state", state);
  return u.toString();
}

async function tokenRequest(params: Record<string, string>): Promise<JobberTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.jobberClientId!, client_secret: env.jobberClientSecret!, ...params }),
    signal: AbortSignal.timeout(10000),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) {
    const msg = `Jobber token error ${res.status}: ${json.error ?? "unknown"}`;
    if (res.status === 400 || res.status === 401) throw new PermanentJobError(`${msg}. Reconnect Jobber in Integrations.`);
    throw new Error(msg);
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? params.refresh_token ?? "",
    expiresAt: json.expires_in ? Date.now() + json.expires_in * 1000 : undefined,
  };
}

export function exchangeJobberCode(code: string) {
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: jobberRedirectUri() });
}

export function refreshJobberTokens(refreshToken: string) {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

async function gql<T>(accessToken: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", "X-JOBBER-GRAPHQL-VERSION": API_VERSION },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 401) throw new JobberUnauthorized();
  const json = (await res.json().catch(() => ({}))) as { data?: T; errors?: { message: string }[] };
  if (!res.ok || json.errors?.length) {
    const msg = `Jobber API ${res.status}: ${json.errors?.map((e) => e.message).join("; ") ?? "error"}`;
    if (res.status >= 500 || res.status === 429) throw new Error(msg);
    throw new PermanentJobError(msg);
  }
  return json.data as T;
}

export class JobberUnauthorized extends Error {}

const CLIENT_CREATE = `mutation CreateClient($input: ClientCreateInput!) {
  clientCreate(input: $input) { client { id } userErrors { message path } }
}`;

const REQUEST_CREATE = `mutation CreateRequest($input: RequestCreateInput!) {
  requestCreate(input: $input) { request { id } userErrors { message path } }
}`;

/** Creates a Jobber client and request. Returns ids. Refreshes tokens once on 401 via onRefresh. */
export async function pushLeadToJobber(tokens: JobberTokens, p: LeadPayload, onRefresh: (t: JobberTokens) => Promise<void>) {
  let t = tokens;
  if (t.expiresAt && t.expiresAt < Date.now() + 60_000) {
    t = await refreshJobberTokens(t.refreshToken);
    await onRefresh(t);
  }
  const run = async <T>(q: string, v: Record<string, unknown>) => {
    try {
      return await gql<T>(t.accessToken, q, v);
    } catch (e) {
      if (!(e instanceof JobberUnauthorized)) throw e;
      t = await refreshJobberTokens(t.refreshToken);
      await onRefresh(t);
      return gql<T>(t.accessToken, q, v);
    }
  };

  const clientInput: Record<string, unknown> = {
    firstName: p.lead.firstName || p.lead.name,
    lastName: p.lead.lastName || "-",
    emails: [{ description: "MAIN", primary: true, address: p.lead.email }],
    phones: [{ description: "MAIN", primary: true, number: p.lead.phone }],
  };
  if (p.lead.street) {
    clientInput.billingAddress = { street1: p.lead.street, city: p.lead.city ?? "", province: p.lead.state ?? "", postalCode: p.lead.zip ?? "", country: "United States" };
  }
  const c = await run<{ clientCreate: { client: { id: string } | null; userErrors: { message: string }[] } }>(CLIENT_CREATE, { input: clientInput });
  if (!c.clientCreate.client) throw new PermanentJobError(`Jobber clientCreate: ${c.clientCreate.userErrors.map((e) => e.message).join("; ")}`);

  const services = p.quote.services.map((s) => s.name).join(", ");
  const r = await run<{ requestCreate: { request: { id: string } | null; userErrors: { message: string }[] } }>(REQUEST_CREATE, {
    input: { clientId: c.clientCreate.client.id, title: `Instant quote ${p.quote.priceText}: ${services}`.slice(0, 250) },
  });
  if (!r.requestCreate.request) throw new PermanentJobError(`Jobber requestCreate: ${r.requestCreate.userErrors.map((e) => e.message).join("; ")}`);
  return { clientId: c.clientCreate.client.id, requestId: r.requestCreate.request.id };
}
