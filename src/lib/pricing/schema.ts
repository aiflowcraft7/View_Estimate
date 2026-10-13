import { z } from "zod";

const id = z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/i, "Use letters, numbers, - or _");
const nonneg = z.number().finite().min(0);

export const addonSchema = z.object({
  id,
  name: z.string().min(1).max(80),
  unit: z.enum(["flat", "per_unit"]),
  price: nonneg.max(100000),
});

export const serviceSchema = z.object({
  id,
  name: z.string().min(1).max(80),
  description: z.string().max(200).optional(),
  icon: z.string().max(32).optional(),
  active: z.boolean().optional(),
  unit: z.enum(["house_sqft", "living_sqft", "roof_sqft", "flat_sqft", "window", "gutter_lf", "flat", "band"]),
  rate: nonneg.max(100000),
  minPrice: nonneg.max(100000).optional(),
  storyMultipliers: z.record(z.string().regex(/^[1-9]$/), z.number().min(0.1).max(10)).optional(),
  pitchSteps: z.array(z.object({ minDegrees: z.number().min(0).max(90), multiplier: z.number().min(0.1).max(10) })).max(10).optional(),
  gutterFactor: z.number().min(0.1).max(5).optional(),
  bands: z.array(z.object({ upTo: z.number().positive(), price: nonneg.max(100000) })).max(30).optional(),
  sizeOptions: z.array(z.object({ id, label: z.string().min(1).max(80), sqft: z.number().positive().max(100000) })).max(20).optional(),
  addons: z.array(addonSchema).max(20).optional(),
  confirmOnsite: z
    .object({
      maxStories: z.number().int().min(1).max(10).optional(),
      maxLivingSqft: z.number().positive().optional(),
      onManualSize: z.boolean().optional(),
    })
    .optional(),
});

export const bundleSchema = z.object({
  id,
  name: z.string().min(1).max(80),
  minServices: z.number().int().min(2).max(20).optional(),
  serviceIds: z.array(id).max(20).optional(),
  type: z.enum(["pct", "amount"]),
  value: nonneg.max(100000),
});

export const rulesSchema = z.object({
  orderMinimum: nonneg.max(100000).optional(),
  roundTo: z.number().int().min(0).max(100).optional(),
  displayMode: z.enum(["exact", "range"]).optional(),
  rangePct: z.number().min(0).max(0.5).optional(),
});

export const pricingConfigSchema = z
  .object({
    services: z.array(serviceSchema).max(40),
    bundles: z.array(bundleSchema).max(20).optional(),
    rules: rulesSchema.optional(),
  })
  .superRefine((cfg, ctx) => {
    const ids = new Set<string>();
    for (const s of cfg.services) {
      if (ids.has(s.id)) ctx.addIssue({ code: "custom", message: `Duplicate service id ${s.id}` });
      ids.add(s.id);
      if (s.unit === "flat_sqft" && !s.sizeOptions?.length)
        ctx.addIssue({ code: "custom", message: `${s.name}: add at least one size option` });
      if (s.unit === "band" && !s.bands?.length) ctx.addIssue({ code: "custom", message: `${s.name}: add at least one size band` });
    }
  });

export const propertySchema = z.object({
  footprintSqft: z.number().nonnegative().max(200000).nullable().optional(),
  roofSqft: z.number().nonnegative().max(400000).nullable().optional(),
  perimeterFt: z.number().nonnegative().max(20000).nullable().optional(),
  roofPitchDegrees: z.number().min(0).max(90).nullable().optional(),
  livingSqft: z.number().nonnegative().max(200000).nullable().optional(),
  stories: z.number().int().min(1).max(10),
  source: z.enum(["solar", "manual", "band", "none"]),
});

export const selectionsSchema = z
  .array(
    z.object({
      serviceId: id,
      sizeOptionId: id.optional(),
      quantity: z.number().nonnegative().max(100000).optional(),
      addons: z.array(z.object({ id, quantity: z.number().nonnegative().max(100000).optional() })).max(20).optional(),
    }),
  )
  .min(1)
  .max(20);
