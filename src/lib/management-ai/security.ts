import { Role } from "@prisma/client";

type AiMode = "management" | "sales";

type RoleCarrier = {
  role: Role;
  salesRoleEnabled?: boolean | null;
};

const SALES_SENSITIVE_PATTERNS = [
  /\bgehalt\w*/i,
  /\blohn\w*/i,
  /\bverdien\w*/i,
  /\bverdienst\w*/i,
  /\bpersonalkosten\b/i,
  /\bmitarbeiterkosten\b/i,
  /\bkosten\s+(je|pro)\s+mitarbeiter\b/i,
  /\bmitarbeiter\w*\s+.*\bkosten\b/i,
  /\bkostensatz\b/i,
  /\bkostensaetze\b/i,
  /\bkostenstundensatz\b/i,
  /\bstundensatzkosten\b/i,
  /\bteuer\w*\s+mitarbeiter\w*/i,
  /\bmitarbeiter\w*.*\bteuer\w*/i,
  /\bguenstig\w*\s+mitarbeiter\w*/i,
  /\bgünstig\w*\s+mitarbeiter\w*/i,
  /\bmitarbeiter\w*.*\bguenstig\w*/i,
  /\bmitarbeiter\w*.*\bgünstig\w*/i,
  /\binterne\w*\s+kosten\b/i,
  /\bpersonalaufwand\b/i,
  /\barbeitgeberkosten\b/i,
  /\bkostenvergleich\b/i,
  /\bwer\s+kostet\b/i,
  /\bdeckungsbeitrag\b/i,
  /\bmarge\b/i,
  /\blaborcost/i,
  /\bhourlycost/i,
  /\btotalcost\b/i,
  /\bmaterialcost/i,
  /\bcostsnapshot/i,
  /\bemployeecost/i,
  /\bsalary\b/i,
  /\bwage\b/i,
];

const PROMPT_INJECTION_PATTERNS = [
  /ignore (all )?(previous|above|earlier) instructions/i,
  /ignoriere .*anweisung/i,
  /system prompt/i,
  /developer message/i,
  /du bist jetzt/i,
  /forget .*instructions/i,
  /zeige .*prompt/i,
];

const OUT_OF_SCOPE_PATTERNS = [
  /\bwetter\b/i,
  /\bfussball\b/i,
  /\bfußball\b/i,
  /\brezept\b/i,
  /\bkrankheit\b/i,
  /\bmedizin/i,
  /\bprivatleben\b/i,
  /\bpolitik\b/i,
  /\baktienkurs\b/i,
  /\bhauptstadt\b/i,
  /\berzaehl.*witz\b/i,
  /\berzähl.*witz\b/i,
];

const WORKPILOT_SCOPE_PATTERNS = [
  /\bworkpilot\b/i,
  /\bunternehmen\b/i,
  /\bbwl\b/i,
  /\bvertrieb\b/i,
  /\bangebot\w*/i,
  /\bkunde\w*/i,
  /\bprojekt\w*/i,
  /\bumsatz\b/i,
  /\bforecast\b/i,
  /\bliquiditaet\b/i,
  /\bliquidität\b/i,
  /\bkapazitaet\b/i,
  /\bkapazität\b/i,
  /\bplanung\b/i,
  /\bsvs\b/i,
  /\boffene posten\b/i,
  /\brechnung\w*/i,
  /\bdauerlaeufer\b/i,
  /\bdauerläufer\b/i,
  /\bnachfass/i,
  /\bwachstum\b/i,
  /\bbremse\w*/i,
  /\bengpass\b/i,
  /\bstempel/i,
  /\bzeiten\b/i,
];

export function canUseManagementAi(user: RoleCarrier): boolean {
  return user.role === Role.ADMIN || user.role === Role.GESCHAEFTSFUEHRER;
}

export function canUseSalesAi(user: RoleCarrier): boolean {
  return canUseManagementAi(user) || user.role === Role.VERTRIEB || user.salesRoleEnabled === true;
}

export function asksForSalesRestrictedData(question: string): boolean {
  return SALES_SENSITIVE_PATTERNS.some((pattern) => pattern.test(question));
}

export function isPromptInjectionAttempt(question: string): boolean {
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(question));
}

export function isClearlyOutOfScopeQuestion(question: string): boolean {
  const normalized = question.trim();
  if (!normalized) return false;
  return OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(normalized)) &&
    !WORKPILOT_SCOPE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function sanitizeContextLine(line: string, mode: AiMode) {
  const trimmed = line.trim();
  if (!trimmed) return "";
  if (PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(trimmed))) return "";
  if (mode === "sales" && SALES_SENSITIVE_PATTERNS.some((pattern) => pattern.test(trimmed))) return "";
  return trimmed;
}

export function sanitizeAiContext(context: string, mode: AiMode, maxLength = 12000): string {
  return context
    .split(/\r?\n/)
    .map((line) => sanitizeContextLine(line, mode))
    .filter(Boolean)
    .join("\n")
    .slice(0, maxLength)
    .trim();
}

export function normalizeAndLimitAiReply(reply: string, maxWords = 140): string {
  const normalized = reply
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*---+\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return normalized;

  const clipped = words.slice(0, maxWords).join(" ");
  const sentenceEnd = Math.max(clipped.lastIndexOf("."), clipped.lastIndexOf("?"), clipped.lastIndexOf("!"));
  const readable = sentenceEnd > 80 ? clipped.slice(0, sentenceEnd + 1) : clipped;
  return `${readable}\n\nIch halte es bewusst kurz. Welchen Punkt soll ich vertiefen?`;
}
