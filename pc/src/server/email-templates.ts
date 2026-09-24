import type { EmailMessage } from "./email";

/**
 * Transactional email content.
 *
 * Table layout and inline styles because that is what email clients render
 * reliably. Every user-supplied value is HTML-escaped: a display name is free
 * text, and an unescaped one would let anyone inject markup into mail sent
 * from this domain.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface LayoutInput {
  to: string;
  subject: string;
  preheader: string;
  heading: string;
  paragraphs: string[];
  action: { label: string; url: string };
  footnote: string;
  appName: string;
}

function render(input: LayoutInput): EmailMessage {
  const { action } = input;
  const safeUrl = escapeHtml(action.url);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f8f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111b15;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8f6;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #d6ded8;border-radius:16px;">
<tr><td style="padding:28px 32px 8px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:28px;height:28px;background:#12805c;border-radius:8px;text-align:center;color:#ffffff;font-size:15px;font-weight:700;">&#10047;</td>
<td style="padding-left:10px;font-weight:650;font-size:15px;">${escapeHtml(input.appName)}</td>
</tr></table>
</td></tr>
<tr><td style="padding:16px 32px 0;">
<h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;font-weight:650;">${escapeHtml(input.heading)}</h1>
${input.paragraphs
  .map(
    (text) =>
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#4a5a50;">${escapeHtml(text)}</p>`,
  )
  .join("\n")}
</td></tr>
<tr><td style="padding:8px 32px 24px;">
<a href="${safeUrl}" style="display:inline-block;background:#12805c;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:999px;">${escapeHtml(action.label)}</a>
</td></tr>
<tr><td style="padding:0 32px 28px;">
<p style="margin:0;font-size:12.5px;line-height:1.5;color:#71857a;">If the button does not work, paste this link into your browser:<br><a href="${safeUrl}" style="color:#12805c;word-break:break-all;">${safeUrl}</a></p>
</td></tr>
<tr><td style="padding:16px 32px 24px;border-top:1px solid #e2e9e3;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#71857a;">${escapeHtml(input.footnote)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    input.heading,
    "",
    ...input.paragraphs.flatMap((p) => [p, ""]),
    `${action.label}: ${action.url}`,
    "",
    "—",
    input.footnote,
  ].join("\n");

  return { to: input.to, subject: input.subject, html, text };
}

function greeting(name: string | null | undefined): string {
  const first = name?.trim().split(/\s+/)[0];
  return first ? `Hi ${first},` : "Hi,";
}

export function verificationEmail(args: {
  to: string;
  name?: string | null;
  url: string;
  appName: string;
}): EmailMessage {
  return render({
    to: args.to,
    appName: args.appName,
    subject: `Confirm your email for ${args.appName}`,
    preheader: "One click to finish setting up your account.",
    heading: "Confirm your email address",
    paragraphs: [
      greeting(args.name),
      `Confirm this address to finish creating your ${args.appName} account. The link expires in 24 hours.`,
    ],
    action: { label: "Confirm email", url: args.url },
    footnote:
      "If you did not create an account, you can ignore this email — nothing will happen.",
  });
}

export function passwordResetEmail(args: {
  to: string;
  name?: string | null;
  url: string;
  appName: string;
}): EmailMessage {
  return render({
    to: args.to,
    appName: args.appName,
    subject: `Reset your ${args.appName} password`,
    preheader: "A link to choose a new password.",
    heading: "Reset your password",
    paragraphs: [
      greeting(args.name),
      "Someone asked to reset the password for this account. If it was you, choose a new password below. The link expires in one hour and can be used once.",
      "Resetting signs you out on every other device.",
    ],
    action: { label: "Choose a new password", url: args.url },
    footnote:
      "If you did not ask for this, ignore this email. Your password stays the same.",
  });
}

export function changeEmailConfirmation(args: {
  to: string;
  name?: string | null;
  newEmail: string;
  url: string;
  appName: string;
}): EmailMessage {
  return render({
    to: args.to,
    appName: args.appName,
    subject: `Confirm your new email for ${args.appName}`,
    preheader: `Approve the change to ${args.newEmail}.`,
    heading: "Approve your email change",
    paragraphs: [
      greeting(args.name),
      `Your account's email address is being changed to ${args.newEmail}. Approve the change to continue; you will then confirm the new address from its own inbox.`,
    ],
    action: { label: "Approve change", url: args.url },
    footnote:
      "If you did not request this, do not click the link, and change your password.",
  });
}
