import "server-only";
import { env } from "@/lib/env";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Swap with EMAIL_PROVIDER. */
export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  async send(message: EmailMessage) {
    console.info(`[email] to=${message.to} subject="${message.subject}"\n${message.text}`);
  }
}

class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  async send(message: EmailMessage) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendApiKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.emailFrom(), to: [message.to], subject: message.subject, text: message.text, html: message.html }),
    });
    if (!res.ok) throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
  }
}

export function getEmailProvider(): EmailProvider {
  return env.emailProvider() === "resend" ? new ResendEmailProvider() : new ConsoleEmailProvider();
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Minimal branded layout shared by all notification emails. */
export function renderEmail(opts: { heading: string; body: string; ctaLabel?: string; ctaUrl?: string; footer: string }) {
  const paragraphs = opts.body.split("\n").filter(Boolean).map((p) => `<p style="margin:0 0 12px">${escapeHtml(p)}</p>`).join("");
  const cta = opts.ctaUrl
    ? `<p style="margin:24px 0"><a href="${escapeHtml(opts.ctaUrl)}" style="background:#b45309;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">${escapeHtml(opts.ctaLabel ?? "Open")}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#fdf8f3;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#292524">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<div style="font-weight:700;font-size:18px;color:#b45309;margin-bottom:20px">FundMyDegree</div>
<div style="background:#fff;border:1px solid #e7e5e4;border-radius:12px;padding:24px">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(opts.heading)}</h1>${paragraphs}${cta}</div>
<p style="font-size:12px;color:#78716c;margin-top:20px">${escapeHtml(opts.footer)}</p></div></body></html>`;
  const text = `${opts.heading}\n\n${opts.body}${opts.ctaUrl ? `\n\n${opts.ctaLabel ?? "Open"}: ${opts.ctaUrl}` : ""}\n\n${opts.footer}`;
  return { html, text };
}
