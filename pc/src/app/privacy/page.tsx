import type { Metadata } from "next";
import Link from "next/link";
import { getEnv } from "@/server/env";
import LegalPage from "../components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What PlantGuard collects, why, and how to download or delete it.",
};

/*
 * Written to match what the code actually does — change both together.
 * Operators must have this reviewed for their own jurisdiction before launch.
 */
export default function PrivacyPage() {
  const { COMPANY_NAME: company, SUPPORT_EMAIL: email } = getEnv();
  const contact = email ? (
    <a href={`mailto:${email}`}>{email}</a>
  ) : (
    "the contact address published on this site"
  );

  return (
    <LegalPage title="Privacy Policy" updated="24 September 2026">
      <p>
        This policy explains what {company} (&ldquo;we&rdquo;) collects when you
        use PlantGuard, why, and the choices you have. The short version: leaf
        photos are analysed on your own device, we store only what you choose to
        save, we never sell your data, and you can download or delete it at any
        time.
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li>
          <strong>Account details</strong> — your name and email address, and
          your password stored as a salted, one-way hash (we cannot read it). If
          you sign in with Google or GitHub, we receive your name, email address
          and an account identifier from that provider.
        </li>
        <li>
          <strong>Saved scans</strong> — for each scan you save: the diagnosis,
          confidence scores, severity estimate, the heatmap data behind them,
          the model version, and any label or notes you add. If &ldquo;Keep
          photos with saved scans&rdquo; is on, a compressed copy of the photo
          is stored too; it is re-encoded in your browser first, which removes
          embedded metadata such as GPS location.
        </li>
        <li>
          <strong>Sign-in sessions</strong> — for each device you are signed in
          on: when the session started, when it was last used, its IP address
          and browser type. You can see and end these in Settings.
        </li>
        <li>
          <strong>Preferences</strong> — your language, theme and scanning
          preferences.
        </li>
        <li>
          <strong>Operational logs</strong> — our servers record requests and
          errors (including IP addresses) to keep the service secure and
          working.
        </li>
      </ul>
      <p>
        Photos you analyse but do not save never leave your device. We do not
        use advertising, analytics or tracking scripts.
      </p>

      <h2>2. Why we use it</h2>
      <ul>
        <li>
          To provide the service: signing you in, and storing and showing your
          scan history.
        </li>
        <li>
          To keep accounts secure: verifying email addresses, limiting repeated
          sign-in attempts, and letting you review active sessions.
        </li>
        <li>
          To send essential emails: address confirmation, password resets and
          email-change approvals. We do not send marketing email.
        </li>
      </ul>
      <p>
        We do not sell your data, and we do not use your photos or scans to
        train models without your explicit consent.
      </p>

      <h2>3. Cookies</h2>
      <p>
        We use only cookies the service needs: a session cookie that keeps you
        signed in, a short-lived signed copy of your session to reduce database
        lookups, and a cookie that remembers your chosen language. Your theme
        choice is kept in your browser&rsquo;s local storage. There are no
        third-party cookies.
      </p>

      <h2>4. Who else processes it</h2>
      <p>
        We rely on a small number of service providers to run PlantGuard — our
        hosting and database providers, our email delivery provider, and, only
        if you use them to sign in, Google or GitHub. They process data on our
        behalf and only as needed to provide their service.
      </p>

      <h2>5. How long we keep it</h2>
      <p>
        We keep your account and saved scans until you delete them. Deleting a
        scan removes it and its photo immediately; deleting your account removes
        your profile, sessions and every scan and photo. Copies in encrypted
        backups expire on their normal rotation. Expired sessions and
        verification links are deleted automatically.
      </p>

      <h2>6. Your choices and rights</h2>
      <ul>
        <li>
          <strong>Access and portability</strong> — download everything we store
          about you from <Link href="/settings">Settings</Link> as a JSON file.
        </li>
        <li>
          <strong>Correction</strong> — change your name, email or password in
          Settings.
        </li>
        <li>
          <strong>Deletion</strong> — delete individual scans, all scans, or
          your whole account in Settings.
        </li>
        <li>
          <strong>Photo storage</strong> — turn &ldquo;Keep photos with saved
          scans&rdquo; off to store results only.
        </li>
      </ul>
      <p>
        Depending on where you live, you may have further rights. Contact us at{" "}
        {contact} to exercise them.
      </p>

      <h2>7. Security</h2>
      <p>
        Traffic is encrypted in transit, passwords are hashed, access to every
        scan is checked against your session on each request, and repeated
        sign-in attempts are rate limited. No system is perfectly secure; if we
        learn of a breach affecting your data we will notify you as the law
        requires.
      </p>

      <h2>8. Children</h2>
      <p>
        PlantGuard is not directed at children under 13, and we do not knowingly
        collect their data.
      </p>

      <h2>9. Changes</h2>
      <p>
        If we change this policy in a meaningful way, we will update the date
        above and tell signed-in users before the change takes effect.
      </p>

      <h2>10. Contact</h2>
      <p>Questions about privacy: {contact}.</p>
    </LegalPage>
  );
}
