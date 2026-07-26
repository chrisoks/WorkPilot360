import {
  authorizeJarvisQuestion,
  JarvisAccessProfile,
  JarvisQuestionAuthorization,
} from "@/lib/jarvis/security";
import { getJarvisActionDecision } from "@/lib/jarvis/actions";

export type JarvisSurfaceContext = {
  module?: string;
  subview?: string;
  recordType?: "none" | "customer" | "project";
  projectKind?: "unknown" | "oneTime" | "recurring";
  billingMode?: "unknown" | "hourly" | "monthlyFlat";
  modal?: string;
};

export type JarvisHelpResult = {
  type: "answer" | "clarification" | "refusal" | "unknown";
  message: string;
  choices?: string[];
  topicId?: string;
};

type JarvisTopic = {
  id: string;
  title: string;
  keywords: string[];
  surfaces?: string[];
  answer: string;
  actionId?: string;
};

const PROJECT_KIND_CHOICES = [
  "Einmaliges Projekt",
  "Dauerläufer mit Stundenabrechnung",
  "Dauerläufer mit Monatspauschale",
];

const TOPICS: JarvisTopic[] = [
  {
    id: "offer.create",
    title: "Angebot anlegen",
    keywords: ["angebot anlegen", "angebot erstellen", "neues angebot", "wie lege ich ein angebot"],
    surfaces: ["Projekte OK solutions", "Projekte OK immocare", "Projektakte"],
    actionId: "offer.prepare",
    answer:
      "Öffne zuerst das passende Projekt. Gehe in der Projektakte auf „Dokumente“ und wähle als Dokumentart „Angebote“. Klicke anschließend auf „+ Angebot“, ergänze Kopf- und Positionsdaten, prüfe die Vorschau und erstelle oder speichere das Angebot.",
  },
  {
    id: "offer.addendum",
    title: "Nachtragsangebot anlegen",
    keywords: ["nachtragsangebot", "nachtrag anlegen", "nachtrag erstellen"],
    surfaces: ["Projekte OK solutions", "Projekte OK immocare", "Projektakte"],
    actionId: "offer.prepare",
    answer:
      "Öffne das Projekt und gehe in der Projektakte auf „Dokumente“. Wähle „Angebote: Nachtragsangebote“ und klicke auf „+ Nachtragsangebot“. Ergänze die Positionen und prüfe vor dem Erstellen die Vorschau.",
  },
  {
    id: "appointment.create",
    title: "Termin oder Terminwunsch anlegen",
    keywords: ["termin anlegen", "termin eintragen", "termin erstellen", "terminwunsch", "planungstermin"],
    surfaces: ["Planungsboard", "Projektakte"],
    actionId: "planning.prepare",
    answer:
      "Öffne das Projekt und den Reiter „Termine & Stempelungen“. Mit „+ Termin“ legst du einen festen Planungstermin an. Mit „+ Terminwunsch“ erfasst du einen noch freizugebenden Bedarf. Wähle Mitarbeiter, Datum, Zeit und die passende Zuordnung und speichere anschließend.",
  },
  {
    id: "planning.assignEmployees",
    title: "Mitarbeitende für ein Projekt verplanen",
    keywords: [
      "mitarbeiter verplanen",
      "mitarbeitende verplanen",
      "mitarbeiter einplanen",
      "mitarbeitende einplanen",
      "jungs verplanen",
      "jungs einplanen",
      "team verplanen",
      "team einplanen",
      "personal verplanen",
      "personal einplanen",
      "wie kann ich verplanen",
      "wie plane ich mitarbeiter",
      "projekt verplanen",
    ],
    surfaces: ["Planungsboard", "Projektakte"],
    actionId: "planning.prepare",
    answer: "",
  },
  {
    id: "time.manual",
    title: "Manuellen Zeiteintrag erfassen",
    keywords: [
      "zeiteintrag",
      "zeit eintragen",
      "zeit erfassen",
      "stunden eintragen",
      "stempelung nachtragen",
      "manuelle stempelung",
    ],
    surfaces: ["Projektakte", "Persönliche Daten"],
    actionId: "time.prepare",
    answer: "",
  },
  {
    id: "task.create",
    title: "Aufgabe anlegen",
    keywords: ["aufgabe anlegen", "aufgabe erstellen", "neue aufgabe"],
    surfaces: ["Aufgaben", "Projektakte", "Kundenakte"],
    actionId: "task.prepare",
    answer:
      "Nutze oben „+ Neu“ und wähle „Aufgabe“. Ergänze Titel, Zuständigkeit und Deadline. Wenn die Aufgabe zu einem Kunden oder Projekt gehört, ordne beides direkt im Formular zu und speichere anschließend.",
  },
  {
    id: "contact.create",
    title: "Kontakt anlegen",
    keywords: ["kontakt anlegen", "kunde anlegen", "firma anlegen", "ansprechpartner anlegen", "neuer kontakt"],
    surfaces: ["Kontakte", "Kundenakte"],
    actionId: "contact.manage",
    answer:
      "Öffne „Kontakte“ und klicke auf „+ Kontakt“. Wähle den passenden Kontakttyp, trage die Stammdaten ein und speichere. Einen Ansprechpartner legst du danach in der Kundenakte im Reiter „Ansprechpartner“ an.",
  },
  {
    id: "project.create",
    title: "Projekt anlegen",
    keywords: ["projekt anlegen", "projekt erstellen", "neues projekt"],
    surfaces: ["Projekte OK solutions", "Projekte OK immocare"],
    actionId: "project.manage",
    answer:
      "Nutze oben „+ Neu“ und wähle „Projekt“. Entscheide zuerst den richtigen Geschäftsbereich, ordne den Kunden zu und ergänze Projektart, Verantwortlichkeit und Projektdaten. Prüfe die Angaben und speichere das Projekt.",
  },
  {
    id: "catalog.create",
    title: "Artikel, Leistung oder Paket anlegen",
    keywords: [
      "artikel anlegen",
      "wie lege ich einen artikel an",
      "leistung anlegen",
      "paket anlegen",
      "stammdaten anlegen",
      "katalogposition anlegen",
    ],
    surfaces: ["Artikel & Leistungen"],
    actionId: "catalog.manage",
    answer:
      "Öffne „Artikel & Leistungen“ und wähle oben „+ Artikel“, „+ Leistung“ oder „+ Paket“. Pflege zuerst die Informationen und anschließend den Reiter „Kalkulation“. Bei Paketen ergänzt du dort die enthaltenen Materialien sowie Lohn- oder Maschinenkosten.",
  },
  {
    id: "winter.calculate",
    title: "Winterdienst kalkulieren",
    keywords: ["winterdienst kalkulieren", "winterdienstrechner", "winterdienst paket", "streueinsatz kalkulieren"],
    surfaces: ["Kalkulations-Rechner"],
    answer:
      "Öffne „Kalkulations-Rechner“ und wähle „Winterdienst“. Erfasse die Kalkulationsgrundlagen und berechne die Varianten. Rechnen ist ohne Zuordnung möglich; dauerhaft speichern oder als Paket in ein Angebot übernehmen kannst du erst nach Auswahl eines Projekts. Der Kunde wird daraus automatisch übernommen.",
  },
  {
    id: "vehicle.calculate",
    title: "Fahrt kalkulieren",
    keywords: ["fahrt kalkulieren", "fahrtenrechner", "fahrzeugkosten", "kilometer kalkulieren"],
    surfaces: ["Kalkulations-Rechner"],
    answer:
      "Öffne „Kalkulations-Rechner“ und wähle „Fahrten“. Wähle ein Fahrzeug, trage die Gesamtstrecke ein und übernimm bei Bedarf einen aktuellen Kraftstoffpreis. Der Rechner berücksichtigt bewusst nur Fahrzeug- und Kraftstoffkosten, keine Personalkosten.",
  },
];

function normalize(value: string) {
  return value
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesOne(value: string, candidates: string[]) {
  return candidates.some((candidate) => value.includes(normalize(candidate)));
}

function getTimeEntryAnswer(question: string, context: JarvisSurfaceContext): JarvisHelpResult {
  const normalized = normalize(question);
  const isOneTime =
    context.projectKind === "oneTime" ||
    includesOne(normalized, ["einmaliges projekt", "einmalig", "einmal-projekt"]);
  const isHourly =
    context.billingMode === "hourly" ||
    includesOne(normalized, ["stundenabrechnung", "nach stunden", "stunden dauerläufer"]);
  const isMonthlyFlat =
    context.billingMode === "monthlyFlat" ||
    includesOne(normalized, ["monatspauschale", "monatliche pauschale", "pauschal dauerläufer"]);

  if (!isOneTime && !isHourly && !isMonthlyFlat) {
    return {
      type: "clarification",
      topicId: "time.manual",
      message: "Für welche Projektart möchtest du den Zeiteintrag erfassen?",
      choices: PROJECT_KIND_CHOICES,
    };
  }

  const assignment = isOneTime
    ? "Wähle die Auftragsgrundlage aus dem aktiven Angebot oder Nachtrag. Ohne Angebot musst du die Ausnahme begründen."
    : isHourly
      ? "Wähle das Verrechnungsgewerk und die passende aktive Stunden-Abrechnungsleistung."
      : "Bei einer Monatspauschale ist keine zusätzliche Verrechnungszuordnung nötig.";

  return {
    type: "answer",
    topicId: "time.manual",
    message:
      `Öffne das Projekt und den Reiter „Termine & Stempelungen“. Klicke auf „+ Zeiteintrag“, wähle Mitarbeiter, Datum, Start, Ende und Pause. ${assignment} Ergänze den Grund im Kommentarfeld und speichere den Eintrag.`,
  };
}

function getEmployeePlanningAnswer(context: JarvisSurfaceContext): JarvisHelpResult {
  const start =
    context.recordType === "project"
      ? "Du bist bereits in der Projektakte. Öffne dort „Termine & Stempelungen“ und klicke auf „+ Termin“."
      : "Öffne das passende Projekt, gehe auf „Termine & Stempelungen“ und klicke auf „+ Termin“. Alternativ kannst du die Planung im „Planungsboard“ beginnen.";
  const billingNote =
    context.billingMode === "hourly"
      ? "Da dieses Projekt nach Stunden abgerechnet wird, wählst du zusätzlich „Termin-Gewerk“ und „Abrechnungsleistung“."
      : context.billingMode === "monthlyFlat"
        ? "Bei der Monatspauschale ist keine zusätzliche Abrechnungsleistung nötig."
        : "Bei einem Dauerläufer mit Stundenabrechnung wählst du zusätzlich „Termin-Gewerk“ und „Abrechnungsleistung“.";

  return {
    type: "answer",
    topicId: "planning.assignEmployees",
    message:
      `${start} Wähle Planungsboard, Planungsgruppe, Mitarbeiter, Datum sowie Von/Bis und speichere die Planung. ${billingNote} „+ Terminwunsch“ nutzt du nur, wenn der Termin erst noch freigegeben werden soll.`,
  };
}

function scoreTopic(topic: JarvisTopic, question: string, context: JarvisSurfaceContext) {
  const normalized = normalize(question);
  let intentScore = 0;

  topic.keywords.forEach((keyword) => {
    const normalizedKeyword = normalize(keyword);
    if (normalized.includes(normalizedKeyword)) intentScore += normalizedKeyword.split(" ").length * 4;
    normalizedKeyword.split(" ").forEach((term) => {
      if (term.length >= 5 && normalized.includes(term)) intentScore += 1;
    });
  });

  // Der Oberflächenkontext darf eine erkannte Absicht präzisieren, aber niemals
  // allein ein fachlich unpassendes Hilfethema auswählen.
  if (intentScore === 0) return 0;

  let score = intentScore;
  if (context.module && topic.surfaces?.includes(context.module)) score += 2;
  if (context.recordType === "project" && topic.surfaces?.includes("Projektakte")) score += 2;
  if (context.recordType === "customer" && topic.surfaces?.includes("Kundenakte")) score += 2;
  return score;
}

export function sanitizeJarvisSurfaceContext(value: unknown): JarvisSurfaceContext {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  const text = (key: string, maxLength = 80) =>
    typeof source[key] === "string" ? String(source[key]).trim().slice(0, maxLength) : undefined;
  const recordType = source.recordType;
  const projectKind = source.projectKind;
  const billingMode = source.billingMode;

  return {
    module: text("module"),
    subview: text("subview"),
    modal: text("modal"),
    recordType:
      recordType === "customer" || recordType === "project" || recordType === "none" ? recordType : "none",
    projectKind:
      projectKind === "oneTime" || projectKind === "recurring" || projectKind === "unknown"
        ? projectKind
        : "unknown",
    billingMode:
      billingMode === "hourly" || billingMode === "monthlyFlat" || billingMode === "unknown"
        ? billingMode
        : "unknown",
  };
}

export function resolveJarvisSystemHelp(
  question: string,
  context: JarvisSurfaceContext = {},
  accessProfile?: JarvisAccessProfile
): JarvisHelpResult {
  const cleaned = question.trim().slice(0, 1800);
  if (!cleaned) {
    return { type: "unknown", message: "Bitte stelle mir eine Frage zur Bedienung von WorkPilot360." };
  }

  const authorization = authorizeJarvisQuestion(cleaned, accessProfile);
  if (!authorization.allowed) {
    return {
      type: "refusal",
      message: getJarvisRefusalMessage(authorization),
    };
  }
  if (
    authorization.dataClass === "payroll" ||
    authorization.dataClass === "personnel" ||
    authorization.dataClass === "financial"
  ) {
    return {
      type: "unknown",
      message:
        "Deine Rolle erlaubt diese Datenklasse. Die konkrete Abfrage ist im aktuellen JARVIS-Ausbaustand noch nicht sicher angebunden.",
    };
  }

  const ranked = TOPICS
    .map((topic) => ({ topic, score: scoreTopic(topic, cleaned, context) }))
    .sort((first, second) => second.score - first.score);
  const match = ranked[0];

  if (!match || match.score < 3) {
    return {
      type: "unknown",
      message:
        "Dazu habe ich noch keine freigegebene WorkPilot-Anleitung. Formuliere bitte kurz, welche Funktion oder welchen Reiter du bedienen möchtest.",
    };
  }
  if (match.topic.actionId) {
    if (!accessProfile) {
      return {
        type: "refusal",
        message: "Für diese Bedienhilfe muss deine aktuelle WorkPilot-Rolle eindeutig geprüft werden.",
      };
    }
    const actionDecision = getJarvisActionDecision(match.topic.actionId, accessProfile);
    if (!actionDecision.permitted) {
      return {
        type: "refusal",
        topicId: match.topic.id,
        message:
          "Diese Funktion ist für deine aktuelle WorkPilot-Rolle nicht freigegeben. JARVIS kann sie deshalb weder erklären noch vorbereiten.",
      };
    }
  }

  if (match.topic.id === "time.manual") return getTimeEntryAnswer(cleaned, context);
  if (match.topic.id === "planning.assignEmployees") return getEmployeePlanningAnswer(context);
  return {
    type: "answer",
    topicId: match.topic.id,
    message: match.topic.answer,
  };
}

function getJarvisRefusalMessage(authorization: JarvisQuestionAuthorization) {
  if (authorization.reason === "prompt_injection") {
    return "Diese Anweisung kann ich nicht befolgen. Ich bleibe bei freigegebenen Hilfen zur Bedienung von WorkPilot360.";
  }
  if (authorization.reason === "secret") {
    return "Passwörter, API-Schlüssel, Tokens und technische Geheimnisse sind in JARVIS für alle Rollen gesperrt.";
  }
  if (authorization.dataClass === "payroll" || authorization.dataClass === "personnel") {
    return "Deine aktuelle Rolle darf diese sensiblen Personal- oder Lohndaten nicht über JARVIS abrufen.";
  }
  if (authorization.dataClass === "financial") {
    return "Deine aktuelle Rolle darf diese Finanzdaten oder Finanzfunktion nicht über JARVIS verwenden.";
  }
  if (authorization.dataClass === "customer") {
    return "Deine aktuelle Rolle darf diese Kunden- oder Kontaktdaten nicht über JARVIS verwenden.";
  }
  return "Diese Information ist für deine aktuelle Rolle in JARVIS nicht freigegeben.";
}

export function getJarvisKnowledgeExcerpt(topicId?: string) {
  const topic = TOPICS.find((item) => item.id === topicId);
  if (!topic) return "";
  return `${topic.title}: ${topic.answer}`.trim();
}
