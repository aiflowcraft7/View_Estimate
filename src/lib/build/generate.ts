import "server-only";
import { digWebsite } from "@/lib/build/dig-website";
import { DEFAULT_BRAND_COLOR, DEFAULT_SERVICE_IDS } from "@/lib/build/parse-website";
import { createDemoBusiness } from "@/lib/business";
import { parseZips } from "@/lib/geocode";
import { SERVICE_TEMPLATES } from "@/lib/pricing/templates";

export type GenerateFromWebsiteInput = { website: string };
export type GenerateFromAnswersInput = {
  name: string;
  serviceIds: string[];
  zips?: string;
  alertEmail?: string;
};

export type GenerateOk = {
  ok: true;
  slug: string;
  claimToken: string;
  name: string;
};
export type GenerateErr = { ok: false; error: string; needsQuestions?: boolean };
export type GenerateResult = GenerateOk | GenerateErr;

const validServiceIds = () => new Set(SERVICE_TEMPLATES.map((s) => s.id));

function pickServices(ids: string[] | undefined): string[] {
  const valid = validServiceIds();
  const picked = (ids ?? []).filter((id) => valid.has(id));
  return picked.length ? picked : [...DEFAULT_SERVICE_IDS];
}

export async function generateFromWebsite(input: GenerateFromWebsiteInput): Promise<GenerateResult> {
  try {
    const dig = await digWebsite(input.website);
    const { business, claimToken } = await createDemoBusiness({
      name: dig.name,
      website: dig.website,
      phone: dig.phone,
      alertEmail: dig.alertEmail,
      brandColor: dig.brandColor || DEFAULT_BRAND_COLOR,
      serviceIds: pickServices(dig.serviceIds),
      serviceArea: dig.zips.length ? { zips: dig.zips } : {},
      createdByAdmin: false,
    });
    return { ok: true, slug: business.slug, claimToken, name: business.name };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "We couldn't build from that website";
    const needsQuestions =
      /couldn't find your business name|couldn't reach|couldn't read|not allowed|valid website/i.test(msg);
    return { ok: false, error: msg, needsQuestions };
  }
}

export async function generateFromAnswers(input: GenerateFromAnswersInput): Promise<GenerateResult> {
  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: "Enter your business name" };
  const serviceIds = pickServices(input.serviceIds);
  if (!serviceIds.length) return { ok: false, error: "Pick at least one service" };
  const email = input.alertEmail?.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email" };
  const zips = parseZips(input.zips ?? "");
  const { business, claimToken } = await createDemoBusiness({
    name,
    alertEmail: email || null,
    brandColor: DEFAULT_BRAND_COLOR,
    serviceIds,
    serviceArea: zips.length ? { zips } : {},
    createdByAdmin: false,
  });
  return { ok: true, slug: business.slug, claimToken, name: business.name };
}
