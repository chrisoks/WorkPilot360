import { Role } from "@prisma/client";
import {
  canAccessEmployeeCosts,
  canManageInvoices,
  canManageUsers,
  canReadContacts,
} from "@/lib/permissions";

export type JarvisActor = {
  id?: string;
  role: Role;
  teamId?: string | null;
  salesRoleEnabled?: boolean | null;
};

export type JarvisAccessProfile = {
  sessionActor: JarvisActor;
  effectiveActor: JarvisActor;
  isImpersonating: boolean;
};

export type JarvisDataClass =
  | "public"
  | "internal"
  | "customer"
  | "financial"
  | "personnel"
  | "payroll"
  | "secret";

export type JarvisQuestionAuthorization = {
  allowed: boolean;
  dataClass: JarvisDataClass;
  reason: "allowed" | "prompt_injection" | "secret" | "role";
};

const PROMPT_INJECTION_PATTERNS = [
  /ignore (all )?(previous|above|earlier) instructions/i,
  /ignoriere .*anweisung/i,
  /system prompt/i,
  /developer message/i,
  /du bist jetzt/i,
  /forget .*instructions/i,
  /zeige .*prompt/i,
];

const SECRET_REQUEST_PATTERNS = [
  /\b(?:zeige|nenne|verrate|gib|lies|sende|exportiere)\b.*\b(?:passwort|kennwort|api[- ]?key|secret|token|private key|privater schlüssel|umgebungsvariable|\.env)\b/i,
  /\bwie lautet\b.*\b(?:passwort|kennwort|api[- ]?key|secret|token|private key|privater schlüssel)\b/i,
  /\b(?:passwort|kennwort|api[- ]?key|secret|token|private key|privater schlüssel)\b.*\b(?:anzeigen|auslesen|offenlegen|herausgeben)\b/i,
];

const PAYROLL_PATTERNS = [
  /\bgehalt\w*/i,
  /\blohn\w*/i,
  /\bverdien\w*/i,
  /\bpersonalkosten\b/i,
  /\bmitarbeiterkosten\b/i,
  /\bkostensatz\b/i,
  /\bkostenstundensatz\b/i,
  /\barbeitgeberkosten\b/i,
  /\bpersonalaufwand\b/i,
  /\bsalary\b/i,
  /\bwage\b/i,
];

const PERSONNEL_PATTERNS = [
  /\bpersonalakte\b/i,
  /\bmitarbeiterbeurteilung\b/i,
  /\bgeburtsdatum\b/i,
  /\bkrankheit\w*/i,
  /\bpersonalnummer\b/i,
  /\bmitarbeiter\w*.*\b(?:adresse|telefonnummer|handynummer|privatadresse)\b/i,
];

const FINANCIAL_PATTERNS = [
  /\brechnung\w*/i,
  /\boffene posten\b/i,
  /\bmahnung\w*/i,
  /\bfakturier\w*/i,
  /\bstorn\w*/i,
  /\bmarge\b/i,
  /\bdeckungsbeitrag\b/i,
  /\bliquidit[aä]t\b/i,
  /\bumsatz\b/i,
  /\bforecast\b/i,
];

const CUSTOMER_PATTERNS = [
  /\bkontakt\w*/i,
  /\bkunde\w*/i,
  /\bansprechpartner\b/i,
  /\bkundenzufriedenheit\b/i,
  /\bkuzu\b/i,
];

export function createJarvisAccessProfile(
  sessionActor: JarvisActor,
  effectiveActor: JarvisActor = sessionActor
): JarvisAccessProfile {
  return {
    sessionActor,
    effectiveActor,
    isImpersonating:
      Boolean(sessionActor.id) &&
      Boolean(effectiveActor.id) &&
      sessionActor.id !== effectiveActor.id,
  };
}

function canSingleActorAccessDataClass(actor: JarvisActor, dataClass: JarvisDataClass) {
  switch (dataClass) {
    case "public":
    case "internal":
      return true;
    case "customer":
      return canReadContacts(actor);
    case "financial":
      return canManageInvoices(actor);
    case "personnel":
      return canManageUsers(actor);
    case "payroll":
      return canAccessEmployeeCosts(actor);
    case "secret":
      return false;
  }
}

export function canAccessJarvisDataClass(
  profile: JarvisAccessProfile | undefined,
  dataClass: JarvisDataClass
) {
  if (dataClass === "public" || dataClass === "internal") return true;
  if (!profile) return false;
  return (
    canSingleActorAccessDataClass(profile.sessionActor, dataClass) &&
    canSingleActorAccessDataClass(profile.effectiveActor, dataClass)
  );
}

export function classifyJarvisQuestion(question: string): JarvisDataClass {
  if (SECRET_REQUEST_PATTERNS.some((pattern) => pattern.test(question))) return "secret";
  if (PAYROLL_PATTERNS.some((pattern) => pattern.test(question))) return "payroll";
  if (PERSONNEL_PATTERNS.some((pattern) => pattern.test(question))) return "personnel";
  if (FINANCIAL_PATTERNS.some((pattern) => pattern.test(question))) return "financial";
  if (CUSTOMER_PATTERNS.some((pattern) => pattern.test(question))) return "customer";
  return "internal";
}

export function authorizeJarvisQuestion(
  question: string,
  profile?: JarvisAccessProfile
): JarvisQuestionAuthorization {
  if (PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(question))) {
    return { allowed: false, dataClass: "secret", reason: "prompt_injection" };
  }

  const dataClass = classifyJarvisQuestion(question);
  if (dataClass === "secret") {
    return { allowed: false, dataClass, reason: "secret" };
  }
  if (!canAccessJarvisDataClass(profile, dataClass)) {
    return { allowed: false, dataClass, reason: "role" };
  }
  return { allowed: true, dataClass, reason: "allowed" };
}
