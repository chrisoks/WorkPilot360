const fs = require("fs");
const path = require("path");

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function count(content, needle) {
  return content.split(needle).length - 1;
}

function getPrismaModelBlock(schema, modelName) {
  const match = schema.match(new RegExp(`model\\s+${modelName}\\s+\\{([\\s\\S]*?)\\n\\}`, "m"));
  return match ? match[1] : "";
}

function hasPrismaField(schema, modelName, fieldName, fieldType) {
  const modelBlock = getPrismaModelBlock(schema, modelName);
  if (!modelBlock) return false;
  return new RegExp(`(^|\\n)\\s*${fieldName}\\s+${fieldType}(\\s|\\?|\\n)`, "m").test(modelBlock);
}

function listSourceFiles(relativeDir) {
  const absoluteDir = path.join(root, relativeDir);
  if (!fs.existsSync(absoluteDir)) return [];
  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(relativePath);
    if (!/\.(ts|tsx|js|prisma)$/.test(entry.name)) return [];
    return [relativePath];
  });
}

function getPrismaModels(schema) {
  return new Set([...schema.matchAll(/model\s+(\w+)\s*\{/g)].map((match) => match[1]));
}

function getRuntimeSchemaTargets() {
  const sourceFiles = [
    ...listSourceFiles("src"),
    ...listSourceFiles("scripts"),
    ...listSourceFiles("prisma"),
  ];
  const runtimeTargets = new Map();
  const ddlTargetPattern =
    /(?:CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?|ALTER\s+TABLE|CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?[\s\S]*?ON)\s+"([^"\r\n]+)"/gi;

  for (const relativePath of sourceFiles) {
    const content = read(relativePath);
    for (const match of content.matchAll(ddlTargetPattern)) {
      const tableName = match[1];
      if (!runtimeTargets.has(tableName)) runtimeTargets.set(tableName, new Set());
      runtimeTargets.get(tableName).add(relativePath);
    }
  }

  return runtimeTargets;
}

const files = {
  page: read("src/components/dashboard/dashboard-page.tsx"),
  css: read("src/components/dashboard/dashboard.module.css"),
  schema: read("prisma/schema.prisma"),
  activityReportsRoute: read("src/app/api/activity-reports/route.ts"),
  finalInspectionsRoute: read("src/app/api/final-inspections/route.ts"),
  invoicesRoute: read("src/app/api/invoices/route.ts"),
  invoiceCancellationService: read("src/lib/invoices/invoice-cancellation-service.ts"),
  invoiceCreditService: read("src/lib/invoices/invoice-credit-service.ts"),
  invoiceLifecycleService: read("src/lib/invoices/invoice-lifecycle-service.ts"),
  invoiceLifecycleRoute: read("src/app/api/invoices/lifecycle/route.ts"),
  potentialsRoute: read("src/app/api/potentials/route.ts"),
  offersRoute: read("src/app/api/offers/route.ts"),
  heroProjectsRoute: read("src/app/api/hero/projects/route.ts"),
  projectLogbookRoute: read("src/app/api/project-logbook-entries/route.ts"),
  projectTimeEntriesRoute: read("src/app/api/project-time-entries/route.ts"),
  projectTimeEntryService: read("src/lib/time/project-time-entry-service.ts"),
  smokeDetectorReportsRoute: read("src/app/api/smoke-detector-reports/route.ts"),
  tasksRoute: read("src/app/api/tasks/route.ts"),
  onlineRequestSubmitRoute: read("src/app/api/public/online-requests/submit/route.ts"),
  onlineRequestConversionRoute: read("src/app/api/online-requests/[requestId]/convert/route.ts"),
  onlineRequestWorkspace: read("src/components/online-requests/online-requests-workspace.tsx"),
  storedFileRoute: read("src/app/api/files/[fileId]/route.ts"),
  storagePilot: read("src/lib/storage/file-pilot.ts"),
  packageJson: read("package.json"),
};

const required = [
  {
    label: "Objektspeicher-Dateien bleiben ueber eine geschuetzte WorkPilot-Route mandantengebunden",
    file: "storedFileRoute",
    needle: 'organizationId: organization.id',
    min: 1,
  },
  {
    label: "Objektspeicher-Auslieferung bleibt privat gecacht und wird nicht oeffentlich",
    file: "storedFileRoute",
    needle: 'Cache-Control": "private',
    min: 2,
  },
  {
    label: "Projektbild-Pilot behaelt den Datenbank-Fallback bei Speicherfehlern",
    file: "storagePilot",
    needle: "database fallback retained",
    min: 1,
  },
  {
    label: "Sidebar/Ansichten verwenden Zusatzverkäufe statt Potenziale",
    file: "page",
    needle: "Zusatzverkäufe",
    min: 10,
  },
  {
    label: "Manueller Zusatzverkauf kann angelegt werden",
    file: "page",
    needle: "Zusatzverkauf anlegen",
    min: 2,
  },
  {
    label: "Zusatzverkauf-Nummer wird in der UI berechnet/angezeigt",
    file: "page",
    needle: "getPotentialNumber",
    min: 3,
  },
  {
    label: "Zusatzverkauf-Nachfassaufgabe ist verknuepft",
    file: "page",
    needle: "getPotentialLinkedTask",
    min: 3,
  },
  {
    label: "Einmalprojekt-Angebotsplanung hat projektweite Angebotsleisten",
    file: "page",
    needle: "singleProjectOfferPlanningRows",
    min: 3,
  },
  {
    label: "Terminmaske kann Angebot zuordnen",
    file: "page",
    needle: "planningEntryOfferId",
    min: 5,
  },
  {
    label: "Terminmaske zeigt Angebotszuordnung auch bei Einmalprojekt-Angebotsbasis",
    file: "page",
    needle: "shouldShowPlanningOfferAssignment",
    min: 2,
  },
  {
    label: "Planung bearbeiten erkennt vorhandene Angebotsplanung",
    file: "page",
    needle: "entryProjectHasOfferPlanning",
    min: 2,
  },
  {
    label: "Angebots-Kontingentbox bleibt in der Planungsmaske sichtbar",
    file: "page",
    needle: "Kontingent vorbereitet",
    min: 1,
  },
  {
    label: "Einmalprojekt-Verbrauch wird je Angebot in der Seitenleiste angezeigt",
    file: "page",
    needle: "singleProjectOfferTimeUsageRows",
    min: 2,
  },
  {
    label: "Einmalprojekte nutzen Ausfuehrungsplanung statt Restlaufzeit-Endphase",
    file: "page",
    needle: "Ausführungsplanung",
    min: 1,
  },
  {
    label: "Planbare Stunden-Leisten haben Termin-/Bearbeiten-Auswahl",
    file: "page",
    needle: "projectPlanningCapacityMenu",
    min: 2,
  },
  {
    label: "TerWu-Prozessschritt prueft Einmalprojekte angebotsbezogen",
    file: "page",
    needle: "singleProjectOfferAppointmentState",
    min: 2,
  },
  {
    label: "Dauerlaeufer behalten Monatsleiste in der Projektakte",
    file: "page",
    needle: "projectMonthStripMonths",
    min: 2,
  },
  {
    label: "Dauerlaeufer-Planung bleibt monatsbezogen",
    file: "page",
    needle: "projectComparisonMonthPlanningEntries",
    min: 3,
  },
  {
    label: "Dauerlaeufer-Stempelungen bleiben monatsbezogen",
    file: "page",
    needle: "projectComparisonMonthStampEntries",
    min: 3,
  },
  {
    label: "Dauerlaeufer-Kontingente bleiben Monatsbasis fuer Planung",
    file: "page",
    needle: "projectMonthBudgetHours",
    min: 5,
  },
  {
    label: "Projektlogbuch speichert Monatsakte defensiv",
    file: "projectLogbookRoute",
    needle: "projectMonth",
    min: 5,
  },
  {
    label: "Projektbilder werden vor Upload normalisiert/verkleinert",
    file: "page",
    needle: "canvas.toDataURL(\"image/jpeg\", 0.82)",
    min: 1,
  },
  {
    label: "Projektbilder-Upload schreibt bei Dauerlaeufern in den ausgewaehlten Monat",
    file: "page",
    needle: "uploadProjectImageCategory",
    min: 2,
  },
  {
    label: "Vorher-/Nachherbilder bleiben eigene Projektbild-Kategorien",
    file: "page",
    needle: "Vorherbilder",
    min: 5,
  },
  {
    label: "Nachherbilder bleiben eigene Projektbild-Kategorie",
    file: "page",
    needle: "Nachherbilder",
    min: 5,
  },
  {
    label: "Verlorene Angebote werden als eigener Status gefuehrt",
    file: "offersRoute",
    needle: "lostReason",
    min: 4,
  },
  {
    label: "Verlorene Angebote werden aus aktiven Angebotsgrundlagen ausgeschlossen",
    file: "page",
    needle: "isActiveFinalOffer",
    min: 4,
  },
  {
    label: "Angebot-verloren-Dialog bleibt vorhanden",
    file: "page",
    needle: "Angebot verloren",
    min: 4,
  },
  {
    label: "Verlorene Angebote koennen wieder aktiviert werden",
    file: "page",
    needle: "Verlust zurücknehmen",
    min: 1,
  },
  {
    label: "Offers-API kann verlorene Angebote wieder aktivieren",
    file: "offersRoute",
    needle: "restoreLost",
    min: 2,
  },
  {
    label: "Angebote speichern Gewinnmerkmal",
    file: "schema",
    needle: "wonAt",
    min: 1,
  },
  {
    label: "Angebote koennen per API als gewonnen markiert werden",
    file: "offersRoute",
    needle: "markWon",
    min: 1,
  },
  {
    label: "Angebot gewonnen kann per Planung markiert werden",
    file: "page",
    needle: "markOfferWon",
    min: 2,
  },
  {
    label: "Projektakte erkennt, wenn alle Angebotsgrundlagen verloren sind",
    file: "page",
    needle: "projectHasOnlyLostOffers",
    min: 5,
  },
  {
    label: "Verlorene Angebote zeigen einen Kommentarclip",
    file: "page",
    needle: "offerStatusCommentClip",
    min: 2,
  },
  {
    label: "Verlorene Angebote brauchen einen Pflichtkommentar",
    file: "page",
    needle: "Bitte einen Kommentar zum verlorenen Angebot angeben.",
    min: 1,
  },
  {
    label: "Offers-API erzwingt Pflichtkommentar fuer verlorene Angebote",
    file: "offersRoute",
    needle: "Bitte einen Kommentar",
    min: 1,
  },
  {
    label: "Planungsbutton zeigt ohne aktive Angebotsgrundlage keinen Fertig-Zustand",
    file: "page",
    needle: "Kein aktives Angebot",
    min: 1,
  },
  {
    label: "Projektkopf behält Zusatzverkauf-Platzhalter ohne Leerraum",
    file: "page",
    needle: "Kein Zusatzverkauf",
    min: 1,
  },
  {
    label: "Zusatzverkauf-Platzhalter im Projektkopf ist deaktiviert",
    file: "page",
    needle: "disabled={!projectUpsellState}",
    min: 1,
  },
  {
    label: "Rechnungshistorie nutzt das Standard-Historiendesign",
    file: "page",
    needle: "projectInvoiceHistory.slice(0, 6).map",
    min: 1,
  },
  {
    label: "Mojibake-Kompatibilitaet schuetzt Dauerlaeufer-Projekttypen",
    file: "page",
    needle: "LEGACY_RECURRING_PROJECT_KIND",
    min: 2,
  },
  {
    label: "Mojibake-Kompatibilitaet schuetzt geloeschte Statuswerte",
    file: "page",
    needle: "isDeletedStatus",
    min: 3,
  },
  {
    label: "Mojibake-Kompatibilitaet schuetzt Taetigkeitsbericht-Titel",
    file: "projectLogbookRoute",
    needle: "ACTIVITY_REPORT_TITLES",
    min: 2,
  },
  {
    label: "Projektakte kann Taetigkeitsberichte erstellen",
    file: "page",
    needle: "Tätigkeitsbericht erstellen",
    min: 1,
  },
  {
    label: "Taetigkeitsbericht-Erstellung nutzt die Activity-Reports-API",
    file: "page",
    needle: "/api/activity-reports",
    min: 1,
  },
  {
    label: "Taetigkeitsbericht-Button haengt am richtigen Dokumentordner",
    file: "page",
    needle: 'selectedProjectDocumentType === "Tätigkeitsberichte"',
    min: 2,
  },
  {
    label: "Taetigkeitsbericht nutzt nur sichtbare Vorher-/Nachherbild-Schluessel",
    file: "page",
    needle: "getVisibleReportImageKeys",
    min: 3,
  },
  {
    label: "Activity-Reports-API filtert Berichte nach Projektmonat",
    file: "activityReportsRoute",
    needle: "projectMonth",
    min: 8,
  },
  {
    label: "Activity-Reports-API akzeptiert sichtbare Bildauswahl",
    file: "activityReportsRoute",
    needle: "beforeImageKeys",
    min: 2,
  },
  {
    label: "Rauchmelder-Nachweise bleiben unter Checklisten abgelegt",
    file: "smokeDetectorReportsRoute",
    needle: "Dokumente: Checklisten",
    min: 2,
  },
  {
    label: "Alte Rauchmelder-Nachweise bleiben lesbar",
    file: "smokeDetectorReportsRoute",
    needle: "Dokumente: Rauchmelder-Nachweise",
    min: 1,
  },
  {
    label: "Endkontrolle bleibt als eigener Dokument-/Statusbereich vorhanden",
    file: "finalInspectionsRoute",
    needle: "Dokumente: Endkontrolle",
    min: 1,
  },
  {
    label: "Projektakte zaehlt Endkontrolle fuer Fortschritt",
    file: "page",
    needle: "projectEndCheckCount",
    min: 2,
  },
  {
    label: "Projektpipeline enthaelt Geplant als eigenen Status",
    file: "page",
    needle: 'label: "Geplant"',
    min: 1,
  },
  {
    label: "Projektstatus-Normalisierung kennt Geplant",
    file: "heroProjectsRoute",
    needle: 'return "Geplant"',
    min: 1,
  },
  {
    label: "Projektakte enthaelt Projektgewinn-Reiter",
    file: "page",
    needle: "Projektgewinn",
    min: 3,
  },
  {
    label: "Projektgewinn bleibt als finaler Projektgewinn vorhanden",
    file: "page",
    needle: "projectProfitScopes",
    min: 2,
  },
  {
    label: "Projektgewinn nutzt gespeicherte Materialkosten-Snapshots",
    file: "page",
    needle: "materialCostSnapshot",
    min: 2,
  },
  {
    label: "Projektgewinn nutzt gespeicherte Lohnkosten-Snapshots",
    file: "page",
    needle: "laborCostSnapshot",
    min: 2,
  },
  {
    label: "Projektgewinn zeigt finalen/vorlaeufigen Status",
    file: "page",
    needle: "vorläufig",
    min: 2,
  },
  {
    label: "Projektgewinn erklaert Storno ohne aktive Rechnung",
    file: "page",
    needle: "Rechnung storniert / keine aktive Rechnung",
    min: 1,
  },
  {
    label: "Rechnungen fuehren ein Leistungsdatum",
    file: "invoicesRoute",
    needle: "serviceDate",
    min: 10,
  },
  {
    label: "Rechnungsmaske bestaetigt Leistungsdatum vor finaler Erstellung",
    file: "page",
    needle: "getInvoiceServiceDateLabel",
    min: 3,
  },
  {
    label: "Stempelungen koennen technisch mit Rechnungen verknuepft werden",
    file: "invoicesRoute",
    needle: "markStampedHoursAsInvoiced",
    min: 2,
  },
  {
    label: "Storno loest verknuepfte Stempelungen wieder von der Rechnung",
    file: "invoiceCancellationService",
    needle: "invoiceId: null, invoiceNumber: null, invoicedAt: null",
    min: 1,
  },
  {
    label: "Teilgutschriften pruefen kumulierte Restbetraege",
    file: "invoiceCreditService",
    needle: "alreadyCreditedByLine",
    min: 4,
  },
  {
    label: "Teilgutschriften bleiben ohne Zeit- und Lagerwirkung",
    file: "invoiceCreditService",
    needle: "Keine automatische Zeitfreigabe und keine Materialrückbuchung",
    min: 1,
  },
  {
    label: "Rechnungen bleiben fuer Dashboard und Buchhaltung lesbar",
    file: "invoicesRoute",
    needle: "export async function GET(req: Request)",
    min: 1,
  },
  {
    label: "Rechnungsloeschung delegiert an den kontrollierten Lebenszyklusservice",
    file: "invoicesRoute",
    needle: "executeInvoiceLifecycle",
    min: 2,
  },
  {
    label: "Nur Rechnungsentwuerfe duerfen kontrolliert geloescht werden",
    file: "invoiceLifecycleService",
    needle: "invoice.status !== \"Entwurf\"",
    min: 1,
  },
  {
    label: "Rechnungsentwurf-Loeschung verlangt eine exakte Bestaetigung",
    file: "invoiceLifecycleService",
    needle: "getInvoiceLifecycleConfirmationText",
    min: 2,
  },
  {
    label: "Geloeschte Rechnungsentwuerfe bleiben ueber eine geschuetzte Route wiederherstellbar",
    file: "invoiceLifecycleRoute",
    needle: "executeInvoiceLifecycle",
    min: 2,
  },
  {
    label: "Zeiteintraege delegieren an den gemeinsamen Schreibservice",
    file: "projectTimeEntriesRoute",
    needle: "saveProjectTimeEntry",
    min: 2,
  },
  {
    label: "Gemeinsamer Zeiteintragsservice bewahrt Rechnungsverknuepfung",
    file: "projectTimeEntryService",
    needle: "invoiceId",
    min: 4,
  },
  {
    label: "Terminserie nutzt neues Wording",
    file: "page",
    needle: "Terminserie anlegen",
    min: 1,
  },
  {
    label: "Terminmaske markiert Pflichtfelder",
    file: "page",
    needle: "data-required-missing",
    min: 3,
  },
  {
    label: "CSS-Pulsierung fuer Pflichtfelder ist vorhanden",
    file: "css",
    needle: "requiredPulse",
    min: 2,
  },
  {
    label: "Manueller Zusatzverkauf hat eigene Modalbreite",
    file: "css",
    needle: "manualPotentialModal",
    min: 1,
  },
  {
    label: "ProjectPotential speichert VC-Nummer",
    file: "schema",
    custom: () => hasPrismaField(files.schema, "ProjectPotential", "number", "String"),
    min: 1,
  },
  {
    label: "ProjectPotential Nummer ist indexiert",
    file: "schema",
    needle: "@@index([organizationId, number])",
    min: 1,
  },
  {
    label: "Potentials-API erzeugt VC-Nummern",
    file: "potentialsRoute",
    needle: "VC-",
    min: 2,
  },
  {
    label: "Potentials-API ergaenzt fehlende Nummern defensiv",
    file: "potentialsRoute",
    needle: "ensurePotentialNumbers",
    min: 1,
  },
  {
    label: "Tasks-API respektiert Status beim Anlegen",
    file: "tasksRoute",
    needle: "const nextStatus = body.status ? mapStatus(body.status) : TaskStatus.OFFEN",
    min: 1,
  },
  {
    label: "Mojibake-Check ist im Paket registriert",
    file: "packageJson",
    needle: "\"check:mojibake\"",
    min: 1,
  },
  {
    label: "Artikel & Leistungen nutzt die Standard-Tabellenfamilie",
    file: "page",
    needle: "styles.table} ${styles.catalogTable",
    min: 1,
  },
  {
    label: "Artikel & Leistungen hat Status-Clips",
    file: "css",
    needle: "catalogStatusClip",
    min: 3,
  },
  {
    label: "Buchhaltung ist als eigene Rolle im Schema vorhanden",
    file: "schema",
    needle: "BUCHHALTUNG",
    min: 1,
  },
  {
    label: "Auswertungsreiter werden rollenbasiert gefiltert",
    file: "page",
    needle: "getVisibleReportTabs",
    min: 2,
  },
  {
    label: "Buchhaltung faellt bei gesperrter Navigation auf Auswertungen zurueck",
    file: "page",
    needle: "isAccountingRole",
    min: 2,
  },
  {
    label: "Buchhaltung darf aus Auswertungen nicht in Projektakten drilldownen",
    file: "page",
    needle: "canUseReportDrilldowns",
    min: 3,
  },
  {
    label: "Buchhaltung hat in Auswertungen reine Leserechte",
    file: "page",
    needle: "canUseReportWriteActions",
    min: 4,
  },
  {
    label: "Mitarbeitenden-Auswertung nutzt rollenbezogene sichtbare Datenbasis",
    file: "page",
    needle: "visibleEmployeeReportRows",
    min: 3,
  },
  {
    label: "Normale Mitarbeitende sehen keine fremden Mitarbeiter-Einzelkarten",
    file: "page",
    needle: "canViewEmployeeTeamMemberDetails",
    min: 3,
  },
  {
    label: "Umsatz- und Projektuebersicht hat rollenabhaengige Inhaltstiefe",
    file: "page",
    needle: "canViewFullOverviewAnalytics",
    min: 4,
  },
  {
    label: "Umsatz- und Projektuebersicht schuetzt sensible Finanzkennzahlen",
    file: "page",
    needle: "canViewSensitiveOverviewFinancials",
    min: 7,
  },
  {
    label: "Sales-Auswertung bleibt eigener Reports-Reiter",
    file: "page",
    needle: "salesOfferRows",
    min: 5,
  },
  {
    label: "Sales-Auswertung nutzt Angebot-gewonnen-Logik",
    file: "page",
    needle: "salesWonOfferRows",
    min: 4,
  },
  {
    label: "Vertrieb sieht Sales-Auswertung",
    file: "page",
    needle: "\"sales\"",
    min: 3,
  },
  {
    label: "Projekt-/SVS-/KuZu-Auswertungen nutzen rollenbezogene Projektbasis",
    file: "page",
    needle: "isProjectVisibleInProjectScopedAnalytics",
    min: 6,
  },
  {
    label: "KuZu beruecksichtigt eigene Vertriebszuordnung",
    file: "page",
    needle: "isCustomerFeedbackLinkedToActiveSalesUser",
    min: 3,
  },
  {
    label: "Online-Anfragen bleiben ein eigener geschuetzter Hauptbereich",
    file: "page",
    needle: "\"onlineRequests\"",
    min: 8,
  },
  {
    label: "Online-Anfragen-Posteingang erzwingt eine Kundenentscheidung",
    file: "onlineRequestWorkspace",
    needle: "customerDecision",
    min: 8,
  },
  {
    label: "Oeffentliche Online-Anfragen verwenden einmalige Sitzungen",
    file: "onlineRequestSubmitRoute",
    needle: "consumedAt: null",
    min: 2,
  },
  {
    label: "Oeffentliche Bilder werden serverseitig neu codiert",
    file: "onlineRequestSubmitRoute",
    needle: "photos_reencoded",
    min: 1,
  },
  {
    label: "Online-Anfragen werden immer als OK-immocare-Lead angelegt",
    file: "onlineRequestConversionRoute",
    needle: "const PROJECT_STATUS = \"Lead / Klärung\"",
    min: 1,
  },
  {
    label: "Online-Anfragebilder bleiben eine eigene Projektbildgruppe",
    file: "onlineRequestConversionRoute",
    needle: "Bilder: Anfragebilder",
    min: 1,
  },
  {
    label: "Online-Anfragen-Umwandlung hat einen expliziten Aktionsmarker",
    file: "onlineRequestConversionRoute",
    needle: "online-request-convert-v1",
    min: 1,
  },
];

const forbidden = [
  {
    label: "Alte sichtbare Hauptnavigation darf nicht wieder Potenziale heissen",
    file: "page",
    needle: "[\"salesOpportunities\", \"Potenziale\"]",
  },
  {
    label: "Alte Tab-Beschriftung darf nicht wieder Potenziale heissen",
    file: "page",
    needle: "salesOpportunities: \"Potenziale\"",
  },
  {
    label: "Terminmaske darf nicht wieder mit Freie Projektplanung vorbefuellt sein",
    file: "page",
    needle: "setPlanningEntryTitle(\"Freie Projektplanung\")",
  },
  {
    label: "Terminmaske darf nicht wieder mit alter Beschreibung vorbefuellt sein",
    file: "page",
    needle: "setPlanningEntryDescription(\"Freie Planung ohne Angebotskontingent",
  },
  {
    label: "Wochenenden-Checkbox darf nicht zurueckkommen",
    file: "page",
    needle: "Wochenenden überspringen",
  },
  {
    label: "Icon-Buttons duerfen nicht nur ein Fragezeichen rendern",
    file: "page",
    needle: ">?</button>",
  },
  {
    label: "Projektakten-Planung darf neue Termine nicht mit dem zuletzt gewaehlten Planungsboard-Tag vorbelegen",
    file: "page",
    needle: "setPlanningEntryDate(selectedPlanningDateKey);",
  },
  {
    label: "Rechnungshistorie darf nicht wieder als Inline-Panel gerendert werden",
    file: "page",
    needle: "invoiceHistoryPanel",
  },
];

const requiredPrismaFields = [
  {
    model: "WorkPilotProject",
    field: "recurringBillingMode",
    reason: "Dauerlaeufer-Abrechnungsmodell wird in UI, Projekt-API, Stempelung und Projektzeiten genutzt.",
  },
  {
    model: "WorkPilotProject",
    field: "timeBudgetEnabled",
    reason: "Aktivierung von Projektzeitkontingenten wird in Projektakte und Planung genutzt.",
  },
  {
    model: "OnlineRequestPortal",
    field: "trustedHostnames",
    reason: "Oeffentliche Formularmutationen sind an die Portal-Hostname-Allowlist gebunden.",
  },
  {
    model: "OnlineRequest",
    field: "submissionIpHash",
    reason: "Missbrauchsschutz speichert nur den HMAC der Netzwerkkennung.",
  },
  {
    model: "OnlineRequest",
    field: "convertedProjectId",
    reason: "Replay-sichere Projektumwandlung braucht den dauerhaften Projektnachweis.",
  },
  {
    model: "OnlineRequestPhoto",
    field: "data",
    reason: "Sicher normalisierte Anfragebilder werden organisationsgebunden gespeichert.",
  },
  {
    model: "StoredFile",
    field: "objectKey",
    reason: "Private Objektdateien brauchen einen eindeutigen technischen Speicherschluessel.",
  },
  {
    model: "StoredFile",
    field: "sha256",
    reason: "Objektspeicherdateien muessen dauerhaft per SHA-256 verifizierbar bleiben.",
  },
  {
    model: "StoredFile",
    field: "sourceEntityId",
    reason: "Dual-Write-Wiederholungen brauchen einen eindeutigen idempotenten Quellenbezug.",
  },
  {
    model: "OnlineRequestPublicSession",
    field: "consumedAt",
    reason: "Oeffentliche Formularsitzungen muessen genau einmal verwendbar bleiben.",
  },
  {
    model: "Invoice",
    field: "sourceInvoiceId",
    reason: "Gutschriften muessen dauerhaft und mandantengebunden auf ihre Ursprungsrechnung verweisen.",
  },
  {
    model: "InvoiceLine",
    field: "sourceInvoiceLineId",
    reason: "Kumulierte Teilgutschriften muessen positionsgenau gegen den Restbetrag geprueft werden.",
  },
];

const failures = [];

for (const check of required) {
  const actual = check.custom ? (check.custom() ? 1 : 0) : count(files[check.file], check.needle);
  if (actual < check.min) {
    failures.push(`${check.label}: erwartet mindestens ${check.min}, gefunden ${actual}.`);
  }
}

for (const check of forbidden) {
  if (files[check.file].includes(check.needle)) {
    failures.push(`${check.label}: verbotener Marker gefunden.`);
  }
}

for (const check of requiredPrismaFields) {
  const modelBlock = getPrismaModelBlock(files.schema, check.model);
  if (!modelBlock) {
    failures.push(`Prisma-Modell fehlt: ${check.model}. ${check.reason}`);
    continue;
  }
  if (!new RegExp(`(^|\\n)\\s*${check.field}\\s+`, "m").test(modelBlock)) {
    failures.push(`Prisma-Feld fehlt: ${check.model}.${check.field}. ${check.reason}`);
  }
}

const prismaModels = getPrismaModels(files.schema);
const runtimeSchemaTargets = getRuntimeSchemaTargets();
const runtimeTargetsMissingInPrisma = [...runtimeSchemaTargets.keys()]
  .filter((tableName) => !prismaModels.has(tableName))
  .sort();

for (const tableName of runtimeTargetsMissingInPrisma) {
  failures.push(
    `Runtime-DDL-Ziel fehlt im Prisma-Schema: ${tableName}. Dateien: ${[
      ...runtimeSchemaTargets.get(tableName),
    ].join(", ")}.`
  );
}

if (failures.length > 0) {
  console.error("Regressionscheck fehlgeschlagen:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Regressionscheck bestanden: zentrale Entwicklungsmarker sind vorhanden.");
