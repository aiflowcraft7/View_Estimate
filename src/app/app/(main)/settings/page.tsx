import { Card, PageHeader } from "@/components/ui";
import { requireBusiness } from "@/lib/auth";
import { env } from "@/lib/env";
import { smsLive } from "@/lib/messaging/sms";
import { AlertsForm, AreaForm, ProfileForm } from "./Forms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { business: b, user } = await requireBusiness();
  const data = {
    name: b.name,
    phone: b.phone,
    website: b.website,
    headline: b.headline,
    timezone: b.timezone,
    brandColor: b.brandColor,
    logoUrl: b.logoUrl,
    alertEmail: b.alertEmail,
    alertPhone: b.alertPhone,
    smsAlertsEnabled: b.smsAlertsEnabled,
    zips: (b.serviceArea.zips ?? []).join(", "),
    centerLabel: b.serviceArea.center?.label ?? "",
    radiusMiles: b.serviceArea.radiusMiles ?? 0,
  };
  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 font-semibold">Business and branding</h2>
          <ProfileForm b={data} />
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Lead alerts</h2>
          <AlertsForm b={data} smsLive={smsLive()} />
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Service area</h2>
          <AreaForm b={data} />
        </Card>
        <Card>
          <h2 className="font-semibold">Account</h2>
          <p className="mt-1 text-sm text-zinc-600">Signed in as {user.email}.</p>
          <p className="mt-1 text-sm text-zinc-600">
            To delete your account and all lead data, email <a className="text-brand-700 underline" href={`mailto:${env.supportEmail}`}>{env.supportEmail}</a>.
          </p>
          <form action="/logout" method="post" className="mt-3">
            <button className="text-sm font-medium text-zinc-700 underline">Sign out</button>
          </form>
        </Card>
      </div>
    </>
  );
}
