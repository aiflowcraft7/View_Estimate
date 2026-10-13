"use client";

import { useActionState } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { SERVICE_TEMPLATES } from "@/lib/pricing/templates";
import { createDemo, type DemoState } from "../actions";

export function DemoForm() {
  const [s, action, pending] = useActionState<DemoState, FormData>(createDemo, {});
  if (s.demoUrl) {
    return (
      <div className="space-y-4">
        <Notice tone="success">Demo created.</Notice>
        <Field label="Demo page (send this in outreach)">
          <Input readOnly value={s.demoUrl} onFocus={(e) => e.currentTarget.select()} />
        </Field>
        <Field label="Claim link (send when the owner says yes; works once)">
          <Input readOnly value={s.claimUrl} onFocus={(e) => e.currentTarget.select()} />
        </Field>
        <div className="flex gap-2">
          <a className="text-sm font-medium text-brand-700 underline" href={s.demoUrl} target="_blank" rel="noopener">
            Open demo
          </a>
          <a className="text-sm font-medium text-brand-700 underline" href={`/admin/b/${s.id}`}>
            Manage business
          </a>
          <a className="text-sm font-medium text-brand-700 underline" href="/admin/new">
            Create another
          </a>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name">
          <Input name="name" required placeholder="Tampa Bay Soft Wash" />
        </Field>
        <Field label="Website">
          <Input name="website" placeholder="tampabaysoftwash.com" />
        </Field>
        <Field label="Phone">
          <Input name="phone" />
        </Field>
        <Field label="Owner email for alerts (optional)">
          <Input name="alertEmail" type="email" />
        </Field>
        <Field label="Logo URL" hint="Or upload a file below.">
          <Input name="logoUrl" type="url" placeholder="https://…/logo.png" />
        </Field>
        <Field label="Logo file">
          <input type="file" name="logo" accept="image/*" className="mt-2 text-sm" />
        </Field>
        <Field label="Brand color">
          <input type="color" name="brandColor" defaultValue="#0f766e" className="mt-1 h-10 w-20 rounded" />
        </Field>
        <Field label="Price level vs. our templates" hint="1 = typical. 1.2 = 20% higher (match their published prices).">
          <Input name="priceFactor" type="number" step="0.05" min={0.3} max={3} defaultValue={1} />
        </Field>
      </div>
      <Field label="Headline">
        <Input name="headline" placeholder="Instant prices for house and roof washing in Tampa Bay" />
      </Field>
      <div>
        <p className="text-sm font-medium">Services</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {SERVICE_TEMPLATES.map((t) => (
            <label key={t.id} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="services" value={t.id} defaultChecked={["house_wash", "roof_wash", "driveway"].includes(t.id)} />
              {t.name}
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field label="Service area center (optional)">
          <Input name="centerText" placeholder="Tampa, FL" />
        </Field>
        <Field label="Radius (miles)">
          <Input name="radiusMiles" type="number" min={0} max={200} defaultValue={30} />
        </Field>
      </div>
      <Field label="ZIP codes (optional)">
        <Input name="zips" />
      </Field>
      {s.error && <Notice tone="error">{s.error}</Notice>}
      <Button disabled={pending}>{pending ? "Creating…" : "Create demo"}</Button>
    </form>
  );
}
