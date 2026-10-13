/** Applies database migrations: npm run db:migrate (uses DATABASE_URL, or local PGlite when unset). */
import { getDb } from "../src/lib/db";

getDb()
  .then(() => {
    console.log("Migrations applied.");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
