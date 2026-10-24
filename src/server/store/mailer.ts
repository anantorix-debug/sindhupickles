import "server-only";
import nodemailer from "nodemailer";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** Sends through any SMTP provider. Configure with SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM. */
class SmtpMailer implements Mailer {
  private transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true", // true for port 465
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });

  async send(mail: Mail) {
    await this.transport.sendMail({ from: process.env.SMTP_FROM ?? process.env.SMTP_USER, to: mail.to, subject: mail.subject, text: mail.text });
  }
}

/**
 * Used when no SMTP provider is configured. In development the message (including password-reset
 * links) is printed to the server console; in production it is dropped with a warning rather
 * than leaking links into logs.
 */
class ConsoleMailer implements Mailer {
  async send(mail: Mail) {
    if (process.env.NODE_ENV === "production") {
      console.warn(`[mail] SMTP_HOST is not set; dropped "${mail.subject}" to ${mail.to}`);
      return;
    }
    console.info(`\n[mail:dev] To: ${mail.to}\n[mail:dev] Subject: ${mail.subject}\n${mail.text}\n`);
  }
}

export const mailer: Mailer = process.env.SMTP_HOST ? new SmtpMailer() : new ConsoleMailer();
