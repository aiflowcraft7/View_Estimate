import { cronAuthorized } from "@/lib/cron";
import { runDaily } from "@/lib/daily";

export const maxDuration = 300;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  return Response.json(await runDaily());
}
