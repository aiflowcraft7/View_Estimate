/** Pricing types shared by the engine, the pricing builder, the widget and the server. */

export type PricingUnit =
  | "house_sqft" // house footprint sq ft x rate x story multiplier
  | "living_sqft" // living sq ft (footprint x stories, or what the homeowner typed) x rate
  | "roof_sqft" // roof surface sq ft x rate x pitch multiplier
  | "flat_sqft" // driveway/patio sq ft chosen by the homeowner x rate
  | "window" // window count x rate, or window count bands
  | "gutter_lf" // footprint perimeter x gutter factor x rate x story multiplier
  | "flat" // one fixed price
  | "band"; // tiered price by living sq ft bands

export type Band = { upTo: number; price: number }; // upTo inclusive; last band may use upTo = Infinity-like large value

export type SizeOption = { id: string; label: string; sqft: number };

export type PitchStep = { minDegrees: number; multiplier: number };

export type Addon = {
  id: string;
  name: string;
  /** flat = one fixed price; per_unit = price x the service quantity (per window, per sq ft...) */
  unit: "flat" | "per_unit";
  price: number;
};

export const SIDING_TYPES = ["vinyl", "brick", "hardie", "stucco"] as const;
export type SidingType = (typeof SIDING_TYPES)[number];

export const SIDING_LABELS: Record<SidingType, string> = {
  vinyl: "Vinyl",
  brick: "Brick",
  hardie: "Hardie board",
  stucco: "Stucco",
};

export type ConfirmOnsiteRules = {
  /** Above this many stories, the price must be confirmed on site. */
  maxStories?: number;
  /** Above this living sq ft, the price must be confirmed on site. */
  maxLivingSqft?: number;
  /** When true, any manual size override forces on-site confirmation. */
  onManualSize?: boolean;
  /** Siding types that cannot be priced exactly, e.g. ["stucco"]. */
  sidingOnsite?: SidingType[];
  /** Visible organic staining is confirmed on site. */
  onStaining?: boolean;
  /** Gutters that have not been cleaned in years are confirmed on site. */
  onNeglectedGutters?: boolean;
};

export type ServiceConfig = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  active?: boolean;
  unit: PricingUnit;
  /** Price per unit (per sq ft, per window, per linear ft) or the flat price. */
  rate: number;
  /** Minimum price for this service. */
  minPrice?: number;
  /** Multiplier by story count, e.g. { "1": 1, "2": 1.25, "3": 1.6 } */
  storyMultipliers?: Record<string, number>;
  /** Roof pitch steps, highest matching minDegrees wins. */
  pitchSteps?: PitchStep[];
  /** gutter_lf: gutter length = perimeter x factor (default 1). */
  gutterFactor?: number;
  /** band unit, and optional window bands */
  bands?: Band[];
  /** flat_sqft: size choices shown to the homeowner */
  sizeOptions?: SizeOption[];
  /** window: count choices shown to the homeowner; defaults to free entry */
  addons?: Addon[];
  confirmOnsite?: ConfirmOnsiteRules;
};

export type Bundle = {
  id: string;
  name: string;
  /** Applies when at least this many services are selected. */
  minServices?: number;
  /** Applies when all these services are selected. */
  serviceIds?: string[];
  type: "pct" | "amount";
  value: number;
};

export type PricingRules = {
  orderMinimum?: number;
  /** Round the total to the nearest step, e.g. 5 = nearest $5. 0 or undefined = nearest $1. */
  roundTo?: number;
  displayMode?: "exact" | "range";
  /** Range width as a fraction, e.g. 0.1 = +/-10% */
  rangePct?: number;
};

export type PricingConfig = {
  services: ServiceConfig[];
  bundles?: Bundle[];
  rules?: PricingRules;
};

export type SizeSource = "solar" | "manual" | "band" | "none";

export type PropertyFacts = {
  footprintSqft?: number | null;
  roofSqft?: number | null;
  perimeterFt?: number | null;
  roofPitchDegrees?: number | null;
  /** Living sq ft typed or confirmed by the homeowner. Falls back to footprint x stories. */
  livingSqft?: number | null;
  stories: number;
  source: SizeSource;
  siding?: SidingType | null;
  /** Homeowner reported green or black organic staining. */
  staining?: boolean;
  /** Homeowner said the gutters have not been cleaned in years. */
  neglectedGutters?: boolean;
};

export type ServiceSelection = {
  serviceId: string;
  /** flat_sqft: chosen size option id */
  sizeOptionId?: string;
  /** window count or custom sq ft */
  quantity?: number;
  addons?: { id: string; quantity?: number }[];
};

export type QuoteLine = {
  serviceId: string;
  name: string;
  unit: PricingUnit;
  measure: number;
  measureLabel: string;
  base: number;
  addons: { id: string; name: string; amount: number }[];
  minimumApplied: boolean;
  total: number;
  confirmOnsite: boolean;
  notes: string[];
};

export type QuoteResult = {
  lines: QuoteLine[];
  subtotal: number;
  discount: { bundleId: string; name: string; amount: number } | null;
  orderMinimumApplied: boolean;
  total: number;
  displayMode: "exact" | "range";
  range: { low: number; high: number } | null;
  needsOnsiteConfirmation: boolean;
  /** Hint like "Add 1 more service to save 10%" */
  bundleNudge: { name: string; servicesNeeded: number; label: string } | null;
  errors: string[];
};
