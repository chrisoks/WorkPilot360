export type JarvisDomain = "system" | "sales" | "management";

function normalize(value: string) {
  return value
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSystemHowToQuestion(normalized: string) {
  return (
    /\bwie\b/.test(normalized) &&
    /\b(anleg|erstell|erfass|eintrag|offn|find|bearbeit|ander|losch|stornier|bedien|plan)\w*\b/.test(
      normalized
    )
  );
}

export function resolveJarvisDomain(question: string): JarvisDomain {
  const normalized = normalize(question);
  if (!normalized || isSystemHowToQuestion(normalized)) return "system";

  const managementMarkers = [
    "bwl",
    "liquiditat",
    "deckungsbeitrag",
    "rentabilitat",
    "wirtschaftlichkeit",
    "unternehmenslage",
    "kapazitat",
    "produktivitat",
    "offene posten",
    "forecast",
    "svs",
    "wachstum",
    "management",
    "umsatz",
    "kosten",
    "ertrag",
    "gewinn",
    "marge",
    "auslastung",
  ];
  if (managementMarkers.some((marker) => normalized.includes(marker))) {
    return "management";
  }

  const salesMarkers = [
    "vertrieb",
    "nachfass",
    "verkaufschance",
    "abschlussquote",
    "zusatzverkauf",
    "neukunde",
    "kundenpotenzial",
    "angebot nachfassen",
    "dauerlaufer nachverhand",
    "aktiv angehen",
    "wiederholungsauftrag",
    "folgeauftrag",
    "vorjahresleistung",
    "letztes jahr",
  ];
  if (salesMarkers.some((marker) => normalized.includes(marker))) {
    return "sales";
  }

  return "system";
}
