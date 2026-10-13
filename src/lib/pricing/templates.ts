import type { PricingConfig, ServiceConfig } from "./types";

/**
 * Starter price templates. Owners pick the services they offer during
 * onboarding and adjust the numbers in the pricing builder.
 * Prices are typical US mid-market rates and are meant to be edited.
 */
export const SERVICE_TEMPLATES: ServiceConfig[] = [
  {
    id: "house_wash",
    name: "House wash",
    description: "Soft wash of siding, trim and soffits",
    icon: "home",
    unit: "house_sqft",
    rate: 0.22,
    minPrice: 249,
    storyMultipliers: { "1": 1, "2": 1.6, "3": 2.1 },
    confirmOnsite: { maxStories: 3, maxLivingSqft: 6000 },
    addons: [
      { id: "rust_removal", name: "Rust stain removal", unit: "flat", price: 75 },
      { id: "fence", name: "Fence wash", unit: "flat", price: 125 },
    ],
  },
  {
    id: "roof_wash",
    name: "Roof soft wash",
    description: "Removes black streaks, moss and algae",
    icon: "roof",
    unit: "roof_sqft",
    rate: 0.35,
    minPrice: 399,
    storyMultipliers: { "1": 1, "2": 1.1, "3": 1.25 },
    pitchSteps: [
      { minDegrees: 30, multiplier: 1.15 },
      { minDegrees: 40, multiplier: 1.3 },
    ],
    confirmOnsite: { maxStories: 3, maxLivingSqft: 6000 },
  },
  {
    id: "driveway",
    name: "Driveway cleaning",
    description: "Surface cleaning of concrete or pavers",
    icon: "driveway",
    unit: "flat_sqft",
    rate: 0.2,
    minPrice: 149,
    sizeOptions: [
      { id: "one_car", label: "1-car driveway (about 400 sq ft)", sqft: 400 },
      { id: "two_car", label: "2-car driveway (about 600 sq ft)", sqft: 600 },
      { id: "three_car", label: "3-car driveway (about 900 sq ft)", sqft: 900 },
      { id: "large", label: "Large or long driveway (about 1,400 sq ft)", sqft: 1400 },
    ],
    addons: [
      { id: "sidewalk", name: "Front sidewalk", unit: "flat", price: 49 },
      { id: "sealing", name: "Sealing", unit: "per_unit", price: 0.6 },
    ],
  },
  {
    id: "patio",
    name: "Patio and pool deck",
    description: "Concrete, pavers or stone",
    icon: "patio",
    unit: "flat_sqft",
    rate: 0.25,
    minPrice: 149,
    sizeOptions: [
      { id: "small", label: "Small patio (about 200 sq ft)", sqft: 200 },
      { id: "medium", label: "Medium patio (about 450 sq ft)", sqft: 450 },
      { id: "large", label: "Large patio or pool deck (about 800 sq ft)", sqft: 800 },
    ],
  },
  {
    id: "windows",
    name: "Window cleaning",
    description: "Exterior glass, frames and sills",
    icon: "window",
    unit: "window",
    rate: 8,
    minPrice: 199,
    storyMultipliers: { "1": 1, "2": 1.2, "3": 1.4 },
    addons: [
      { id: "screens", name: "Screen cleaning", unit: "per_unit", price: 3 },
      { id: "inside", name: "Inside glass", unit: "per_unit", price: 5 },
    ],
  },
  {
    id: "gutter_cleaning",
    name: "Gutter cleaning",
    description: "Clear gutters and flush downspouts",
    icon: "gutter",
    unit: "gutter_lf",
    rate: 1.25,
    gutterFactor: 0.9,
    minPrice: 149,
    storyMultipliers: { "1": 1, "2": 1.25, "3": 1.6 },
    confirmOnsite: { maxStories: 3 },
  },
  {
    id: "gutter_brightening",
    name: "Gutter brightening",
    description: "Removes black tiger stripes from gutter faces",
    icon: "sparkle",
    unit: "gutter_lf",
    rate: 1.5,
    gutterFactor: 0.9,
    minPrice: 199,
    storyMultipliers: { "1": 1, "2": 1.2, "3": 1.5 },
  },
];

export const DEFAULT_PRICING: PricingConfig = {
  services: SERVICE_TEMPLATES,
  bundles: [
    { id: "two_plus", name: "Bundle discount", minServices: 2, type: "pct", value: 10 },
    { id: "three_plus", name: "Bundle discount", minServices: 3, type: "pct", value: 15 },
  ],
  rules: { orderMinimum: 199, roundTo: 5, displayMode: "exact", rangePct: 0.1 },
};

export function templateFor(ids: string[]): PricingConfig {
  return {
    ...DEFAULT_PRICING,
    services: SERVICE_TEMPLATES.filter((s) => ids.includes(s.id)).map((s) => structuredClone(s)),
  };
}

export const HOME_SIZE_BANDS = [
  { id: "under_1500", label: "Under 1,500 sq ft", sqft: 1200 },
  { id: "1500_2500", label: "1,500 to 2,500 sq ft", sqft: 2000 },
  { id: "2500_3500", label: "2,500 to 3,500 sq ft", sqft: 3000 },
  { id: "3500_5000", label: "3,500 to 5,000 sq ft", sqft: 4200 },
  { id: "over_5000", label: "Over 5,000 sq ft", sqft: 5800 },
];
