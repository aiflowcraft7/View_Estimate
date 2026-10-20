import { LegalPage } from "@/components/legal";
import { env } from "@/lib/env";

export const metadata = { title: "Terms of Service" };

export default function Terms() {
  const n = env.legalName;
  return (
    <LegalPage title="Terms of Service" updated="October 13, 2026">
      <p>These terms are an agreement between {n} and the business that signs up (&quot;you&quot;). By creating an account you accept them.</p>
      <h2>The service</h2>
      <p>We provide a quote form, hosted page and tools that show homeowners prices you configure, and deliver their requests to you.</p>
      <h2>Your prices and your leads</h2>
      <ul>
        <li>You set all prices and rules. Prices shown are estimates based on your settings and on property data that may be incomplete or inaccurate. You are responsible for confirming the final price with the homeowner. We are not liable for pricing errors or lost jobs.</li>
        <li>You own the leads you receive. We process homeowner data on your behalf to provide the service, as described in our Privacy Policy, and you agree to use it lawfully.</li>
        <li>You are responsible for your own communications with homeowners, including compliance with the TCPA and other messaging laws when you contact them.</li>
      </ul>
      <h2>Acceptable use</h2>
      <p>Don&apos;t misuse the service: no unlawful, deceptive or spam content, no attempts to break security, no reselling without our written permission.</p>
      <h2>Free trial, billing and cancellation</h2>
      <ul>
        <li>New accounts start free: the first 3 leads are included, and prices stay on until the 3rd lead or 45 days after you claim the page, whichever comes first. After that, pick a paid plan. Plans renew monthly or yearly until canceled.</li>
        <li>Payments are processed by Paddle.com, our merchant of record, which also handles sales tax, invoices and refunds under its buyer terms.</li>
        <li>You can cancel anytime from the billing page. Service continues to the end of the paid period. If payment stops, your quote form keeps collecting requests without showing prices.</li>
      </ul>
      <h2>Done-for-you setup</h2>
      <p>If you ask us to set up or install the service, you authorize us to configure your account and, where you give us access, your website. You review and approve your prices.</p>
      <h2>Availability</h2>
      <p>We work to keep the service available but don&apos;t guarantee it will be uninterrupted. Third-party services (maps, texting, email, CRMs) may change or fail.</p>
      <h2>Limitation of liability</h2>
      <p>
        To the extent the law allows, the service is provided &quot;as is&quot;, and our total liability for any claim is limited to the amount you paid us in the 3 months before the claim. We are not liable for indirect or consequential damages, including lost profits.
      </p>
      <h2>Termination</h2>
      <p>You may stop using the service at any time. We may suspend accounts that breach these terms. On request we will export or delete your data.</p>
      <h2>Changes and contact</h2>
      <p>
        We may update these terms and will notify you of material changes. Questions: <a className="underline" href={`mailto:${env.supportEmail}`}>{env.supportEmail}</a>.
      </p>
    </LegalPage>
  );
}
