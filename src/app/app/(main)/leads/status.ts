import type { LeadStatus } from "@/lib/db/schema";

export const LEAD_STATUSES: LeadStatus[] = ["new", "contacted", "booked", "lost"];

export function statusColor(s: string): "blue" | "amber" | "green" | "gray" {
  return s === "new" ? "blue" : s === "contacted" ? "amber" : s === "booked" ? "green" : "gray";
}
