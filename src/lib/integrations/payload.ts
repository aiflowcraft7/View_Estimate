import type { QuoteResult } from "../pricing/types";

export type LeadPayload = {
  event: "lead.created";
  lead: {
    id: string;
    createdAt: string;
    name: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    address: string | null;
    street: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    notes: string | null;
    preferredWindow: string | null;
    smsConsent: boolean;
    url: string;
    photos: string[];
  };
  quote: {
    id: string | null;
    total: number | null;
    priceText: string;
    displayMode: string | null;
    needsOnsiteConfirmation: boolean;
    services: { id: string; name: string; measure: string; total: number }[];
    discount: { name: string; amount: number } | null;
    sizeSource: string | null;
  };
  business: { id: string; name: string; slug: string };
};

export function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

/** "123 Main St, Tampa, FL 33602, USA" -> parts. Best effort for CRMs that want structured addresses. */
export function splitAddress(address: string | null): { street: string | null; city: string | null; state: string | null; zip: string | null } {
  if (!address) return { street: null, city: null, state: null, zip: null };
  const parts = address.split(",").map((p) => p.trim()).filter((p) => p && !/^(USA|United States)$/i.test(p));
  const stateZip = parts.length >= 3 ? parts[parts.length - 1].match(/^([A-Z]{2})\s*(\d{5})?/) : null;
  return {
    street: parts[0] ?? null,
    city: parts.length >= 3 ? parts[parts.length - 2] : (parts[1] ?? null),
    state: stateZip?.[1] ?? null,
    zip: stateZip?.[2] ?? address.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] ?? null,
  };
}

export function buildLeadPayload(input: {
  lead: { id: string; createdAt: Date; name: string; phone: string; email: string; address: string | null; notes: string | null; preferredWindow: string | null; smsConsent: boolean; photos: string[]; total: number | null };
  quote: { id: string; result: QuoteResult; property: { source: string } } | null;
  business: { id: string; name: string; slug: string };
  leadUrl: string;
  priceText: string;
  photoUrls: string[];
}): LeadPayload {
  const { lead, quote, business } = input;
  return {
    event: "lead.created",
    lead: {
      id: lead.id,
      createdAt: lead.createdAt.toISOString(),
      name: lead.name,
      ...splitName(lead.name),
      phone: lead.phone,
      email: lead.email,
      address: lead.address,
      ...splitAddress(lead.address),
      notes: lead.notes,
      preferredWindow: lead.preferredWindow,
      smsConsent: lead.smsConsent,
      url: input.leadUrl,
      photos: input.photoUrls,
    },
    quote: {
      id: quote?.id ?? null,
      total: quote?.result.total ?? lead.total,
      priceText: input.priceText,
      displayMode: quote?.result.displayMode ?? null,
      needsOnsiteConfirmation: quote?.result.needsOnsiteConfirmation ?? false,
      services: (quote?.result.lines ?? []).map((l) => ({ id: l.serviceId, name: l.name, measure: l.measureLabel, total: l.total })),
      discount: quote?.result.discount ? { name: quote.result.discount.name, amount: quote.result.discount.amount } : null,
      sizeSource: quote?.property.source ?? null,
    },
    business,
  };
}

/** Flat key/value shape for GoHighLevel inbound webhooks and Zapier field mapping. */
export function flattenForGhl(p: LeadPayload): Record<string, string | number | boolean | null> {
  return {
    first_name: p.lead.firstName,
    last_name: p.lead.lastName,
    full_name: p.lead.name,
    email: p.lead.email,
    phone: p.lead.phone,
    address1: p.lead.street,
    city: p.lead.city,
    state: p.lead.state,
    postal_code: p.lead.zip,
    full_address: p.lead.address,
    quote_total: p.quote.total,
    quote_price_text: p.quote.priceText,
    quote_services: p.quote.services.map((s) => `${s.name} ($${s.total})`).join(", "),
    needs_onsite_confirmation: p.quote.needsOnsiteConfirmation,
    preferred_time: p.lead.preferredWindow,
    notes: p.lead.notes,
    sms_consent: p.lead.smsConsent,
    lead_url: p.lead.url,
    source: "ViewEstimate instant quote",
    lead_id: p.lead.id,
  };
}
