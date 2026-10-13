"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, requireBusiness } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { enqueueCrmSync } from "@/lib/integrations/sync";
import { runDueJobs } from "@/lib/jobs/queue";

const schema = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "contacted", "booked", "lost"]),
  internalNotes: z.string().max(5000).optional(),
  bookedValue: z.string().max(20).optional(),
});

export async function updateLead(form: FormData) {
  const ctx = await requireBusiness();
  const d = schema.parse(Object.fromEntries(form));
  const value = d.bookedValue ? Number(d.bookedValue.replace(/[$,]/g, "")) : null;
  const db = await getDb();
  // Scoped by business id: a lead id from another tenant matches nothing.
  await db
    .update(leads)
    .set({ status: d.status, internalNotes: d.internalNotes ?? null, bookedValue: Number.isFinite(value) ? value : null, updatedAt: new Date() })
    .where(and(eq(leads.id, d.id), eq(leads.businessId, ctx.business.id)));
  if (ctx.actingAsAdmin) await audit(ctx.user.id, ctx.business.id, "lead.update", { leadId: d.id, status: d.status });
  revalidatePath(`/app/leads/${d.id}`);
}

export async function resyncLead(form: FormData) {
  const ctx = await requireBusiness();
  const id = z.string().uuid().parse(form.get("id"));
  const db = await getDb();
  const [l] = await db.select({ id: leads.id }).from(leads).where(and(eq(leads.id, id), eq(leads.businessId, ctx.business.id)));
  if (!l) return;
  const ids = await enqueueCrmSync(ctx.business.id, id);
  if (ids.length) await runDueJobs({ ids });
  revalidatePath(`/app/leads/${id}`);
}
