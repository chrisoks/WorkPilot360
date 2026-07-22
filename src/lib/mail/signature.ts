import { prisma } from "@/lib/db/client";

function escapeMailHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textSignatureToHtml(value: string) {
  return escapeMailHtml(value.trimEnd())
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\r?\n/g, "<br>"))
    .map((paragraph) => `<p>${paragraph || "&nbsp;"}</p>`)
    .join("");
}

function sanitizeSignatureHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}

export function normalizeMailSignatureHtml(value: string) {
  const signature = value.trim();
  if (!signature) return "";
  return /<\/?[a-z][\s\S]*>/i.test(signature)
    ? sanitizeSignatureHtml(signature)
    : textSignatureToHtml(signature);
}

export async function getUserMailSignatureHtml(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ signature: string | null; signatureHidden: boolean | null }>>`
    SELECT "signature", "signatureHidden"
    FROM "User"
    WHERE id = ${userId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row || row.signatureHidden) return "";
  return normalizeMailSignatureHtml(row.signature ?? "");
}
