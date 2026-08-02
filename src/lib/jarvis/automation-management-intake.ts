export type JarvisAutomationManagementRequest = {
  enabled: boolean;
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
    /projektstatus/.test(text) && /(automation|fruhwarn|eskalation)/.test(text);
  if (!mentionsProjectStatusAutomation) return null;
  if (/\b(deaktivier|ausschalt|abschalt|stoppe?|inaktiv)\w*/.test(text) || /\bschalt\w*\b.*\b(aus|ab)\b/.test(text)) return { enabled: false };
  if (/\b(aktivier|einschalt|anschalt|starte?|aktiv)\w*/.test(text) || /\bschalt\w*\b.*\bein\b/.test(text)) return { enabled: true };
  return null;
}
