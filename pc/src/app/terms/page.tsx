import type { Metadata } from "next";
import Link from "next/link";
import { getEnv } from "@/server/env";
import LegalPage from "../components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using PlantGuard.",
};

/* Operators must have these reviewed for their own jurisdiction before launch. */
export default function TermsPage() {
  const { COMPANY_NAME: company, SUPPORT_EMAIL: email } = getEnv();
  const contact = email ? (
    <a href={`mailto:${email}`}>{email}</a>
  ) : (
    "the contact address published on this site"
  );

  return (
    <LegalPage title="Terms of Service" updated="24 September 2026">
      <p>
        These terms govern your use of PlantGuard, operated by {company}{" "}
        (&ldquo;we&rdquo;). By creating an account or using the service you
        agree to them. If you do not agree, do not use PlantGuard.
      </p>

      <h2>1. The service</h2>
      <p>
        PlantGuard analyses photographs of plant leaves to suggest possible
        diseases, estimate severity, and offer general care guidance. The
        analysis runs on your device; if you choose, results and photos are
        saved to your account. We may change, add or remove features over time.
      </p>

      <h2>2. Not professional advice</h2>
      <p>
        <strong>
          PlantGuard provides automated, informational guidance only. It can be
          wrong, and it is not a substitute for an agronomist, plant pathologist
          or agricultural extension officer.
        </strong>{" "}
        Diagnoses come from a machine-learning model trained on laboratory
        images, and severity estimates are approximate. Before acting on a
        result — especially before applying any pesticide, fungicide or other
        chemical — confirm the diagnosis with a qualified local expert and
        follow the product label and your local regulations. You are responsible
        for decisions you make about your crops.
      </p>

      <h2>3. Your account</h2>
      <ul>
        <li>
          Provide accurate information and keep your password secret. You are
          responsible for activity on your account.
        </li>
        <li>
          Tell us promptly at {contact} if you believe your account has been
          compromised.
        </li>
        <li>
          You must be at least 13 years old, or the minimum age required where
          you live, to create an account.
        </li>
      </ul>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          upload content you do not have the right to use, or that is unlawful;
        </li>
        <li>
          attempt to access other users&rsquo; data, probe or disrupt the
          service, or bypass its security or rate limits;
        </li>
        <li>
          use automated means to create accounts or to send large volumes of
          requests;
        </li>
        <li>use the service to harm others or to break the law.</li>
      </ul>

      <h2>5. Your content</h2>
      <p>
        You keep ownership of the photos, notes and other content you save. You
        give us permission to store, process and display that content only as
        needed to provide the service to you. You can delete it at any time —
        see our <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>6. Availability</h2>
      <p>
        We work to keep PlantGuard available and your data safe, but the service
        is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without
        warranties of any kind, including accuracy, fitness for a particular
        purpose, or uninterrupted operation. Keep your own records of anything
        important.
      </p>

      <h2>7. Limitation of liability</h2>
      <p>
        To the fullest extent the law allows, we are not liable for indirect,
        incidental or consequential losses — including crop loss, lost income,
        or losses arising from reliance on a diagnosis or recommendation —
        arising from your use of PlantGuard. Nothing in these terms excludes
        liability that cannot be excluded by law.
      </p>

      <h2>8. Suspension and termination</h2>
      <p>
        You may stop using PlantGuard and delete your account at any time from
        Settings. We may suspend or close accounts that breach these terms or
        put the service or other users at risk.
      </p>

      <h2>9. Changes to these terms</h2>
      <p>
        We may update these terms. If a change is material, we will update the
        date above and notify signed-in users before it takes effect. Continuing
        to use PlantGuard after that means you accept the new terms.
      </p>

      <h2>10. Contact</h2>
      <p>Questions about these terms: {contact}.</p>
    </LegalPage>
  );
}
