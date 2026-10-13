import { LegalPage } from "@/components/legal";
import { env } from "@/lib/env";

export const metadata = { title: "SMS Terms" };

export default function SmsTerms() {
  return (
    <LegalPage title="SMS Terms" updated="October 13, 2026">
      <h2>Program</h2>
      <p>
        {env.appName} sends transactional text messages: new-lead alerts to businesses that turn them on, and, when a homeowner checks the consent box on a quote form, messages about their quote and booking from the business they contacted. We do not send marketing texts.
      </p>
      <h2>Consent</h2>
      <p>Homeowners opt in by checking an unticked box on the quote form. Businesses opt in to lead alerts in their settings. Consent is not a condition of purchase.</p>
      <h2>Frequency and cost</h2>
      <p>Message frequency varies with your activity. Message and data rates may apply.</p>
      <h2>Opt out and help</h2>
      <p>
        Reply <b>STOP</b> to any message to stop receiving texts. Reply <b>HELP</b> for help, or email <a className="underline" href={`mailto:${env.supportEmail}`}>{env.supportEmail}</a>.
      </p>
      <h2>Privacy</h2>
      <p>
        We do not sell or share mobile numbers or opt-in data with third parties for marketing. See our <a className="underline" href="/privacy">Privacy Policy</a>.
      </p>
      <p>Carriers are not liable for delayed or undelivered messages.</p>
    </LegalPage>
  );
}
