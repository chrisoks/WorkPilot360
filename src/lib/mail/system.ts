import nodemailer from "nodemailer";

export type SystemMailPurpose = "notification" | "noreply";

type SystemMailAddress = {
  name: string;
  address: string;
};

type SystemMailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  purpose?: SystemMailPurpose;
  replyTo?: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parsePort(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 587;
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) return fallback;
  return ["1", "true", "yes", "ja"].includes(value.trim().toLowerCase());
}

function parseAddress(value: string | undefined, fallback: SystemMailAddress): SystemMailAddress {
  const cleaned = cleanText(value);
  if (!cleaned) return fallback;

  const match = cleaned.match(/^(.*)<([^>]+)>$/);
  if (!match) {
    return { name: fallback.name, address: cleaned };
  }

  return {
    name: cleanText(match[1]).replace(/^"|"$/g, "") || fallback.name,
    address: cleanText(match[2]) || fallback.address,
  };
}

function normalizeRecipients(value: string | string[]) {
  const values = Array.isArray(value) ? value : value.split(",");
  return values.map((item) => cleanText(item)).filter(Boolean);
}

export function getSystemMailStatus() {
  const host = cleanText(process.env.SYSTEM_MAIL_SMTP_HOST) || "smtp.strato.de";
  const port = parsePort(process.env.SYSTEM_MAIL_SMTP_PORT);
  const secure = parseBoolean(process.env.SYSTEM_MAIL_SMTP_SECURE, port === 465);
  const user = cleanText(process.env.SYSTEM_MAIL_SMTP_USER);
  const passwordConfigured = Boolean(cleanText(process.env.SYSTEM_MAIL_SMTP_PASSWORD));
  const from = parseAddress(process.env.SYSTEM_MAIL_FROM, {
    name: "WorkPilot360 Benachrichtigungen",
    address: "info@oks-cloudservices.com",
  });

  return {
    configured: Boolean(host && user && passwordConfigured && from.address),
    host,
    port,
    secure,
    user,
    from,
    passwordConfigured,
    replyTo: cleanText(process.env.SYSTEM_MAIL_REPLY_TO),
  };
}

export async function sendSystemMail(input: SystemMailInput) {
  const status = getSystemMailStatus();
  if (!status.configured) {
    throw new Error("Systemmail ist noch nicht vollständig konfiguriert.");
  }

  const recipients = normalizeRecipients(input.to);
  if (recipients.length === 0) {
    throw new Error("Keine gültige Empfängeradresse angegeben.");
  }

  const transporter = nodemailer.createTransport({
    host: status.host,
    port: status.port,
    secure: status.secure,
    auth: {
      user: status.user,
      pass: cleanText(process.env.SYSTEM_MAIL_SMTP_PASSWORD),
    },
    requireTLS: !status.secure,
  });

  const from = `${status.from.name} <${status.from.address}>`;
  const info = await transporter.sendMail({
    from,
    to: recipients,
    replyTo: cleanText(input.replyTo) || status.replyTo || undefined,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  return {
    accepted: info.accepted.map(String),
    rejected: info.rejected.map(String),
    messageId: info.messageId,
  };
}
