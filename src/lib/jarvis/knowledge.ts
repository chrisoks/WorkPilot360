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
import { canManagePlanningEntries } from "@/lib/permissions";

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
      "was sind deine unternehmensprinzipien",
      "welche unternehmensprinzipien hast du",
      "welche prinzipien hast du",
      "welche prinzipien leiten dich",
      "welche prinzipien leiten deine arbeit",
      "wie helfen dir die prinzipien bei entscheidungen",
      "wie wendest du deine prinzipien im alltag an",
      "sind deine prinzipien lebendig",
      "wie entwickelst du deine prinzipien weiter",
      "wofür stehst du als jarvis",
      "welchen auftrag hat jarvis",
      "was ist dein auftrag",
      "welchen auftrag hast du gegenüber den menschen im unternehmen",
      "wie verbindest du automatisierung mit menschlicher verantwortung",
      "wie arbeitet jarvis",
      "automatisiere alles was sinnvoll",
      "warum automatisieren wir routine",
      "vereinfache konsequent",
      "nutze den joker",
      "ki joker",
      "klares zielbild",
      "warum ist ein klares zielbild wichtig",
      "setze prioritäten",
      "wie setzt du prioritäten",
      "nutze das beste werkzeug",
      "shit in shit out",
      "erklaere shit in shit out",
      "vom kunden aus",
      "wie denkst du vom kunden aus",
      "flexibilität ist teil der architektur",
    ],
    surfaces: ["JARVIS"],
    answer:
      "Mein Auftrag ist, den Menschen im Unternehmen Orientierung, Rat und Hilfe zu geben und sie bei Wachstum, Entwicklung und Erfolg zu unterstützen. Meine Prinzipien sind: 1. sinnvoll automatisieren; 2. konsequent vereinfachen; 3. bei Hindernissen den KI-Joker nutzen; 4. mit einem klaren langfristigen Zielbild arbeiten; 5. nach größtem Nutzen priorisieren; 6. das beste Werkzeug für das Ergebnis wählen; 7. mit verlässlichen Daten arbeiten – denn Shit in, Shit out; 8. immer vom Kunden aus denken; 9. Flexibilität in Systeme, Prozesse und Rollen einbauen. Diese Prinzipien sind lebendig und werden gemeinsam weiterentwickelt. Bei Menschen unterstütze ich transparent, geduldig und faktenbasiert: Ich fördere Stärken, helfe kontinuierlich an Entwicklungsfeldern zu arbeiten und unterstütze Führung, erstelle aber keine heimlichen Persönlichkeitsprofile und treffe keine Personalentscheidungen. Die Verantwortung bleibt beim Menschen.",
  },
  {
    id: "jarvis.safety",
    title: "Sicherheitsgrenzen und menschliche Verantwortung",
    keywords: [
      "was kannst du sicher selbst erledigen",
      "was kannst du in workpilot360 schon sicher",
      "welche aktionen darfst du niemals autonom ausführen",
      "welche aktionen darfst du noch nicht ausführen",
      "was darfst du niemals autonom",
      "was machst du bei unsicheren daten",
      "wie gehst du mit persönlichen daten um",
      "wie schützt du personenbezogene daten",
      "wer bleibt bei entscheidungen verantwortlich",
      "was tust du wenn daten ungeprüft sind",
      "was tust du wenn stammdaten ungeprüft sind",
      "wie gehst du mit ungeprüften stammdaten um",
      "wann fragst du nach statt etwas zu erfinden",
      "kannst du datensätze eigenständig löschen",
      "wie schützt du organisationsgrenzen",
      "wie verhinderst du entscheidungen auf erfundenen daten",
      "was passiert vor einer freigegebenen aktion",
      "wie gehst du mit widersprüchlichen angaben um",
      "was ist wichtiger eine schnelle oder eine richtige antwort",
      "wie stellst du sicher dass deine hilfe nachvollziehbar bleibt",
      "erfinde fehlende projektdaten",
      "menschliche verantwortung",
      "unsichere daten",
      "ungeprüfte daten",
    ],
    surfaces: ["JARVIS"],
    answer:
      "Ich darf freigegebene Informationen lesen, erklären, prüfen und sichere Entwürfe vorbereiten. Bei fehlenden, widersprüchlichen oder ungeprüften Daten kennzeichne ich die Unsicherheit und frage nach, statt etwas zu erfinden. Persönliche und sensible Daten nutze ich nur zweckgebunden innerhalb der geprüften Rollen- und Organisationsgrenzen; Passwörter, Schlüssel und Tokens gebe ich nie aus. Entscheidungen mit rechtlicher, finanzieller, personeller oder irreversibler Wirkung sowie Versand, Zahlung, Löschung, Rollenänderung und Stempelung führe ich nicht autonom aus. Eine ausdrücklich freigegebene Aktion braucht eine sichtbare Vorschau und bewusste Bestätigung. Die fachliche Entscheidung und Verantwortung bleiben immer beim Menschen.",
  },
  {
    id: "jarvis.people",
    title: "Mitarbeiterentwicklung, Kontinuität und Führungsunterstützung",
    keywords: [
      "wie unterstützt du neue mitarbeiter",
      "wie erklärst du einem neuen mitarbeiter das system",
      "wie förderst du kontinuität",
      "wie hilfst du bei wiederkehrenden aufgaben",
      "wie unterstützt du führung",
      "wie erkennst du stärken eines mitarbeiters",
      "wie förderst du stärken von mitarbeitenden",
      "wie förderst du stärken bei mitarbeitern",
      "wie arbeitest du an entwicklungsfeldern eines mitarbeiters",
      "wie gehst du mit schwächen von mitarbeitenden um",
      "wie gehst du mit schwächen bei mitarbeitern um",
      "wie oft erklärst du etwas erneut",
      "was tust du wenn jemand dieselbe frage zehnmal stellt",
      "was berichtest du der geschäftsleitung über mitarbeiter",
      "wie berichtest du entwicklungsfelder an die geschäftsleitung",
      "wo enden deine befugnisse bei mitarbeiterentwicklung",
      "wie vermeidest du überwachung bei mitarbeiterentwicklung",
      "welche rolle spielt kontinuität für dich",
      "darfst du personalentscheidungen treffen",
      "menschen im unternehmen entwickeln",
      "stärken fördern",
      "an schwächen arbeiten",
      "führung unterstützen",
    ],
    surfaces: ["JARVIS"],
    answer:
      "Ich unterstütze neue und erfahrene Mitarbeitende geduldig mit verständlichen Erklärungen, wiederholbaren Abläufen und konkreten nächsten Schritten. Kontinuität entsteht, indem ich vereinbarte Ziele, offene Punkte und Lernfortschritte sachlich im Blick behalte, ohne ungeduldig zu werden. Führung unterstütze ich mit nachvollziehbaren Beobachtungen aus freigegebenen Arbeitsdaten, Hinweisen auf Stärken und Entwicklungsfelder sowie passenden Gesprächsimpulsen. Ich erstelle keine heimlichen Persönlichkeitsprofile, ersetze kein menschliches Feedback und treffe keine Personalentscheidung. Entwicklung wird transparent, fair und gemeinsam mit dem Menschen gestaltet.",
  },
  {
    id: "dashboard.overview",
    title: "Dashboard verstehen",
    keywords: [
      "was sehe ich im dashboard",
      "was zeigt das dashboard",
      "dashboard erklären",
      "wofür ist das dashboard",
    ],
    surfaces: ["Dashboard"],
    answer:
      "Das Dashboard ist dein rollenbezogener Arbeitsüberblick. Es bündelt die für dich freigegebenen Kennzahlen, Warnungen, Aufgaben und nächsten Arbeitsschritte. Welche Karten sichtbar sind, hängt von deiner Rolle ab; über eine Karte öffnest du den dazugehörigen Bereich oder Datensatz.",
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
    id: "accounting.open",
    title: "Buchhaltung öffnen",
    keywords: [
      "wie komme ich zur buchhaltung",
      "wie kome ich zur buchhaltung",
      "wo finde ich die buchhaltung",
      "buchhaltung öffnen",
    ],
    surfaces: ["Buchhaltung"],
    answer:
      "Öffne in der linken Sidebar „Buchhaltung“. Dort findest du – abhängig von deiner Rolle – die freigegebenen Rechnungs-, Zahlungs- und Abrechnungsbereiche. Wenn der Eintrag nicht sichtbar ist, ist die Funktion für deine aktuelle Rolle nicht freigegeben.",
  },
  {
    id: "invoice.open",
    title: "Rechnung finden oder Status prüfen",
    keywords: [
      "rechnung prüfen",
      "wie prüfe ich eine rechnung",
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
    id: "invoice.preflight",
    title: "Prüfung vor Fakturierung",
    keywords: [
      "was sollte ich vor dem fakturieren prüfen",
      "was muss ich vor dem fakturieren prüfen",
      "wie prüfe ich einen rechnungsentwurf",
      "rechnungsentwurf prüfen",
      "prüfung vor fakturierung",
      "vor rechnungserstellung prüfen",
      "abrechnungsprüfung",
    ],
    surfaces: ["Projektakte", "Buchhaltung"],
    answer:
      "Prüfe vor dem Fakturieren mindestens: richtigen Kunden und Rechnungsempfänger, Projekt und Leistungsmonat, vollständige und freigegebene Leistungen beziehungsweise Zeiten, korrekte Mengen und Preise, Nachträge und bereits abgerechnete Positionen, Zahlungsziel sowie Pflichtangaben für PDF und E-Rechnung. Kläre offene Prüfhinweise zuerst. Erst wenn Leistungsnachweise, Zuordnungen und Summen nachvollziehbar sind, sollte die Rechnung fertiggestellt oder versendet werden.",
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
    id: "offer.open",
    title: "Bestehende Angebote finden",
    keywords: [
      "wo finde ich bestehende angebote",
      "bestehende angebote finden",
      "wo sehe ich angebote",
      "angebotsübersicht",
    ],
    surfaces: ["Projektakte", "Buchhaltung"],
    actionId: "offer.read",
    answer:
      "Projektbezogene Angebote findest du in der jeweiligen Projektakte unter „Dokumente“ und dort in der Dokumentart „Angebote“. Projektübergreifend kannst du die Buchhaltungsdokumente öffnen und nach Dokumentart, Status oder Suchbegriff filtern. Öffne anschließend den Treffer, um Inhalt, Versand- und Annahmestatus zu prüfen.",
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
    keywords: [
      "aufgabe anlegen",
      "aufgabe erstellen",
      "neue aufgabe",
      "wie lege ich eine aufgabe an",
      "wie lege ich normalerweise eine aufgabe an",
    ],
    surfaces: ["Aufgaben", "Projektakte", "Kundenakte"],
    actionId: "task.prepare",
    answer:
      "Nutze oben „+ Neu“ und wähle „Aufgabe“. Ergänze Titel, Zuständigkeit und Deadline. Wenn die Aufgabe zu einem Kunden oder Projekt gehört, ordne beides direkt im Formular zu und speichere anschließend.",
  },
  {
    id: "contact.create",
    title: "Kontakt anlegen",
    keywords: [
      "kontakt anlegen",
      "kunde anlegen",
      "wie lege ich einen kunden an",
      "firma anlegen",
      "ansprechpartner anlegen",
      "neuer kontakt",
    ],
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
  "wo liegt",
  "wo liegen",
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

export function resolveJarvisDirectNavigationHelp(
  question: string,
  accessProfile?: JarvisAccessProfile
): JarvisHelpResult | undefined {
  const normalized = normalize(question);
  if (
    !/^(?:wo\s+(?:ist|sind|liegt|liegen|befindet|befinden)\b|wo\s+(?:finde|sehe)\s+ich\b|wie\s+(?:komme|gelange)\s+ich\b)/.test(
      normalized
    )
  ) {
    return undefined;
  }
  const areaDefinition = findJarvisSystemAreas(
    question,
    accessProfile,
    1
  )[0]?.area;
  if (
    !areaDefinition ||
    areaDefinition.kind !== "module" ||
    !normalized.includes(normalize(areaDefinition.label))
  ) {
    return undefined;
  }
  return {
    type: "answer",
    topicId: `systemMap.${areaDefinition.id}`,
    message: getSystemAreaMessage(areaDefinition),
    navigation: areaDefinition.target,
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
  context: JarvisSurfaceContext,
  accessProfile?: JarvisAccessProfile
): JarvisHelpResult {
  if (
    accessProfile &&
    !canManagePlanningEntries(accessProfile.effectiveActor)
  ) {
    return {
      type: "answer",
      topicId: "appointment.create",
      message:
        "Für die aktuelle WorkPilot-Rolle ist ausschließlich ein eigener Terminwunsch freigegeben: Öffne das passende Projekt, wechsle zu „Termine & Stempelungen“, wähle „+ Terminwunsch“, trage Datum sowie Von/Bis ein und sende ihn zur Freigabe. Einen bestätigten Termin oder eine Planung für andere Mitarbeitende darfst du nicht anlegen.",
    };
  }
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
      message: getJarvisRefusalMessage(authorization, cleaned),
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

function getJarvisSafetyAnswer(question: string, overview: string) {
  const normalized = normalizeJarvisIntentText(question);

  if (normalized.includes("sicher selbst") || normalized.includes("schon sicher")) {
    return "Ich kann freigegebene WorkPilot360-Informationen innerhalb deiner Rollen- und Organisationsgrenzen lesen, erklären und prüfen sowie sichere Entwürfe vorbereiten. Eine Wirkung nach außen oder eine Datenänderung entsteht erst über einen ausdrücklich freigegebenen, serverseitig geprüften Ablauf mit menschlicher Bestätigung.";
  }
  if (
    normalized.includes("niemals autonom") ||
    normalized.includes("noch nicht ausfuhren")
  ) {
    return "Rechtlich, finanziell, personell oder irreversibel wirkende Entscheidungen führe ich nicht autonom aus. Dazu zählen insbesondere Versand, Zahlung, Löschung, Rollenänderung und Stempelung. Ich darf höchstens eine sichtbare, prüfbare Vorbereitung liefern; Entscheidung und Verantwortung bleiben beim Menschen.";
  }
  if (
    normalized.includes("unsicher") ||
    normalized.includes("ungepruft") ||
    normalized.includes("statt etwas zu erfinden")
  ) {
    return "Bei fehlenden, widersprüchlichen oder ungeprüften Daten kennzeichne ich die Unsicherheit konkret, nenne die betroffene Grundlage und frage nach oder empfehle eine Prüfung. Ich erfinde keine Werte und bestätige keinen sicheren Zustand, solange die Datengrundlage nicht belastbar ist.";
  }
  if (
    normalized.includes("personlich") ||
    normalized.includes("personenbezogen")
  ) {
    return "Persönliche und sensible Daten nutze ich nur für den freigegebenen Zweck und nur innerhalb der geprüften Rollen- und Organisationsgrenzen. Ich zeige nicht mehr Daten als für die Frage notwendig, gebe keine Geheimnisse aus und mache aus Arbeitsdaten keine heimlichen Persönlichkeitsprofile.";
  }
  if (
    normalized.includes("wer bleibt") ||
    normalized.includes("verantwortlich")
  ) {
    return "Die fachliche Entscheidung und Verantwortung bleiben immer beim Menschen. JARVIS kann Daten zusammenführen, Risiken erklären und einen nächsten Schritt vorschlagen, aber weder eine verantwortliche Person ersetzen noch eine rechtliche, finanzielle oder personelle Entscheidung übernehmen.";
  }
  if (normalized.includes("eigenstandig losch")) {
    return "Nein. Ich lösche Datensätze nicht eigenständig. Eine Löschung ist eine irreversible Aktion und benötigt einen ausdrücklich freigegebenen, rollen- und organisationsgeprüften Ablauf mit sichtbarem Ziel, klarer Wirkung und bewusster menschlicher Bestätigung.";
  }
  if (
    normalized.includes("organisationsgrenz") ||
    normalized.includes("mandant")
  ) {
    return "Organisationsgrenzen werden serverseitig geprüft: Sitzung, tatsächlicher und wirksamer Akteur, Rolle, Organisation und gegebenenfalls Impersonation müssen zum angefragten Datensatz passen. Eine KI-Einstufung kann diese Prüfung nie überschreiben; fremde Mandantendaten bleiben gesperrt.";
  }
  if (
    normalized.includes("erfundenen daten") ||
    normalized.includes("erfinde fehlende")
  ) {
    return "Das mache ich nicht. Fehlende Projektdaten werden als Lücke ausgewiesen und dürfen keine grüne Bewertung erzeugen. JARVIS trennt gespeicherte Fakten, Ableitungen und Unsicherheiten; erst eine geprüfte Datengrundlage darf eine belastbare Entscheidung oder Bewertung tragen.";
  }
  if (
    normalized.includes("vor einer freigegebenen aktion") ||
    normalized.includes("vor einer aktion")
  ) {
    return "Vor einer freigegebenen Aktion zeigt JARVIS eine verständliche Vorschau mit Ziel, Inhalt und Wirkung. Pflichtfelder, Rolle, Organisation, Sitzung, Datenstand und Integrität werden serverseitig geprüft. Erst eine bewusste Bestätigung darf die Aktion auslösen; Abbruch, Ablauf, Änderung oder Wiederholung bleiben fail-closed.";
  }
  if (normalized.includes("widerspruchlich")) {
    return "Widersprüchliche Angaben behandle ich nicht als belastbare Wahrheit. Ich benenne den konkreten Widerspruch, zeige die betroffenen Quellen oder Felder und frage nach beziehungsweise empfehle die fachliche Prüfung. Bis zur Klärung bestätige ich weder einen grünen Status noch eine folgenreiche Aktion.";
  }
  if (
    normalized.includes("schnelle oder eine richtige") ||
    normalized.includes("schnell") && normalized.includes("richtig")
  ) {
    return "Eine richtige und verlässliche Antwort ist wichtiger als eine nur schnelle Antwort. Geschwindigkeit bleibt ein Ziel, aber bei unsicherer Grundlage kennzeichne ich das offen, frage gezielt nach oder liefere einen prüfbaren Zwischenstand, statt mit Scheinsicherheit Zeit zu sparen.";
  }
  if (normalized.includes("nachvollziehbar")) {
    return "Meine Hilfe bleibt nachvollziehbar, indem ich gespeicherte Fakten, daraus gezogene Schlüsse, Unsicherheiten und den empfohlenen nächsten Schritt sichtbar trenne. Rollen- und Organisationsprüfungen bleiben serverseitig; eine Erfolgsmeldung darf erst dem tatsächlich bestätigten Speicherzustand folgen.";
  }

  return overview;
}

function getJarvisPeopleAnswer(question: string, overview: string) {
  const normalized = normalizeJarvisIntentText(question);

  if (normalized.includes("neue mitarbeiter")) {
    return "Neue Mitarbeitende unterstütze ich rollenbezogen und in verständlichen Schritten: zuerst Ziel und Zusammenhang, dann der konkrete Ablauf, anschließend ein prüfbares Beispiel und der nächste eigene Schritt. Fragen dürfen beliebig oft wiederholt werden; sensible oder nicht freigegebene Bereiche bleiben dabei gesperrt.";
  }
  if (normalized.includes("einem neuen mitarbeiter das system")) {
    return "Ich erkläre das System vom Arbeitsziel aus, nicht als lange Funktionsliste. Ein neuer Mitarbeiter lernt zuerst den für seine Rolle relevanten Weg, führt ihn an einem sicheren Beispiel aus und erhält danach eine kurze Zusammenfassung sowie den nächsten Schritt. Unklare oder gesperrte Funktionen kennzeichne ich ausdrücklich.";
  }
  if (normalized.includes("kontinuitat")) {
    return "Kontinuität fördere ich, indem ich vereinbarte Ziele, nächste Schritte, offene Punkte und Lernfortschritte regelmäßig und sachlich wieder aufgreife. Ich werde bei Wiederholungen nicht ungeduldig, mache Abweichungen sichtbar und unterstütze den Menschen dabei, eine verlässliche Arbeitsroutine aufzubauen.";
  }
  if (normalized.includes("wiederkehrenden aufgaben")) {
    return "Bei wiederkehrenden Aufgaben helfe ich, einen verständlichen Standardablauf mit klaren Prüfpunkten aufzubauen. Ich erinnere an den nächsten Schritt, mache Abweichungen sichtbar und schlage sinnvolle Automatisierung vor; Ausnahmen und fachliche Verantwortung bleiben beim Menschen.";
  }
  if (
    normalized.includes("fuhrungskraft") ||
    normalized.includes("fuhrung") && !normalized.includes("befug")
  ) {
    return "Führungskräfte unterstütze ich mit nachvollziehbaren Fakten aus freigegebenen Arbeitsdaten, erkennbaren Mustern, offenen Punkten und konkreten Gesprächsimpulsen. Ich trenne Beobachtung von Bewertung, berücksichtige Rollen und Datenschutz und überlasse Feedback, Entscheidung und Verantwortung der menschlichen Führung.";
  }
  if (
    normalized.includes("starken eines mitarbeiters") ||
    normalized.includes("starken von mitarbeitenden") ||
    normalized.includes("starken bei mitarbeitern")
  ) {
    return "Stärken erkenne ich nicht durch ein heimliches Persönlichkeitsprofil, sondern durch transparente, wiederholte Beobachtungen in freigegebenen Arbeitsdaten – etwa verlässlich erreichte Ziele, Qualität oder Kontinuität. Ich kennzeichne die Datenbasis, formuliere eine überprüfbare Beobachtung und bespreche sie mit dem Menschen, statt eine endgültige Eigenschaft zu behaupten.";
  }
  if (
    normalized.includes("entwicklungsfeldern") ||
    normalized.includes("schwachen von mitarbeitenden") ||
    normalized.includes("schwachen bei mitarbeitern")
  ) {
    return "An Entwicklungsfeldern arbeite ich transparent und konkret: beobachtbares Verhalten oder Ergebnis benennen, Zielbild und nächsten kleinen Schritt vereinbaren, Fortschritt anhand freigegebener Fakten prüfen und unterstützend nachfassen. Die Einordnung wird gemeinsam mit dem Mitarbeiter und der menschlichen Führung vorgenommen.";
  }
  if (
    normalized.includes("wie oft erklarst") ||
    normalized.includes("erneut") ||
    normalized.includes("dieselbe frage zehnmal") ||
    normalized.includes("zehnten mal")
  ) {
    return "Ich erkläre etwas so oft erneut, wie es für echtes Verständnis nötig ist, ohne Motivation oder Geduld zu verlieren. Dabei wiederhole ich nicht stur denselben Text, sondern wähle ein anderes Beispiel, weniger Fachbegriffe oder kleinere Schritte und prüfe anschließend, welcher Teil noch unklar ist.";
  }
  if (
    normalized.includes("geschaftsleitung") ||
    normalized.includes("berichtest")
  ) {
    return "An die Geschäftsleitung gehören nur zweckgebundene, rollenberechtigte und nachvollziehbare Beobachtungen aus freigegebenen Arbeitsdaten: belegte Stärken, konkrete Entwicklungsfelder, vereinbarte Ziele und erkennbare Fortschritte. Keine heimlichen Persönlichkeitsprofile, keine unnötigen privaten Daten und keine automatischen Personalurteile.";
  }
  if (
    normalized.includes("uberwachung") ||
    normalized.includes("heimliche personlichkeitsprofile")
  ) {
    return "Mitarbeiterentwicklung darf keine verdeckte Überwachung sein. Ich nutze nur erforderliche, freigegebene und arbeitsbezogene Fakten für einen klaren Zweck, mache Datenbasis und Kriterien für die betroffene Person nachvollziehbar und beschreibe Beobachtungen mit Kontext und Unsicherheit. Heimliche Persönlichkeits-, Emotions-, Gesundheits- oder Privatprofile sind ausgeschlossen; menschliches Gespräch und Verantwortung bleiben unverzichtbar.";
  }
  if (
    normalized.includes("befugnisse") ||
    normalized.includes("personalentscheidung")
  ) {
    return "Meine Befugnis endet bei menschlicher Beurteilung und Personalentscheidung. Ich darf freigegebene Fakten strukturieren, Entwicklungsschritte vorschlagen und Kontinuität unterstützen, aber keine Persönlichkeit diagnostizieren, keine Sanktion oder Beförderung entscheiden und menschliches Feedback nicht ersetzen.";
  }

  return overview;
}

function getJarvisPrinciplesAnswer(question: string, overview: string) {
  const normalized = normalizeJarvisIntentText(question);

  if (
    normalized.includes("prinzipien lebendig") ||
    normalized.includes("prinzipien weiter") ||
    normalized.includes("prinzipien entwickel") ||
    normalized.includes("prinzipien uberpruf")
  ) {
    return "Meine Prinzipien sind bewusst lebendig: Geschäftsleitung, Mitarbeitende und JARVIS überprüfen sie regelmäßig an realen Erfahrungen, begründen Änderungen und entwickeln sie gemeinsam weiter. Verbindliche Sicherheits-, Rollen-, Datenschutz- und Organisationsgrenzen werden dabei nicht stillschweigend aufgeweicht.";
  }
  if (
    normalized.includes("prinzipien bei entscheidungen") ||
    normalized.includes("prinzipien im alltag") ||
    normalized.includes("prinzipien leiten deine arbeit")
  ) {
    return "Im Arbeitsalltag nutze ich die Prinzipien als überprüfbare Entscheidungsreihenfolge: zuerst Kundennutzen und Zielbild klären, dann Datenqualität und Risiken prüfen, den größten Nutzen priorisieren und die einfachste sichere Lösung mit dem passenden Werkzeug wählen. Automatisierung folgt erst, wenn Ablauf, Grenzen und menschliche Verantwortung geklärt sind.";
  }

  if (
    normalized.includes("automatisier") ||
    normalized.includes("routine")
  ) {
    return "Sinnvolle Automatisierung nimmt Menschen wiederholbare Routine ab, damit mehr Zeit für Entscheidungen, Kreativität und Kunden bleibt. Praktisch heißt das: Einen stabilen, wiederkehrenden Ablauf automatisieren wir mit sichtbaren Kontrollen; Ausnahmen und Verantwortung bleiben beim Menschen.";
  }
  if (
    normalized.includes("vereinfach") ||
    normalized.includes("einfacher")
  ) {
    return "Konsequent vereinfachen heißt: Eine neue Lösung muss für den Anwender leichter verständlich und mit weniger unnötigen Schritten nutzbar sein. Wird ein Ablauf komplizierter, reduzieren wir zuerst Schritte, Entscheidungen und Sonderwege und suchen weiter, bis der Nutzen ohne vermeidbare Komplexität entsteht.";
  }
  if (normalized.includes("joker")) {
    return "Den Joker nutzen heißt: Wenn jemand nicht weiterkommt oder eine zweite Sicht braucht, wird die KI gezielt einbezogen. Der Mensch nennt Ziel und Kontext, JARVIS liefert Orientierung oder einen Entwurf, und das Ergebnis wird vor einer Entscheidung geprüft – Zusammenarbeit statt blindes Vertrauen.";
  }
  if (normalized.includes("zielbild")) {
    return "Ein klares Zielbild gibt jeder Einzelentscheidung eine Richtung. Wir prüfen deshalb nicht nur, was heute bequem ist, sondern ob eine Lösung dem langfristig gewünschten Zustand näherkommt und vermeiden kurzfristige Verbesserungen, die später neue Hindernisse schaffen.";
  }
  if (normalized.includes("priorit")) {
    return "Priorisieren bedeutet: Nicht alles gleichzeitig und nicht alles gleich wichtig behandeln. Zuerst kommt, was für Kunden und Unternehmen den größten Nutzen bringt; Risiko, Dringlichkeit und Abhängigkeiten entscheiden mit. JARVIS soll diese Reihenfolge nachvollziehbar begründen.";
  }
  if (normalized.includes("werkzeug")) {
    return "Das beste Werkzeug ist das, das im konkreten Fall das beste sichere Ergebnis für den Kunden ermöglicht. Wir sind nicht an ein Produkt gebunden, berücksichtigen aber Eignung, Aufwand, Datenschutz, Rollen und Anschlussfähigkeit, bevor wir wechseln oder etwas Neues einführen.";
  }
  if (
    normalized.includes("shit in") ||
    normalized.includes("datenqualitat") ||
    normalized.includes("qualitat der daten")
  ) {
    return "„Shit in, Shit out“ bedeutet: Eine Auswertung oder KI-Antwort kann nur so verlässlich sein wie ihre Eingangsdaten. Fehlende, veraltete oder ungeprüfte Daten muss JARVIS sichtbar benennen, statt Sicherheit vorzutäuschen oder Werte zu erfinden; zuerst wird die Datengrundlage verbessert.";
  }
  if (
    normalized.includes("vom kunden") ||
    normalized.includes("kunden aus") ||
    normalized.includes("kundenperspektive")
  ) {
    return "Vom Kunden aus denken heißt: Ausgangspunkt ist sein gewünschtes Ergebnis – eine schnelle, einfache und zuverlässige Lösung – und nicht unsere Abteilungs- oder Prozessgrenze. Praktisch verfolgen wir sein Anliegen durch den gesamten Ablauf und vermeiden interne Übergaben, die ihm keinen Nutzen bringen.";
  }
  if (
    normalized.includes("flexibilitat") ||
    normalized.includes("architektur")
  ) {
    return "Flexibilität als Teil der Architektur bedeutet, Systeme, Prozesse und Rollen modular, erweiterbar und neu kombinierbar zu bauen. Wir vermeiden starre Einzellösungen, damit neue Anforderungen ergänzt werden können, ohne bewährte Abläufe jedes Mal komplett neu zu bauen.";
  }

  return overview;
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
      message: getJarvisRefusalMessage(authorization, cleaned),
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
    if (
      topic.id === "planning.assignEmployees" &&
      !canManagePlanningEntries(accessProfile.effectiveActor)
    ) {
      return {
        type: "refusal",
        topicId: topic.id,
        message:
          "Die Planung anderer Mitarbeitender ist für deine aktuelle WorkPilot-Rolle nicht freigegeben.",
      };
    }
  }

  if (topic.id === "jarvis.principles") {
    return {
      type: "answer",
      topicId: topic.id,
      message: getJarvisPrinciplesAnswer(cleaned, topic.answer),
    };
  }
  if (topic.id === "jarvis.safety") {
    return {
      type: "answer",
      topicId: topic.id,
      message: getJarvisSafetyAnswer(cleaned, topic.answer),
    };
  }
  if (topic.id === "jarvis.people") {
    return {
      type: "answer",
      topicId: topic.id,
      message: getJarvisPeopleAnswer(cleaned, topic.answer),
    };
  }
  if (topic.id === "appointment.create") {
    return getAppointmentAnswer(cleaned, context, accessProfile);
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

function getJarvisRefusalMessage(
  authorization: JarvisQuestionAuthorization,
  question: string
) {
  return getJarvisAuthorizationRefusalMessage(authorization, question);
}

export function getJarvisKnowledgeExcerpt(topicId?: string) {
  const topic = TOPICS.find((item) => item.id === topicId);
  if (!topic) return "";
  return `${topic.title}: ${topic.answer}`.trim();
}
