import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";

export type JarvisProjectDialogIntent =
  | "explainIdentity"
  | "explainCustomer"
  | "explainAddress"
  | "explainTrade"
  | "explainBranch"
  | "explainVolume"
  | "explainProjectType"
  | "explainBilling"
  | "explainProcess"
  | "explainStatus"
  | "explainPlanning"
  | "explainRisk"
  | "explainNextStep"
  | "explainResponsibility"
  | "explainReviewStatus"
  | "explainLastChange"
  | "explainEvidence"
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
    /\b(?:welche|was ist die|wie lautet die)\b.*\bprojektnummer\b/.test(value) ||
    /\bprojektnummer\b.*\b(?:hier|dieses|diesem|hat|lautet)\b/.test(value)
  ) {
    return "explainIdentity";
  }

  if (
    /\bwelch\w*\b.*\bkund\w*\b.*\bprojekt\b/.test(value) ||
    /\bwer ist\b.*\bkund\w*\b.*\bprojekt\w*\b/.test(value) ||
    /\bwie hei(?:ss|ß)t\b.*\bkund\w*\b.*\bprojekt\w*\b/.test(value) ||
    /\b(?:kunde|kunden)\b.*\b(?:gehort|ist|hat|verknupft)\b.*\bprojekt\b/.test(
      value
    )
  ) {
    return "explainCustomer";
  }

  if (
    /\b(?:welche|was ist die|wie lautet die)\b.*\b(?:objektadresse|projektadresse|adresse)\b/.test(
      value
    ) ||
    /\b(?:objektadresse|projektadresse)\b.*\b(?:projekt|hier|hat|verknupft)\b/.test(
      value
    )
  ) {
    return "explainAddress";
  }

  if (
    /\bwelch\w*\b.*\bgewerk\b/.test(value) ||
    /\bgewerk\b.*\b(?:projekt|hat|ist|hinterlegt)\b/.test(value)
  ) {
    return "explainTrade";
  }

  if (
    /\bwelch\w*\b.*\bniederlassung\b/.test(value) ||
    /\bniederlassung\b.*\b(?:projekt|hat|ist|hinterlegt|zugeordnet)\b/.test(
      value
    )
  ) {
    return "explainBranch";
  }

  if (
    /\bwelch\w*\b.*\bprojektvolumen\b/.test(value) ||
    /\bprojektvolumen\b.*\b(?:hinterlegt|hat|ist)\b/.test(value)
  ) {
    return "explainVolume";
  }

  if (
    /\b(?:welche projektart|welchen projekttyp|was fur (?:ein|eine) projekt(?:art|typ)?|was ist .* fur (?:ein|en|nen) projekt)\b/.test(
      value
    ) ||
    /(was|welch).*(furn|fur n|fur ein|fur eine).*(projekt|projektart|projekttyp)/.test(
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
    /\b(?:welchen|was fur einen|wie ist der|was ist der)\b.*\bprojektstatus\b/.test(
      value
    ) ||
    /\bstatus\b.*\b(?:projekt|hat|ist)\b/.test(value)
  ) {
    return "explainStatus";
  }

  if (
    /\b(?:wie ist|was ist)\b.*\bplanungsstand\b/.test(value) ||
    /\bplanungsstand\b.*\b(?:projekt|hat|ist)\b/.test(value)
  ) {
    return "explainPlanning";
  }

  if (
    /\b(?:gro(?:ss|ß)te[snr]?|wichtigste[snr]?)\b.*\brisiko\b/.test(value) ||
    /\brisiko\b.*\b(?:projekt|aktuell|gro(?:ss|ß))\b/.test(value) ||
    /\b(?:welche|was sind die|welchen)\b.*\b(?:nachste[nr]?|sinnvolle[nr]?)\b.*\bschritt\w*\b.*\b(?:empfiehl|projekt)\w*\b/.test(
      value
    )
  ) {
    return /\bschritt\w*\b/.test(value) ? "explainNextStep" : "explainRisk";
  }

  if (
    /\b(?:welche|was fur eine|auf welcher)\b.*\b(?:datenbasis|datengrundlage|grundlage|quelle\w*)\b.*\b(?:empfehl|bewert|pruf)\w*\b/.test(
      value
    ) ||
    /\b(?:datenbasis|datengrundlage|grundlage|quelle\w*)\b.*\b(?:nutzt|verwendest)\b.*\b(?:empfehl|bewert|pruf)\w*\b/.test(
      value
    )
  ) {
    return "explainEvidence";
  }

  if (
    /\bwer\b.*\b(?:verantwortlich|projektverantwort)\w*\b/.test(value) ||
    /\bprojektverantwort\w*\b.*\b(?:wer|ist)\b/.test(value) ||
    /\bwer\b.*\b(?:kummert|betreut)\b.*\bprojekt\b/.test(value)
  ) {
    return "explainResponsibility";
  }

  if (
    /\b(?:fachlich\s+)?(?:gepruft|freigegeben|prufstatus)\b/.test(value) ||
    /\b(?:wie ist|was ist)\b.*\bprufstand\b/.test(value)
  ) {
    return "explainReviewStatus";
  }

  if (
    /\b(?:was|welche|wann)\b.*\bzuletzt\b.*\b(?:geandert|anderung|gespeichert|aktualisiert)\w*\b/.test(
      value
    ) ||
    /\bletzte\b.*\b(?:anderung|speicherung|aktualisierung)\b/.test(value)
  ) {
    return "explainLastChange";
  }

  if (
    /^(und )?was ist mit\b/.test(value) ||
    /\bwas wei(?:ss|ß)t du (daruber|uber|zu)\b/.test(value) ||
    /^(und )?sag .* (uber|zu)\b/.test(value) ||
    /^(und )?erklar .* projekt\b/.test(value)
  ) {
    return "ambiguousProjectQuestion";
  }

  return undefined;
}
