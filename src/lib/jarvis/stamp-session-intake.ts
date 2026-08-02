import type { StampSessionTransition } from "@/lib/time/stamp-session-service";

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function extractStampSessionTransition(
  question: string
): StampSessionTransition | null {
  const value = normalize(question);
  if (!value || !/\b(stempel\w*|timer|arbeitszeit)\b/.test(value)) {
    return null;
  }
  if (
    /\b(zeige|status|laeuft|laufe|ist|warum|wie|wann|welche|pruefe|kontrolliere)\b/.test(
      value
    ) &&
    !/\b(pausier\w*|fortsetz\w*|setze\b.*\bfort|starte wieder|weiterlaufen)\b/.test(
      value
    )
  ) {
    return null;
  }
  if (/\b(pausier\w*|pause einlegen)\b/.test(value)) {
    return "pause";
  }
  if (
    /\b(fortsetz\w*|starte wieder|weiterlaufen|weiter stempeln|pause beenden)\b/.test(value) ||
    /\bsetze\b.*\bfort\b/.test(value) ||
    /\bbeende\b.*\bstempelpause\b/.test(value)
  ) {
    return "resume";
  }
  return null;
}

export function looksLikeStampSessionTransitionRequest(question: string) {
  return extractStampSessionTransition(question) !== null;
}

export type StampSessionStartRequest = {
  mode: "project" | "unproductive";
  projectNumber: string;
  comment: string;
  unproductiveLabel: string;
  trade: string;
  billingService: string;
  confirmImplementationStatus: boolean;
};

function extractTaggedValue(question: string, labels: string[]) {
  const escaped = [...labels]
    .sort((left, right) => right.length - left.length)
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const allLabels = [
    "tätigkeit",
    "taetigkeit",
    "kommentar",
    "notiz",
    "gewerk",
    "abrechnungsleistung",
    "leistung",
    "unproduktive tätigkeit",
    "unproduktive taetigkeit",
    "projektstatus",
    "status",
  ];
  const boundary = allLabels
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const match = question.match(
    new RegExp(
      `(?:^|[.;,]\\s*)(?:${escaped.join("|")})\\s*[:=]\\s*(.+?)(?=\\s*(?:[.;,]\\s*)?(?:${boundary})(?:\\s*[:=]|\\b)|$)`,
      "i"
    )
  );
  return (match?.[1] ?? "").trim().replace(/[.;,]+$/, "").slice(0, 1000);
}

export function extractStampSessionStartRequest(
  question: string
): StampSessionStartRequest | null {
  const value = normalize(question);
  if (
    !value ||
    !/\b(stempel\w*|timer|arbeitszeit)\b/.test(value) ||
    !/\b(start\w*|beginn\w*)\b/.test(value) ||
    /\b(wieder|fortsetz\w*|pause beenden)\b/.test(value)
  ) {
    return null;
  }

  const mode = /\bunproduktiv\w*\b/.test(value)
    ? "unproductive"
    : "project";
  const projectNumber =
    mode === "project"
      ? (question.match(/\b([A-ZÄÖÜ]{2,12}-\d{1,10})\b/i)?.[1] ?? "")
          .trim()
          .toUpperCase()
      : "";
  const comment = extractTaggedValue(question, [
    "tätigkeit",
    "taetigkeit",
    "kommentar",
    "notiz",
  ]);
  const unproductiveLabel =
    mode === "unproductive"
      ? extractTaggedValue(question, [
          "unproduktive tätigkeit",
          "unproduktive taetigkeit",
        ]) || "Unproduktiv"
      : "";

  return {
    mode,
    projectNumber,
    comment,
    unproductiveLabel,
    trade: extractTaggedValue(question, ["gewerk"]),
    billingService: extractTaggedValue(question, [
      "abrechnungsleistung",
      "leistung",
    ]),
    confirmImplementationStatus:
      mode === "project" &&
      /\b(status\w*|projektstatus)\b.*\b(umsetzung|ausfuhrung)\b/.test(value),
  };
}

export function looksLikeStampSessionStartRequest(question: string) {
  return extractStampSessionStartRequest(question) !== null;
}

export type StampSessionStopRequest = {
  completionStatus: "finished" | "interrupted" | "";
  comment: string;
  interruptionReason: string;
  finalInspectionMode: "" | "self" | "colleague";
  allInspectionChecksDone: boolean;
  upsellNotes: string;
};

export function extractStampSessionStopRequest(
  question: string,
): StampSessionStopRequest | null {
  const value = normalize(question);
  if (
    !value ||
    !/\b(stempel\w*|timer|arbeitszeit)\b/.test(value) ||
    !/\b(stopp\w*|beend\w*|abschliess\w*|abschließ\w*)\b/.test(value) ||
    /\b(pause|fortsetz\w*|wieder\w*|start\w*|beginn\w*)\b/.test(value)
  ) {
    return null;
  }

  const completionStatus = /\b(arbeit\s+)?unterbrochen\b|\bunterbrech\w*\b/.test(
    value,
  )
    ? "interrupted"
    : /\b(arbeit\s+)?fertig\b|\berledigt\b|\babgeschlossen\b/.test(value)
      ? "finished"
      : "";
  const interruptionReason = extractTaggedValue(question, [
    "unterbrechungsgrund",
    "grund",
    "warum unterbrochen",
  ]);
  const comment = extractTaggedValue(question, [
    "ergänzung",
    "ergaenzung",
    "kommentar",
    "notiz",
  ]);
  const finalInspectionMode = /endkontrolle[^.;,]*(kollege|kollegin)|durch\s+(einen\s+)?kollegen/.test(
    value,
  )
    ? "colleague"
    : /endkontrolle[^.;,]*(selbst|durchgeführt|durchgefuehrt)|endkontrolle\s*:\s*fertig/.test(
        value,
      )
      ? "self"
      : "";
  const upsellNotes = extractTaggedValue(question, [
    "zusatzverkauf",
    "zusatzverkaufsmöglichkeit",
    "zusatzverkaufsmoeglichkeit",
  ]);

  return {
    completionStatus,
    comment,
    interruptionReason,
    finalInspectionMode,
    allInspectionChecksDone:
      /\b(alle|sämtliche|saemtliche)\b[^.;,]*\b(prüfpunkte|pruefpunkte|checks)\b[^.;,]*\b(erledigt|bestätigt|bestaetigt|ok)\b/.test(
        value,
      ),
    upsellNotes,
  };
}

export function looksLikeStampSessionStopRequest(question: string) {
  return extractStampSessionStopRequest(question) !== null;
}
