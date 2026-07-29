import {
  authorizeJarvisQuestion,
  getJarvisAuthorizationRefusalMessage,
  JarvisAccessProfile,
  JarvisQuestionAuthorization,
} from "@/lib/jarvis/security";
import { getJarvisActionDecision } from "@/lib/jarvis/actions";
import {
  findJarvisAreaByContext,
  findJarvisSystemAreas,
} from "@/lib/jarvis/system-map";
import type { JarvisNavigationTarget, JarvisSystemArea } from "@/lib/jarvis/system-map";
import {
  createJarvisDialogChoice,
  type JarvisDialogChoice,
} from "@/lib/jarvis/dialog";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";

export type JarvisSurfaceContext = {
  module?: string;
  subview?: string;
  recordType?: "none" | "customer" | "project";
  recordId?: string;
  projectKind?: "unknown" | "oneTime" | "recurring";
  billingMode?: "unknown" | "hourly" | "monthlyFlat";
  modal?: string;
};

export type JarvisHelpResult = {
  type: "answer" | "clarification" | "refusal" | "unknown";
  message: string;
  choices?: JarvisDialogChoice[];
  topicId?: string;
  navigation?: JarvisNavigationTarget;
};

function buildRoleAwareFallbackChoices(
  context: JarvisSurfaceContext,
  accessProfile?: JarvisAccessProfile
) {
  const choices: JarvisDialogChoice[] = [];
  if (context.module || context.subview || context.recordType === "project") {
    choices.push(
      createJarvisDialogChoice(
        "fallback-current-area",
        "Aktuellen Bereich erklären",
        "Was kann ich im aktuell geöffneten Bereich machen?"
      )
    );
  }
  if (!accessProfile) return choices;

  if (getJarvisActionDecision("project.read", accessProfile).executable) {
    choices.push(
      createJarvisDialogChoice(
        "fallback-projects",
        "Projekte, Planung & Zeiten",
        "Wie finde ich ein Projekt und wo prüfe ich Planung, Termine und Stempelungen?"
      )
    );
  }
  if (getJarvisActionDecision("contact.read", accessProfile).executable) {
    choices.push(
      createJarvisDialogChoice(
        "fallback-contacts",
        "Kunden & Kontakte",
        "Wie finde und bearbeite ich Kunden und Kontakte?"
      )
    );
  }
  if (getJarvisActionDecision("task.read", accessProfile).executable) {
    choices.push(
      createJarvisDialogChoice(
        "fallback-tasks",
        "Aufgaben & offene Punkte",
        "Wie finde und bearbeite ich meine Aufgaben und offenen Punkte?"
      )
    );
  }
  const canReadOffers = getJarvisActionDecision("offer.read", accessProfile).executable;
  const canReadInvoices = getJarvisActionDecision("invoice.read", accessProfile).executable;
  if (canReadOffers || canReadInvoices) {
    const label =
      canReadOffers && canReadInvoices
        ? "Angebote & Rechnungen"
        : canReadOffers
          ? "Angebote"
          : "Rechnungen";
    choices.push(
      createJarvisDialogChoice(
        "fallback-commercial",
        label,
        `Wie finde und prüfe ich ${label.toLowerCase()}?`
      )
    );
  }
  return choices;
}

function looksLikeWorkPilotQuestion(question: string) {
  const value = question.toLocaleLowerCase("de-DE");
  return (
    /\b(?:[a-zäöü]{2,}[- ]?\d+|\d{5,})\b/i.test(question) ||
    /(projekt|kunde|kontakt|angebot|rechnung|aufgabe|termin|planung|stempel|zeiteintrag|mitarbeiter|auswertung|dashboard|logbuch|dokument|leistung|artikel|kalkulation|einstellung|workpilot|jarvis|reiter|funktion|bereich|akte|status)/.test(
      value
    )
  );
}

type JarvisTopic = {
  id: string;
  title: string;
  keywords: string[];
  surfaces?: string[];
  answer: string;
  actionId?: string;
};

const PROJECT_KIND_CHOICES: JarvisDialogChoice[] = [
  createJarvisDialogChoice(
    "time-entry-one-time",
    "Einmaliges Projekt",
    "Wie erfasse ich einen manuellen Zeiteintrag für ein einmaliges Projekt?"
  ),
  createJarvisDialogChoice(
    "time-entry-hourly",
    "Dauerläufer mit Stundenabrechnung",
    "Wie erfasse ich einen manuellen Zeiteintrag für einen Dauerläufer mit Stundenabrechnung?"
  ),
  createJarvisDialogChoice(
    "time-entry-flat",
    "Dauerläufer mit Monatspauschale",
    "Wie erfasse ich einen manuellen Zeiteintrag für einen Dauerläufer mit Monatspauschale?"
  ),
];

const TOPICS: JarvisTopic[] = [
  {
    id: "jarvis.principles",
    title: "Auftrag und Prinzipien von JARVIS",
    keywords: [
      "was sind deine prinzipien",
      "welche prinzipien hast du",
      "wofür stehst du als jarvis",
      "welchen auftrag hat jarvis",
      "was ist dein auftrag",
      "wie arbeitet jarvis",
    ],
    surfaces: ["JARVIS"],
    answer:
      "Mein Auftrag ist, den Menschen im Unternehmen Orientierung, Rat und Hilfe zu geben und sie bei Wachstum, Entwicklung und Erfolg zu unterstützen. Meine Prinzipien sind: 1. sinnvoll automatisieren; 2. konsequent vereinfachen; 3. bei Hindernissen den KI-Joker nutzen; 4. mit einem klaren langfristigen Zielbild arbeiten; 5. nach größtem Nutzen priorisieren; 6. das beste Werkzeug für das Ergebnis wählen; 7. mit verlässlichen Daten arbeiten – denn Shit in, Shit out; 8. immer vom Kunden aus denken; 9. Flexibilität in Systeme, Prozesse und Rollen einbauen. Diese Prinzipien sind lebendig und werden gemeinsam weiterentwickelt. Bei Menschen unterstütze ich transparent, geduldig und faktenbasiert: Ich fördere Stärken, helfe kontinuierlich an Entwicklungsfeldern zu arbeiten und unterstütze Führung, erstelle aber keine heimlichen Persönlichkeitsprofile und treffe keine Personalentscheidungen. Die Verantwortung bleibt beim Menschen.",
  },
  {
    id: "project.search",
    title: "Projektübersicht öffnen",
    keywords: [
      "alle projekte",
      "projektübersicht",
      "projektübersicht öffnen",
      "wo finde ich projekte",
      "projekte suchen",
    ],
    surfaces: ["Projekte OK solutions", "Projekte OK immocare"],
    answer:
      "Öffne in der Sidebar den passenden Projektbereich „Projekte OK solutions“ oder „Projekte OK immocare“. Dort findest du die Projektübersicht mit Suche und Statusfiltern; über einen Treffer öffnest du die jeweilige Projektakte.",
  },
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
    id: "project.documents.open",
    title: "Projektdokumente finden",
    keywords: [
      "dokumente eines projekts",
      "projektdokumente finden",
      "wo sehe ich die dokumente",
      "wo finde ich die dokumente",
      "dokumente im projekt",
    ],
    surfaces: ["Projektakte"],
    answer:
      "Öffne das betreffende Projekt und wähle links „Dokumente“. Dort findest du die zum Projekt gespeicherten Angebote, Rechnungen und weiteren Dokumentarten. Über die Auswahl innerhalb des Reiters wechselst du zur benötigten Dokumentart.",
  },
  {
    id: "project.logbook.open",
    title: "Projekt-Logbuch nutzen",
    keywords: [
      "wofür ist das logbuch",
      "wozu dient das logbuch",
      "projekt logbuch",
      "logbucheintrag hinzufügen",
      "logbucheintrag anlegen",
      "eintrag ins logbuch",
    ],
    surfaces: ["Projektakte"],
    answer:
      "Das Projekt-Logbuch ist die nachvollziehbare Chronik für Kommentare, Arbeitsstände und Systemereignisse. Öffne das betreffende Projekt und wähle links „Logbuch“. Einen neuen manuellen Eintrag erstellst du dort über „+ Eintrag“; dokumentiere nur tatsächliche Vorgänge und ordne den Eintrag dem richtigen Projektzeitraum zu.",
  },
  {
    id: "project.images.open",
    title: "Projektbilder und Bildnachweise finden",
    keywords: [
      "bilder zum projekt ansehen",
      "bilder eines projekts",
      "projektbilder ansehen",
      "projektbilder finden",
      "wo finde ich bilder",
      "vorherbilder",
      "nachherbilder",
      "bildnachweise",
    ],
    surfaces: ["Projektakte"],
    answer:
      "Öffne das betreffende Projekt und wähle links „Bilder“. Dort findest du die vorhandenen Projektbilder sowie – wenn für den Ablauf vorgesehen – die Gruppen „Vorherbilder“ und „Nachherbilder“. Prüfe bei Nachweisen immer den richtigen Leistungsmonat; fehlende Originalbilder dürfen nicht durch erfundene oder duplizierte Bilder ersetzt werden.",
  },
  {
    id: "project.approvals.open",
    title: "Projektfreigaben finden",
    keywords: [
      "projektfreigaben finden",
      "freigaben im projekt",
      "wo finde ich freigaben",
      "wo sehe ich freigaben",
      "angebotsfreigaben finden",
    ],
    surfaces: ["Projektakte"],
    answer:
      "Öffne das betreffende Projekt und wähle links „Freigaben“. Dort prüfst du vorhandene digitale Angebotsaufrufe, Annahmen und Freigabenachweise. Ob für das konkrete Projekt bereits eine Freigabe vorliegt, beantwortet nur der tatsächlich gespeicherte Eintrag – JARVIS nimmt sie nicht pauschal an.",
  },
  {
    id: "project.tasks.open",
    title: "Projektaufgaben finden",
    keywords: [
      "aufgaben eines projekts",
      "projektaufgaben finden",
      "wo finde ich die aufgaben",
      "aufgaben im projekt",
    ],
    surfaces: ["Projektakte", "Aufgaben"],
    answer:
      "Öffne das betreffende Projekt und wähle links „Aufgaben“. Dort siehst du die mit diesem Projekt verknüpften Aufgaben und ihren aktuellen Status. Die zentrale Aufgabenübersicht findest du zusätzlich in der Sidebar unter „Aufgaben“.",
  },
  {
    id: "project.status.change",
    title: "Projektstatus ändern",
    keywords: [
      "status eines projekts ändern",
      "projektstatus ändern",
      "wie ändere ich den status",
    ],
    surfaces: ["Projektakte"],
    actionId: "project.manage",
    answer:
      "Öffne das betreffende Projekt und klicke im Projektkopf auf „Status ändern“. Wähle den fachlich passenden neuen Status, ergänze einen notwendigen Hinweis und bestätige die Änderung. Beachte, dass ein Statuswechsel projektbezogene Automatiken und Prüfungen auslösen kann.",
  },
  {
    id: "contact.search",
    title: "Kunden oder Kontakt finden",
    keywords: [
      "bestimmten kunden finden",
      "kunden suchen",
      "kontakt suchen",
      "wie finde ich einen kunden",
    ],
    surfaces: ["Kontakte", "Kundenakte"],
    answer:
      "Öffne „Kontakte“ und nutze dort die Suche nach Name, Firma, Kundennummer, E-Mail oder Ort. Für einen schnellen Direktaufruf kannst du auch die globale Suche oben in WorkPilot360 verwenden.",
  },
  {
    id: "notifications.open",
    title: "Benachrichtigungen öffnen",
    keywords: [
      "benachrichtigungen sehen",
      "benachrichtigungen öffnen",
      "wo sehe ich benachrichtigungen",
      "meldungen öffnen",
    ],
    surfaces: ["Dashboard"],
    answer:
      "Öffne oben rechts das Glockensymbol. Dort siehst du neue und bereits gelesene WorkPilot360-Benachrichtigungen und kannst ihre verknüpften Datensätze öffnen.",
  },
  {
    id: "invoice.open",
    title: "Rechnung finden oder Status prüfen",
    keywords: [
      "rechnung prüfen",
      "status einer rechnung",
      "rechnung finden",
      "wo finde ich die rechnung",
      "wo sehe ich offene rechnungen",
      "offene rechnungen sehen",
    ],
    surfaces: ["Projektakte", "Buchhaltung"],
    answer:
      "Öffne das betreffende Projekt und dort den Bereich „Rechnungen“. Wähle die gewünschte Rechnung aus und prüfe Status, Rechnungsdatum, Leistungsmonat und Positionen. Projektübergreifend findest du Rechnungen zusätzlich unter „Buchhaltung“.",
  },
  {
    id: "recurring.next-invoice",
    title: "Nächste Monatsrechnung beim Dauerläufer",
    keywords: [
      "nächste monatsrechnung erzeugt",
      "dauerläufer nächste monatsrechnung",
      "wie wird die nächste monatsrechnung erzeugt",
    ],
    surfaces: ["Projektakte", "Buchhaltung"],
    answer:
      "Bei einem Stunden-Dauerläufer erzeugt die erste vollständig zugeordnete Stempelung eines Leistungsmonats genau einen Rechnungsentwurf; weitere passende Zeiten werden diesem Entwurf zugeordnet. Bei einer Monatspauschale folgt die Monatskette der aktiven Rechnung des direkten Vormonats und darf keinen Monat überspringen. Prüfe vor dem Fertigstellen immer Projektart, Abrechnungsmodell, Leistungsmonat und den vorhandenen Entwurf, damit keine Doppelrechnung entsteht.",
  },
  {
    id: "stamp.interruption-comment",
    title: "Kommentar einer Arbeitsunterbrechung finden",
    keywords: [
      "kommentar zu einer arbeitsunterbrechung",
      "grund der unterbrechung",
      "unterbrechung kommentar",
    ],
    surfaces: ["Projektakte"],
    answer:
      "Öffne im Projekt „Termine & Stempelungen“ und wähle den betroffenen Zeiteintrag. Den dokumentierten Grund findest du in den Details der Unterbrechung beziehungsweise im Kommentarfeld des Eintrags. Prüfe zusätzlich eine verknüpfte Klärungsaufgabe und das Logbuch, falls der Arbeitsablauf dort fortgeführt wurde.",
  },
  {
    id: "offer.tracking",
    title: "Angebotsöffnung und Annahme prüfen",
    keywords: [
      "angebot geöffnet",
      "angebot angesehen",
      "angebot angenommen",
      "verbindlich angenommen",
      "status eines angebots",
    ],
    surfaces: ["Projektakte"],
    actionId: "offer.prepare",
    answer:
      "Öffne im Projekt das betreffende Angebot. Dort siehst du, ob und wann der öffentliche Angebotslink geöffnet wurde, wie oft er aufgerufen wurde und ob eine verbindliche Annahme mit Freigabenachweis vorliegt.",
  },
  {
    id: "offer.send",
    title: "Angebot per E-Mail versenden",
    keywords: [
      "angebot per e mail versenden",
      "angebot per email versenden",
      "angebot verschicken",
      "angebot senden",
    ],
    surfaces: ["Projektakte"],
    actionId: "offer.prepare",
    answer:
      "Öffne im Projekt das fertige Angebot und prüfe zuerst Empfänger, Positionen, Gesamtbetrag und Vorschau. Wähle anschließend die E-Mail-Funktion am Angebot, kontrolliere Empfänger, Betreff, Nachricht und Anhänge und versende erst nach dieser Abschlussprüfung. Der Versand erzeugt den digitalen Angebotslink für Öffnungs- und Annahmenachweise.",
  },
  {
    id: "appointment.create",
    title: "Termin oder Terminwunsch anlegen",
    keywords: [
      "termin anlegen",
      "termin eintragen",
      "termin erstellen",
      "termin buchen",
      "termin planen",
      "wie buche ich einen termin",
      "einsatztermin",
      "terminwunsch",
      "planungstermin",
    ],
    surfaces: ["Planungsboard", "Projektakte"],
    actionId: "planning.prepare",
    answer: "",
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

export const JARVIS_HELP_TOPIC_CATALOG = TOPICS.map((topic) => ({
  id: topic.id,
  title: topic.title,
}));

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

const SYSTEM_MAP_INTENTS = [
  "wo finde ich",
  "wo ist",
  "wo kann ich",
  "öffne",
  "oeffne",
  "navigiere",
  "bring mich",
  "wie komme ich",
  "wie gelange ich",
  "wo sehe ich",
  "was kann ich hier",
  "was mache ich hier",
  "wofür ist",
  "wofuer ist",
  "was ist der bereich",
  "was ist dieser bereich",
  "erkläre mir den bereich",
  "erklaere mir den bereich",
];

function isSystemMapIntent(question: string) {
  const normalized = normalize(question);
  return SYSTEM_MAP_INTENTS.some((intent) => normalized.includes(normalize(intent)));
}

function getSystemAreaMessage(areaDefinition: JarvisSystemArea) {
  const workflowText = areaDefinition.workflows
    .map((workflow, index) => `${index + 1}. ${workflow}`)
    .join(" ");
  const limitation =
    areaDefinition.status === "limited"
      ? " Der Bereich ist derzeit nur eingeschränkt ausgebaut; JARVIS verspricht dort keine noch nicht vorhandenen Funktionen."
      : "";
  return `${areaDefinition.label}: ${areaDefinition.purpose} Typische Schritte: ${workflowText}${limitation}`;
}

function getSystemMapHelp(
  question: string,
  context: JarvisSurfaceContext,
  accessProfile?: JarvisAccessProfile
): JarvisHelpResult | undefined {
  if (!isSystemMapIntent(question)) return undefined;

  const normalized = normalize(question);
  const asksAboutCurrentContext = includesOne(normalized, [
    "hier",
    "dieser bereich",
    "diesem bereich",
    "aktuelle bereich",
    "aktuellen bereich",
  ]);
  const explicitArea = findJarvisSystemAreas(question, accessProfile, 1)[0]?.area;
  const contextArea = asksAboutCurrentContext && !explicitArea
    ? findJarvisAreaByContext(context.module, context.subview, accessProfile)
    : undefined;
  const areaDefinition = explicitArea ?? contextArea;
  if (!areaDefinition) return undefined;

  const isMatchingRecordContext =
    (areaDefinition.kind === "project_file" && context.recordType === "project") ||
    (areaDefinition.kind === "customer_file" && context.recordType === "customer");
  const navigation =
    areaDefinition.kind === "project_file" || areaDefinition.kind === "customer_file"
      ? isMatchingRecordContext
        ? areaDefinition.target
        : undefined
      : areaDefinition.target;

  return {
    type: "answer",
    topicId: `systemMap.${areaDefinition.id}`,
    message: getSystemAreaMessage(areaDefinition),
    navigation,
  };
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

function extractHelpProjectReference(question: string) {
  return (
    question
      .match(/\b(?:[\p{L}]{2,}-\d+|[A-ZÄÖÜ]{2,}\s+\d+|\d{5,})\b/u)?.[0]
      ?.trim() ?? ""
  );
}

function getAppointmentAnswer(
  question: string,
  context: JarvisSurfaceContext
): JarvisHelpResult {
  const explicitReference = extractHelpProjectReference(question);
  const start = explicitReference
    ? `Öffne das Projekt ${explicitReference} und dort „Termine & Stempelungen“. Klicke anschließend auf „+ Termin“.`
    : context.recordType === "project"
      ? "Du bist bereits in der Projektakte. Öffne links „Termine & Stempelungen“ und klicke auf „+ Termin“."
      : "Öffne zuerst das passende Projekt und dort „Termine & Stempelungen“. Klicke anschließend auf „+ Termin“.";
  const billingNote =
    !explicitReference && context.billingMode === "hourly"
      ? "Da dieses Projekt nach Stunden abgerechnet wird, wählst du zusätzlich „Termin-Gewerk“ und „Abrechnungsleistung“."
      : !explicitReference && context.billingMode === "monthlyFlat"
        ? "Bei diesem Projekt mit Monatspauschale ist keine zusätzliche Abrechnungsleistung erforderlich."
        : "Bei einem Dauerläufer mit Stundenabrechnung sind zusätzlich „Termin-Gewerk“ und „Abrechnungsleistung“ erforderlich.";

  return {
    type: "answer",
    topicId: "appointment.create",
    message:
      `${start} Wähle Planungsboard, Planungsgruppe, Mitarbeiter, Datum sowie Von/Bis und speichere den Termin. ${billingNote} „+ Terminwunsch“ verwendest du nur, wenn der Termin erst noch freigegeben werden soll.`,
  };
}

function scoreTopic(topic: JarvisTopic, question: string, context: JarvisSurfaceContext) {
  const normalized = normalize(question);
  const stopWords = new Set([
    "als",
    "am",
    "an",
    "auf",
    "bei",
    "das",
    "dem",
    "den",
    "der",
    "die",
    "ein",
    "eine",
    "einen",
    "einem",
    "einer",
    "eines",
    "für",
    "hier",
    "ich",
    "im",
    "in",
    "ist",
    "kann",
    "mit",
    "oder",
    "und",
    "von",
    "was",
    "wie",
    "wo",
    "zu",
    "zum",
    "zur",
  ]);
  const stem = (word: string) => {
    if (word.length < 5) return word;
    return word.replace(/(?:em|en|es|e|n)$/u, "");
  };
  const questionTerms = new Set(
    normalized
      .split(" ")
      .filter(Boolean)
      .map(stem)
  );
  let intentScore = 0;

  topic.keywords.forEach((keyword) => {
    const normalizedKeyword = normalize(keyword);
    const keywordTerms = normalizedKeyword
      .split(" ")
      .filter((term) => term && !stopWords.has(term))
      .map(stem);
    const matches =
      normalized.includes(normalizedKeyword) ||
      (keywordTerms.length > 0 &&
        keywordTerms.every((term) => questionTerms.has(term)));
    if (matches) {
      intentScore += Math.max(keywordTerms.length, 1) * 4;
    }
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

export function findJarvisExactHelpTopicId(
  question: string,
  context: JarvisSurfaceContext = {}
) {
  const normalizedIntent = normalizeJarvisIntentText(question);
  if (
    /\btermin\w*\b/.test(normalizedIntent) &&
    /\b(?:buch|leg|erstell|eintrag|plan)\w*\b/.test(normalizedIntent)
  ) {
    return "appointment.create";
  }
  const ranked = TOPICS
    .map((topic) => ({ topic, score: scoreTopic(topic, question, context) }))
    .sort((first, second) => second.score - first.score);
  return ranked[0]?.score >= 3 ? ranked[0].topic.id : undefined;
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
    recordId: text("recordId", 120),
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
  const matchedTopicId = findJarvisExactHelpTopicId(cleaned, context);
  if (matchedTopicId) {
    return resolveJarvisSystemHelpTopic(
      matchedTopicId,
      cleaned,
      context,
      accessProfile
    );
  }
  const systemMapHelp = getSystemMapHelp(cleaned, context, accessProfile);
  if (systemMapHelp) return systemMapHelp;
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

  {
    const hasWorkPilotSignal = looksLikeWorkPilotQuestion(cleaned);
    const choices =
      hasWorkPilotSignal || accessProfile
        ? buildRoleAwareFallbackChoices(context, accessProfile)
        : [];
    if (choices.length > 0) {
      return {
        type: "clarification",
        topicId: "system-help.clarification",
        message: hasWorkPilotSignal
          ? "Ich konnte deine Frage noch nicht eindeutig verstehen. Meinst du einen dieser WorkPilot360-Bereiche? Du kannst auch kurz beschreiben, was du erreichen möchtest."
          : "Ich konnte deine Frage nicht sicher verstehen oder WorkPilot360 zuordnen. Meinst du einen dieser Bereiche? Du kannst dein Ziel auch noch einmal mit anderen Worten beschreiben.",
        choices,
      };
    }
    return {
      type: "unknown",
      message:
        "Dazu habe ich noch keine freigegebene WorkPilot-Anleitung. Formuliere bitte kurz, welche Funktion oder welchen Reiter du bedienen möchtest.",
    };
  }
}

export function resolveJarvisSystemHelpTopic(
  topicId: string,
  question: string,
  context: JarvisSurfaceContext = {},
  accessProfile?: JarvisAccessProfile
): JarvisHelpResult {
  const cleaned = question.trim().slice(0, 1800);
  const topic = TOPICS.find((candidate) => candidate.id === topicId);
  if (!topic) {
    return {
      type: "unknown",
      message:
        "Diese Bedienhilfe ist in WorkPilot360 noch nicht eindeutig hinterlegt.",
    };
  }

  const authorization = authorizeJarvisQuestion(cleaned, accessProfile);
  if (!authorization.allowed) {
    return {
      type: "refusal",
      message: getJarvisRefusalMessage(authorization),
    };
  }
  if (topic.actionId) {
    if (!accessProfile) {
      return {
        type: "refusal",
        message:
          "Für diese Bedienhilfe muss deine aktuelle WorkPilot-Rolle eindeutig geprüft werden.",
      };
    }
    const actionDecision = getJarvisActionDecision(
      topic.actionId,
      accessProfile
    );
    if (!actionDecision.permitted) {
      return {
        type: "refusal",
        topicId: topic.id,
        message:
          "Diese Funktion ist für deine aktuelle WorkPilot-Rolle nicht freigegeben. JARVIS kann sie deshalb weder erklären noch vorbereiten.",
      };
    }
  }

  if (topic.id === "appointment.create") {
    return getAppointmentAnswer(cleaned, context);
  }
  if (topic.id === "time.manual") return getTimeEntryAnswer(cleaned, context);
  if (topic.id === "planning.assignEmployees") {
    return getEmployeePlanningAnswer(context);
  }
  return {
    type: "answer",
    topicId: topic.id,
    message: topic.answer,
  };
}

function getJarvisRefusalMessage(authorization: JarvisQuestionAuthorization) {
  return getJarvisAuthorizationRefusalMessage(authorization);
}

export function getJarvisKnowledgeExcerpt(topicId?: string) {
  const topic = TOPICS.find((item) => item.id === topicId);
  if (!topic) return "";
  return `${topic.title}: ${topic.answer}`.trim();
}
