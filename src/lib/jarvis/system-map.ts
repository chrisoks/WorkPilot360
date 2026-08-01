import { Role } from "@prisma/client";
import { JarvisAccessProfile, JarvisActor } from "@/lib/jarvis/security";

export type JarvisSystemAreaKind =
  | "module"
  | "subview"
  | "report"
  | "project_file"
  | "customer_file"
  | "settings"
  | "calculator"
  | "system_service";

export type JarvisNavigationTarget = {
  label: string;
  tab: string;
  reportTab?: string;
  firmSettingsTab?: string;
  projectFileTab?: string;
  customerFileTab?: string;
};

export type JarvisSystemArea = {
  id: string;
  label: string;
  kind: JarvisSystemAreaKind;
  parentId?: string;
  keywords: string[];
  purpose: string;
  workflows: string[];
  roles: Role[];
  target?: JarvisNavigationTarget;
  status: "active" | "limited";
  verification: {
    status: "verified" | "needs_review";
    checkedAt: string;
    sourceRefs: string[];
  };
};

export type JarvisSystemAreaMatch = {
  area: JarvisSystemArea;
  score: number;
};

const ALL_INTERNAL_ROLES: Role[] = [
  Role.ADMIN,
  Role.GESCHAEFTSFUEHRER,
  Role.FUEHRUNGSKRAFT,
  Role.MITARBEITER,
  Role.VERTRIEB,
];
const REPORT_NAVIGATION_ROLES: Role[] = [...ALL_INTERNAL_ROLES, Role.BUCHHALTUNG];
const OPERATIVE_ROLES: Role[] = [
  Role.ADMIN,
  Role.GESCHAEFTSFUEHRER,
  Role.FUEHRUNGSKRAFT,
  Role.MITARBEITER,
];
const MANAGEMENT_ROLES: Role[] = [Role.ADMIN, Role.GESCHAEFTSFUEHRER, Role.FUEHRUNGSKRAFT];
const SALES_ROLES: Role[] = [Role.ADMIN, Role.GESCHAEFTSFUEHRER, Role.FUEHRUNGSKRAFT, Role.VERTRIEB];
const FINANCE_ROLES: Role[] = [Role.ADMIN, Role.GESCHAEFTSFUEHRER, Role.FUEHRUNGSKRAFT, Role.BUCHHALTUNG];
const MASTER_DATA_ROLES: Role[] = [Role.ADMIN, Role.GESCHAEFTSFUEHRER];
const ACCOUNTING_NAVIGATION_ROLES: Role[] = [Role.ADMIN, Role.GESCHAEFTSFUEHRER, Role.FUEHRUNGSKRAFT];

const DASHBOARD_SOURCE = "src/components/dashboard/dashboard-page.tsx";
const STORAGE_ARCHITECTURE_SOURCE = "docs/STORAGE_ARCHITEKTUR.md";
const VERIFIED_AT = "2026-07-30";

function area(
  definition: Omit<JarvisSystemArea, "status" | "verification"> &
    Partial<Pick<JarvisSystemArea, "status" | "verification">>
): JarvisSystemArea {
  return {
    ...definition,
    status: definition.status ?? "active",
    verification: {
      status: "verified",
      checkedAt: VERIFIED_AT,
      sourceRefs: [DASHBOARD_SOURCE],
      ...definition.verification,
    },
  };
}

function moduleArea(
  id: string,
  label: string,
  purpose: string,
  workflows: string[],
  roles: Role[],
  keywords: string[] = []
) {
  return area({
    id,
    label,
    kind: "module",
    keywords: [label, ...keywords],
    purpose,
    workflows,
    roles,
    target: { label: `${label} öffnen`, tab: id },
  });
}

function childArea(input: {
  id: string;
  label: string;
  kind?: JarvisSystemAreaKind;
  parentId: string;
  tab: string;
  purpose: string;
  workflows: string[];
  roles: Role[];
  keywords?: string[];
  reportTab?: string;
  firmSettingsTab?: string;
  status?: "active" | "limited";
  verificationStatus?: "verified" | "needs_review";
  sourceRefs?: string[];
}) {
  return area({
    id: input.id,
    label: input.label,
    kind: input.kind ?? "subview",
    parentId: input.parentId,
    keywords: [input.label, ...(input.keywords ?? [])],
    purpose: input.purpose,
    workflows: input.workflows,
    roles: input.roles,
    target: {
      label: `${input.label} öffnen`,
      tab: input.tab,
      reportTab: input.reportTab,
      firmSettingsTab: input.firmSettingsTab,
    },
    status: input.status,
    verification: {
      status: input.verificationStatus ?? "verified",
      checkedAt: VERIFIED_AT,
      sourceRefs: input.sourceRefs ?? [DASHBOARD_SOURCE],
    },
  });
}

const MAIN_AREAS: JarvisSystemArea[] = [
  moduleArea("overview", "Dashboard", "Persönlicher und rollenbezogener Arbeitsüberblick.", ["Kennzahlen überblicken", "Warnungen und nächste Arbeitsschritte öffnen"], ALL_INTERNAL_ROLES, ["startseite", "übersicht"]),
  moduleArea("reports", "Auswertungen", "Rollenbezogene operative, vertriebliche und kaufmännische Analysen.", ["Zeitraum und Filter setzen", "KPI-Details prüfen", "zu Datensätzen springen"], REPORT_NAVIGATION_ROLES, ["berichte", "kennzahlen"]),
  moduleArea("onlineRequests", "Online-Anfragen", "Öffentliche Formularanfragen prüfen und kontrolliert als neue OK-immocare-Leads übernehmen.", ["neue Anfrage öffnen", "Kundenentscheidung und Verantwortung prüfen", "in ein neues Projekt unter Lead / Klärung umwandeln"], SALES_ROLES, ["online anfragen", "formularanfragen", "anfragenposteingang", "lead klärung"]),
  moduleArea("contacts", "Kontakte", "Kunden, Firmen und Ansprechpartner verwalten.", ["Kontakte suchen", "Kundenakte öffnen", "Ansprechpartner und Objektadressen pflegen"], SALES_ROLES, ["kunden", "crm"]),
  moduleArea("newsFeed", "News-Feed", "Interne Nachrichten, Reaktionen und Abstimmungen.", ["Beiträge lesen", "kommentieren und reagieren"], ALL_INTERNAL_ROLES, ["neuigkeiten"]),
  moduleArea("salesHub", "Meine Ziele", "Eigene Vertriebs- und Leistungsziele verfolgen.", ["eigene Ziele prüfen", "Fortschritt und Historie öffnen"], [Role.ADMIN, Role.GESCHAEFTSFUEHRER, Role.FUEHRUNGSKRAFT, Role.MITARBEITER, Role.VERTRIEB], ["zielübersicht"]),
  moduleArea("projectsSolutions", "Projekte OK solutions", "Solutions-Projekte nach Projektart und Status bearbeiten.", ["Projekt suchen", "Projektakte öffnen", "Projektstatus und Verantwortlichkeit prüfen"], [Role.ADMIN, Role.GESCHAEFTSFUEHRER, Role.FUEHRUNGSKRAFT, Role.MITARBEITER, Role.VERTRIEB], ["solutions projekte", "projektübersicht", "projektübersicht öffnen"]),
  moduleArea("projectsImmocare", "Projekte OK immocare", "Immocare-Projekte nach Projektart und Status bearbeiten.", ["Projekt suchen", "Projektakte öffnen", "Projektstatus und Verantwortlichkeit prüfen"], [Role.ADMIN, Role.GESCHAEFTSFUEHRER, Role.FUEHRUNGSKRAFT, Role.MITARBEITER, Role.VERTRIEB], ["immocare projekte"]),
  moduleArea("articles", "Artikel & Leistungen", "Artikel, Leistungen und Pakete als gemeinsame Angebots- und Rechnungsbasis.", ["Stammdaten suchen", "Kalkulation prüfen", "Pakete zusammensetzen"], [Role.ADMIN, Role.GESCHAEFTSFUEHRER, Role.FUEHRUNGSKRAFT, Role.MITARBEITER, Role.VERTRIEB], ["katalog", "stammdaten"]),
  moduleArea("calculators", "Kalkulations-Rechner", "Produktive Fachkalkulationen für Winterdienst und Fahrten; Fahrzeuge liefern Stammdaten, Vermietung ist noch eingeschränkt.", ["Kalkulationsart wählen", "fehlende Grundlagen dialoggeführt ergänzen", "Varianten, Selbstkosten, Verkauf, Aufschlag und Marge prüfen", "Snapshot bewusst bestätigen"], OPERATIVE_ROLES, ["rechner", "kalkulation"]),
  moduleArea("salesOpportunities", "Zusatzverkäufe", "Verkaufschancen und Nachfasspunkte bearbeiten.", ["Chance erfassen", "Verantwortung und Wiedervorlage pflegen", "Angebot oder Aufgabe vorbereiten"], [Role.ADMIN, Role.GESCHAEFTSFUEHRER, Role.FUEHRUNGSKRAFT, Role.MITARBEITER, Role.VERTRIEB], ["potenziale", "verkaufschancen"]),
  moduleArea("dashboard", "Aufgaben", "Eigene und berechtigte Teamaufgaben steuern.", ["Aufgaben filtern", "Aufgabe anlegen", "Status, Beteiligte und Deadline pflegen"], [Role.ADMIN, Role.GESCHAEFTSFUEHRER, Role.FUEHRUNGSKRAFT, Role.MITARBEITER, Role.VERTRIEB], ["to dos", "todo"]),
  moduleArea("planningBoard", "Planungsboard", "Mitarbeitende, Termine und Kapazitäten planen.", ["Board und Gruppe wählen", "Termin oder Terminwunsch anlegen", "Tagesauslastung prüfen"], OPERATIVE_ROLES, ["planung", "einsatzplanung"]),
  moduleArea("processAutomation", "Prozess/Automation", "Kontrollierte Fachautomationen und Statusüberwachung.", ["Automationsbereich wählen", "Dry-Run prüfen", "freigegebene Regeln verwalten"], MANAGEMENT_ROLES, ["automationen", "prozesse"]),
  moduleArea("accounting", "Buchhaltung", "Rechnungen, offene Posten, Dokumente und Stapelabrechnung.", ["Rechnungen prüfen", "offene Posten bearbeiten", "Abrechnung vorbereiten"], ACCOUNTING_NAVIGATION_ROLES, ["finanzen", "rechnung", "rechnungen"]),
  moduleArea("personalData", "Persönliche Daten", "Eigene Profildaten, Dokumente und persönliche Entwicklung.", ["eigene Daten prüfen", "eigene Dokumente öffnen", "persönliche Entwicklung einsehen"], ALL_INTERNAL_ROLES, ["mein profil", "meine daten"]),
  moduleArea("employees", "Mitarbeiter", "Mitarbeiter, Abwesenheiten, Zeiten und berechtigte Personaldaten.", ["Mitarbeiterübersicht öffnen", "Teamkalender prüfen", "Zeiterfassung kontrollieren"], OPERATIVE_ROLES, ["personal", "team"]),
  moduleArea("settings", "Firmeneinstellungen", "Unternehmensweite Stammdaten, Fristen und Konfiguration.", ["Einstellungsbereich wählen", "Konfiguration prüfen", "berechtigte Änderungen speichern"], OPERATIVE_ROLES, ["einstellungen", "konfiguration"]),
];

const TASK_AREAS = [
  childArea({ id: "tasks.calendar", label: "Kalenderübersicht", parentId: "dashboard", tab: "calendar", purpose: "Aufgaben und Abwesenheiten in Monat, Woche oder Tag.", workflows: ["Zeitraum wechseln", "Tag öffnen", "Aufgabe aufrufen"], roles: SALES_ROLES.concat(Role.MITARBEITER) }),
  childArea({ id: "tasks.kanban", label: "Aufgaben-Kanban", parentId: "dashboard", tab: "kanban", purpose: "Aufgaben nach Bearbeitungsstatus steuern.", workflows: ["Statusspalten prüfen", "Aufgabe öffnen", "Status bearbeiten"], roles: SALES_ROLES.concat(Role.MITARBEITER), keywords: ["kanban"] }),
  childArea({ id: "tasks.archive", label: "Aufgabenarchiv", parentId: "dashboard", tab: "archive", purpose: "Erledigte und archivierte Aufgaben nachvollziehen.", workflows: ["Archiv durchsuchen", "Aufgabe öffnen", "berechtigt wiederherstellen"], roles: SALES_ROLES.concat(Role.MITARBEITER), keywords: ["archivierte aufgaben"] }),
];

const GOAL_AREAS = [
  childArea({ id: "goals.own", label: "Meine Ziele", parentId: "salesHub", tab: "salesHub", purpose: "Eigene Ziele, Fortschritt und Historie.", workflows: ["Zielzeitraum wählen", "Fortschritt prüfen", "Zieldetails öffnen"], roles: SALES_ROLES.concat(Role.MITARBEITER) }),
  childArea({ id: "goals.management", label: "Zielverwaltung", parentId: "salesHub", tab: "salesTargets", purpose: "Unternehmens- und Teamziele verwalten.", workflows: ["Zielgruppe wählen", "Ziel anlegen oder bearbeiten", "Fortschritt kontrollieren"], roles: [Role.ADMIN, Role.GESCHAEFTSFUEHRER] }),
];

const EMPLOYEE_AREAS = [
  childArea({ id: "employees.overview", label: "Mitarbeiterübersicht", parentId: "employees", tab: "employees", purpose: "Aktive Mitarbeiter und Teams überblicken.", workflows: ["Mitarbeiter suchen", "Mitarbeiteransicht öffnen", "Teamzuordnung prüfen"], roles: OPERATIVE_ROLES }),
  childArea({ id: "employees.costRates", label: "Lohnkostensätze", parentId: "employees", tab: "laborCostRates", purpose: "Interne Mitarbeiterkostensätze für berechtigte Rollen.", workflows: ["Kostensatz prüfen", "fehlende Grundlagen erkennen"], roles: [Role.ADMIN, Role.GESCHAEFTSFUEHRER], keywords: ["lk satz", "mitarbeiterkosten"] }),
  childArea({ id: "employees.absences", label: "Team-Kalender", parentId: "employees", tab: "absenceRequests", purpose: "Abwesenheiten und Verfügbarkeiten im Team.", workflows: ["Abwesenheiten prüfen", "Antrag öffnen", "berechtigt bearbeiten"], roles: MANAGEMENT_ROLES.concat(Role.MITARBEITER), keywords: ["abwesenheiten", "urlaub"] }),
  childArea({ id: "employees.timeTracking", label: "Zeiterfassung", parentId: "employees", tab: "timeTracking", purpose: "Projektzeiten und Stempelungen kontrollieren.", workflows: ["Zeitraum und Mitarbeiter filtern", "Zeiteintrag prüfen", "berechtigt korrigieren"], roles: MANAGEMENT_ROLES.concat(Role.MITARBEITER), keywords: ["stempelungen", "arbeitszeit"] }),
];

const PROCESS_AREAS = [
  childArea({ id: "automation.winterService", label: "Winterdienst-Automation", parentId: "processAutomation", tab: "winterService", purpose: "Winterdiensteinsätze und Monatsabrechnung überwachen.", workflows: ["Einsätze prüfen", "fehlende Berichte erkennen", "Abrechnungsstatus öffnen"], roles: MANAGEMENT_ROLES }),
  childArea({ id: "automation.activityReports", label: "Allgemeine Tätigkeitsberichte", parentId: "processAutomation", tab: "generalActivityReports", purpose: "Allgemeine Tätigkeitsberichte vorbereiten und verwalten.", workflows: ["Berichte suchen", "Bericht öffnen", "Dokumentstatus prüfen"], roles: MANAGEMENT_ROLES, keywords: ["tätigkeitsberichte"] }),
  childArea({ id: "automation.status", label: "Status-Automatisierung", parentId: "processAutomation", tab: "statusAutomation", purpose: "Status- und Eskalationsregeln kontrolliert betreiben.", workflows: ["Dry-Run ausführen", "Treffer und Zustellung prüfen", "Freigabestatus kontrollieren"], roles: MANAGEMENT_ROLES, keywords: ["status automation", "eskalation"] }),
];

const ACCOUNTING_AREAS = [
  childArea({ id: "accounting.batchBilling", label: "Stapelabrechnung", parentId: "accounting", tab: "batchBilling", purpose: "Mehrere abrechenbare Vorgänge kontrolliert vorbereiten.", workflows: ["Kandidaten prüfen", "Dry-Run und Ausschlüsse kontrollieren", "berechtigt abrechnen"], roles: ACCOUNTING_NAVIGATION_ROLES, keywords: ["massenfaktura"] }),
  childArea({ id: "accounting.documents", label: "Buchhaltungsdokumente", parentId: "accounting", tab: "documents", purpose: "Angebote, Rechnungen, Mahnungen und weitere Dokumente.", workflows: ["Dokumentart wählen", "Dokument suchen", "Vorschau oder Historie öffnen"], roles: ACCOUNTING_NAVIGATION_ROLES, keywords: ["dokumente", "rechnungsdokumente"] }),
];

const CATALOG_AREAS = [
  childArea({ id: "catalog.articles", label: "Artikel", parentId: "articles", tab: "articles", purpose: "Material- und Artikelstammdaten.", workflows: ["Artikel suchen", "Bestand und Kalkulation prüfen", "berechtigt bearbeiten"], roles: SALES_ROLES.concat(Role.MITARBEITER) }),
  childArea({ id: "catalog.services", label: "Leistungen", parentId: "articles", tab: "services", purpose: "Leistungs- und Verrechnungssätze.", workflows: ["Leistung suchen", "Kalkulation prüfen", "berechtigt bearbeiten"], roles: SALES_ROLES.concat(Role.MITARBEITER) }),
  childArea({ id: "catalog.packages", label: "Pakete", parentId: "articles", tab: "packages", purpose: "Zusammengesetzte Verkaufspositionen aus Material und Leistung.", workflows: ["Paket suchen", "Bestandteile und Preis prüfen", "berechtigt bearbeiten"], roles: SALES_ROLES.concat(Role.MITARBEITER) }),
];

const REPORT_DEFINITIONS: Array<[string, string, Role[], string]> = [
  ["forecast", "Forecast & OP Kontrolle", [Role.ADMIN, Role.GESCHAEFTSFUEHRER, Role.VERTRIEB, Role.BUCHHALTUNG], "Forecast, offene und überfällige Posten kontrollieren."],
  ["monthlyReport", "Monatsbericht", [Role.ADMIN, Role.GESCHAEFTSFUEHRER, Role.BUCHHALTUNG], "Den kaufmännischen Monatsbericht prüfen."],
  ["employeeRevenue", "Umsatz & Kunden", [Role.FUEHRUNGSKRAFT, Role.MITARBEITER], "Eigene oder teambezogene Umsatz- und Kundenwerte einordnen."],
  ["sales", "Sales-Performance", [Role.ADMIN, Role.GESCHAEFTSFUEHRER, Role.VERTRIEB], "Angebote, Abschlussquote und Nachfasspotenzial analysieren."],
  ["svs", "SVS Analyse", [Role.ADMIN, Role.GESCHAEFTSFUEHRER, Role.FUEHRUNGSKRAFT], "Stundenverrechnungssätze und Kapazitätsbasis einordnen."],
  ["projects", "Projekt-Auswertung", [Role.ADMIN, Role.GESCHAEFTSFUEHRER, Role.FUEHRUNGSKRAFT, Role.VERTRIEB], "Projektpipeline, Laufzeiten und Engpässe analysieren."],
  ["customers", "Kunden-Auswertung", [Role.ADMIN, Role.GESCHAEFTSFUEHRER, Role.VERTRIEB, Role.BUCHHALTUNG], "Kundenumsatz, Risiken und Detaildatensätze prüfen."],
  ["kuzu", "KuZu", [Role.ADMIN, Role.GESCHAEFTSFUEHRER, Role.FUEHRUNGSKRAFT, Role.VERTRIEB], "Kundenzufriedenheit und Handlungsbedarf auswerten."],
  ["catalog", "Artikel & Leistungen-Auswertung", [Role.ADMIN, Role.GESCHAEFTSFUEHRER], "Verkaufte Materialien, Leistungen, Mengen und Margen analysieren."],
  ["employees", "Mitarbeiter-Auswertung", [Role.ADMIN, Role.GESCHAEFTSFUEHRER, Role.FUEHRUNGSKRAFT, Role.MITARBEITER], "Arbeitszeit und Produktivität rollengerecht prüfen."],
  ["executive", "Geschäftsführung", [Role.ADMIN, Role.GESCHAEFTSFUEHRER], "Unternehmensweite Engpässe und Steuerungskennzahlen bündeln."],
  ["map", "Projektkarte", [Role.ADMIN, Role.GESCHAEFTSFUEHRER, Role.FUEHRUNGSKRAFT], "Projekte räumlich darstellen und filtern."],
];

const REPORT_AREAS = REPORT_DEFINITIONS.map(([id, label, roles, purpose]) =>
  childArea({
    id: `reports.${id}`,
    label,
    kind: "report",
    parentId: "reports",
    tab: "reports",
    reportTab: id,
    purpose,
    workflows: ["Zeitraum und Filter setzen", "KPI-Detail öffnen", "Datengrundlage und Einordnung prüfen"],
    roles,
  })
);

const SETTINGS_DEFINITIONS: Array<[string, string, string]> = [
  ["profile", "Firmenprofil", "Firmenstammdaten und Absenderprofil."],
  ["units", "Einheiten", "Einheiten für Artikel und Dokumentpositionen."],
  ["businessAreaTargets", "Geschäftsbereich-Soll", "Zielverteilung der Geschäftsbereiche."],
  ["planningGroupCapacity", "Planungsgruppen-SVS", "Kapazität und SVS je Planungsgruppe."],
  ["deadlines", "Zeitfristen", "Fristen, Warnungen und Eskalationsregeln."],
  ["branches", "Unternehmensstruktur", "Niederlassungen und Verteilungsanteile."],
  ["emailTemplates", "E-Mail-Vorlagen", "Vorlagen für Dokument- und Systemmails."],
  ["interfaces", "Schnittstellen", "Freigegebene Integrationen und Verbindungsstatus."],
  ["checklists", "Checklisten", "Unternehmensweite Checklistenvorlagen."],
  ["mailServer", "Mailserver", "Systemweiten Mailversand konfigurieren und testen."],
];

const SETTINGS_AREAS = SETTINGS_DEFINITIONS.map(([id, label, purpose]) =>
  childArea({
    id: `settings.${id}`,
    label,
    kind: "settings",
    parentId: "settings",
    tab: "settings",
    firmSettingsTab: id,
    purpose,
    workflows: ["aktuelle Konfiguration prüfen", "berechtigte Änderungen vorbereiten und speichern"],
    roles: id === "profile" ? OPERATIVE_ROLES : MASTER_DATA_ROLES,
  })
);

const CALCULATOR_AREAS = [
  childArea({ id: "calculators.winter", label: "Winterdienst-Rechner", kind: "calculator", parentId: "calculators", tab: "calculators", purpose: "Winterdienstvarianten mit Einsatz-, Zeit- und Salzannahmen kalkulieren.", workflows: ["Grundlagen erfassen", "Varianten vergleichen", "Projekt und Angebot zuordnen"], roles: OPERATIVE_ROLES, sourceRefs: ["src/components/calculators/winter-service-calculator.tsx"] }),
  childArea({ id: "calculators.trips", label: "Fahrtenrechner", kind: "calculator", parentId: "calculators", tab: "calculators", purpose: "Fahrzeug- und Kraftstoffkosten einer Fahrt kalkulieren.", workflows: ["Fahrzeug wählen", "Strecke und Kraftstoffpreis erfassen", "Selbstkosten und Marge prüfen"], roles: OPERATIVE_ROLES, sourceRefs: ["src/components/calculators/vehicle-module.tsx"] }),
  childArea({ id: "calculators.vehicles", label: "Fahrzeuge", kind: "calculator", parentId: "calculators", tab: "calculators", purpose: "Fahrzeugstammdaten für den Fahrtenrechner; kein eigenständiger Rechner.", workflows: ["Fahrzeug suchen", "Verbrauch und Kilometerwerte prüfen", "berechtigt und getrennt von Kalkulationen bearbeiten"], roles: MANAGEMENT_ROLES, sourceRefs: ["src/components/calculators/vehicle-module.tsx"] }),
  childArea({ id: "calculators.rental", label: "Vermietung", kind: "calculator", parentId: "calculators", tab: "calculators", purpose: "Vorbereiteter Bereich für Fahrzeugvermietung.", workflows: ["fachlichen Ausbau abwarten"], roles: MANAGEMENT_ROLES, status: "limited", verificationStatus: "needs_review", sourceRefs: ["src/components/calculators/vehicle-module.tsx"] }),
];

const PROJECT_FILE_DEFINITIONS: Array<[string, string, string]> = [
  ["logbook", "Projekt-Logbuch", "Chronik, Kommentare und Systemereignisse."],
  ["notes", "Projekt-Hinweise", "Wichtige aktive Hinweise und Bestätigungen."],
  ["images", "Projekt-Bilder", "Projektbilder und Immocare-Bildgruppen."],
  ["documents", "Projekt-Dokumente", "Angebote, Rechnungen, Berichte und Anhänge."],
  ["approvals", "Angebotsfreigaben", "Digitale Angebotsaufrufe, Annahmen und Nachweise."],
  ["gaeb", "Projekt-GAEB", "Ausschreibungsdateien und GAEB-Bezug."],
  ["time", "Projekt-Zeiten", "Erfasste Projektzeiten und Zuordnungen."],
  ["appointments", "Termine & Stempelungen", "Planungstermine, Terminwünsche und Stempelungen."],
  ["forecast", "Projekt-Forecast", "Projektbezogene Umsatz- und Abrechnungsplanung."],
  ["budgets", "Projektzeitkontingente", "Zeitbudgets und Verbrauch."],
  ["marketingQuotas", "Marketing-Kontingente", "Projektbezogene Marketingleistungen."],
  ["automaticBilling", "Automatische Abrechnung", "Regeln und Status der Projektabrechnung."],
  ["profit", "Projektgewinn", "Erlöse, Kosten, Zeiten und Datenqualität des Projektgewinns."],
  ["potentials", "Projekt-Zusatzverkäufe", "Verkaufschancen im Projekt."],
  ["tasks", "Projekt-Aufgaben", "Mit dem Projekt verknüpfte Aufgaben."],
  ["comparison", "Projekt-Vergleich", "Angebots-, Leistungs- oder Abrechnungsvergleich."],
  ["checklists", "Projekt-Checklisten", "Projektbezogene Prüfschritte."],
];

const PROJECT_FILE_AREAS = PROJECT_FILE_DEFINITIONS.map(([id, label, purpose]) =>
  area({
    id: `projectFile.${id}`,
    label,
    kind: "project_file",
    parentId: "projectsSolutions",
    keywords: [label, `projekt ${label}`],
    purpose,
    workflows: ["passendes Projekt öffnen", `${label} auswählen`, "berechtigte Details prüfen oder bearbeiten"],
    roles: id === "profit" ? [Role.ADMIN, Role.GESCHAEFTSFUEHRER] : SALES_ROLES.concat(Role.MITARBEITER),
    target: { label: `${label} öffnen`, tab: "projectsSolutions", projectFileTab: id },
  })
);

const CUSTOMER_FILE_DEFINITIONS: Array<[string, string, string]> = [
  ["logbook", "Kunden-Logbuch", "Kunden- und Projektchronik."],
  ["notes", "Kunden-Hinweise", "Aktive kundenbezogene Hinweise."],
  ["images", "Kunden-Bilder", "Bilder aus verknüpften Projekten."],
  ["documents", "Kunden-Dokumente", "Dokumente aus Kunde und Projekten."],
  ["approvals", "Kunden-Freigaben", "Digitale Angebotsfreigaben des Kunden."],
  ["gaeb", "Kunden-GAEB", "Ausschreibungsdateien mit Kundenbezug."],
  ["contacts", "Ansprechpartner", "Ansprechpartner und deren Kontaktdaten."],
  ["potentials", "Kunden-Zusatzverkäufe", "Verkaufschancen des Kunden."],
  ["tasks", "Kunden-Aufgaben", "Mit dem Kunden verknüpfte Aufgaben."],
  ["projects", "Kunden-Projekte", "Alle Projekte des Kunden."],
  ["addresses", "Objektadressen", "Einsatz- und Objektadressen des Kunden."],
];

const CUSTOMER_FILE_AREAS = CUSTOMER_FILE_DEFINITIONS.map(([id, label, purpose]) =>
  area({
    id: `customerFile.${id}`,
    label,
    kind: "customer_file",
    parentId: "contacts",
    keywords: [label, `kunde ${label}`],
    purpose,
    workflows: ["passenden Kunden öffnen", `${label} auswählen`, "berechtigte Details prüfen oder bearbeiten"],
    roles: SALES_ROLES,
    target: { label: `${label} öffnen`, tab: "contacts", customerFileTab: id },
  })
);

const SYSTEM_SERVICE_AREAS: JarvisSystemArea[] = [
  area({
    id: "system.objectStorage",
    label: "Datei- und Objektspeicher",
    kind: "system_service",
    keywords: [
      "Objektspeicher",
      "HiDrive",
      "S3 Speicher",
      "Dateispeicher",
      "Dokumentenspeicher",
      "Bilder speichern",
      "PDF speichern",
      "stored-file",
      "PWA Dateiupload",
    ],
    purpose:
      "Private, verifizierte Byte-Ablage fuer Bilder, PDFs und E-Rechnungen bei unveraenderter Fach-, Rechte- und Auswertungslogik in WorkPilot360.",
    workflows: [
      "Datei im zustaendigen WorkPilot-Fachweg hochladen oder erzeugen",
      "Inhalt, Groesse und SHA-256 vor der Fachreferenz verifizieren",
      "Datei nur organisations- und besitzergebunden ueber WorkPilot ausliefern",
      "Fallback, Audit, Aufbewahrung und kontrollierte Migration getrennt behandeln",
    ],
    roles: REPORT_NAVIGATION_ROLES,
    verification: {
      status: "verified",
      checkedAt: "2026-08-01",
      sourceRefs: [
        STORAGE_ARCHITECTURE_SOURCE,
        "prisma/schema.prisma",
        "src/lib/storage/file-pilot.ts",
        "src/lib/storage/document-file.ts",
        "src/app/api/files/[fileId]/route.ts",
      ],
    },
  }),
];

export const JARVIS_SYSTEM_AREAS: JarvisSystemArea[] = [
  ...MAIN_AREAS,
  ...TASK_AREAS,
  ...GOAL_AREAS,
  ...EMPLOYEE_AREAS,
  ...PROCESS_AREAS,
  ...ACCOUNTING_AREAS,
  ...CATALOG_AREAS,
  ...REPORT_AREAS,
  ...SETTINGS_AREAS,
  ...CALCULATOR_AREAS,
  ...PROJECT_FILE_AREAS,
  ...CUSTOMER_FILE_AREAS,
  ...SYSTEM_SERVICE_AREAS,
];

export const JARVIS_MAIN_NAVIGATION_AREA_IDS = MAIN_AREAS.map((item) => item.id);
export const JARVIS_REPORT_AREA_IDS = REPORT_AREAS.map((item) => item.id);

function actorCanAccessArea(actor: JarvisActor, areaDefinition: JarvisSystemArea) {
  if (areaDefinition.roles.includes(actor.role)) return true;
  return actor.salesRoleEnabled === true && areaDefinition.roles.includes(Role.VERTRIEB);
}

export function canAccessJarvisSystemArea(
  areaDefinition: JarvisSystemArea,
  profile?: JarvisAccessProfile
) {
  if (!profile) return false;
  return (
    actorCanAccessArea(profile.sessionActor, areaDefinition) &&
    actorCanAccessArea(profile.effectiveActor, areaDefinition)
  );
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findJarvisSystemAreas(
  query: string,
  profile?: JarvisAccessProfile,
  limit = 4
): JarvisSystemAreaMatch[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  return JARVIS_SYSTEM_AREAS
    .filter((candidate) => canAccessJarvisSystemArea(candidate, profile))
    .map((candidate) => {
      const candidates = [candidate.label, ...candidate.keywords].map(normalize);
      const score = candidates.reduce((best, keyword) => {
        if (normalizedQuery === keyword) return Math.max(best, 100 + keyword.length);
        if (normalizedQuery.includes(keyword)) return Math.max(best, 50 + keyword.length);
        const matchingTerms = keyword
          .split(" ")
          .filter((term) => term.length >= 4 && normalizedQuery.includes(term)).length;
        return Math.max(best, matchingTerms * 5);
      }, 0);
      return { area: candidate, score };
    })
    .filter((candidate) => candidate.score >= 10)
    .sort((first, second) => second.score - first.score || first.area.label.localeCompare(second.area.label, "de"))
    .slice(0, Math.max(1, limit));
}

export function findJarvisAreaByContext(
  moduleName: string | undefined,
  subviewName: string | undefined,
  profile?: JarvisAccessProfile
) {
  const candidates = [subviewName, moduleName].filter((value): value is string => Boolean(value?.trim()));
  for (const candidate of candidates) {
    const exact = JARVIS_SYSTEM_AREAS.find(
      (item) => normalize(item.label) === normalize(candidate) && canAccessJarvisSystemArea(item, profile)
    );
    if (exact) return exact;
  }
  return undefined;
}
