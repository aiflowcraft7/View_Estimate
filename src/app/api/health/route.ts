import { sql } from "drizzle-orm";
import { json } from "@/lib/api";
import { getDb } from "@/lib/db";
import { env, productionConfigGaps, serviceStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Public readiness probe. Reports which services are live, never their secrets. */
export async function GET() {
  const missing = productionConfigGaps();
  let db: "up" | "down" = "down";
  if (env.databaseUrl || !env.runtimeProduction) {
    try {
      const database = await getDb();
      await database.execute(sql`select 1`);
      db = "up";
    } catch {
      db = "down";
    }
  }
  const ok = missing.length === 0 && db === "up";
  return json(
    {
      ok,
      db,
      missing,
      services: serviceStatus().map(({ name, live }) => ({ name, live })),
    },
    ok ? 200 : 503,
  );
}
