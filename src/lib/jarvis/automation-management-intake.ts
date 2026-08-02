import { PROJECT_STATUS_ESCALATION_DEFAULTS } from "@/lib/company-settings/deadlines";

export type JarvisAutomationManagementRequest =
  | { operation: "switch"; enabled: boolean }
  | {
      operation: "rule";
      status: string;
      enabled?: boolean;
      responsibleAfterDays?: number;
      managementAfterDays?: number;
    };

function normalize(value: string) {
  return value
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractProjectStatusAutomationRequest(question: string): JarvisAutomationManagementRequest | null {
  const text = normalize(question);
  const mentionsProjectStatusAutomation =
    /projektstatus/.test(text) && /(automation|fruhwarn|eskalation|regel|schwelle|frist)/.test(text);
  if (!mentionsProjectStatusAutomation) return null;
  const status = PROJECT_STATUS_ESCALATION_DEFAULTS.find((rule) => text.includes(normalize(rule.status)))?.status;
  if (status && /\b(regel|schwelle|frist)\w*/.test(text)) {
    const responsibleMatch = text.match(/verantwort\w*(?:\s+person)?(?:\s+ab|\s+nach|\s*[:=])\s*(\d{1,3})\s*tag/);
    const managementMatch = text.match(/(?:geschaftsfuhr\w*|management)(?:\s+ab|\s+nach|\s*[:=])\s*(\d{1,3})\s*tag/);
    const enabled = /\b(deaktivier|ausschalt|inaktiv)\w*/.test(text)
      ? false
      : /\b(aktivier|einschalt|aktiv)\w*/.test(text)
        ? true
        : undefined;
    const request = {
      operation: "rule" as const,
      status,
      ...(enabled === undefined ? {} : { enabled }),
      ...(responsibleMatch ? { responsibleAfterDays: Number(responsibleMatch[1]) } : {}),
      ...(managementMatch ? { managementAfterDays: Number(managementMatch[1]) } : {}),
    };
    if (request.enabled !== undefined || request.responsibleAfterDays !== undefined || request.managementAfterDays !== undefined) return request;
  }
  if (/\b(deaktivier|ausschalt|abschalt|stoppe?|inaktiv)\w*/.test(text) || /\bschalt\w*\b.*\b(aus|ab)\b/.test(text)) return { operation: "switch", enabled: false };
  if (/\b(aktivier|einschalt|anschalt|starte?|aktiv)\w*/.test(text) || /\bschalt\w*\b.*\bein\b/.test(text)) return { operation: "switch", enabled: true };
  return null;
}
