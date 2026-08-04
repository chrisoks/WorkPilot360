const KNOWN_JARVIS_INTENT_TERMS = [
  "projekt",
  "projekte",
  "projektart",
  "projektarten",
  "projekttyp",
  "projektnummer",
  "projektdaten",
  "abrechnung",
  "abrechnungen",
  "abrechnungsmodell",
  "abrechnungsart",
  "abgerechnet",
  "fakturiert",
  "logik",
  "automatik",
  "sollprozess",
  "planung",
  "geplant",
  "verplant",
  "termin",
  "termine",
  "folgemonat",
  "rechnung",
  "rechnungen",
  "rechnungsentwurf",
  "rechnungsentwurfe",
  "leistungsmonat",
  "einmalprojekt",
  "dauerlaufer",
  "monatspauschale",
  "stundenabrechnung",
  "stempelung",
  "stempelungen",
  "arbeitszeit",
  "arbeitszeiten",
  "zeiteintrag",
  "zeiteintrage",
  "vollstandig",
  "unvollstandig",
  "prufe",
  "prufen",
  "analysiere",
  "untersuche",
  "kontrolliere",
  "buchhaltung",
  "komme",
] as const;

function baseNormalize(value: string) {
  return value
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?!.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const COLLOQUIAL_PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/^(?:(?:hey|hallo|moin)\s+jarvis|jarvis|sag\s+mal(?:\s+jarvis)?)\s+/g, ""],
  [/\bwie\s+sieht['’]?s\b/g, "wie sieht es"],
  [/\bwie\s+schaut['’]?s\b/g, "wie schaut es"],
  [/\bwie\s+steht['’]?s\b/g, "wie steht es"],
  [/\bwie\s+geht['’]?s\b/g, "wie geht es"],
  [/\bwie\s+lauft['’]?s\b/g, "wie lauft es"],
  [/\bwas\s+gibt['’]?s\b/g, "was gibt es"],
  [/\bwo\s+klemmt['’]?s\b/g, "wo klemmt es"],
  [/\bwie\s+war['’]?s\b/g, "wie war es"],
  [/\bwies\b/g, "wie es"],
  [/\bsieht['’]?s\b/g, "sieht es"],
  [/\bschaut['’]?s\b/g, "schaut es"],
  [/\bsteht['’]?s\b/g, "steht es"],
  [/\bgeht['’]?s\b/g, "geht es"],
  [/\blauft['’]?s\b/g, "lauft es"],
  [/\bgibt['’]?s\b/g, "gibt es"],
  [/\bklemmt['’]?s\b/g, "klemmt es"],
  [/\bbraucht['’]?s\b/g, "braucht es"],
  [/\bist['’]?s\b/g, "ist es"],
  [/\bisses\b/g, "ist es"],
  [/\bhat['’]?s\b/g, "hat es"],
  [/\bkann['’]?s\b/g, "kann es"],
  [/\bwar['’]?s\b/g, "war es"],
  [/\bkannste\b/g, "kannst du"],
  [/\bhaste\b/g, "hast du"],
  [/\bwillste\b/g, "willst du"],
  [/\bsolln\b/g, "sollen"],
  [/\bham\s+wir\b/g, "haben wir"],
  [/\bwasn\b/g, "was denn"],
  [/\bzeig\s+ma\b/g, "zeige mal"],
  [/\bggu\b/g, "gegenuber"],
];

function expandColloquialJarvisPhrases(value: string) {
  return COLLOQUIAL_PHRASE_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value
  );
}

function damerauLevenshtein(left: string, right: string) {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const matrix = Array.from({ length: rows }, () =>
    Array<number>(columns).fill(0)
  );
  for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
  for (let column = 0; column < columns; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitutionCost =
        left[row - 1] === right[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + substitutionCost
      );
      if (
        row > 1 &&
        column > 1 &&
        left[row - 1] === right[column - 2] &&
        left[row - 2] === right[column - 1]
      ) {
        matrix[row][column] = Math.min(
          matrix[row][column],
          matrix[row - 2][column - 2] + 1
        );
      }
    }
  }

  return matrix[left.length][right.length];
}

function correctionThreshold(term: string) {
  return term.length >= 10 ? 2 : 1;
}

export function correctJarvisIntentToken(token: string) {
  const isRegularKnownInflection = KNOWN_JARVIS_INTENT_TERMS.some((term) => {
    if (!token.startsWith(term) || token === term) return false;
    return /^(?:e|en|er|es|em|n|s)$/.test(token.slice(term.length));
  });
  if (
    token.length < 4 ||
    /[\d@/_\\-]/.test(token) ||
    isRegularKnownInflection ||
    KNOWN_JARVIS_INTENT_TERMS.includes(
      token as (typeof KNOWN_JARVIS_INTENT_TERMS)[number]
    )
  ) {
    return token;
  }

  const candidates = KNOWN_JARVIS_INTENT_TERMS.flatMap((term) => {
    const threshold = correctionThreshold(term);
    if (Math.abs(term.length - token.length) > threshold) return [];
    const distance = damerauLevenshtein(token, term);
    return distance <= threshold ? [{ term, distance }] : [];
  }).sort((left, right) => left.distance - right.distance);
  if (candidates.length === 0) return token;
  const bestDistance = candidates[0].distance;
  const bestCandidates = candidates.filter(
    (candidate) => candidate.distance === bestDistance
  );
  return bestCandidates.length === 1 ? bestCandidates[0].term : token;
}

export function normalizeJarvisIntentText(value: string) {
  return expandColloquialJarvisPhrases(baseNormalize(value))
    .split(" ")
    .map(correctJarvisIntentToken)
    .join(" ");
}
