import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";

export type JarvisProjectDialogIntent =
  | "explainProjectType"
  | "explainBilling"
  | "explainProcess"
  | "ambiguousProjectQuestion";

export function resolveJarvisProjectDialogIntent(input: {
  question: string;
  hasProjectContext: boolean;
}): JarvisProjectDialogIntent | undefined {
  if (!input.hasProjectContext) return undefined;
  const value = normalizeJarvisIntentText(input.question);
  const diagnosticCommand =
    /(pruf|check|analysier|untersuch|kontrollier)/.test(value) ||
    /(gesundheitscheck|projektcheck|datenqualitat|auffallig|verbesserungspotenzial)/.test(
      value
    );
  if (diagnosticCommand) return undefined;

  if (
    /(welche|was fur eine|was ist .* fur ein).*(projektart|projekttyp|projekt)/.test(
      value
    ) ||
    /(projektart|projekttyp).*(hat|ist|von)/.test(value) ||
    /ist .* (einmalprojekt|einmaliges projekt|dauerlaufer)/.test(value) ||
    /erklar.*projektart/.test(value)
  ) {
    return "explainProjectType";
  }

  if (
    /(wie|womit|wonach).*(abgerechnet|fakturiert)/.test(value) ||
    /(welches|was fur ein|was ist das).*(abrechnungsmodell|abrechnungsart)/.test(
      value
    ) ||
    /(abrechnungsmodell|abrechnungsart).*(hat|gilt|ist)/.test(value) ||
    /(monatspauschale|stundenabrechnung).*(oder|gilt|hat)/.test(value)
  ) {
    return "explainBilling";
  }

  if (
    /(welche|was fur eine).*(logik|automatik|sollprozess)/.test(value) ||
    /(logik|automatik|sollprozess).*(gilt|hat|funktioniert)/.test(value) ||
    /(wie).*(lauft|funktioniert).*(projekt|planung|rechnung|abrechnung)/.test(
      value
    ) ||
    /(unterschied|unterscheidet).*(einmalprojekt|dauerlaufer|monatspauschale|stundenabrechnung)/.test(
      value
    )
  ) {
    return "explainProcess";
  }

  if (
    /^(und )?was ist mit\b/.test(value) ||
    /^(und )?was weisst du (uber|zu)\b/.test(value) ||
    /^(und )?sag .* (uber|zu)\b/.test(value) ||
    /^(und )?erklar .* projekt\b/.test(value)
  ) {
    return "ambiguousProjectQuestion";
  }

  return undefined;
}
