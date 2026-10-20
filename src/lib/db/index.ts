import "server-only";
import path from "node:path";
import { sql } from "drizzle-orm";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { env } from "../env";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

type GlobalDb = { __veDb?: Promise<Db> };
const g = globalThis as unknown as GlobalDb;

/**
 * Returns the database, running pending migrations on first use.
 * - DATABASE_URL set: Postgres (Supabase in production).
 * - DATABASE_URL unset: embedded PGlite stored in .data/pglite, no setup needed.
 * Cached on globalThis so dev hot-reloads reuse one connection.
 */
export function getDb(): Promise<Db> {
  if (!g.__veDb) {
    g.__veDb = connect().catch((e) => {
      g.__veDb = undefined;
      throw e;
    });
  }
  return g.__veDb;
}

async function connect(): Promise<Db> {
  if (!env.databaseUrl && env.runtimeProduction) {
    throw new Error("DATABASE_URL is required in production");
  }
  if (env.databaseUrl) {
    const { default: postgres } = await import("postgres");
    // prepare:false keeps it compatible with Supabase's transaction pooler (port 6543).
    const client = postgres(env.databaseUrl, { prepare: false, max: Number(process.env.DB_POOL_MAX ?? 5) });
    const db = drizzlePostgres(client, { schema });
    if (process.env.DB_AUTO_MIGRATE !== "false") {
      const { migrate } = await import("drizzle-orm/postgres-js/migrator");
      // Advisory lock so concurrent cold starts don't race the migrator.
      await db.execute(sql`select pg_advisory_lock(727274)`);
      try {
        await migrate(db, { migrationsFolder: MIGRATIONS });
      } finally {
        await db.execute(sql`select pg_advisory_unlock(727274)`);
      }
    }
    return db;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = env.pgliteDir === "memory" ? undefined : path.resolve(env.pgliteDir);
  if (dir) {
    const fs = await import("node:fs");
    fs.mkdirSync(dir, { recursive: true });
  }
  const client = new PGlite(dir);
  const db = drizzlePglite(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  // Both drivers expose the same query builder API.
  return db as unknown as Db;
}

export { schema };
