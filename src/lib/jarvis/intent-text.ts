const KNOWN_JARVIS_INTENT_TERMS = [
  "projekt",
  "projekte",
  "projektart",
  "projektarten",
  "projekttyp",
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
  "rechnung",
  "rechnungen",
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
  "prufe",
  "prufen",
  "analysiere",
  "untersuche",
  "kontrolliere",
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
  if (
    token.length < 5 ||
    /[\d@/_\\-]/.test(token) ||
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
  return baseNormalize(value)
    .split(" ")
    .map(correctJarvisIntentToken)
    .join(" ");
}
