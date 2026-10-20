import { LegalPage } from "@/components/legal";
import { env } from "@/lib/env";

export const metadata = { title: "Privacy Policy" };

export default function Privacy() {
  const n = env.legalName;
  return (
    <LegalPage title="Privacy Policy" updated="October 13, 2026">
      <p>
        {n} (&quot;we&quot;) provides instant-quote software to exterior cleaning companies (&quot;Businesses&quot;). This policy explains what we collect from Businesses and from homeowners who use a Business&apos;s quote form, and how we use it.
      </p>
      <h2>Information we collect</h2>
      <ul>
        <li>From homeowners: property address, home size answers, selected services, name, phone, email, notes, optional photos, preferred time, and, if you agree, consent to receive text messages (with the consent wording, time and IP address).</li>
        <li>From Businesses: account email, business details, prices, alert contacts and billing status. Payment card details are handled by our payment provider, Paddle, and never reach us.</li>
        <li>Usage data: pages and steps reached in the quote form, without cookies or cross-site tracking. Server logs include IP addresses for security and abuse prevention.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To calculate a price, send the request to the Business you asked for a quote, and email you a summary.</li>
        <li>To alert the Business by email and text message and, if they connected one, send the request to their CRM.</li>
        <li>To operate, secure and improve the service, and to bill Businesses.</li>
      </ul>
      <h2>Who processes it for us</h2>
      <p>
        We use service providers to run the service: Supabase (database and file storage), Clerk (Business sign-in), Vercel (hosting), Google Maps Platform (address lookup and building size), Twilio (text messages), Resend (email), Paddle (payments), Cloudflare (bot protection) and Sentry (error monitoring). They process data only on our instructions.
      </p>
      <h2>Text messages</h2>
      <p>
        <b>We do not sell, rent or share mobile phone numbers or text message opt-in data with third parties or affiliates for their marketing purposes.</b> Mobile information is only used to send the messages you agreed to. Reply STOP to opt out at any time. See our <a className="underline" href="/sms-terms">SMS terms</a>.
      </p>
      <h2>Homeowner requests belong to the Business</h2>
      <p>When you request a quote, the Business you contacted receives your details and handles them under its own privacy practices. We process that data on the Business&apos;s behalf.</p>
      <h2>Retention and deletion</h2>
      <p>
        We keep quote and lead data while the Business&apos;s account is active and delete it within 90 days after the account closes, unless the law requires otherwise. You can ask us to access or delete your data at any time by emailing <a className="underline" href={`mailto:${env.supportEmail}`}>{env.supportEmail}</a>. We honor deletion requests from any US resident, including under California law (CCPA/CPRA).
      </p>
      <h2>Security</h2>
      <p>Data is encrypted in transit. Photos are stored privately and shared through short-lived links. Connected-app credentials are encrypted at rest.</p>
      <h2>Children</h2>
      <p>The service is not directed to children under 13 and we do not knowingly collect their information.</p>
      <h2>Changes and contact</h2>
      <p>
        We will post any changes here. Questions: <a className="underline" href={`mailto:${env.supportEmail}`}>{env.supportEmail}</a>.
      </p>
    </LegalPage>
  );
}
