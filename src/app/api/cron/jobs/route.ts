import { cronAuthorized } from "@/lib/cron";
import { runDueJobs } from "@/lib/jobs/queue";

export const maxDuration = 60;

/** Runs due background jobs (alert retries, CRM sync retries). Scheduled every minute in vercel.json. */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  const started = Date.now();
  let ran = 0;
  let failed = 0;
  // Keep draining while there is work and time left.
  while (Date.now() - started < 45_000) {
    const r = await runDueJobs({ limit: 25 });
    ran += r.ran;
    failed += r.failed;
    if (r.ran < 25) break;
  }
  return Response.json({ ran, failed });
}
