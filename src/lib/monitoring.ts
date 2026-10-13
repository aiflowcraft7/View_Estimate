import { env } from "./env";

/**
 * Error reporting. Always logs to the console (Vercel keeps these logs);
 * also sends to Sentry when SENTRY_DSN is set, using Sentry's plain HTTP
 * envelope endpoint so no SDK is needed.
 */
export function reportError(error: unknown, context: Record<string, unknown> = {}): void {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error("[error]", err.message, context, err.stack);
  const dsn = env.sentryDsn;
  if (!dsn) return;
  void sendToSentry(dsn, err, context).catch(() => {});
}

async function sendToSentry(dsn: string, err: Error, extra: Record<string, unknown>) {
  const u = new URL(dsn);
  const projectId = u.pathname.replace(/\//g, "");
  const publicKey = u.username;
  const endpoint = `${u.protocol}//${u.host}/api/${projectId}/envelope/?sentry_key=${publicKey}&sentry_version=7`;
  const eventId = crypto.randomUUID().replace(/-/g, "");
  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "node",
    level: "error",
    environment: env.isProduction ? "production" : "development",
    server_name: env.appUrl,
    exception: {
      values: [{ type: err.name, value: err.message, stacktrace: { frames: parseStack(err.stack) } }],
    },
    extra,
  };
  const body = [JSON.stringify({ event_id: eventId, dsn }), JSON.stringify({ type: "event" }), JSON.stringify(event)].join("\n");
  await fetch(endpoint, { method: "POST", body, signal: AbortSignal.timeout(3000) });
}

function parseStack(stack?: string) {
  return (stack ?? "")
    .split("\n")
    .slice(1, 30)
    .map((l) => ({ function: l.trim() }))
    .reverse();
}
