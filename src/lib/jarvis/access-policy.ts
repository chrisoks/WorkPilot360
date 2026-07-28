import type { JarvisReadResponse } from "@/lib/jarvis/read-model";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";

function policyAnswer(message: string): JarvisReadResponse {
  return {
    type: "answer",
    topicId: "security.access-policy",
    message,
    deterministic: true,
  };
}

export function resolveJarvisAccessPolicyQuestion(
  question: string
): JarvisReadResponse | undefined {
  const value = normalizeJarvisIntentText(question);
  const asksPolicy =
    /\b(?:darf|durfen|kann|konnen|berechtigt|freigegeben|zugriff)\b/.test(
      value
    );

  if (
    asksPolicy &&
    /\b(?:mitarbeiter|normale\w* mitarbeiter)\b/.test(value) &&
    /\b(?:lohn|gehalt|mitarbeiterkosten|kostensatz)\w*\b/.test(value)
  ) {
    return policyAnswer(
      "Nein. Die Rolle „Mitarbeiter“ darf in WorkPilot360 keine Lohn-, Gehalts- oder internen Mitarbeiterkostendaten abrufen. Diese Datenklasse ist auf Administration und Geschäftsführung begrenzt; JARVIS lädt sie für andere Rollen nicht."
    );
  }

  if (
    asksPolicy &&
    /\bfuhrungskraft\b/.test(value) &&
    /\b(?:kunde|kontakt|kundendaten|kontaktdaten)\w*\b/.test(value)
  ) {
    return policyAnswer(
      "Eine Führungskraft darf die für Kunden-, Projekt- und Arbeitsabläufe vorgesehenen Kontakt- und Kundendaten sehen. Private Mitarbeiterdaten, technische Geheimnisse und Lohn- oder Gehaltsdaten gehören nicht zu dieser Kundenberechtigung und werden dadurch nicht freigegeben."
    );
  }

  if (
    asksPolicy &&
    /\bmitarbeiter\b/.test(value) &&
    /\b(?:termin|einsatz|planung)\w*\b/.test(value) &&
    /\b(?:andere|fremde|kollegen|mitarbeitende)\b/.test(value)
  ) {
    return policyAnswer(
      "Nein. Die normale Mitarbeiterrolle darf Planungstermine nicht für andere Personen verwalten. Das ist in WorkPilot360 auf Administration, Geschäftsführung und Führungskräfte begrenzt. Eigene Arbeits- und Terminangaben bleiben davon getrennt."
    );
  }

  if (
    /\b(?:private|privat)\w*\b/.test(value) &&
    /\b(?:telefon|telefonnummer|handy|handynummer|adresse)\w*\b/.test(value) &&
    /\bmitarbeiter\w*\b/.test(value)
  ) {
    return policyAnswer(
      "Private Kontakt- oder Adressdaten von Mitarbeitenden gebe ich in JARVIS-Antworten nicht aus. Falls ein dienstlich notwendiger Zugriff besteht, muss er im dafür vorgesehenen, rollenberechtigten Mitarbeiterbereich geprüft werden."
    );
  }

  return undefined;
}
