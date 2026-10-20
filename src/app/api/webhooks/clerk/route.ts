import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { deleteUserByClerkId, upsertUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch {
    return new Response("Verification failed", { status: 400 });
  }

  if (evt.type === "user.created" || evt.type === "user.updated") {
    const { id, email_addresses, first_name, last_name, primary_email_address_id } = evt.data;
    const email =
      email_addresses.find((e) => e.id === primary_email_address_id)?.email_address ?? email_addresses[0]?.email_address;
    if (email) {
      const name = [first_name, last_name].filter(Boolean).join(" ").trim() || null;
      await upsertUser(email, name, id);
    }
  }

  if (evt.type === "user.deleted") {
    const id = evt.data.id;
    if (id) await deleteUserByClerkId(id);
  }

  return new Response("OK", { status: 200 });
}
