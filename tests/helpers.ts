import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createBusinessForUser } from "@/lib/business";

let n = 0;
export async function makeOwner(name = "Test Wash Co") {
  const db = await getDb();
  const [u] = await db.insert(users).values({ email: `owner${Date.now()}${n++}@example.com` }).returning();
  const b = await createBusinessForUser(u.id, { name, alertEmail: u.email, alertPhone: "(813) 555-0100", serviceIds: ["house_wash", "roof_wash", "driveway"] });
  return { user: u, business: b };
}
