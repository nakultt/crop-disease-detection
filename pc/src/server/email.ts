import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { type Env, getEnv } from "./env";
import { logger } from "./logger";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Outbound mail.
 *
 * Three transports, chosen by configuration:
 * - `smtp`    — real delivery (`SMTP_URL`, or `SMTP_HOST` and friends). Works
 *               with any provider that speaks SMTP: Resend, SES, Postmark,
 *               Mailgun, SendGrid, or your own server.
 * - `file`    — each message written as JSON to `MAIL_OUTBOX_DIR`. The
 *               end-to-end tests read verification links from here.
 * - `console` — the message, links included, printed to the server log, so
 *               a fresh clone can complete sign-up with no mail setup at all.
 */

let transporter: Transporter | null = null;

function smtpTransport(env: Env): Transporter {
  if (transporter) return transporter;
  transporter = env.SMTP_URL
    ? nodemailer.createTransport(env.SMTP_URL)
    : nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT ?? 587,
        secure: env.SMTP_SECURE ?? env.SMTP_PORT === 465,
        auth: env.SMTP_USER
          ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? "" }
          : undefined,
      });
  return transporter;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const env = getEnv();

  switch (env.emailTransport) {
    case "smtp": {
      await smtpTransport(env).sendMail({ from: env.EMAIL_FROM, ...message });
      logger.info("Email sent", { subject: message.subject });
      return;
    }
    case "file": {
      const dir = path.resolve(env.MAIL_OUTBOX_DIR as string);
      await mkdir(dir, { recursive: true });
      const file = path.join(dir, `${Date.now()}-${randomUUID()}.json`);
      await writeFile(
        file,
        JSON.stringify(
          { from: env.EMAIL_FROM, date: new Date().toISOString(), ...message },
          null,
          2,
        ),
      );
      logger.info("Email written to outbox", {
        subject: message.subject,
        file,
      });
      return;
    }
    case "console": {
      logger.info(
        `Email (not delivered — no SMTP configured)\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}`,
      );
      return;
    }
  }
}

/**
 * Send without making the caller wait, and never throw into it.
 *
 * Auth flows must respond in the same time whether or not an email went out —
 * otherwise response timing reveals which addresses have accounts.
 */
export function sendEmailInBackground(message: EmailMessage): Promise<void> {
  return sendEmail(message).catch((error) => {
    logger.error("Failed to send email", {
      err: error,
      subject: message.subject,
    });
  });
}
