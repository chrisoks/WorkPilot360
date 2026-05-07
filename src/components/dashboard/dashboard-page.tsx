"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import styles from "./dashboard.module.css";

const DOCUMENT_PREVIEW_WIDTH = 595;
const DOCUMENT_PREVIEW_HEIGHT = 842;

type AppTab =
  | "overview"
  | "dashboard"
  | "kanban"
  | "calendar"
  | "reports"
  | "hero"
  | "projectsSolutions"
  | "projectsImmocare"
  | "contacts"
  | "documents"
  | "documentOverview"
  | "documentTexts"
  | "documentTemplates"
  | "documentConfigurator"
  | "documentGaeb"
  | "orders"
  | "articles"
  | "services"
  | "salesPrices"
  | "datanorm"
  | "accounting"
  | "personalData"
  | "employees"
  | "absenceRequests"
  | "timeTracking"
  | "timeCategories"
  | "breakManagement"
  | "planningBoard"
  | "archive"
  | "settings";
type CalendarView = "month" | "week" | "day";
type PerformancePeriod = "day" | "month" | "year";
type ProductivityPeriod = "day" | "week" | "month" | "quarter" | "year";
type ContactFormTab = "details" | "address" | "terms" | "payment" | "zugferd";
type CustomerFileTab =
  | "logbook"
  | "images"
  | "documents"
  | "gaeb"
  | "contacts"
  | "tasks"
  | "orders"
  | "projects"
  | "addresses";
type CustomerDocumentType =
  | "Allgemeine Dokumente"
  | "Anfragen"
  | "Angebote"
  | "Angebote: Sonderangebote"
  | "Tätigkeitsberichte"
  | "Mahnung"
  | "Rechnungen";
type ProjectFileTab =
  | "logbook"
  | "images"
  | "documents"
  | "gaeb"
  | "time"
  | "appointments"
  | "tasks"
  | "material"
  | "comparison"
  | "participants"
  | "checklists";
type SidebarPreparedTab =
  | "documents"
  | "documentOverview"
  | "documentTexts"
  | "documentTemplates"
  | "documentConfigurator"
  | "documentGaeb"
  | "articles"
  | "services"
  | "salesPrices"
  | "datanorm";
type FirmSettingsTab =
  | "profile"
  | "appearance"
  | "branches"
  | "emailTemplates"
  | "infoDocuments"
  | "interfaces"
  | "accessRights"
  | "projectTypes"
  | "documentFolders"
  | "checklists"
  | "sources"
  | "mailServer"
  | "customFields";
type CompanyProfileEditTab = "general" | "contact" | "bank";
type EmployeeTopTab = "overview" | "absence" | "time" | "balance" | "documents";
type EmployeeTimePeriod = "day" | "month" | "year" | "custom";
type EmployeeSideTab =
  | "personal"
  | "permissions"
  | "mailserver"
  | "employment"
  | "tax"
  | "bank"
  | "password";
type DocumentConfiguratorSection =
  | "general"
  | "layout"
  | "firstPage"
  | "followingPages"
  | "options"
  | "booking";
type DocumentPreviewPage = "first" | "following";
type DocumentLayoutConfig = {
  baseType: string;
  name: string;
  status: string;
  folder: string;
  numberRange: string;
  moveProjectStatus: string;
  marginTop: string;
  marginBottom: string;
  marginLeft: string;
  marginRight: string;
  baseLayout: string;
  fontFamily: string;
  fontSize: string;
  showFoldMarks: boolean;
  mainTop: string;
  mainLeft: string;
  mainRight: string;
  introText: string;
  closingText: string;
  showPositionDescription: boolean;
  showPositionImages: boolean;
  showQuantityPdf: boolean;
  showEan: boolean;
  showArticleNumbers: boolean;
  hideSinglePrices: boolean;
  showTitleSums: boolean;
  hideOrderValue: boolean;
  showVat: boolean;
  showVatRate: boolean;
  showTitleSummary: boolean;
  showSurcharge: boolean;
  showLaborMachineCosts: boolean;
  showArticlePricesInServices: boolean;
  footerText: string;
  footerDistance: string;
  footerFontSize: string;
  showLetterhead: boolean;
  letterheadFileName: string;
  letterheadDataUrl: string;
  addressLineEnabled: boolean;
  addressLineText: string;
  addressLineTop: string;
  addressLineLeft: string;
  subjectOneEnabled: boolean;
  subjectOneBold: boolean;
  subjectOneSource: string;
  subjectOneFont: string;
  subjectOneSize: string;
  subjectOnePrefix: string;
  subjectTwoEnabled: boolean;
  subjectTwoBold: boolean;
  subjectTwoFont: string;
  subjectTwoSize: string;
  showFirstPageLogo: boolean;
  showFirstPageAddress: boolean;
  firstPageLogoTop: string;
  firstPageLogoLeft: string;
  firstPageLogoWidth: string;
  firstPageLogoHeight: string;
  firstPageAddressText: string;
  firstPageInfoBlock: boolean;
  firstPageInfoTop: string;
  firstPageInfoLeft: string;
  firstPageInfoWidth: string;
  showCustomerNumber: boolean;
  showDocumentNumber: boolean;
  showRecipientVatId: boolean;
  showContactName: boolean;
  showContactPhone: boolean;
  showContactMobile: boolean;
  showContactFax: boolean;
  showContactEmail: boolean;
  contactDisplayMode: string;
  deliveryDateMode: string;
  paymentTypeMode: string;
  showFreeInfoBlock: boolean;
  freeInfoTop: string;
  freeInfoLeft: string;
  freeInfoWidth: string;
  freeInfoContent: string;
  followingShowLogo: boolean;
  followingShowAddress: boolean;
  followingLogoTop: string;
  followingLogoLeft: string;
  followingLogoWidth: string;
  followingLogoHeight: string;
  followingInfoBlock: boolean;
  followingInfoAlsoFirstPage: boolean;
  followingInfoTop: string;
  followingInfoLeft: string;
  followingInfoWidth: string;
  followingShowDocumentNumber: boolean;
  followingShowProjectNumber: boolean;
  followingShowContact: boolean;
  followingShowPhone: boolean;
  followingShowMobile: boolean;
  followingShowFax: boolean;
  followingShowEmail: boolean;
  subjectPrefix: string;
  bookingRelevant: boolean;
  bookingCategory: string;
  bookingSide: string;
  bookingAccount: string;
  costCenter: string;
  correctionDocumentType: string;
};
type DocumentTypeSummary = {
  id: string;
  name: string;
  baseType: string;
  folder: string;
  status: string;
  config: Partial<DocumentLayoutConfig>;
  isArchived: boolean;
  updatedAt: string;
  updatedAtLabel: string;
};
type DocumentTextItem = {
  id: string;
  source: string;
  kind: "text" | "title";
  title: string;
  body: string;
  createdAtLabel: string;
  updatedAtLabel: string;
};
type DocumentTextView = "texts" | "titles" | "syntax";
type GlobalSearchResult = {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  detail: string;
  target:
    | { kind: "contact"; id: string }
    | { kind: "project"; id: string }
    | { kind: "task"; id: string }
    | { kind: "documentType"; id: string }
    | { kind: "documentText"; id: string };
};
type UserRole = "ADMIN" | "GESCHAEFTSFUEHRER" | "FUEHRUNGSKRAFT" | "MITARBEITER" | "GAST";
type TaskStatus =
  | "offen"
  | "in Bearbeitung"
  | "wartet auf R\u00fcckmeldung"
  | "erledigt"
  | "abgelehnt"
  | "\u00fcberf\u00e4llig"
  | "archiviert";

function DocumentLetterheadCanvas({
  dataUrl,
  fileName,
  pageNumber,
}: {
  dataUrl: string;
  fileName: string;
  pageNumber: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;
    let loadedPdf: { destroy: () => Promise<void> } | null = null;

    async function renderPdfPage() {
      const canvas = canvasRef.current;
      if (!canvas || !dataUrl) return;

      const pdfjs = await import("pdfjs-dist");

	pdfjs.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

      const buffer = await fetch(dataUrl).then((res) => res.arrayBuffer());
      if (cancelled) return;

      const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
      loadedPdf = pdf;
      const safePageNumber = Math.min(Math.max(pageNumber, 1), pdf.numPages);
      const page = await pdf.getPage(safePageNumber);
      if (cancelled) return;

      const context = canvas.getContext("2d");
      if (!context) return;

      const baseViewport = page.getViewport({ scale: 1 });
      const deviceScale = window.devicePixelRatio || 1;
      const scale = Math.min(
        DOCUMENT_PREVIEW_WIDTH / baseViewport.width,
        DOCUMENT_PREVIEW_HEIGHT / baseViewport.height
      );
      const viewport = page.getViewport({ scale: scale * deviceScale });
      const offsetX = Math.max((DOCUMENT_PREVIEW_WIDTH * deviceScale - viewport.width) / 2, 0);
      const offsetY = Math.max((DOCUMENT_PREVIEW_HEIGHT * deviceScale - viewport.height) / 2, 0);

      canvas.width = Math.round(DOCUMENT_PREVIEW_WIDTH * deviceScale);
      canvas.height = Math.round(DOCUMENT_PREVIEW_HEIGHT * deviceScale);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      renderTask = page.render({
        canvasContext: context,
        viewport,
        transform: [1, 0, 0, 1, offsetX, offsetY],
      });
      await renderTask.promise.catch(() => undefined);
    }

    void renderPdfPage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      void loadedPdf?.destroy();
    };
  }, [dataUrl, fileName, pageNumber]);

  return <canvas ref={canvasRef} aria-label={`Briefpapier ${fileName} Seite ${pageNumber}`} />;
}

type TaskPriority = "niedrig" | "normal" | "hoch" | "kritisch";
type CustomerClass = "A" | "B" | "C" | "";
type RecurrenceInterval = "daily" | "weekly" | "monthly" | "yearly";
type GermanStateCode =
  | "BW"
  | "BY"
  | "BE"
  | "BB"
  | "HB"
  | "HH"
  | "HE"
  | "MV"
  | "NI"
  | "NW"
  | "RP"
  | "SL"
  | "SN"
  | "ST"
  | "SH"
  | "TH";

type UserOption = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  teamId: string | null;
  teamIds: string[];
  dailyWorkHours: number;
  profileImageDataUrl: string;
};

type TeamOption = {
  id: string;
  name: string;
  departmentId: string | null;
  userCount: number;
  taskCount: number;
};

type TradeOption = {
  id: string;
  name: string;
  projectPrefix: string;
};

type EscalationRule = {
  id: string;
  name: string;
  hoursAfterDue: number;
  targetRole: UserRole;
  targetRoleLabel: string;
  isActive: boolean;
  emailEnabled: boolean;
  emailRecipients: string;
};

type HeroProjectPreview = {
  id: string;
  projectNumber: string;
  title: string;
  customer: string;
  status: string;
  statusCode: string;
  description: string;
  contactId?: string;
  contactPersonId?: string;
  addressContactId?: string;
  projectType?: string;
  projectKind?: string;
  projectRuntimeFrom?: string;
  projectRuntimeUntil?: string;
  billingInterval?: string;
  trade?: string;
  branch?: string;
  volume?: string;
  source?: string;
  address?: string;
  participants?: string;
  responsibleName?: string;
  createdAt?: string;
  timeBudgetHours?: string;
  timeBudgetHistory?: Array<{
    id: string;
    changedAt: string;
    changedBy: string;
    previousHours: string;
    nextHours: string;
  }>;
};

type AppNotification = {
  id: string;
  subject: string;
  body: string;
  channel: string;
  createdAt: string;
  readAt: string | null;
  taskId: string | null;
};

type AbsenceItem = {
  id: string;
  userId: string;
  userName: string;
  representativeUserId: string | null;
  representativeName: string | null;
  type: "urlaub" | "krank";
  date: string;
  note: string;
};

type ContactItem = {
  id: string;
  category: string;
  type: "person" | "company";
  legalForm: string;
  customerNumber: string;
  salutation: string;
  additionalSalutation: string;
  companyName: string;
  firstName: string;
  lastName: string;
  position: string;
  email: string;
  phone: string;
  mobile: string;
  fax: string;
  website: string;
  source: string;
  reachability: string;
  isInvoiceRecipient: boolean;
  parentCompanyId: string;
  parentCompanyName: string;
  mainContactName: string;
  isMainContact: boolean;
  street: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  country: string;
  paymentTermDays: number | null;
  discountPercent: number | null;
  discountTermDays: number | null;
  priceGroup: string;
  iban: string;
  bic: string;
  bankName: string;
  taxId: string;
  debtorCreditorAccount: string;
  leitwegId: string;
  createdAt: string;
  updatedAt: string;
};

type ContactColumnId =
  | "type"
  | "customerNumber"
  | "companyName"
  | "salutation"
  | "additionalSalutation"
  | "firstName"
  | "lastName"
  | "email"
  | "category"
  | "location"
  | "phone"
  | "mobile"
  | "createdAt"
  | "birthDate"
  | "fax"
  | "website"
  | "source"
  | "reachability"
  | "paymentTermDays"
  | "discountPercent"
  | "discountTermDays"
  | "priceGroup"
  | "leitwegId";

type ContactColumn = {
  id: ContactColumnId;
  label: string;
  filterType?: "select";
  options?: string[];
  value: (contact: ContactItem) => string;
  render?: (contact: ContactItem) => ReactNode;
};

type ProjectPipelineId = "solutions" | "immocare";

type ProjectPipelineStatus = {
  label: string;
  icon: string;
  count?: number;
  urgent?: boolean;
};

type ProjectPipeline = {
  id: ProjectPipelineId;
  tab: AppTab;
  label: string;
  company: string;
  total: number;
  statuses: ProjectPipelineStatus[];
};

type ProjectDraft = {
  contactId: string;
  contactPersonId: string;
  addressContactId: string;
  projectType: "Projekt OK solutions" | "Projekt OK immocare";
  projectKind: "einmaliges Projekt" | "Dauerläufer-Projekt";
  projectRuntimeFrom: string;
  projectRuntimeUntil: string;
  billingInterval: "monatlich" | "quartalsweise" | "jährlich";
  trade: string;
  branch: string;
  name: string;
  volume: string;
  timeBudgetHours: string;
  source: string;
  participants: string;
};
type ProjectKindFilter = "" | ProjectDraft["projectKind"];

type CustomerLogbookEntry = {
  id: string;
  customerId: string;
  date: string;
  text: string;
  colleague: string;
  visibleFor: string[];
  attachments: LogbookAttachment[];
  taskTitle: string;
};

type LogbookAttachment = {
  name: string;
  type: "Bild" | "Dokument";
  mimeType?: string;
  size?: number;
  dataUrl?: string;
};

type ProjectLogbookEntry = {
  id: string;
  projectId: string;
  date: string;
  title: string;
  text: string;
  author: string;
  colleague: string;
  visibleFor: string[];
  attachments: LogbookAttachment[];
};

type StampMode = "project" | "unproductive";

type StampSession = {
  mode: StampMode;
  projectId: string;
  startedAt: number;
  accumulatedMs: number;
  pauseStartedAt: number | null;
  pauseMs: number;
};

type StampTimeEntry = {
  id: string;
  mode: StampMode;
  projectId: string;
  projectLabel: string;
  employee: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  pauseMs: number;
  comment: string;
};

const defaultContactColumnIds: ContactColumnId[] = [
  "type",
  "customerNumber",
  "companyName",
  "firstName",
  "lastName",
  "email",
  "category",
  "location",
  "phone",
  "mobile",
  "createdAt",
];

const emptyProjectDraft: ProjectDraft = {
  contactId: "",
  contactPersonId: "",
  addressContactId: "",
  projectType: "Projekt OK solutions",
  projectKind: "einmaliges Projekt",
  projectRuntimeFrom: "",
  projectRuntimeUntil: "",
  billingInterval: "monatlich",
  trade: "Winterdienst",
  branch: "OK solutions GmbH",
  name: "",
  volume: "",
  timeBudgetHours: "",
  source: "",
  participants: "",
};

const projectTradeOptions = [
  "Wartung",
  "Malerarbeiten",
  "Glasreinigung",
  "Unterhaltsreinigung",
  "Grünflächen- und Gartenpflege",
  "Hausmeisterservice",
  "Hausverwaltung",
  "Fassadenreinigung",
  "Dachreinigung",
  "Umzug Service",
  "Intern",
  "Trockeneisstrahlen",
  "Reparaturarbeiten",
  "Reinigung",
  "Objektbetreuung",
  "Photovoltaikanlagenreinigung",
  "Materialverkauf",
  "Arbeitssicherheit",
  "HR",
  "Marketing",
  "Winterdienst",
];

const projectSourceOptions = [
  "E-Mail",
  "Persönlicher Kontakt",
  "Messe",
  "Social Media",
  "Sonstige",
  "Online-Portal",
  "Telefon",
  "Eigene Webseite",
  "Empfehlung",
  "Bestandskunde",
  "Auxenwerbung",
  "Netzwerk",
  "Interessent",
  "Flyer / Prospekt",
  "Fahrzeugwerbung",
];

const projectLifecycleStatuses: ProjectPipelineStatus[] = [
  { label: "Alle Offenen", icon: "", count: 0 },
  { label: "Lead / Klärung", icon: "1", count: 0, urgent: true },
  { label: "Angebot", icon: "2", count: 0 },
  { label: "Warten auf Kunde", icon: "3", count: 0 },
  { label: "Zur Planung bereit", icon: "4", count: 0 },
  { label: "Umsetzung", icon: "5", count: 0 },
  { label: "Endkontrolle", icon: "6", count: 0 },
  { label: "Zur Abrechnung bereit", icon: "7", count: 0 },
  { label: "Abgeschlossen", icon: "8", count: 0 },
  { label: "Archiviert", icon: "9", count: 0 },
];

const projectAutomationRules: Array<{
  status: string;
  trigger: string;
  action: string;
}> = [
  {
    status: "Lead / Klärung",
    trigger: "Täglich, solange das Projekt in Lead / Klärung steht",
    action: "Notification und E-Mail als Erinnerung",
  },
  {
    status: "Warten auf Kunde",
    trigger: "Alle 3 Tage, solange der Kunde noch nicht reagiert hat",
    action: "Notification und E-Mail an den Vertriebler",
  },
  {
    status: "Zur Planung bereit",
    trigger: "Beim Wechsel von Warten auf Kunde zu Zur Planung bereit",
    action: "Notification und E-Mail an den Planungsbeauftragten",
  },
  {
    status: "Umsetzung",
    trigger: "Sobald das Projekt in Umsetzung ist",
    action: "Sichtbar für die ausführenden Mitarbeiter in App und PC",
  },
  {
    status: "Zur Abrechnung bereit",
    trigger: "Nach abgeschlossener Endkontrolle",
    action: "Automatischer Statuswechsel auf Zur Abrechnung bereit",
  },
  {
    status: "Dauerläufer-Faktura",
    trigger: "Nach Faktura bei Dauerläufer-Projekten",
    action: "Automatisch zurück auf Zur Planung bereit",
  },
];

function getProjectStatusStripLabel(label: string) {
  const labelMap: Record<string, string> = {
    "Alle Offenen": "Alle offenen",
    "Lead / Klärung": "Lead & Klärung",
    Angebot: "Angebotserstellung",
    Umsetzung: "In Umsetzung",
    Endkontrolle: "Endkontrolle",
    "Zur Abrechnung bereit": "Abrechnungbereit",
  };

  return labelMap[label] ?? label;
}

function getProjectNumberPrefix(projectNumber: string) {
  return projectNumber.split("-")[0] || "-";
}

function getProjectNumberSuffix(projectNumber: string) {
  return projectNumber.split("-")[1] || projectNumber || "-";
}

const tradeProjectPrefixes: Record<string, string> = {
  Arbeitssicherheit: "ASS",
  Dachreinigung: "DAR",
  Fassadenreinigung: "FAR",
  Glasreinigung: "GLR",
  "Grünflächen- und Gartenpflege": "GPFL",
  Hausmeisterservice: "HAS",
  Hausverwaltung: "HVW",
  HR: "HR",
  Intern: "INT",
  Malerarbeiten: "MAR",
  Marketing: "MKG",
  Materialverkauf: "MAT",
  Objektbetreuung: "OBJ",
  Photovoltaikanlagenreinigung: "PAR",
  Reinigung: "REI",
  Reparaturarbeiten: "REP",
  Trockeneisstrahlen: "TREI",
  Umzug: "UMZ",
  "Umzug Service": "UMZ",
  Unterhaltsreinigung: "UHR",
  Wartung: "WAR",
  Winterdienst: "WID",
};

function normalizeTradeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/x/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeProjectPrefixInput(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);
}

function getProjectTradePrefix(tradeName: string, tradeOptions: TradeOption[] = []) {
  const savedPrefix = tradeOptions.find(
    (trade) => normalizeTradeName(trade.name) === normalizeTradeName(tradeName)
  )?.projectPrefix;
  if (savedPrefix) return savedPrefix;

  const directMatch = tradeProjectPrefixes[tradeName];
  if (directMatch) return directMatch;

  const normalizedTrade = normalizeTradeName(tradeName);
  const mappedEntry = Object.entries(tradeProjectPrefixes).find(
    ([name]) => normalizeTradeName(name) === normalizedTrade
  );
  if (mappedEntry) return mappedEntry[1];

  const relevantWords = normalizedTrade
    .split(" ")
    .filter((word) => word && !["und", "service", "von", "der", "die", "das"].includes(word));
  const initials = relevantWords.map((word) => word[0]).join("").toUpperCase();
  const compact = relevantWords.join("").toUpperCase();

  return (initials.length >= 3 ? initials : compact).slice(0, 4) || "PRJ";
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0]?.slice(0, 2);

  return (initials || "MA").toUpperCase();
}

function getNextProjectSequence(projects: HeroProjectPreview[]) {
  const numericIds = projects
    .map((project) => Number(getProjectNumberSuffix(project.projectNumber || "")))
    .filter((value) => Number.isFinite(value));

  return numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
}

const projectPipelines: ProjectPipeline[] = [
  {
    id: "solutions",
    tab: "projectsSolutions",
    label: "Projekte OK solutions",
    company: "OK solutions",
    total: 47,
    statuses: projectLifecycleStatuses,
  },
  {
    id: "immocare",
    tab: "projectsImmocare",
    label: "Projekte OK immocare",
    company: "OK immocare",
    total: 80,
    statuses: projectLifecycleStatuses,
  },
];

const planningBoardSections = [
  {
    company: "OK solutions",
    title: "OK solutions Planungsboard",
    groups: ["Gesamt", "Marketing", "Arb.Sich.", "HR"],
    detailGroups: [
      { name: "Marketing", employees: ["Ramona Eid", "Hendrik Eid"] },
      { name: "Arb.Sich.", employees: ["Christian Eid", "Christine Giesswein"] },
      { name: "HR", employees: ["Natalia Gretschanjuk", "Mert Tozkular"] },
    ],
  },
  {
    company: "OK immocare",
    title: "OK immocare Planungsboard",
    groups: ["Gesamt", "VZK", "TZK"],
    detailGroups: [
      { name: "VZK", employees: ["Albert Hensinger", "Ion Ceban"] },
      { name: "TZK", employees: ["Ilona Mihailova", "Jacqueline Mzoughi"] },
    ],
  },
];

const planningTimelineSlots = Array.from({ length: 57 }, (_, index) => {
  const totalMinutes = 6 * 60 + index * 15;
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(
    totalMinutes % 60
  ).padStart(2, "0")}`;
});
const planningHourLabels = Array.from({ length: 15 }, (_, index) => `${String(6 + index).padStart(2, "0")}:00`);
const planningSlotColumnCount = 56;

const navigationTabs: Array<[AppTab, string]> = [
  ["overview", "Übersicht"],
  ["reports", "Auswertungen"],
  ["contacts", "Kontakte"],
  ["projectsSolutions", "Projekte OK solutions"],
  ["projectsImmocare", "Projekte OK immocare"],
  ["documents", "Dokumente"],
  ["articles", "Artikel & Leistungen"],
  ["dashboard", "Aufgaben"],
  ["planningBoard", "Planungsboard"],
  ["accounting", "Buchhaltung"],
  ["personalData", "Persönliche Daten"],
  ["employees", "Mitarbeiter"],
  ["settings", "Firmeneinstellungen"],
];

const preparedSidebarTabLabels: Record<SidebarPreparedTab, string> = {
  documents: "Dokumente",
  documentOverview: "Dokumentenübersicht",
  documentTexts: "Texte & Titel",
  documentTemplates: "Vorlagen",
  documentConfigurator: "Konfigurator",
  documentGaeb: "Ausschreibungen (GAEB)",
  articles: "Artikel",
  services: "Leistungen",
  salesPrices: "Verkaufspreise",
  datanorm: "Datanorm",
};

function isPreparedSidebarTab(tab: AppTab): tab is SidebarPreparedTab {
  return tab in preparedSidebarTabLabels;
}

function SidebarIcon({ tab }: { tab: AppTab }) {
  const common = {
    className: styles.navIcon,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };

  if (tab === "overview") {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="6" height="6" rx="1.4" />
        <rect x="14" y="4" width="6" height="6" rx="1.4" />
        <rect x="4" y="14" width="6" height="6" rx="1.4" />
        <rect x="14" y="14" width="6" height="6" rx="1.4" />
      </svg>
    );
  }

  if (tab === "reports") {
    return (
      <svg {...common}>
        <path d="M11 3a9 9 0 1 0 9 9h-9V3Z" />
        <path d="M13 3v7h7a7 7 0 0 0-7-7Z" />
      </svg>
    );
  }

  if (tab === "contacts") {
    return (
      <svg {...common}>
        <rect x="5" y="4" width="14" height="16" rx="2" />
        <circle cx="12" cy="10" r="2.2" fill="currentColor" />
        <path d="M8.3 16c.8-2 6.6-2 7.4 0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M3.8 8h2M3.8 12h2M3.8 16h2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (tab === "projectsSolutions" || tab === "projectsImmocare") {
    return (
      <svg {...common}>
        <path d="M5.5 7.5h12.2c1.4 0 2.5 1.1 2.5 2.5v7.2c0 1.4-1.1 2.5-2.5 2.5H5.5C4.1 19.7 3 18.6 3 17.2V10c0-1.4 1.1-2.5 2.5-2.5Z" />
        <path d="M7 4.5h9.5M6 6h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="17" cy="15.5" r="3.4" fill="#111827" stroke="currentColor" strokeWidth="1.4" />
        <path d="M17 13.7v2h1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (tab === "documents" || tab.toString().startsWith("document")) {
    return (
      <svg {...common}>
        <path d="M7 3h7l4 4v14H7z" />
        <path d="M14 3v5h5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }

  if (tab === "articles" || tab === "services" || tab === "salesPrices" || tab === "datanorm") {
    return (
      <svg {...common}>
        <path d="M5 6h3M5 12h3M5 18h3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M11 6h8M11 12h8M11 18h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (tab === "dashboard" || tab === "kanban" || tab === "archive") {
    return (
      <svg {...common}>
        <rect x="5" y="5" width="14" height="14" rx="2" />
        <path d="m9 12 2 2 4-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (tab === "planningBoard" || tab === "calendar") {
    return (
      <svg {...common}>
        <path d="M5 7h14M5 12h14M5 17h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M7 7h4M13 12h5M6 17h7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }

  if (tab === "accounting") {
    return (
      <svg {...common}>
        <ellipse cx="12" cy="6" rx="7" ry="3" />
        <path d="M5 6v5c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 11v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (tab === "personalData") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21c1-4.2 14-4.2 15 0" />
      </svg>
    );
  }

  if (tab === "employees") {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <circle cx="16.5" cy="9.5" r="2.5" />
        <path d="M3.5 20c.8-4.3 10.2-4.3 11 0M12.5 19.5c.7-3 6.7-3 7.3 0" />
      </svg>
    );
  }

  if (tab === "settings") {
    return (
      <svg {...common}>
        <path d="M12 3.5 14 5l2.4-.7 1.4 2.4-1.8 1.7.2 1.1 2.2 1v2.8l-2.2 1-.2 1.1 1.8 1.7-1.4 2.4-2.4-.7-2 1.5-2-1.5-2.4.7-1.4-2.4 1.8-1.7-.2-1.1-2.2-1v-2.8l2.2-1 .2-1.1-1.8-1.7 1.4-2.4L10 5l2-1.5Z" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
    );
  }

  return null;
}

const firmSettingsTabs: Array<{ id: FirmSettingsTab; label: string }> = [
  { id: "profile", label: "Firmenprofil" },
  { id: "appearance", label: "Seitendarstellung" },
  { id: "branches", label: "Niederlassungen" },
  { id: "emailTemplates", label: "Email-Templates" },
  { id: "infoDocuments", label: "Informationsdokumente" },
  { id: "interfaces", label: "Schnittstellen" },
  { id: "accessRights", label: "Zugriffsrechte" },
  { id: "projectTypes", label: "Projekttypen" },
  { id: "documentFolders", label: "Dokumentenordner" },
  { id: "checklists", label: "Checklisten" },
  { id: "sources", label: "Quellen" },
  { id: "mailServer", label: "Mailserver" },
  { id: "customFields", label: "Eigene Felder" },
];

const germanStateOptions: Array<{ value: GermanStateCode; label: string }> = [
  { value: "BW", label: "Baden-Württemberg" },
  { value: "BY", label: "Bayern" },
  { value: "BE", label: "Berlin" },
  { value: "BB", label: "Brandenburg" },
  { value: "HB", label: "Bremen" },
  { value: "HH", label: "Hamburg" },
  { value: "HE", label: "Hessen" },
  { value: "MV", label: "Mecklenburg-Vorpommern" },
  { value: "NI", label: "Niedersachsen" },
  { value: "NW", label: "Nordrhein-Westfalen" },
  { value: "RP", label: "Rheinland-Pfalz" },
  { value: "SL", label: "Saarland" },
  { value: "SN", label: "Sachsen" },
  { value: "ST", label: "Sachsen-Anhalt" },
  { value: "SH", label: "Schleswig-Holstein" },
  { value: "TH", label: "Thüringen" },
];

const legalFormOptions = [
  "Einzelunternehmen",
  "GbR",
  "GmbH",
  "gGmbH",
  "OHG",
  "AG",
  "KG",
  "UG",
  "GmbH & Co. KG",
  "KG aA",
  "eG",
  "Kollektivgesellschaft",
  "Genossenschaft",
  "Verein",
  "Stiftung",
];

const emptyContact: Omit<ContactItem, "id" | "createdAt" | "updatedAt"> = {
  category: "Kunde",
  type: "person",
  legalForm: "",
  customerNumber: "",
  salutation: "",
  additionalSalutation: "",
  companyName: "",
  firstName: "",
  lastName: "",
  position: "",
  email: "",
  phone: "",
  mobile: "",
  fax: "",
  website: "",
  source: "E-Mail",
  reachability: "Sonstige",
  isInvoiceRecipient: false,
  parentCompanyId: "",
  parentCompanyName: "",
  mainContactName: "",
  isMainContact: false,
  street: "",
  addressLine1: "",
  addressLine2: "",
  postalCode: "",
  city: "",
  country: "Deutschland",
  paymentTermDays: null,
  discountPercent: null,
  discountTermDays: null,
  priceGroup: "(Standard-VK)",
  iban: "",
  bic: "",
  bankName: "",
  taxId: "",
  debtorCreditorAccount: "",
  leitwegId: "",
};

type TaskItem = {
  id: string;
  createdAt: string;
  titel: string;
  beschreibung: string;
  status: TaskStatus;
  prioritaet: TaskPriority;
  gewerkId: string;
  gewerk: string;
  zustaendigId: string;
  zustaendig: string;
  rolle: string;
  faelligkeit: string;
  kunde: string;
  kundenklasse: CustomerClass;
  autoFeedbackEnabled: boolean;
  autoFeedbackRecipientId: string;
  recurrenceEnabled: boolean;
  recurrenceInterval: RecurrenceInterval | "";
  createdById: string;
  acceptanceStatus: "pending" | "accepted" | "rejected";
  acceptanceRespondedAt: string | null;
  rejectionReason: string;
  completedAt: string | null;
  archiveDueAt: string | null;
  archivedAt: string | null;
  archiveReason: string;
  vorgabeMinuten: number | null;
  gesamtzeitMinuten: number;
  planningAllocations: TaskPlanningAllocation[];
  kommentare: CommentItem[];
  zeiteintraege: TimeEntryItem[];
};

type HolidayItem = {
  date: string;
  name: string;
};

type CommentItem = {
  id: string;
  text: string;
  erstelltAm: string;
  autor: string;
};

type TimeEntryItem = {
  id: string;
  gestartetAm: string;
  dauerMinuten: number;
  notiz: string;
  nutzer: string;
};

type TaskPlanningAllocation = {
  date: string;
  minutes: number;
};

type LoginCredentialsDraft = {
  name: string;
  email: string;
  password: string;
};

function resizeProfileImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Profilbild konnte nicht gelesen werden."));
    reader.onload = () => {
      const image = new Image();

      image.onerror = () => reject(new Error("Profilbild konnte nicht verarbeitet werden."));
      image.onload = () => {
        const size = 320;
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("Profilbild konnte nicht verarbeitet werden."));
          return;
        }

        canvas.width = size;
        canvas.height = size;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, size, size);

        const sourceSize = Math.min(image.width, image.height);
        const sourceX = (image.width - sourceSize) / 2;
        const sourceY = (image.height - sourceSize) / 2;

        context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };

      image.src = String(reader.result ?? "");
    };

    reader.readAsDataURL(file);
  });
}

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: "ADMIN", label: "Admin" },
  { value: "GESCHAEFTSFUEHRER", label: "Gesch\u00e4ftsf\u00fchrung" },
  { value: "FUEHRUNGSKRAFT", label: "F\u00fchrungskraft" },
  { value: "MITARBEITER", label: "Mitarbeiter" },
  { value: "GAST", label: "Gast" },
];

const statusOptions: TaskStatus[] = [
  "offen",
  "in Bearbeitung",
  "wartet auf R\u00fcckmeldung",
  "erledigt",
  "abgelehnt",
  "\u00fcberf\u00e4llig",
  "archiviert",
];

const priorityOptions: TaskPriority[] = ["niedrig", "normal", "hoch", "kritisch"];

const vacationHandoverItems = [
  "Offene Aufgaben geprüft und bei Bedarf neu priorisiert",
  "Kritische Deadlines mit dem Vertreter abgestimmt",
  "Wichtige Kunden- und Projekthinweise dokumentiert",
  "Benötigte Links, Unterlagen oder Zugänge für den Vertreter hinterlegt",
];

const emptyTask = {
  titel: "",
  beschreibung: "",
  status: "offen" as TaskStatus,
  prioritaet: "normal" as TaskPriority,
  faelligkeit: "",
  kunde: "",
  kundenklasse: "" as CustomerClass,
  autoFeedbackEnabled: false,
  autoFeedbackRecipientId: "",
  recurrenceEnabled: false,
  recurrenceInterval: "weekly" as RecurrenceInterval,
  vorgabeMinuten: "",
};

function formatMinutes(minutes: number | null) {
  if (!minutes) return "-";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes} Min.`;
  if (remainingMinutes === 0) return `${hours} Std.`;
  return `${hours} Std. ${remainingMinutes} Min.`;
}

function formatStopwatch(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}h`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}h`;
}

function formatStampDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function parseGermanDate(value: string) {
  const [day, month, year] = value.split(".").map((part) => Number(part));
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}

function formatInputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function isDateInRange(date: Date, start: Date, end: Date) {
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const startValue = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const endValue = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return value >= startValue && value <= endValue;
}

function parseHoursInput(value?: string) {
  if (!value) return 0;
  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function formatHours(value: number) {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDeadline(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateOnly(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatCalendarTitle(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseProjectDate(value?: string) {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  return Number.isFinite(date.getTime()) ? date : null;
}

function formatProjectDate(value?: string) {
  const date = parseProjectDate(value);
  return date ? date.toLocaleDateString("de-DE") : "-";
}

function formatProjectRuntimeDuration(startValue?: string, endValue?: string) {
  const startDate = parseProjectDate(startValue);
  const endDate = parseProjectDate(endValue);

  if (!startDate || !endDate) return "-";
  if (endDate.getTime() < startDate.getTime()) return "Enddatum liegt vor Start";

  let months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());
  let days = endDate.getDate() - startDate.getDate();

  if (days < 0) {
    months -= 1;
    days += new Date(endDate.getFullYear(), endDate.getMonth(), 0).getDate();
  }

  const parts = [
    months > 0 ? `${months} ${months === 1 ? "Monat" : "Monate"}` : "",
    days > 0 ? `${days} ${days === 1 ? "Tag" : "Tage"}` : "",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "0 Tage";
}

function getDefaultDeadlineValue(date = new Date()) {
  return `${formatDateKey(date)}T12:00`;
}

function normalizeDeadlineInput(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return "";

  const dateOnlyMatch = trimmedValue.match(/^(\d{4}-\d{2}-\d{2})(?:T)?$/);
  if (dateOnlyMatch) return `${dateOnlyMatch[1]}T12:00`;

  const incompleteTimeMatch = trimmedValue.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})(?::)?$/);
  if (incompleteTimeMatch) return `${incompleteTimeMatch[1]}T${incompleteTimeMatch[2]}:00`;

  return trimmedValue;
}

function getMonthDays(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const days: Array<Date | null> = [];

  for (let index = 0; index < startOffset; index += 1) {
    days.push(null);
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(year, month, day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

function getWeekDays(date: Date) {
  const start = new Date(date);
  const dayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayOffset);
  start.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function formatWeekTitle(date: Date) {
  const days = getWeekDays(date);
  const first = days[0];
  const last = days[6];
  return `${new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(
    first
  )} - ${new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(last)}`;
}

function formatDayTitle(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function getDeadlineState(value: string) {
  if (!value) return "empty";

  const now = new Date();
  const deadline = new Date(value);
  const isSameDay =
    deadline.getFullYear() === now.getFullYear() &&
    deadline.getMonth() === now.getMonth() &&
    deadline.getDate() === now.getDate();

  if (deadline.getTime() <= now.getTime()) return "due";

  const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntilDeadline <= 24 || isSameDay) return "due";
  if (hoursUntilDeadline <= 48) return "soon";

  return "open";
}

function getWorkingMillisecondsBetween(start: Date, end: Date, holidayDateKeys: Set<string>) {
  if (end.getTime() <= start.getTime()) return 0;

  let totalMilliseconds = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  while (cursor.getTime() < end.getTime()) {
    const nextDay = new Date(cursor);
    nextDay.setDate(cursor.getDate() + 1);

    const dayKey = formatDateKey(cursor);
    const dayOfWeek = cursor.getDay();
    const isWorkingDay = dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDateKeys.has(dayKey);

    if (isWorkingDay) {
      const segmentStart = Math.max(start.getTime(), cursor.getTime());
      const segmentEnd = Math.min(end.getTime(), nextDay.getTime());
      totalMilliseconds += Math.max(0, segmentEnd - segmentStart);
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return totalMilliseconds;
}

function getDeadlineProgress(task: TaskItem, nowMs: number, holidayDateKeys: Set<string>) {
  if (!task.faelligkeit || !task.createdAt) return 0;

  const createdAt = new Date(task.createdAt);
  const deadline = new Date(task.faelligkeit);
  const now = new Date(nowMs);

  if (!Number.isFinite(createdAt.getTime()) || !Number.isFinite(deadline.getTime())) return 0;
  if (deadline.getTime() <= createdAt.getTime()) return nowMs >= deadline.getTime() ? 100 : 0;

  const totalWorkingMilliseconds = getWorkingMillisecondsBetween(
    createdAt,
    deadline,
    holidayDateKeys
  );
  const elapsedWorkingMilliseconds = getWorkingMillisecondsBetween(
    createdAt,
    now > deadline ? deadline : now,
    holidayDateKeys
  );

  if (totalWorkingMilliseconds <= 0) return nowMs >= deadline.getTime() ? 100 : 0;

  return clampPercent(Math.round((elapsedWorkingMilliseconds / totalWorkingMilliseconds) * 100));
}

function getDeadlineWorkingTimeInfo(
  task: TaskItem,
  nowMs: number,
  holidayDateKeys: Set<string>
) {
  if (!task.faelligkeit || !task.createdAt) {
    return {
      progress: 0,
      elapsedWorkingMilliseconds: 0,
      totalWorkingMilliseconds: 0,
    };
  }

  const createdAt = new Date(task.createdAt);
  const deadline = new Date(task.faelligkeit);
  const now = new Date(nowMs);

  if (!Number.isFinite(createdAt.getTime()) || !Number.isFinite(deadline.getTime())) {
    return {
      progress: 0,
      elapsedWorkingMilliseconds: 0,
      totalWorkingMilliseconds: 0,
    };
  }

  const totalWorkingMilliseconds = getWorkingMillisecondsBetween(
    createdAt,
    deadline,
    holidayDateKeys
  );
  const elapsedWorkingMilliseconds = getWorkingMillisecondsBetween(
    createdAt,
    now > deadline ? deadline : now,
    holidayDateKeys
  );

  return {
    progress: getDeadlineProgress(task, nowMs, holidayDateKeys),
    elapsedWorkingMilliseconds,
    totalWorkingMilliseconds,
  };
}

function getDeadlineProgressStyle(
  task: TaskItem,
  nowMs: number,
  holidayDateKeys: Set<string>
) {
  const progress = getDeadlineProgress(task, nowMs, holidayDateKeys);

  return {
    "--deadline-progress": `${progress}%`,
    "--deadline-visible-progress": progress > 0 && progress < 4 ? "4%" : `${progress}%`,
  } as CSSProperties;
}

function getDeadlineProgressText(
  task: TaskItem,
  nowMs: number,
  holidayDateKeys: Set<string>
) {
  const info = getDeadlineWorkingTimeInfo(task, nowMs, holidayDateKeys);

  if (info.totalWorkingMilliseconds <= 0) {
    return "Keine Arbeitszeit zwischen Erstellung und Deadline. Wochenenden und Feiertage werden nicht gezählt.";
  }

  if (info.elapsedWorkingMilliseconds <= 0) {
    return "0% der Arbeitszeit bis zur Deadline verbraucht. Wochenenden und Feiertage werden nicht gezählt.";
  }

  return `${info.progress}% der Arbeitszeit bis zur Deadline verbraucht. Wochenenden und Feiertage werden nicht gezählt.`;
}

function getDeadlineProgressState(
  task: TaskItem,
  nowMs: number,
  holidayDateKeys: Set<string>
) {
  if (!task.faelligkeit) return "empty";
  if (new Date(task.faelligkeit).getTime() <= nowMs) return "due";

  const progress = getDeadlineProgress(task, nowMs, holidayDateKeys);
  if (progress >= 90) return "due";
  if (progress >= 80) return "soon";
  return "open";
}

function isTaskOverdueByWorkingTime(
  task: TaskItem,
  nowMs: number,
  holidayDateKeys: Set<string>
) {
  if (!task.faelligkeit || task.status === "erledigt") return false;

  const deadlineTime = new Date(task.faelligkeit).getTime();
  if (!Number.isFinite(deadlineTime)) return false;
  if (deadlineTime <= nowMs) return true;

  return getDeadlineProgress(task, nowMs, holidayDateKeys) >= 100;
}

function getRemainingMinutes(task: TaskItem) {
  if (!task.vorgabeMinuten) return null;

  const trackedMinutes = task.zeiteintraege.reduce(
    (total, entry) => total + entry.dauerMinuten,
    0
  );

  return task.vorgabeMinuten - trackedMinutes;
}

function formatRemainingTime(task: TaskItem) {
  const remainingMinutes = getRemainingMinutes(task);

  if (remainingMinutes === null) return "-";
  if (remainingMinutes < 0) return `${formatMinutes(Math.abs(remainingMinutes))} drüber`;
  if (remainingMinutes === 0) return "0 Min.";
  return formatMinutes(remainingMinutes);
}

function formatArchiveCountdown(task: TaskItem) {
  if (task.status !== "erledigt" || !task.archiveDueAt) return "";

  const remainingMs = new Date(task.archiveDueAt).getTime() - Date.now();
  if (remainingMs <= 0) return "Archivierung fällig";

  const totalMinutes = Math.ceil(remainingMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}h bis Archivierung`;
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00`);
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
}

function getEasterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12);
}

function getDateKeyRelativeToEaster(year: number, offsetDays: number) {
  const date = getEasterSunday(year);
  date.setDate(date.getDate() + offsetDays);
  return formatDateKey(date);
}

function getPrayerAndRepentanceDay(year: number) {
  const november23 = new Date(year, 10, 23, 12);
  const dayOfWeek = november23.getDay();
  const daysBackToWednesday = (dayOfWeek + 4) % 7;
  november23.setDate(november23.getDate() - daysBackToWednesday);
  return formatDateKey(november23);
}

function calculateGermanHolidays(state: GermanStateCode, startYear: number, years: number) {
  const holidays: HolidayItem[] = [];
  const addHoliday = (year: number, month: number, day: number, name: string) => {
    holidays.push({ date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, name });
  };
  const addHolidayByDate = (date: string, name: string) => holidays.push({ date, name });

  for (let year = startYear; year < startYear + years; year += 1) {
    addHoliday(year, 1, 1, "Neujahr");
    addHolidayByDate(getDateKeyRelativeToEaster(year, -2), "Karfreitag");
    addHolidayByDate(getDateKeyRelativeToEaster(year, 1), "Ostermontag");
    addHoliday(year, 5, 1, "Tag der Arbeit");
    addHolidayByDate(getDateKeyRelativeToEaster(year, 39), "Christi Himmelfahrt");
    addHolidayByDate(getDateKeyRelativeToEaster(year, 50), "Pfingstmontag");
    addHoliday(year, 10, 3, "Tag der Deutschen Einheit");
    addHoliday(year, 12, 25, "1. Weihnachtstag");
    addHoliday(year, 12, 26, "2. Weihnachtstag");

    if (["BW", "BY", "ST"].includes(state)) addHoliday(year, 1, 6, "Heilige Drei Könige");
    if (["BE", "MV"].includes(state)) addHoliday(year, 3, 8, "Internationaler Frauentag");
    if (["BW", "BY", "HE", "NW", "RP", "SL", "TH"].includes(state)) {
      addHolidayByDate(getDateKeyRelativeToEaster(year, 60), "Fronleichnam");
    }
    if (["BY", "SL"].includes(state)) addHoliday(year, 8, 15, "Mariä Himmelfahrt");
    if (state === "TH") addHoliday(year, 9, 20, "Weltkindertag");
    if (["BB", "HB", "HH", "MV", "NI", "SN", "ST", "SH", "TH"].includes(state)) {
      addHoliday(year, 10, 31, "Reformationstag");
    }
    if (["BW", "BY", "NW", "RP", "SL"].includes(state)) addHoliday(year, 11, 1, "Allerheiligen");
    if (state === "SN") addHolidayByDate(getPrayerAndRepentanceDay(year), "Bux- und Bettag");
  }

  return holidays.sort((first, second) => first.date.localeCompare(second.date));
}

function buildGermanHolidayCatalog(startYear: number, years: number) {
  return germanStateOptions.map((stateOption) => ({
    ...stateOption,
    holidays: calculateGermanHolidays(stateOption.value, startYear, years),
  }));
}

function getProjectKind(project: HeroProjectPreview): ProjectDraft["projectKind"] {
  if (project.projectKind === "Dauerläufer-Projekt" || project.projectKind === "einmaliges Projekt") {
    return project.projectKind;
  }

  const searchableText = [
    project.title,
    project.status,
    project.description,
    project.trade,
    project.billingInterval,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return ["monatlich", "jährlich", "jaehrlich", "quartal", "dauer"].some((token) =>
    searchableText.includes(token)
  )
    ? "Dauerläufer-Projekt"
    : "einmaliges Projekt";
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function getPercent(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : 0;
}

function formatPercent(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return rounded.toLocaleString("de-DE", {
    maximumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
  });
}

function getPerformanceGrade(estimateMinutes: number | null, trackedMinutes: number) {
  if (!estimateMinutes || estimateMinutes <= 0 || trackedMinutes <= 0) return null;
  return Math.round((estimateMinutes / trackedMinutes) * 100);
}

function getPerformanceState(performanceGrade: number | null) {
  if (performanceGrade === null) return "empty";
  if (performanceGrade >= 100) return "good";
  if (performanceGrade >= 85) return "ok";
  return "low";
}

function isDateInPerformancePeriod(value: string, period: PerformancePeriod, referenceDate: Date) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return false;

  if (period === "day") {
    return formatDateKey(date) === formatDateKey(referenceDate);
  }

  if (period === "month") {
    return (
      date.getFullYear() === referenceDate.getFullYear() &&
      date.getMonth() === referenceDate.getMonth()
    );
  }

  return date.getFullYear() === referenceDate.getFullYear();
}

function performancePeriodLabel(period: PerformancePeriod) {
  if (period === "day") return "Tag";
  if (period === "month") return "Monat";
  return "Jahr";
}

function getProductivityPeriodDays(period: ProductivityPeriod, referenceDate = new Date()) {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);

  if (period === "week") {
    const dayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - dayOffset);
  }

  if (period === "month") {
    start.setDate(1);
  }

  if (period === "quarter") {
    const quarterStartMonth = Math.floor(start.getMonth() / 3) * 3;
    start.setMonth(quarterStartMonth, 1);
  }

  if (period === "year") {
    start.setMonth(0, 1);
  }

  const end = new Date(start);
  if (period === "day") end.setDate(start.getDate() + 1);
  if (period === "week") end.setDate(start.getDate() + 7);
  if (period === "month") end.setMonth(start.getMonth() + 1);
  if (period === "quarter") end.setMonth(start.getMonth() + 3);
  if (period === "year") end.setFullYear(start.getFullYear() + 1);

  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor < end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function productivityPeriodLabel(period: ProductivityPeriod) {
  if (period === "day") return "Tag";
  if (period === "week") return "Woche";
  if (period === "month") return "Monat";
  if (period === "quarter") return "Quartal";
  return "Jahr";
}

function getTaskNumber(taskId: string, taskList: TaskItem[]) {
  const index = taskList.findIndex((task) => task.id === taskId);
  return index >= 0 ? `T-${1001 + index}` : taskId;
}

function getTaskNumberValue(taskId: string, taskList: TaskItem[]) {
  const index = taskList.findIndex((task) => task.id === taskId);
  return index >= 0 ? 1001 + index : 0;
}

function getPerformanceGaugeStyle(performanceGrade: number | null) {
  const normalized = performanceGrade === null ? 0 : Math.min(100, Math.max(0, performanceGrade));
  const angle = -180 + (normalized / 100) * 180;

  return {
    "--gauge-angle": `${angle}deg`,
  } as CSSProperties;
}

function getCompletionValidationMessage(
  nextStatus: TaskStatus,
  estimateMinutes: number | null,
  timeEntryCount: number
) {
  if (nextStatus !== "erledigt") return "";
  if (!estimateMinutes || estimateMinutes <= 0) {
    return "Eine Aufgabe kann nur als erledigt gespeichert werden, wenn eine Vorgabezeit hinterlegt ist.";
  }
  if (timeEntryCount < 1) {
    return "Eine Aufgabe kann nur als erledigt gespeichert werden, wenn mindestens ein Zeiteintrag erstellt wurde.";
  }
  return "";
}

function canManageUsers(role?: UserRole) {
  return role === "ADMIN" || role === "GESCHAEFTSFUEHRER";
}

function canAssignOther(role?: UserRole) {
  return role === "ADMIN" || role === "GESCHAEFTSFUEHRER" || role === "FUEHRUNGSKRAFT";
}

const documentConfiguratorSections: Array<{
  id: DocumentConfiguratorSection;
  label: string;
}> = [
  { id: "general", label: "Allgemeine Einstellungen" },
  { id: "layout", label: "Allgemeine Gestaltung" },
  { id: "firstPage", label: "Gestaltung - Erste Seite" },
  { id: "followingPages", label: "Gestaltung - Folgeseiten" },
  { id: "options", label: "Zusatzoptionen" },
  { id: "booking", label: "Buchung" },
];

const documentTemplateSyntax = [
  { placeholder: "{{customer.titleFullName}}", description: "Anrede und Name des Kunden" },
  { placeholder: "{{customer.name}}", description: "Kunden- oder Firmenname" },
  { placeholder: "{{partner.fullName}}", description: "Name des verantwortlichen Mitarbeiters" },
  { placeholder: "{{projectPartner.fullName}}", description: "Projektansprechpartner" },
  { placeholder: "{{project.name}}", description: "Projektname" },
  { placeholder: "{{project.displayId}}", description: "Projekt-ID wie ASS-388" },
  { placeholder: "{{document.number}}", description: "Dokumentnummer" },
  { placeholder: "{{referenceDocument.number}}", description: "Referenzdokumentnummer" },
  { placeholder: "{{referenceDocument.date}}", description: "Datum des Referenzdokuments" },
  { placeholder: "{{referenceDocument.amount}}", description: "Betrag des Referenzdokuments" },
  { placeholder: "{{referenceDocument.dueDate}}", description: "Faelligkeitsdatum" },
  { placeholder: "{{customerDocument.dueDays}}", description: "Zahlungsziel in Tagen" },
  {
    placeholder: "{{customerDocument.currentReminderIntervalEnd}}",
    description: "Fristende der Mahnung",
  },
];

const defaultDocumentLayoutConfig: DocumentLayoutConfig = {
  baseType: "Angebot",
  name: "Angebot OK immocare",
  status: "Aktiv",
  folder: "Angebote",
  numberRange: "ANG-179 | Angebot",
  moveProjectStatus: "(keine Aenderung)",
  marginTop: "40",
  marginBottom: "35",
  marginLeft: "0",
  marginRight: "0",
  baseLayout: "Klassisch",
  fontFamily: "Arial",
  fontSize: "10pt",
  showFoldMarks: true,
  mainTop: "100",
  mainLeft: "25",
  mainRight: "15",
  introText: "Angebot - Einleitung WorkPilot360",
  closingText: "Angebot - Abschluss WorkPilot360",
  showPositionDescription: true,
  showPositionImages: true,
  showQuantityPdf: true,
  showEan: false,
  showArticleNumbers: false,
  hideSinglePrices: false,
  showTitleSums: false,
  hideOrderValue: false,
  showVat: true,
  showVatRate: false,
  showTitleSummary: true,
  showSurcharge: true,
  showLaborMachineCosts: false,
  showArticlePricesInServices: false,
  footerText: "OK solutions GmbH | Im Kroetenteich 3/4 | 74722 Buchen",
  footerDistance: "20",
  footerFontSize: "7pt",
  showLetterhead: true,
  letterheadFileName: "",
  letterheadDataUrl: "",
  addressLineEnabled: true,
  addressLineText: "OK solutions GmbH, Im Kroetenteich 3/4, 74722 Buchen",
  addressLineTop: "45",
  addressLineLeft: "25",
  subjectOneEnabled: true,
  subjectOneBold: true,
  subjectOneSource: "Projektname",
  subjectOneFont: "Arial",
  subjectOneSize: "13pt",
  subjectOnePrefix: "Projekt:",
  subjectTwoEnabled: true,
  subjectTwoBold: true,
  subjectTwoFont: "Arial",
  subjectTwoSize: "13pt",
  showFirstPageLogo: true,
  showFirstPageAddress: false,
  firstPageLogoTop: "10",
  firstPageLogoLeft: "150",
  firstPageLogoWidth: "45",
  firstPageLogoHeight: "30",
  firstPageAddressText: "OK solutions GmbH\nIm Kroetenteich 3/4\n74722 Buchen",
  firstPageInfoBlock: true,
  firstPageInfoTop: "55",
  firstPageInfoLeft: "110",
  firstPageInfoWidth: "85",
  showCustomerNumber: true,
  showDocumentNumber: true,
  showRecipientVatId: false,
  showContactName: true,
  showContactPhone: true,
  showContactMobile: false,
  showContactFax: true,
  showContactEmail: true,
  contactDisplayMode: "Hauptansprechpartner/in",
  deliveryDateMode: "Nicht anzeigen",
  paymentTypeMode: "Nicht anzeigen",
  showFreeInfoBlock: false,
  freeInfoTop: "",
  freeInfoLeft: "",
  freeInfoWidth: "",
  freeInfoContent: "",
  followingShowLogo: true,
  followingShowAddress: false,
  followingLogoTop: "10",
  followingLogoLeft: "150",
  followingLogoWidth: "45",
  followingLogoHeight: "30",
  followingInfoBlock: true,
  followingInfoAlsoFirstPage: false,
  followingInfoTop: "10",
  followingInfoLeft: "25",
  followingInfoWidth: "75",
  followingShowDocumentNumber: true,
  followingShowProjectNumber: true,
  followingShowContact: true,
  followingShowPhone: false,
  followingShowMobile: false,
  followingShowFax: false,
  followingShowEmail: false,
  subjectPrefix: "Angebot Nr.",
  bookingRelevant: false,
  bookingCategory: "Standard",
  bookingSide: "Soll",
  bookingAccount: "",
  costCenter: "",
  correctionDocumentType: "Stornorechnung",
};

export function DashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeTab, setActiveTab] = useState<AppTab>("overview");
  const [documentConfigSection, setDocumentConfigSection] =
    useState<DocumentConfiguratorSection>("general");
  const [documentPreviewPage, setDocumentPreviewPage] = useState<DocumentPreviewPage>("first");
  const [documentLayoutConfig, setDocumentLayoutConfig] = useState<DocumentLayoutConfig>(
    defaultDocumentLayoutConfig
  );
  const [documentConfigSaveMessage, setDocumentConfigSaveMessage] = useState("");
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeSummary[]>([]);
  const [documentTypeView, setDocumentTypeView] = useState<"active" | "archive">("active");
  const [documentTypeSearch, setDocumentTypeSearch] = useState("");
  const [documentTypePageSize, setDocumentTypePageSize] = useState(25);
  const [isDocumentTypeEditorOpen, setIsDocumentTypeEditorOpen] = useState(false);
  const [editingDocumentTypeId, setEditingDocumentTypeId] = useState("");
  const [documentTypeError, setDocumentTypeError] = useState("");
  const [documentTexts, setDocumentTexts] = useState<DocumentTextItem[]>([]);
  const [documentTextView, setDocumentTextView] = useState<DocumentTextView>("texts");
  const [documentTextSearch, setDocumentTextSearch] = useState("");
  const [documentTextPageSize, setDocumentTextPageSize] = useState(25);
  const [isDocumentTextModalOpen, setIsDocumentTextModalOpen] = useState(false);
  const [editingDocumentTextId, setEditingDocumentTextId] = useState("");
  const [documentTextDraftKind, setDocumentTextDraftKind] = useState<"text" | "title">("text");
  const [documentTextDraftSource, setDocumentTextDraftSource] = useState("Eigene");
  const [documentTextDraftTitle, setDocumentTextDraftTitle] = useState("");
  const [documentTextDraftBody, setDocumentTextDraftBody] = useState("");
  const [documentTextDraftError, setDocumentTextDraftError] = useState("");
  const letterheadUploadRef = useRef<HTMLInputElement | null>(null);
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [firmSettingsTab, setFirmSettingsTab] = useState<FirmSettingsTab>("profile");
  const [isFirmSettingsNavOpen, setIsFirmSettingsNavOpen] = useState(false);
  const [openProjectNav, setOpenProjectNav] = useState<Record<string, boolean>>({
    projectsSolutions: false,
    projectsImmocare: false,
  });
  const [openSidebarMenus, setOpenSidebarMenus] = useState<Record<string, boolean>>({
    overview: false,
    documents: false,
    articles: false,
    dashboard: false,
  });
  const [isCompanyProfileModalOpen, setIsCompanyProfileModalOpen] = useState(false);
  const [companyProfileEditTab, setCompanyProfileEditTab] =
    useState<CompanyProfileEditTab>("general");
  const [isTradeManagementModalOpen, setIsTradeManagementModalOpen] = useState(false);
  const [tradeDraftName, setTradeDraftName] = useState("");
  const [tradeDraftPrefix, setTradeDraftPrefix] = useState("");
  const [tradeManagementError, setTradeManagementError] = useState("");
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [trades, setTrades] = useState<TradeOption[]>([]);
  const [escalationRules, setEscalationRules] = useState<EscalationRule[]>([]);
  const [deadlineProgressTime, setDeadlineProgressTime] = useState(() => Date.now());
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const [runningTaskTimers, setRunningTaskTimers] = useState<Record<string, number>>({});
  const [lastTaskTimerDurations, setLastTaskTimerDurations] = useState<Record<string, number>>({});
  const [stampSession, setStampSession] = useState<StampSession | null>(null);
  const [stampEntries, setStampEntries] = useState<StampTimeEntry[]>([]);
  const [isStampModalOpen, setIsStampModalOpen] = useState(false);
  const [stampModalMode, setStampModalMode] = useState<"start" | "change" | "stop">("start");
  const [stampSelectionMode, setStampSelectionMode] = useState<StampMode>("project");
  const [stampProjectId, setStampProjectId] = useState("");
  const [stampProjectSearch, setStampProjectSearch] = useState("");
  const [isStampProjectSearchOpen, setIsStampProjectSearchOpen] = useState(true);
  const [stampComment, setStampComment] = useState("");
  const [stampError, setStampError] = useState("");
  const [editingStampEntry, setEditingStampEntry] = useState<StampTimeEntry | null>(null);
  const [stampEditDate, setStampEditDate] = useState("");
  const [stampEditStartTime, setStampEditStartTime] = useState("");
  const [stampEditEndTime, setStampEditEndTime] = useState("");
  const [stampEditPause, setStampEditPause] = useState("");
  const [stampEditComment, setStampEditComment] = useState("");
  const [stampEditError, setStampEditError] = useState("");
  const [absences, setAbsences] = useState<AbsenceItem[]>([]);
  const [holidayState, setHolidayState] = useState<GermanStateCode>("BW");
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [heroProjects, setHeroProjects] = useState<HeroProjectPreview[]>([]);
  const [heroSearchTerm, setHeroSearchTerm] = useState("");
  const [selectedHeroDetailId, setSelectedHeroDetailId] = useState("");
  const [selectedProjectFileId, setSelectedProjectFileId] = useState("");
  const [isProjectStatusMenuOpen, setIsProjectStatusMenuOpen] = useState(false);
  const [projectFileTab, setProjectFileTab] = useState<ProjectFileTab>("logbook");
  const [selectedProjectDocumentType, setSelectedProjectDocumentType] =
    useState<CustomerDocumentType>("Allgemeine Dokumente");
  const [selectedProjectPipelineStatus, setSelectedProjectPipelineStatus] =
    useState("Alle Offenen");
  const [selectedProjectKindFilter, setSelectedProjectKindFilter] =
    useState<ProjectKindFilter>("");
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProjectDataId, setEditingProjectDataId] = useState("");
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(emptyProjectDraft);
  const [isProjectContactPickerOpen, setIsProjectContactPickerOpen] = useState(false);
  const [projectContactPickerSearch, setProjectContactPickerSearch] = useState("");
  const [projectContactTarget, setProjectContactTarget] = useState<
    "contact" | "person" | "address" | ""
  >("");
  const [hasLoadedHeroProjects, setHasLoadedHeroProjects] = useState(false);
  const [isHeroProjectsLoading, setIsHeroProjectsLoading] = useState(false);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [contactSearchTerm, setContactSearchTerm] = useState("");
  const [contactCategoryFilter, setContactCategoryFilter] = useState("");
  const [contactPage, setContactPage] = useState(1);
  const [contactPageSize, setContactPageSize] = useState(25);
  const [isContactColumnMenuOpen, setIsContactColumnMenuOpen] = useState(false);
  const [isContactExportMenuOpen, setIsContactExportMenuOpen] = useState(false);
  const [isContactBulkModalOpen, setIsContactBulkModalOpen] = useState(false);
  const [contactBulkAction, setContactBulkAction] = useState("Archivieren");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [lastSelectedContactId, setLastSelectedContactId] = useState("");
  const [contactColumnSearch, setContactColumnSearch] = useState("");
  const [contactColumnFilters, setContactColumnFilters] = useState<
    Partial<Record<ContactColumnId, string>>
  >({});
  const [visibleContactColumnIds, setVisibleContactColumnIds] =
    useState<ContactColumnId[]>(defaultContactColumnIds);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactFormTab, setContactFormTab] = useState<ContactFormTab>("details");
  const [contactDraft, setContactDraft] =
    useState<Omit<ContactItem, "id" | "createdAt" | "updatedAt">>(emptyContact);
  const [selectedCustomerFileId, setSelectedCustomerFileId] = useState("");
  const [customerFileTab, setCustomerFileTab] = useState<CustomerFileTab>("logbook");
  const [selectedCustomerDocumentType, setSelectedCustomerDocumentType] =
    useState<CustomerDocumentType>("Allgemeine Dokumente");
  const [customerLogbookEntries, setCustomerLogbookEntries] = useState<CustomerLogbookEntry[]>([]);
  const [projectLogbookEntries, setProjectLogbookEntries] = useState<ProjectLogbookEntry[]>([]);
  const [projectLogbookSearch, setProjectLogbookSearch] = useState("");
  const [logbookTarget, setLogbookTarget] = useState<"customer" | "project">("customer");
  const [logbookError, setLogbookError] = useState("");
  const [isLogbookModalOpen, setIsLogbookModalOpen] = useState(false);
  const [logbookMessage, setLogbookMessage] = useState("");
  const [logbookColleague, setLogbookColleague] = useState("");
  const [logbookVisibleFor, setLogbookVisibleFor] = useState<string[]>([
    "Geschaeftsfuehrer",
    "Vertriebler",
    "Niederlassungsleiter",
    "Monteur",
    "Buchhaltung",
  ]);
  const [logbookAttachments, setLogbookAttachments] = useState<LogbookAttachment[]>([]);
  const [logbookCreateTask, setLogbookCreateTask] = useState(false);
  const [logbookTaskTitle, setLogbookTaskTitle] = useState("");
  const [activeUserId, setActiveUserId] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [showNotificationHistory, setShowNotificationHistory] = useState(false);
  const [notificationSearchTerm, setNotificationSearchTerm] = useState("");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isOwnSettingsOpen, setIsOwnSettingsOpen] = useState(false);
  const [desktopPermission, setDesktopPermission] = useState<NotificationPermission>("default");
  const hasLoadedNotifications = useRef(false);

  const [titel, setTitel] = useState(emptyTask.titel);
  const [beschreibung, setBeschreibung] = useState(emptyTask.beschreibung);
  const [status, setStatus] = useState<TaskStatus>(emptyTask.status);
  const [prioritaet, setPrioritaet] = useState<TaskPriority>(emptyTask.prioritaet);
  const [gewerkId, setGewerkId] = useState("");
  const [zustaendigId, setZustaendigId] = useState("");
  const [selectedHeroProjectId, setSelectedHeroProjectId] = useState("");
  const [faelligkeit, setFaelligkeit] = useState(emptyTask.faelligkeit);
  const [kunde, setKunde] = useState(emptyTask.kunde);
  const [kundenklasse, setKundenklasse] = useState<CustomerClass>(emptyTask.kundenklasse);
  const [autoFeedbackEnabled, setAutoFeedbackEnabled] = useState(emptyTask.autoFeedbackEnabled);
  const [autoFeedbackRecipientId, setAutoFeedbackRecipientId] = useState(
    emptyTask.autoFeedbackRecipientId
  );
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(emptyTask.recurrenceEnabled);
  const [recurrenceInterval, setRecurrenceInterval] = useState<RecurrenceInterval | "">(
    emptyTask.recurrenceInterval
  );
  const [vorgabeMinuten, setVorgabeMinuten] = useState(emptyTask.vorgabeMinuten);
  const [planningEnabled, setPlanningEnabled] = useState(false);
  const [planningAllocations, setPlanningAllocations] = useState<TaskPlanningAllocation[]>([]);
  const [zeitDauer, setZeitDauer] = useState("");
  const [zeitNotiz, setZeitNotiz] = useState("");
  const [editingTimeEntryId, setEditingTimeEntryId] = useState<string | null>(null);
  const [kommentarText, setKommentarText] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<UserRole>("MITARBEITER");
  const [userDailyWorkHours, setUserDailyWorkHours] = useState("8");
  const [userPassword, setUserPassword] = useState("");
  const [loginCredentialsDraft, setLoginCredentialsDraft] =
    useState<LoginCredentialsDraft | null>(null);
  const [ownName, setOwnName] = useState("");
  const [ownEmail, setOwnEmail] = useState("");
  const [ownDailyWorkHours, setOwnDailyWorkHours] = useState("8");
  const [ownProfileImageDataUrl, setOwnProfileImageDataUrl] = useState("");
  const [ownPassword, setOwnPassword] = useState("");
  const [ownPasswordConfirm, setOwnPasswordConfirm] = useState("");
  const [userTeamIds, setUserTeamIds] = useState<string[]>([]);
  const [userAllTeams, setUserAllTeams] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employeeStatusView, setEmployeeStatusView] = useState<"active" | "inactive">("active");
  const [employeeTopTab, setEmployeeTopTab] = useState<EmployeeTopTab>("overview");
  const [employeeSideTab, setEmployeeSideTab] = useState<EmployeeSideTab>("personal");
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");
  const [employeeSignatureHidden, setEmployeeSignatureHidden] = useState(false);
  const [employeeSignature, setEmployeeSignature] = useState("");
  const [employeeTimePeriod, setEmployeeTimePeriod] = useState<EmployeeTimePeriod>("day");
  const [employeeTimeFrom, setEmployeeTimeFrom] = useState(() => formatInputDate(new Date()));
  const [employeeTimeTo, setEmployeeTimeTo] = useState(() => formatInputDate(new Date()));
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [tradeName, setTradeName] = useState("");
  const [tradePrefix, setTradePrefix] = useState("");
  const [editingEscalationRuleId, setEditingEscalationRuleId] = useState<string | null>(null);
  const [escalationName, setEscalationName] = useState("");
  const [escalationHours, setEscalationHours] = useState("24");
  const [escalationTargetRole, setEscalationTargetRole] = useState<UserRole>("FUEHRUNGSKRAFT");
  const [escalationActive, setEscalationActive] = useState(true);
  const [escalationEmailEnabled, setEscalationEmailEnabled] = useState(false);
  const [escalationEmailRecipients, setEscalationEmailRecipients] = useState("");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [selectedPlanningDateKey, setSelectedPlanningDateKey] = useState(() =>
    formatDateKey(new Date())
  );
  const [selectedPlanningGroup, setSelectedPlanningGroup] = useState("Marketing");
  const [isPlanningDayOpen, setIsPlanningDayOpen] = useState(false);
  const [selectedCalendarActionDate, setSelectedCalendarActionDate] = useState("");
  const [absenceUserId, setAbsenceUserId] = useState("");
  const [absenceDateFrom, setAbsenceDateFrom] = useState(() => formatDateKey(new Date()));
  const [absenceDateTo, setAbsenceDateTo] = useState(() => formatDateKey(new Date()));
  const [absenceType, setAbsenceType] = useState<AbsenceItem["type"]>("urlaub");
  const [absenceRepresentativeUserId, setAbsenceRepresentativeUserId] = useState("");
  const [absenceNote, setAbsenceNote] = useState("");
  const [editingAbsenceId, setEditingAbsenceId] = useState<string | null>(null);
  const [absenceChecklist, setAbsenceChecklist] = useState<boolean[]>(
    vacationHandoverItems.map(() => false)
  );
  const [absenceHandoverConfirmed, setAbsenceHandoverConfirmed] = useState(false);
  const [absenceWarning, setAbsenceWarning] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deadlineFilter, setDeadlineFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [taskNumberSort, setTaskNumberSort] = useState<"desc" | "asc">("desc");
  const [kanbanOwnerFilter, setKanbanOwnerFilter] = useState("");
  const [planningOwnerFilter, setPlanningOwnerFilter] = useState("");
  const [selectedPerformancePeriod, setSelectedPerformancePeriod] =
    useState<PerformancePeriod | null>(null);
  const [productivityPeriod, setProductivityPeriod] = useState<ProductivityPeriod>("week");

  const activeUser = useMemo(
    () => users.find((user) => user.id === activeUserId),
    [activeUserId, users]
  );
  const canManageProjectTimeEntries =
    activeUser?.role === "ADMIN" ||
    activeUser?.role === "GESCHAEFTSFUEHRER" ||
    /gesch[aä]ftsf[uü]hrer|geschaeftsfuehrer|ceo/i.test(activeUser?.roleLabel ?? "") ||
    /ceo/i.test(activeUser?.name ?? "");
  const isVacationHandoverComplete =
    absenceType !== "urlaub" ||
    (absenceChecklist.every(Boolean) && absenceHandoverConfirmed);

  const assignableUsers = canAssignOther(activeUser?.role)
    ? users
    : users.filter((user) => user.id === activeUserId);

  const sortedNotifications = useMemo(
    () =>
      [...notifications].sort(
        (first, second) =>
          new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
      ),
    [notifications]
  );
  const unreadNotifications = sortedNotifications.filter((notification) => !notification.readAt);
  const visibleNotifications = showNotificationHistory
    ? sortedNotifications.filter((notification) => {
        const normalizedSearchTerm = notificationSearchTerm.trim().toLowerCase();
        if (!normalizedSearchTerm) return true;

        return [notification.subject, notification.body, notification.channel]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedSearchTerm));
      })
    : unreadNotifications;

  async function loadTasks() {
    const res = await fetch("/api/tasks", { cache: "no-store" });

    if (!res.ok) {
      setErrorMessage("Aufgaben konnten nicht geladen werden.");
      return;
    }

    const data = await res.json();
    setTasks(data);
  }

  async function loadUsers() {
    const res = await fetch("/api/users", { cache: "no-store" });

    if (!res.ok) {
      setErrorMessage("Benutzer konnten nicht geladen werden.");
      setAuthChecked(true);
      return;
    }

    const data = await res.json();
    const storedUserId =
      typeof window !== "undefined" ? window.localStorage.getItem("workpilot-user-id") : null;
    const storedUser = data.find((demoUser: UserOption) => demoUser.id === storedUserId);

    setUsers(data);
    setZustaendigId((current) => current || storedUser?.id || data[0]?.id || "");
    setAbsenceUserId((current) => current || storedUser?.id || data[0]?.id || "");
    setLoginEmail((current) => current || storedUser?.email || "");

    if (storedUser) {
      setActiveUserId(storedUser.id);
      setOwnerFilter((current) => current || storedUser.id);
      setKanbanOwnerFilter((current) => current || storedUser.id);
      setPlanningOwnerFilter((current) => current || storedUser.id);
      setIsAuthenticated(true);
    } else {
      if (storedUserId && typeof window !== "undefined") {
        window.localStorage.removeItem("workpilot-user-id");
      }
      setIsAuthenticated(false);
      setActiveUserId("");
      setOwnerFilter("");
      setKanbanOwnerFilter("");
      setPlanningOwnerFilter("");
    }

    setAuthChecked(true);
  }

  async function loadContacts() {
    const res = await fetch("/api/contacts", { cache: "no-store" });

    if (!res.ok) {
      setErrorMessage("Kontakte konnten nicht geladen werden.");
      return;
    }

    const data = (await res.json()) as ContactItem[];
    setContacts(data);
  }

  function openCreateContactModal(target: "contact" | "person" | "address" | "" = "") {
    const nextNumber =
      contacts
        .map((contact) => Number(contact.customerNumber))
        .filter((value) => Number.isFinite(value))
        .sort((first, second) => second - first)[0] ?? 7000048;

    setContactDraft({
      ...emptyContact,
      category: target === "person" ? "Ansprechpartner" : emptyContact.category,
      customerNumber: String(nextNumber + 1),
    });
    setProjectContactTarget(target);
    setEditingContactId(null);
    setContactFormTab("details");
    setIsContactModalOpen(true);
  }

  function openEditContactModal(contact: ContactItem) {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = contact;

    setContactDraft(draft);
    setEditingContactId(contact.id);
    setContactFormTab("details");
    setIsContactModalOpen(true);
  }

  function updateContactDraft<K extends keyof typeof contactDraft>(
    key: K,
    value: (typeof contactDraft)[K]
  ) {
    setContactDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function saveContact() {
    const res = await fetch("/api/contacts", {
      method: editingContactId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...contactDraft,
        id: editingContactId,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorMessage(data?.error ?? "Kontakt konnte nicht erstellt werden.");
      return;
    }

    const savedContact = (await res.json()) as ContactItem;
    setContacts((currentContacts) =>
      editingContactId
        ? currentContacts.map((contact) =>
            contact.id === savedContact.id ? savedContact : contact
          )
        : [savedContact, ...currentContacts]
    );
    setIsContactModalOpen(false);
    setEditingContactId(null);
    if (!editingContactId && projectContactTarget) {
      const targetKey =
        projectContactTarget === "person"
          ? "contactPersonId"
          : projectContactTarget === "address"
            ? "addressContactId"
            : "contactId";
      updateProjectDraft(targetKey, savedContact.id);
      setProjectContactTarget("");
    }
    setErrorMessage("");
  }

  async function deleteContact() {
    if (!editingContactId) return;

    const contactName = [contactDraft.firstName, contactDraft.lastName].filter(Boolean).join(" ");
    const confirmed = window.confirm(
      `Kontakt "${contactName || contactDraft.companyName || contactDraft.customerNumber}" wirklich löschen?`
    );
    if (!confirmed) return;

    const res = await fetch("/api/contacts", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: editingContactId }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorMessage(data?.error ?? "Kontakt konnte nicht gelöscht werden.");
      return;
    }

    setContacts((currentContacts) =>
      currentContacts.filter((contact) => contact.id !== editingContactId)
    );
    setIsContactModalOpen(false);
    setEditingContactId(null);
    setErrorMessage("");
  }

  function updateContactColumnFilter(columnId: ContactColumnId, value: string) {
    setContactColumnFilters((currentFilters) => ({
      ...currentFilters,
      [columnId]: value,
    }));
  }

  function toggleContactColumn(columnId: ContactColumnId, checked: boolean) {
    setVisibleContactColumnIds((currentIds) => {
      if (checked) {
        return currentIds.includes(columnId) ? currentIds : [...currentIds, columnId];
      }

      return currentIds.length <= 1 ? currentIds : currentIds.filter((id) => id !== columnId);
    });
  }

  function resetContactColumns() {
    setVisibleContactColumnIds(defaultContactColumnIds);
    setContactColumnSearch("");
  }

  function getContactExportValue(contact: ContactItem, column: ContactColumn) {
    return column.value(contact).replace(/\s+/g, " ").trim();
  }

  function downloadContactExport(format: "csv" | "excel") {
    const exportColumns = visibleContactColumns;
    const exportRows = visibleContacts;
    const fileDate = new Date().toISOString().slice(0, 10);

    if (format === "csv") {
      const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
      const rows = [
        exportColumns.map((column) => escapeCsv(column.label)).join(";"),
        ...exportRows.map((contact) =>
          exportColumns
            .map((column) => escapeCsv(getContactExportValue(contact, column)))
            .join(";")
        ),
      ];
      const blob = new Blob([`\uFEFF${rows.join("\r\n")}`], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `kontakte-${fileDate}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setIsContactExportMenuOpen(false);
      return;
    }

    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    const tableRows = exportRows
      .map(
        (contact) =>
          `<tr>${exportColumns
            .map((column) => `<td>${escapeHtml(getContactExportValue(contact, column))}</td>`)
            .join("")}</tr>`
      )
      .join("");
    const tableHeader = exportColumns
      .map((column) => `<th>${escapeHtml(column.label)}</th>`)
      .join("");
    const html = `<html><head><meta charset="utf-8" /></head><body><table><thead><tr>${tableHeader}</tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
    const blob = new Blob([html], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kontakte-${fileDate}.xls`;
    link.click();
    URL.revokeObjectURL(url);
    setIsContactExportMenuOpen(false);
  }

  function handleContactRowClick(
    event: MouseEvent<HTMLTableRowElement>,
    contact: ContactItem,
    pageIndex: number
  ) {
    event.stopPropagation();

    if (event.shiftKey && lastSelectedContactId) {
      const lastIndex = paginatedContacts.findIndex((item) => item.id === lastSelectedContactId);
      const startIndex = Math.min(lastIndex, pageIndex);
      const endIndex = Math.max(lastIndex, pageIndex);
      const rangeIds = paginatedContacts
        .slice(startIndex, endIndex + 1)
        .map((item) => item.id);
      setSelectedContactIds((currentIds) => Array.from(new Set([...currentIds, ...rangeIds])));
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      setSelectedContactIds((currentIds) =>
        currentIds.includes(contact.id)
          ? currentIds.filter((id) => id !== contact.id)
          : [...currentIds, contact.id]
      );
      setLastSelectedContactId(contact.id);
      return;
    }

    setSelectedContactIds((currentIds) =>
      currentIds.length === 1 && currentIds[0] === contact.id ? [] : [contact.id]
    );
    setLastSelectedContactId(contact.id);
  }

  async function applyContactBulkAction() {
    const targetIds = selectedContactIds.length
      ? selectedContactIds
      : visibleContacts.map((contact) => contact.id);
    const targetContacts = contacts.filter((contact) => targetIds.includes(contact.id));

    if (contactBulkAction !== "Archivieren" || targetContacts.length === 0) {
      setIsContactBulkModalOpen(false);
      return;
    }

    const updatedContacts = await Promise.all(
      targetContacts.map(async (contact) => {
        const res = await fetch("/api/contacts", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...contact, category: "Archiv" }),
        });

        if (!res.ok) {
          throw new Error("Kontakt konnte nicht archiviert werden.");
        }

        return (await res.json()) as ContactItem;
      })
    ).catch(() => null);

    if (!updatedContacts) {
      setErrorMessage("Gruppenaktion konnte nicht ausgeführt werden.");
      return;
    }

    setContacts((currentContacts) =>
      currentContacts.map((contact) =>
        updatedContacts.find((updatedContact) => updatedContact.id === contact.id) ?? contact
      )
    );
    setSelectedContactIds([]);
    setIsContactBulkModalOpen(false);
    setErrorMessage("");
  }

  async function handleLogin() {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: loginEmail,
        password: loginPassword,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setLoginError(data?.error ?? "E-Mail oder Passwort ist nicht korrekt.");
      return;
    }

    const user = (await res.json()) as UserOption;
    window.localStorage.setItem("workpilot-user-id", user.id);
    setActiveUserId(user.id);
    setZustaendigId(user.id);
    setAbsenceUserId(user.id);
    setOwnerFilter(user.id);
    setKanbanOwnerFilter(user.id);
    setPlanningOwnerFilter(user.id);
    setLoginPassword("");
    setLoginError("");
    setIsAuthenticated(true);
  }

  function handleLogout() {
    window.localStorage.removeItem("workpilot-user-id");
    setIsAuthenticated(false);
    setActiveUserId("");
    setOwnerFilter("");
    setKanbanOwnerFilter("");
    setPlanningOwnerFilter("");
    setIsUserMenuOpen(false);
    setIsNotificationsOpen(false);
    setNotifications([]);
  }

  function openOwnSettings() {
    if (!activeUser) return;

    setOwnName(activeUser.name);
    setOwnEmail(activeUser.email);
    setOwnDailyWorkHours(String(activeUser.dailyWorkHours ?? 8));
    setOwnProfileImageDataUrl(activeUser.profileImageDataUrl ?? "");
    setOwnPassword("");
    setOwnPasswordConfirm("");
    setIsUserMenuOpen(false);
    setIsOwnSettingsOpen(true);
  }

  async function handleOwnProfileImageUpload(file: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Bitte eine Bilddatei als Profilbild auswählen.");
      return;
    }

    try {
      setOwnProfileImageDataUrl(await resizeProfileImage(file));
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Profilbild konnte nicht verarbeitet werden."
      );
    }
  }

  async function saveOwnSettings() {
    if (!activeUser) return;

    if (ownPassword || ownPasswordConfirm) {
      if (ownPassword.length < 6) {
        setErrorMessage("Das neue Passwort muss mindestens 6 Zeichen lang sein.");
        return;
      }

      if (ownPassword !== ownPasswordConfirm) {
        setErrorMessage("Die Passwort-Wiederholung stimmt nicht überein.");
        return;
      }
    }

    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorId: activeUser.id,
        userId: activeUser.id,
        name: ownName,
        email: ownEmail,
        role: activeUser.role,
        teamIds: activeUser.teamIds,
        dailyWorkHours: ownDailyWorkHours,
        profileImageDataUrl: ownProfileImageDataUrl,
        password: ownPassword || undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorMessage(data?.error ?? "Eigene Einstellungen konnten nicht gespeichert werden.");
      return;
    }

    const updatedUser = (await res.json()) as UserOption;
    setUsers((currentUsers) =>
      currentUsers.map((currentUser) =>
        currentUser.id === updatedUser.id ? updatedUser : currentUser
      )
    );
    await loadUsers();
    setOwnPassword("");
    setOwnPasswordConfirm("");
    setIsOwnSettingsOpen(false);
  }

  async function loadTeams() {
    const res = await fetch("/api/teams", { cache: "no-store" });

    if (!res.ok) {
      setErrorMessage("Teams konnten nicht geladen werden.");
      return;
    }

    const data = await res.json();
    setTeams(data);
  }

  async function loadTrades() {
    const res = await fetch("/api/trades", { cache: "no-store" });

    if (!res.ok) {
      setErrorMessage("Gewerke konnten nicht geladen werden.");
      return;
    }

    const data = await res.json();
    setTrades(data);
  }

  async function createTrade() {
    const name = tradeDraftName.trim();
    const projectPrefix = normalizeProjectPrefixInput(tradeDraftPrefix);
    if (!name) {
      setTradeManagementError("Bitte einen Gewerknamen eintragen.");
      return;
    }

    const res = await fetch("/api/trades", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, projectPrefix, actorId: activeUserId }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setTradeManagementError(data?.error ?? "Gewerk konnte nicht angelegt werden.");
      return;
    }

    setTradeDraftName("");
    setTradeDraftPrefix("");
    setTradeManagementError("");
    await loadTrades();
  }

  async function deleteCompanyProfileTrade(tradeId: string) {
    const res = await fetch("/api/trades", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tradeId, actorId: activeUserId }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setTradeManagementError(data?.error ?? "Gewerk konnte nicht entfernt werden.");
      return;
    }

    setTradeManagementError("");
    await loadTrades();
  }

  async function loadEscalationRules() {
    const res = await fetch("/api/escalation-rules", { cache: "no-store" });

    if (!res.ok) {
      setErrorMessage("Eskalationsregeln konnten nicht geladen werden.");
      return;
    }

    const data = await res.json();
    setEscalationRules(data);
  }

  async function loadDocumentTypes() {
    const res = await fetch("/api/document-types", { cache: "no-store" });

    if (!res.ok) {
      setDocumentTypeError("Dokumenttypen konnten nicht geladen werden.");
      return;
    }

    const data = (await res.json()) as DocumentTypeSummary[];
    setDocumentTypes(data);
    setDocumentTypeError("");
  }

  async function loadDocumentTexts() {
    const res = await fetch("/api/document-texts", { cache: "no-store" });

    if (!res.ok) return;

    const data = (await res.json()) as { texts: DocumentTextItem[] };
    setDocumentTexts(data.texts);
  }

  function openDocumentTextModal(item?: DocumentTextItem, shouldCopy = false) {
    const fallbackKind = documentTextView === "titles" ? "title" : "text";

    setEditingDocumentTextId(item && !shouldCopy ? item.id : "");
    setDocumentTextDraftKind(item?.kind ?? fallbackKind);
    setDocumentTextDraftSource(item?.source ?? "Eigene");
    setDocumentTextDraftTitle(item ? `${item.title}${shouldCopy ? " Kopie" : ""}` : "");
    setDocumentTextDraftBody(item?.body ?? "");
    setDocumentTextDraftError("");
    setIsDocumentTextModalOpen(true);
  }

  function closeDocumentTextModal() {
    setIsDocumentTextModalOpen(false);
    setEditingDocumentTextId("");
    setDocumentTextDraftError("");
  }

  async function saveDocumentTextDraft() {
    const title = documentTextDraftTitle.trim();
    const body = documentTextDraftBody.trim();

    if (!title || !body) {
      setDocumentTextDraftError("Bitte Titel und Text angeben.");
      return;
    }

    const res = await fetch("/api/document-texts", {
      method: editingDocumentTextId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingDocumentTextId,
        source: documentTextDraftSource,
        kind: documentTextDraftKind,
        title,
        body,
      }),
    });

    const data = (await res.json()) as { texts?: DocumentTextItem[]; error?: string };

    if (!res.ok) {
      setDocumentTextDraftError(data.error ?? "Der Eintrag konnte nicht gespeichert werden.");
      return;
    }

    if (data.texts) {
      setDocumentTexts(data.texts);
    }

    setDocumentTextView(documentTextDraftKind === "title" ? "titles" : "texts");
    closeDocumentTextModal();
  }

  async function deleteDocumentText(item: DocumentTextItem) {
    const confirmed = window.confirm(`"${item.title}" wirklich loeschen?`);

    if (!confirmed) return;

    const res = await fetch("/api/document-texts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });

    const data = (await res.json()) as { texts?: DocumentTextItem[]; error?: string };

    if (!res.ok) {
      window.alert(data.error ?? "Der Eintrag konnte nicht geloescht werden.");
      return;
    }

    if (data.texts) {
      setDocumentTexts(data.texts);
    }
  }

  async function loadAbsences() {
    const res = await fetch("/api/absences", { cache: "no-store" });

    if (!res.ok) {
      setErrorMessage("Abwesenheiten konnten nicht geladen werden.");
      return;
    }

    const data = await res.json();
    setAbsences(data);
  }

  async function loadHeroProjects() {
    setHasLoadedHeroProjects(true);
    setIsHeroProjectsLoading(true);

    try {
      const res = await fetch("/api/hero/projects", { cache: "no-store" });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrorMessage(data?.error ?? "HERO-Projekte konnten nicht geladen werden.");
        return;
      }

      const rawData = (await res.json()) as Array<
        Omit<HeroProjectPreview, "id" | "statusCode"> & {
          id: string | number;
          statusCode: string | number;
        }
      >;
      const data: HeroProjectPreview[] = rawData.map((project) => ({
        ...project,
        id: String(project.id),
        statusCode: String(project.statusCode ?? ""),
      }));
      setHeroProjects(data);
      setSelectedHeroDetailId((currentProjectId) =>
        currentProjectId && data.some((project) => project.id === currentProjectId)
          ? currentProjectId
          : data[0]?.id ?? ""
      );
    } finally {
      setIsHeroProjectsLoading(false);
    }
  }

  async function loadProjectTimeEntries() {
    const res = await fetch("/api/project-time-entries", { cache: "no-store" });

    if (!res.ok) {
      setErrorMessage("Projektzeiten konnten nicht geladen werden.");
      return;
    }

    const data = (await res.json()) as StampTimeEntry[];
    setStampEntries(data);
  }

  async function loadProjectLogbookEntries() {
    const res = await fetch("/api/project-logbook-entries", { cache: "no-store" });

    if (!res.ok) {
      setLogbookError("Projekt-Logbucheinträge konnten nicht geladen werden.");
      return;
    }

    const data = (await res.json()) as ProjectLogbookEntry[];
    setProjectLogbookEntries(data);
    setLogbookError("");
  }

  async function loadNotifications(showDesktopNotice = false) {
    if (!activeUserId) return;

    const res = await fetch(`/api/notifications?userId=${activeUserId}`, {
      cache: "no-store",
    });

    if (!res.ok) return;

    const data = (await res.json()) as AppNotification[];

    setNotifications((currentNotifications) => {
      const currentIds = new Set(currentNotifications.map((notification) => notification.id));
      const newUnreadNotifications = data.filter(
        (notification) => !notification.readAt && !currentIds.has(notification.id)
      );

      if (
        showDesktopNotice &&
        hasLoadedNotifications.current &&
        newUnreadNotifications.length > 0 &&
        typeof window !== "undefined" &&
        "Notification" in window &&
        window.Notification.permission === "granted"
      ) {
        newUnreadNotifications.slice(0, 3).forEach((notification) => {
          new window.Notification(notification.subject, {
            body: notification.body,
            tag: notification.id,
          });
        });
      }

      hasLoadedNotifications.current = true;
      return data;
    });
  }

  async function requestDesktopNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setErrorMessage("Desktop-Benachrichtigungen werden von diesem Browser nicht unterstützt.");
      return;
    }

    const permission = await window.Notification.requestPermission();
    setDesktopPermission(permission);
  }

  async function markNotificationsRead() {
    if (!activeUserId) return;

    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: activeUserId }),
    });

    if (!res.ok) return;

    await loadNotifications(false);
  }

  async function saveAbsence() {
    setAbsenceWarning("");

    if (!absenceRepresentativeUserId) {
      setAbsenceWarning("Bitte einen Vertreter auswählen. Eine Abwesenheit kann nur mit Vertreter gespeichert werden.");
      return;
    }

    if (!isVacationHandoverComplete) {
      setAbsenceWarning("Bitte die Urlaubsübergabe vollständig ausfüllen und bestätigen.");
      return;
    }

    const res = await fetch("/api/absences", {
      method: editingAbsenceId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        absenceId: editingAbsenceId,
        actorId: activeUserId,
        userId: absenceUserId,
        dateFrom: absenceDateFrom,
        dateTo: absenceDateTo,
        type: absenceType,
        representativeUserId: absenceRepresentativeUserId || null,
        note: absenceNote,
        handoverChecklist: absenceType === "urlaub" ? vacationHandoverItems : [],
        handoverConfirmed: absenceType !== "urlaub" || isVacationHandoverComplete,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorMessage(data?.error ?? "Abwesenheit konnte nicht gespeichert werden.");
      return;
    }

    setAbsenceNote("");
    setEditingAbsenceId(null);
    setAbsenceChecklist(vacationHandoverItems.map(() => false));
    setAbsenceHandoverConfirmed(false);
    setAbsenceWarning("");
    setIsAbsenceModalOpen(false);
    await loadAbsences();
    await loadNotifications(true);
  }

  async function deleteAbsence(absenceId: string) {
    const confirmed = window.confirm("Abwesenheit wirklich löschen?");
    if (!confirmed) return;

    const res = await fetch("/api/absences", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorId: activeUserId,
        absenceId,
        dateFrom: absenceDateFrom,
        dateTo: absenceDateTo,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorMessage(data?.error ?? "Abwesenheit konnte nicht entfernt werden.");
      return;
    }

    await loadAbsences();
    await loadNotifications(true);
    setEditingAbsenceId(null);
    setIsAbsenceModalOpen(false);
  }

  function openAbsenceModal(date?: Date | string) {
    const selectedDate =
      typeof date === "string" ? date : date ? formatDateKey(date) : formatDateKey(new Date());
    setAbsenceUserId((current) => current || activeUserId || users[0]?.id || "");
    setAbsenceDateFrom(selectedDate);
    setAbsenceDateTo(selectedDate);
    setAbsenceType("urlaub");
    setAbsenceRepresentativeUserId("");
    setAbsenceNote("");
    setEditingAbsenceId(null);
    setAbsenceChecklist(vacationHandoverItems.map(() => false));
    setAbsenceHandoverConfirmed(false);
    setAbsenceWarning("");
    setIsAbsenceModalOpen(true);
    setSelectedCalendarActionDate("");
  }

  function openEditAbsenceModal(absence: AbsenceItem) {
    const relatedAbsences = absences
      .filter(
        (currentAbsence) =>
          currentAbsence.userId === absence.userId &&
          currentAbsence.type === absence.type &&
          currentAbsence.representativeUserId === absence.representativeUserId &&
          currentAbsence.note === absence.note
      )
      .sort((first, second) => first.date.localeCompare(second.date));

    setEditingAbsenceId(absence.id);
    setAbsenceUserId(absence.userId);
    setAbsenceType(absence.type);
    setAbsenceDateFrom(relatedAbsences[0]?.date ?? absence.date);
    setAbsenceDateTo(relatedAbsences.at(-1)?.date ?? absence.date);
    setAbsenceRepresentativeUserId(absence.representativeUserId ?? "");
    setAbsenceNote(absence.note);
    setAbsenceChecklist(vacationHandoverItems.map(() => true));
    setAbsenceHandoverConfirmed(true);
    setAbsenceWarning("");
    setIsAbsenceModalOpen(true);
    setSelectedCalendarActionDate("");
  }

  useEffect(() => {
    loadTasks();
    loadUsers();
    loadTeams();
    loadTrades();
    loadEscalationRules();
    loadAbsences();
    loadContacts();
    loadProjectTimeEntries();
    loadProjectLogbookEntries();
    loadDocumentTypes();
    loadDocumentTexts();
  }, []);

  useEffect(() => {
    setContactPage(1);
  }, [contactSearchTerm, contactCategoryFilter, contactColumnFilters, contactPageSize]);

  useEffect(() => {
    const storedState = window.localStorage.getItem("workpilot-holiday-state") as GermanStateCode | null;
    const initialState = storedState && germanStateOptions.some((option) => option.value === storedState)
      ? storedState
      : "BW";

    setHolidayState(initialState);
    setHolidays(calculateGermanHolidays(initialState, new Date().getFullYear(), 50));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("workpilot-holiday-state", holidayState);
    setHolidays(calculateGermanHolidays(holidayState, new Date().getFullYear(), 50));
  }, [holidayState]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setDesktopPermission(window.Notification.permission);
    }
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setDeadlineProgressTime(Date.now());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (Object.keys(runningTaskTimers).length === 0 && !stampSession) return;

    const intervalId = window.setInterval(() => {
      setTimerNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [runningTaskTimers, stampSession]);

  useEffect(() => {
    if (!activeUserId) return;

    hasLoadedNotifications.current = false;
    void loadNotifications(false);

    const intervalId = window.setInterval(() => {
      void loadNotifications(true);
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [activeUserId]);

  useEffect(() => {
    const storedTab = window.localStorage.getItem("workpilot-active-tab");

    if (navigationTabs.some(([tab]) => tab === storedTab)) {
      setActiveTab(storedTab as AppTab);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("workpilot-active-tab", activeTab);

    if (
      (activeTab === "hero" ||
        activeTab === "projectsSolutions" ||
        activeTab === "projectsImmocare") &&
      !hasLoadedHeroProjects
    ) {
      void loadHeroProjects();
    }
  }, [activeTab, hasLoadedHeroProjects]);

  useEffect(() => {
    if (!isModalOpen && errorMessage.includes("am geplanten Tag abwesend")) {
      setErrorMessage("");
    }
  }, [errorMessage, isModalOpen]);

  useEffect(() => {
    if (!isModalOpen || !editingTask || selectedHeroProjectId) return;

    const matchingProject = heroProjects.find((project) => project.title === editingTask.titel);
    if (matchingProject) {
      setSelectedHeroProjectId(matchingProject.id);
    }
  }, [editingTask, heroProjects, isModalOpen, selectedHeroProjectId]);

  function resetForm() {
    const fallbackOwnerId = canAssignOther(activeUser?.role)
      ? users[0]?.id || ""
      : activeUserId;

    setTitel(emptyTask.titel);
    setBeschreibung(emptyTask.beschreibung);
    setStatus(emptyTask.status);
    setPrioritaet(emptyTask.prioritaet);
    setGewerkId("");
    setZustaendigId(fallbackOwnerId);
    setSelectedHeroProjectId("");
    setFaelligkeit(getDefaultDeadlineValue());
    setKunde(emptyTask.kunde);
    setKundenklasse(emptyTask.kundenklasse);
    setAutoFeedbackEnabled(emptyTask.autoFeedbackEnabled);
    setAutoFeedbackRecipientId(emptyTask.autoFeedbackRecipientId);
    setRecurrenceEnabled(emptyTask.recurrenceEnabled);
    setRecurrenceInterval(emptyTask.recurrenceInterval);
    setVorgabeMinuten(emptyTask.vorgabeMinuten);
    setPlanningEnabled(false);
    setPlanningAllocations([]);
    setKommentarText("");
  }

  function openCreateModal(date?: Date | string) {
    setIsQuickCreateOpen(false);
    setEditingTask(null);
    setErrorMessage("");
    resetForm();
    if (date) {
      const selectedDate = typeof date === "string" ? date : formatDateKey(date);
      setFaelligkeit(`${selectedDate}T12:00`);
    }
    if (!hasLoadedHeroProjects) void loadHeroProjects();
    setIsModalOpen(true);
    setSelectedCalendarActionDate("");
  }

  function openCreateProjectModal() {
    const nextPipelineType =
      activeTab === "projectsImmocare" ? "Projekt OK immocare" : "Projekt OK solutions";
    setEditingProjectDataId("");
    setProjectDraft({
      ...emptyProjectDraft,
      projectType: nextPipelineType,
      branch: nextPipelineType === "Projekt OK immocare" ? "OK immocare GmbH" : "OK solutions GmbH",
    });
    setIsQuickCreateOpen(false);
    setIsProjectContactPickerOpen(false);
    setProjectContactPickerSearch("");
    setIsProjectModalOpen(true);
  }

  function closeProjectModal() {
    setIsProjectModalOpen(false);
    setEditingProjectDataId("");
    setIsProjectContactPickerOpen(false);
    setProjectContactPickerSearch("");
  }

  function openProjectDataModal(project: HeroProjectPreview) {
    setEditingProjectDataId(project.id);
    setProjectDraft({
      ...emptyProjectDraft,
      contactId: project.contactId || "",
      contactPersonId: project.contactPersonId || "",
      addressContactId: project.addressContactId || "",
      projectType:
        project.projectType === "Projekt OK immocare"
          ? "Projekt OK immocare"
          : "Projekt OK solutions",
      projectKind:
        project.projectKind === "Dauerläufer-Projekt"
          ? "Dauerläufer-Projekt"
          : "einmaliges Projekt",
      projectRuntimeFrom: project.projectRuntimeFrom || "",
      projectRuntimeUntil: project.projectRuntimeUntil || "",
      billingInterval:
        project.billingInterval === "quartalsweise" || project.billingInterval === "jährlich"
          ? project.billingInterval
          : "monatlich",
      trade: project.trade || emptyProjectDraft.trade,
      branch:
        project.branch ||
        (project.projectType === "Projekt OK immocare" ? "OK immocare GmbH" : "OK solutions GmbH"),
      name: project.title || "",
      volume: project.volume || "",
      timeBudgetHours: project.timeBudgetHours || "",
      source: project.source || "",
      participants: project.participants || "",
    });
    setIsProjectContactPickerOpen(false);
    setProjectContactPickerSearch("");
    setIsProjectModalOpen(true);
  }

  function updateProjectDraft<K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) {
    setProjectDraft((currentDraft) => ({
      ...currentDraft,
      [key]: value,
      ...(key === "contactId"
        ? {
            contactPersonId: "",
            addressContactId: "",
          }
        : {}),
      ...(key === "projectType"
        ? {
            branch:
              value === "Projekt OK immocare" ? "OK immocare GmbH" : "OK solutions GmbH",
          }
        : {}),
    }));
  }

  function getContactLabel(contact: ContactItem) {
    return (
      [contact.companyName, contact.firstName, contact.lastName].filter(Boolean).join(" - ") ||
      contact.email ||
      contact.customerNumber
    );
  }

  function getContactDisplayName(contact: ContactItem) {
    if (contact.type === "company") return contact.companyName || contact.customerNumber;

    return (
      [contact.salutation, contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
      contact.email ||
      contact.customerNumber
    );
  }

  function getCustomerFileTarget(contact: ContactItem) {
    if (contact.type === "company") return contact;

    return (
      contacts.find((candidate) => candidate.id === contact.parentCompanyId) ||
      contacts.find(
        (candidate) =>
          candidate.type === "company" &&
          candidate.companyName &&
          candidate.companyName === contact.parentCompanyName
      ) ||
      contact
    );
  }

  function openCustomerFile(contact: ContactItem) {
    const target = getCustomerFileTarget(contact);
    setSelectedCustomerFileId(target.id);
    setCustomerFileTab("logbook");
    setSelectedContactIds([]);
  }

  function openGlobalSearchResult(result: GlobalSearchResult) {
    setGlobalSearchTerm("");
    setIsGlobalSearchOpen(false);
    setIsQuickCreateOpen(false);
    setIsNotificationsOpen(false);
    setIsUserMenuOpen(false);

    if (result.target.kind === "contact") {
      const contact = contacts.find((item) => item.id === result.target.id);
      if (!contact) return;
      setActiveTab("contacts");
      openCustomerFile(contact);
      return;
    }

    if (result.target.kind === "project") {
      const project = heroProjects.find((item) => item.id === result.target.id);
      if (!project) return;
      const projectType = (project.projectType ?? "").toLowerCase();
      const projectNumber = (project.projectNumber ?? "").toLowerCase();
      setActiveTab(projectType.includes("immocare") || projectNumber.startsWith("oki") ? "projectsImmocare" : "projectsSolutions");
      setSelectedProjectFileId(project.id);
      setProjectFileTab("logbook");
      return;
    }

    if (result.target.kind === "task") {
      const task = tasks.find((item) => item.id === result.target.id);
      if (!task) return;
      setActiveTab("dashboard");
      openEditModal(task);
      return;
    }

    if (result.target.kind === "documentType") {
      setActiveTab("documentConfigurator");
      setDocumentTypeSearch(result.title);
      return;
    }

    setActiveTab("documentTexts");
    setDocumentTextSearch(result.title);
    setDocumentTextView(result.category === "Titel" ? "titles" : "texts");
  }

  function renderContactFileLink(contact: ContactItem, label: string) {
    if (!label) return "-";

    return (
      <button
        type="button"
        className={styles.tableTextLink}
        onClick={(event) => {
          event.stopPropagation();
          openCustomerFile(contact);
        }}
      >
        {label}
      </button>
    );
  }

  function resetLogbookDraft() {
    setLogbookMessage("");
    setLogbookColleague("");
    setLogbookAttachments([]);
    setLogbookCreateTask(false);
    setLogbookTaskTitle("");
    setLogbookVisibleFor([
      "Geschaeftsfuehrer",
      "Vertriebler",
      "Niederlassungsleiter",
      "Monteur",
      "Buchhaltung",
    ]);
  }

  function openLogbookModal(target: "customer" | "project" = "customer") {
    resetLogbookDraft();
    setLogbookTarget(target);
    setLogbookError("");
    setIsLogbookModalOpen(true);
  }

  function toggleLogbookVisibleFor(role: string, checked: boolean) {
    setLogbookVisibleFor((currentRoles) =>
      checked ? [...new Set([...currentRoles, role])] : currentRoles.filter((item) => item !== role)
    );
  }

  function readLogbookAttachment(file: File, type: "Bild" | "Dokument") {
    return new Promise<LogbookAttachment>((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => reject(new Error("Anhang konnte nicht gelesen werden."));
      reader.onload = () =>
        resolve({
          name: file.name,
          type,
          mimeType: file.type,
          size: file.size,
          dataUrl: String(reader.result ?? ""),
        });
      reader.readAsDataURL(file);
    });
  }

  async function addLogbookAttachments(files: FileList | null, type: "Bild" | "Dokument") {
    if (!files) return;

    const nextAttachments = await Promise.all(
      Array.from(files).map((file) => readLogbookAttachment(file, type))
    );
    setLogbookAttachments((currentAttachments) => [...currentAttachments, ...nextAttachments]);
  }

  async function saveLogbookEntry() {
    if (!logbookMessage.trim()) return;

    const now = new Date();
    const date = new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(now);
    const taskTitle = logbookCreateTask
      ? logbookTaskTitle.trim() || logbookMessage.trim().slice(0, 80)
      : "";

    if (logbookTarget === "project") {
      if (!selectedProjectFile) return;

      const res = await fetch("/api/project-logbook-entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: selectedProjectFile.id,
          title: "Eintrag",
          text: logbookMessage.trim(),
          author: activeUser?.name || "Christian Eid",
          colleague: logbookColleague.trim(),
          visibleFor: logbookVisibleFor,
          attachments: logbookAttachments,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setLogbookError(data?.error ?? "Logbucheintrag konnte nicht gespeichert werden.");
        return;
      }

      const savedEntry = (await res.json()) as ProjectLogbookEntry;
      setProjectLogbookEntries((currentEntries) => [savedEntry, ...currentEntries]);
      setIsLogbookModalOpen(false);
      resetLogbookDraft();
      return;
    }

    if (!selectedCustomerFile) return;

    setCustomerLogbookEntries((currentEntries) => [
      {
        id: `${selectedCustomerFile.id}-${now.getTime()}`,
        customerId: selectedCustomerFile.id,
        date,
        text: logbookMessage.trim(),
        colleague: logbookColleague.trim(),
        visibleFor: logbookVisibleFor,
        attachments: logbookAttachments,
        taskTitle,
      },
      ...currentEntries,
    ]);
    setIsLogbookModalOpen(false);

    if (logbookCreateTask) {
      resetForm();
      setTitel(taskTitle);
      setKunde(
        selectedCustomerFile.companyName ||
          [selectedCustomerFile.firstName, selectedCustomerFile.lastName].filter(Boolean).join(" ")
      );
      setBeschreibung(logbookMessage.trim());
      setIsModalOpen(true);
    }

    resetLogbookDraft();
  }

  function getContactAddressLine(contact: ContactItem) {
    return [contact.street, [contact.postalCode, contact.city].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ");
  }

  async function persistProject(project: HeroProjectPreview) {
    const res = await fetch("/api/hero/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(project),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error ?? "Projekt konnte nicht gespeichert werden.");
    }

    return (await res.json()) as HeroProjectPreview;
  }

  async function saveProjectDraft() {
    const selectedContact = contacts.find((contact) => contact.id === projectDraft.contactId);
    const selectedAddressContact = contacts.find(
      (contact) => contact.id === projectDraft.addressContactId
    );
    const selectedContactPerson = contacts.find(
      (contact) => contact.id === projectDraft.contactPersonId
    );
    const editingProject = heroProjects.find((project) => project.id === editingProjectDataId);
    const targetPipeline =
      projectDraft.projectType === "Projekt OK immocare" ? projectPipelines[1] : projectPipelines[0];
    const prefix = getProjectTradePrefix(projectDraft.trade, trades);
    const projectNumber =
      editingProject?.projectNumber || `${prefix}-${getNextProjectSequence(heroProjects)}`;
    const projectTitle =
      projectDraft.name ||
      [`Projekt ${projectNumber}`, projectDraft.trade].filter(Boolean).join(" - ") ||
      "Neues Projekt";
    const projectAddress = selectedAddressContact
      ? getContactAddressLine(selectedAddressContact)
      : selectedContact
        ? getContactAddressLine(selectedContact)
        : editingProject?.address || "";
    const projectDescription = [
      projectDraft.projectType,
      projectDraft.projectKind,
      projectDraft.trade,
      projectDraft.projectRuntimeFrom ? `Start: ${projectDraft.projectRuntimeFrom}` : "",
      projectDraft.projectKind === "Dauerläufer-Projekt" && projectDraft.projectRuntimeUntil
        ? `Laufzeit bis: ${projectDraft.projectRuntimeUntil}`
        : "",
      projectDraft.projectKind === "Dauerläufer-Projekt"
        ? `Fakturierung: ${projectDraft.billingInterval}`
        : "",
      projectDraft.volume ? `Volumen: ${projectDraft.volume} EUR` : "",
      projectDraft.timeBudgetHours ? `Zeitkontingent: ${projectDraft.timeBudgetHours} Std.` : "",
      projectDraft.source ? `Quelle: ${projectDraft.source}` : "",
      selectedContactPerson ? `Ansprechpartner/in: ${getContactDisplayName(selectedContactPerson)}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    if (editingProject) {
      const previousBudget = editingProject.timeBudgetHours || "";
      const nextBudget = projectDraft.timeBudgetHours || "";
      const budgetChanged = parseHoursInput(previousBudget) !== parseHoursInput(nextBudget);
      const updatedProject: HeroProjectPreview = {
        ...editingProject,
        projectNumber,
        title: projectTitle,
        customer: selectedContact ? getContactLabel(selectedContact) : editingProject.customer,
        contactId: selectedContact?.id || "",
        contactPersonId: selectedContactPerson?.id || "",
        addressContactId: selectedAddressContact?.id || "",
        projectType: projectDraft.projectType,
        projectKind: projectDraft.projectKind,
        projectRuntimeFrom: projectDraft.projectRuntimeFrom,
        projectRuntimeUntil:
          projectDraft.projectKind === "Dauerläufer-Projekt" ? projectDraft.projectRuntimeUntil : "",
        billingInterval:
          projectDraft.projectKind === "Dauerläufer-Projekt" ? projectDraft.billingInterval : "",
        trade: projectDraft.trade,
        branch: projectDraft.branch,
        volume: projectDraft.volume,
        timeBudgetHours: nextBudget,
        timeBudgetHistory: budgetChanged
          ? [
              {
                id: `budget-${Date.now()}`,
                changedAt: new Intl.DateTimeFormat("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date()),
                changedBy: activeUser?.name || "Aktueller Mitarbeiter",
                previousHours: previousBudget || "0",
                nextHours: nextBudget || "0",
              },
              ...(editingProject.timeBudgetHistory || []),
            ]
          : editingProject.timeBudgetHistory,
        source: projectDraft.source,
        address: projectAddress,
        participants: projectDraft.participants,
        responsibleName: editingProject.responsibleName || activeUser?.name || "Christian Eid",
        description: projectDescription,
      };

      let savedProject: HeroProjectPreview;
      try {
        savedProject = await persistProject(updatedProject);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Projekt konnte nicht gespeichert werden.");
        return;
      }

      setHeroProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === editingProject.id ? savedProject : project
        )
      );
      setSelectedHeroDetailId(savedProject.id);
      setSelectedProjectFileId(savedProject.id);
      setSelectedProjectPipelineStatus(savedProject.status || "Alle Offenen");
      setSelectedProjectKindFilter(projectDraft.projectKind);
      setActiveTab(targetPipeline.tab);
      closeProjectModal();
      return;
    }

    const createdProject: HeroProjectPreview = {
      id: `${targetPipeline.id}-${Date.now()}`,
      projectNumber,
      title: projectTitle,
      customer: selectedContact ? getContactLabel(selectedContact) : "",
      status: "Lead / Klärung",
      statusCode: "lead",
      contactId: selectedContact?.id,
      contactPersonId: selectedContactPerson?.id,
      addressContactId: selectedAddressContact?.id,
      projectType: projectDraft.projectType,
      projectKind: projectDraft.projectKind,
      projectRuntimeFrom: projectDraft.projectRuntimeFrom,
      projectRuntimeUntil: projectDraft.projectKind === "Dauerläufer-Projekt" ? projectDraft.projectRuntimeUntil : "",
      billingInterval: projectDraft.projectKind === "Dauerläufer-Projekt" ? projectDraft.billingInterval : "",
      trade: projectDraft.trade,
      branch: projectDraft.branch,
      volume: projectDraft.volume,
      timeBudgetHours: projectDraft.timeBudgetHours,
      timeBudgetHistory: projectDraft.timeBudgetHours
        ? [
            {
              id: `budget-${Date.now()}`,
              changedAt: new Intl.DateTimeFormat("de-DE", {
                day: "2-digit",
                month: "2-digit",
                year: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date()),
              changedBy: activeUser?.name || "Aktueller Mitarbeiter",
              previousHours: "0",
              nextHours: projectDraft.timeBudgetHours,
            },
          ]
        : [],
      source: projectDraft.source,
      address: projectAddress,
      participants: projectDraft.participants,
      responsibleName: activeUser?.name || "Christian Eid",
      createdAt: new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date()),
      description: projectDescription,
    };

    let savedProject: HeroProjectPreview;
    try {
      savedProject = await persistProject(createdProject);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Projekt konnte nicht gespeichert werden.");
      return;
    }

    setHeroProjects((currentProjects) => [savedProject, ...currentProjects]);
    setSelectedHeroDetailId(savedProject.id);
    setSelectedProjectFileId(savedProject.id);
    setProjectFileTab("logbook");
    setSelectedProjectPipelineStatus("Lead / Klärung");
    setSelectedProjectKindFilter(projectDraft.projectKind);
    setActiveTab(targetPipeline.tab);
    closeProjectModal();
  }

  function closeTaskModal() {
    setIsModalOpen(false);
    setErrorMessage("");
  }

  function toggleCalendarDayActions(date: Date) {
    const dateKey = formatDateKey(date);
    setSelectedCalendarActionDate((current) => (current === dateKey ? "" : dateKey));
  }

  function openEditModal(task: TaskItem) {
    setEditingTask(task);
    setErrorMessage("");
    setTitel(task.titel);
    setBeschreibung(task.beschreibung);
    setStatus(task.status);
    setPrioritaet(task.prioritaet);
    setGewerkId(task.gewerkId);
    setZustaendigId(task.zustaendigId);
    setSelectedHeroProjectId(
      heroProjects.find((project) => project.title === task.titel)?.id ?? ""
    );
    setFaelligkeit(task.faelligkeit);
    setKunde(task.kunde);
    setKundenklasse(task.kundenklasse);
    setAutoFeedbackEnabled(task.autoFeedbackEnabled);
    setAutoFeedbackRecipientId(task.autoFeedbackRecipientId);
    setRecurrenceEnabled(task.recurrenceEnabled);
    setRecurrenceInterval(task.recurrenceInterval || emptyTask.recurrenceInterval);
    setVorgabeMinuten(task.vorgabeMinuten?.toString() ?? "");
    setPlanningEnabled(task.planningAllocations.length > 0);
    setPlanningAllocations(task.planningAllocations);
    setZeitDauer("");
    setZeitNotiz("");
    setEditingTimeEntryId(null);
    setKommentarText("");
    if (!hasLoadedHeroProjects) void loadHeroProjects();
    setIsModalOpen(true);
  }

  function selectCustomer(nextCustomer: string) {
    setKunde(nextCustomer);

    const selectedProject = heroProjects.find(
      (currentProject) => currentProject.id === selectedHeroProjectId
    );

    if (selectedProject && selectedProject.customer !== nextCustomer) {
      setSelectedHeroProjectId("");
    }
  }

  function selectHeroProject(projectId: string) {
    setSelectedHeroProjectId(projectId);

    const project = heroProjects.find((currentProject) => currentProject.id === projectId);
    if (!project) return;

    setTitel(project.title);
    setKunde(project.customer);

    if (!beschreibung.trim() && project.description) {
      setBeschreibung(project.description);
    }
  }

  function getDefaultPlanningAllocation() {
    return {
      date: (normalizeDeadlineInput(faelligkeit) || getDefaultDeadlineValue()).slice(0, 10),
      minutes: vorgabeMinuten ? Number(vorgabeMinuten) : 0,
    };
  }

  function togglePlanningEnabled(checked: boolean) {
    setPlanningEnabled(checked);
    if (checked && planningAllocations.length === 0) {
      setPlanningAllocations([getDefaultPlanningAllocation()]);
    }
  }

  function updatePlanningAllocation(
    index: number,
    field: keyof TaskPlanningAllocation,
    value: string
  ) {
    setPlanningAllocations((current) => {
      return current.map((allocation, currentIndex) => {
        if (currentIndex !== index) return allocation;

        if (field === "minutes") {
          return {
            ...allocation,
            minutes: Math.max(0, Number(value)),
          };
        }

        return {
          ...allocation,
          date: value,
        };
      });
    });
  }

  function addPlanningAllocation() {
    setPlanningAllocations((current) => {
      const lastDate = current.at(-1)?.date || getDefaultPlanningAllocation().date;
      return [...current, { date: addDaysToDateKey(lastDate, 1), minutes: 0 }];
    });
  }

  function removePlanningAllocation(index: number) {
    setPlanningAllocations((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function distributePlanningEvenly() {
    const estimate = vorgabeMinuten ? Number(vorgabeMinuten) : 0;
    if (!estimate) return;

    const rowCount = Math.max(planningAllocations.length, 1);
    const baseMinutes = Math.floor(estimate / rowCount);
    const remainder = estimate % rowCount;

    setPlanningAllocations((current) => {
      const sourceRows = current.length > 0 ? current : [getDefaultPlanningAllocation()];
      return sourceRows.map((allocation, index) => ({
        ...allocation,
        minutes: baseMinutes + (index < remainder ? 1 : 0),
      }));
    });
  }

  function getNormalizedPlanningAllocations() {
    return planningAllocations
      .filter((allocation) => allocation.date && allocation.minutes > 0)
      .map((allocation) => ({
        date: allocation.date,
        minutes: Math.round(allocation.minutes),
      }));
  }

  async function saveTask() {
    if (!titel.trim()) return;
    if (autoFeedbackEnabled && !autoFeedbackRecipientId) {
      setErrorMessage("Bitte einen Empfänger für die automatische Rückmeldung auswählen.");
      return;
    }

    const normalizedPlanningAllocations = planningEnabled ? getNormalizedPlanningAllocations() : [];
    const estimateMinutes = vorgabeMinuten ? Number(vorgabeMinuten) : null;

    if (planningEnabled) {
      const distributedMinutes = normalizedPlanningAllocations.reduce(
        (total, allocation) => total + allocation.minutes,
        0
      );

      if (!estimateMinutes || estimateMinutes <= 0) {
        setErrorMessage("Bitte zuerst eine Vorgabezeit eintragen, bevor sie verteilt wird.");
        return;
      }

      if (normalizedPlanningAllocations.length === 0) {
        setErrorMessage("Bitte mindestens einen Planungstag mit Minuten eintragen.");
        return;
      }

      if (distributedMinutes !== estimateMinutes) {
        setErrorMessage(
          `Die verteilte Vorgabezeit muss exakt ${formatMinutes(estimateMinutes)} ergeben. Aktuell verteilt: ${formatMinutes(distributedMinutes)}.`
        );
        return;
      }
    }

    const completionValidationMessage = getCompletionValidationMessage(
      status,
      estimateMinutes,
      editingTask?.zeiteintraege.length ?? 0
    );

    if (completionValidationMessage) {
      setErrorMessage(completionValidationMessage);
      return;
    }

    const method = editingTask ? "PATCH" : "POST";
    const selectedOwnerId = canAssignOther(activeUser?.role) ? zustaendigId : activeUserId;
    const plannedDateKeys =
      normalizedPlanningAllocations.length > 0
        ? Array.from(new Set(normalizedPlanningAllocations.map((allocation) => allocation.date)))
        : [(normalizeDeadlineInput(faelligkeit) || getDefaultDeadlineValue()).slice(0, 10)];
    const absenceDate = plannedDateKeys.find((dateKey) => getUserAbsenceForDateKey(selectedOwnerId, dateKey));

    if (absenceDate) {
      const selectedOwnerName =
        users.find((user) => user.id === selectedOwnerId)?.name ?? "Die ausgewählte Person";
      const absentUntil = getUserAbsentUntil(selectedOwnerId, absenceDate) || absenceDate;
      setErrorMessage(
        `${selectedOwnerName} ist am geplanten Tag abwesend. Die Aufgabe kann nicht gespeichert werden, weil die Person bis einschliexlich ${formatDateOnly(absentUntil)} abwesend ist.`
      );
      return;
    }

    if (!planningEnabled && estimateMinutes && estimateMinutes > 0) {
      const confirmed = window.confirm(
        "Hinweis: Die gesamte Vorgabezeit der Aufgabe wird am Tag der Deadline geplant. Möchtest du fortfahren?"
      );
      if (!confirmed) return;
    }

    const holidayDate = plannedDateKeys.find((dateKey) => getHolidayForDateKey(dateKey));
    if (holidayDate) {
      const holiday = getHolidayForDateKey(holidayDate);
      const confirmed = window.confirm(
        `Achtung, du möchtest eine Aufgabe an einem Feiertag verplanen (${holiday.name}). Willst du fortfahren?`
      );
      if (!confirmed) return;
    }

    const weekendDate = plannedDateKeys.find((dateKey) => isWeekendDateKey(dateKey));
    if (weekendDate) {
      const confirmed = window.confirm(
        "Achtung, du möchtest eine Aufgabe an einem Wochenende verplanen. Willst du fortfahren?"
      );
      if (!confirmed) return;
    }

    const body = {
      id: editingTask?.id,
      actorId: activeUserId,
      title: titel,
      description: beschreibung,
      status,
      priority: prioritaet,
      tradeId: gewerkId || null,
      ownerId: selectedOwnerId,
      deadline: normalizeDeadlineInput(faelligkeit) || getDefaultDeadlineValue(),
      customer: kunde,
      customerClass: kundenklasse || null,
      autoFeedbackEnabled,
      autoFeedbackRecipientId: autoFeedbackEnabled ? autoFeedbackRecipientId : null,
      recurrenceEnabled,
      recurrenceInterval: recurrenceEnabled ? recurrenceInterval : null,
      estimateMinutes,
      planningAllocations: normalizedPlanningAllocations,
    };

    const res = await fetch("/api/tasks", {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorMessage(data?.error ?? "Aufgabe konnte nicht gespeichert werden.");
      return;
    }

    await loadTasks();
    await loadNotifications(true);
    setIsModalOpen(false);
    setEditingTask(null);
  }

  async function addTimeEntry() {
    if (!editingTask || !zeitDauer) return;

    const res = await fetch(`/api/tasks/${editingTask.id}/time-entries`, {
      method: editingTimeEntryId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entryId: editingTimeEntryId,
        durationMinutes: Number(zeitDauer),
        note: zeitNotiz,
      }),
    });

    if (!res.ok) {
      setErrorMessage("Zeiteintrag konnte nicht gespeichert werden.");
      return;
    }

    const entry = await res.json();
    setEditingTask((current) => {
      if (!current) return current;
      const previousEntry = current.zeiteintraege.find((timeEntry) => timeEntry.id === entry.id);

      if (previousEntry) {
        return {
          ...current,
          gesamtzeitMinuten:
            current.gesamtzeitMinuten - previousEntry.dauerMinuten + entry.dauerMinuten,
          zeiteintraege: current.zeiteintraege.map((timeEntry) =>
            timeEntry.id === entry.id ? entry : timeEntry
          ),
        };
      }

      return {
        ...current,
        gesamtzeitMinuten: current.gesamtzeitMinuten + entry.dauerMinuten,
        zeiteintraege: [entry, ...current.zeiteintraege],
      };
    });
    await loadTasks();
    setZeitDauer("");
    setZeitNotiz("");
    setEditingTimeEntryId(null);
  }

  function applyTimeEntryToTask(taskId: string, entry: TimeEntryItem) {
    const updateTask = (task: TaskItem) => {
      const previousEntry = task.zeiteintraege.find((timeEntry) => timeEntry.id === entry.id);

      if (previousEntry) {
        return {
          ...task,
          gesamtzeitMinuten:
            task.gesamtzeitMinuten - previousEntry.dauerMinuten + entry.dauerMinuten,
          zeiteintraege: task.zeiteintraege.map((timeEntry) =>
            timeEntry.id === entry.id ? entry : timeEntry
          ),
        };
      }

      return {
        ...task,
        gesamtzeitMinuten: task.gesamtzeitMinuten + entry.dauerMinuten,
        zeiteintraege: [entry, ...task.zeiteintraege],
      };
    };

    setTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === taskId ? updateTask(task) : task))
    );
    setEditingTask((current) => (current?.id === taskId ? updateTask(current) : current));
  }

  function startTaskTimer(event: MouseEvent<HTMLButtonElement>, task: TaskItem) {
    event.stopPropagation();
    if (task.status === "erledigt" || runningTaskTimers[task.id]) return;

    const startedAt = Date.now();
    setTimerNow(startedAt);
    setRunningTaskTimers((current) => ({
      ...current,
      [task.id]: startedAt,
    }));
    setLastTaskTimerDurations((current) => {
      const next = { ...current };
      delete next[task.id];
      return next;
    });
  }

  async function stopTaskTimer(event: MouseEvent<HTMLButtonElement>, task: TaskItem) {
    event.stopPropagation();

    const startedAt = runningTaskTimers[task.id];
    if (!startedAt) return;

    const stoppedAt = Date.now();
    const elapsedMilliseconds = Math.max(1000, stoppedAt - startedAt);
    const durationMinutes = Math.max(1, Math.ceil(elapsedMilliseconds / 60_000));

    setRunningTaskTimers((current) => {
      const next = { ...current };
      delete next[task.id];
      return next;
    });
    setLastTaskTimerDurations((current) => ({
      ...current,
      [task.id]: elapsedMilliseconds,
    }));

    const res = await fetch(`/api/tasks/${task.id}/time-entries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startedAt: new Date(startedAt).toISOString(),
        durationMinutes,
        note: `Zeitstempelung per Start/Stopp (${formatStopwatch(elapsedMilliseconds)})`,
      }),
    });

    if (!res.ok) {
      setErrorMessage("Zeitstempelung konnte nicht gespeichert werden.");
      return;
    }

    const entry = (await res.json()) as TimeEntryItem;
    applyTimeEntryToTask(task.id, entry);
  }

  function getTaskTimerMilliseconds(task: TaskItem) {
    return (
      task.gesamtzeitMinuten * 60_000 +
      (runningTaskTimers[task.id] ? timerNow - runningTaskTimers[task.id] : 0)
    );
  }

  function getTaskTimerUsagePercent(task: TaskItem) {
    if (!task.vorgabeMinuten || task.vorgabeMinuten <= 0) return 0;
    return clampPercent(Math.round((getTaskTimerMilliseconds(task) / 60_000 / task.vorgabeMinuten) * 100));
  }

  function getTaskTimerUsageState(task: TaskItem) {
    if (!task.vorgabeMinuten || task.vorgabeMinuten <= 0) return "empty";

    const rawPercent = (getTaskTimerMilliseconds(task) / 60_000 / task.vorgabeMinuten) * 100;
    if (rawPercent >= 100) return "over";
    if (rawPercent >= 80) return "warning";
    return "ok";
  }

  function getStampElapsedMilliseconds(session = stampSession) {
    if (!session) return 0;
    if (session.pauseStartedAt) return session.accumulatedMs;
    return session.accumulatedMs + (timerNow - session.startedAt);
  }

  function getStampPauseMilliseconds(session = stampSession) {
    if (!session) return 0;
    return session.pauseMs + (session.pauseStartedAt ? timerNow - session.pauseStartedAt : 0);
  }

  function getStampProjectLabel(projectId: string) {
    const project = heroProjects.find((item) => String(item.id) === String(projectId));
    if (!project) return "Projekt nicht gefunden";
    return `${project.projectNumber} | ${project.title}`;
  }

  function openStampStartModal() {
    if (!hasLoadedHeroProjects) void loadHeroProjects();
    setStampModalMode("start");
    setStampSelectionMode("project");
    setStampProjectId(heroProjects[0]?.id || "");
    setStampProjectSearch("");
    setIsStampProjectSearchOpen(true);
    setStampComment("");
    setStampError("");
    setIsStampModalOpen(true);
  }

  function openStampChangeModal() {
    if (!stampSession) return;
    if (!hasLoadedHeroProjects) void loadHeroProjects();
    setStampModalMode("change");
    setStampSelectionMode(stampSession.mode);
    setStampProjectId(stampSession.projectId || heroProjects[0]?.id || "");
    setStampProjectSearch("");
    setIsStampProjectSearchOpen(true);
    setStampComment("");
    setStampError("");
    setIsStampModalOpen(true);
  }

  function openStampStopModal() {
    if (!stampSession) return;
    setStampModalMode("stop");
    setStampComment("");
    setStampError("");
    setIsStampModalOpen(true);
  }

  function startStampSession(mode: StampMode, projectId: string) {
    const now = Date.now();
    setStampSession({
      mode,
      projectId: mode === "project" ? projectId : "",
      startedAt: now,
      accumulatedMs: 0,
      pauseStartedAt: null,
      pauseMs: 0,
    });
    setTimerNow(now);
  }

  async function saveStampTimeEntry(entry: StampTimeEntry) {
    const projectId =
      entry.mode === "project"
        ? String(entry.projectId ?? "").trim()
        : "__unproductive__";

    const res = await fetch("/api/project-time-entries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...entry,
        projectId,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setStampError(data?.error ?? "Projektzeit konnte nicht gespeichert werden.");
      throw new Error(data?.error ?? "Projektzeit konnte nicht gespeichert werden.");
    }

    const savedEntry = (await res.json()) as StampTimeEntry;
    setStampEntries((currentEntries) => [
      savedEntry,
      ...currentEntries.filter((currentEntry) => currentEntry.id !== savedEntry.id),
    ]);
  }

  function parseStampTimeToMinutes(value: string) {
    const [hours, minutes] = value.split(":").map((part) => Number(part));
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  function parseStampPauseToMilliseconds(value: string) {
    const trimmedValue = value.trim();
    if (!trimmedValue) return 0;
    const parts = trimmedValue.split(":").map((part) => Number(part));
    if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;

    if (parts.length === 2) {
      const [hours, minutes] = parts;
      if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes > 59) return null;
      return (hours * 60 + minutes) * 60_000;
    }

    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts;
      if (
        !Number.isInteger(hours) ||
        !Number.isInteger(minutes) ||
        !Number.isInteger(seconds) ||
        minutes > 59 ||
        seconds > 59
      ) {
        return null;
      }
      return ((hours * 60 + minutes) * 60 + seconds) * 1000;
    }

    return null;
  }

  function openStampEntryEditModal(entry: StampTimeEntry) {
    if (!canManageProjectTimeEntries) return;
    setEditingStampEntry(entry);
    setStampEditDate(entry.date);
    setStampEditStartTime(entry.startTime);
    setStampEditEndTime(entry.endTime);
    setStampEditPause(formatStampDuration(entry.pauseMs));
    setStampEditComment(entry.comment);
    setStampEditError("");
  }

  function closeStampEntryEditModal() {
    setEditingStampEntry(null);
    setStampEditError("");
  }

  async function saveEditedStampEntry() {
    if (!editingStampEntry) return;

    const startMinutes = parseStampTimeToMinutes(stampEditStartTime);
    const endMinutes = parseStampTimeToMinutes(stampEditEndTime);
    const pauseMs = parseStampPauseToMilliseconds(stampEditPause);

    if (!stampEditDate.trim()) {
      setStampEditError("Bitte ein Datum eintragen.");
      return;
    }

    if (startMinutes === null || endMinutes === null || pauseMs === null) {
      setStampEditError("Bitte Zeiten im Format HH:MM und Pause als H:MM:SS eintragen.");
      return;
    }

    const rawDurationMs = (endMinutes - startMinutes) * 60_000 - pauseMs;
    if (rawDurationMs <= 0) {
      setStampEditError("Die Laufzeit muss gröxer als 0 sein.");
      return;
    }

    const updatedEntry: StampTimeEntry = {
      ...editingStampEntry,
      date: stampEditDate.trim(),
      startTime: stampEditStartTime,
      endTime: stampEditEndTime,
      pauseMs,
      durationMs: rawDurationMs,
      comment: stampEditComment.trim(),
    };

    try {
      await saveStampTimeEntry(updatedEntry);
      closeStampEntryEditModal();
    } catch (error) {
      setStampEditError(
        error instanceof Error ? error.message : "Zeiteintrag konnte nicht gespeichert werden."
      );
    }
  }

  async function deleteEditedStampEntry() {
    if (!editingStampEntry) return;
    const shouldDelete = window.confirm("Diesen Zeiteintrag wirklich löschen?");
    if (!shouldDelete) return;

    const res = await fetch(`/api/project-time-entries?id=${encodeURIComponent(editingStampEntry.id)}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setStampEditError(data?.error ?? "Zeiteintrag konnte nicht gelöscht werden.");
      return;
    }

    setStampEntries((currentEntries) =>
      currentEntries.filter((entry) => entry.id !== editingStampEntry.id)
    );
    closeStampEntryEditModal();
  }

  async function closeCurrentStampSession(comment: string) {
    if (!stampSession) return null;
    const now = Date.now();
    const durationMs = getStampElapsedMilliseconds(stampSession);
    const closedProjectId = String(stampSession.projectId ?? "").trim();
    const entry: StampTimeEntry = {
      id: `stamp-${now}`,
      mode: stampSession.mode,
      projectId: stampSession.mode === "project" ? closedProjectId : "__unproductive__",
      projectLabel:
        stampSession.mode === "project" && closedProjectId
          ? getStampProjectLabel(closedProjectId)
          : "Unproduktiv",
      employee: activeUser?.name || "Aktueller Mitarbeiter",
      date: new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(stampSession.startedAt)),
      startTime: new Intl.DateTimeFormat("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(stampSession.startedAt)),
      endTime: new Intl.DateTimeFormat("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(now)),
      durationMs,
      pauseMs: getStampPauseMilliseconds(stampSession),
      comment,
    };
    await saveStampTimeEntry(entry);
    return entry;
  }

  function toggleStampTimer() {
    if (!stampSession) {
      openStampStartModal();
      return;
    }

    const now = Date.now();
    setStampSession((currentSession) => {
      if (!currentSession) return currentSession;
      if (currentSession.pauseStartedAt) {
        return {
          ...currentSession,
          startedAt: now,
          pauseMs: currentSession.pauseMs + (now - currentSession.pauseStartedAt),
          pauseStartedAt: null,
        };
      }

      return {
        ...currentSession,
        accumulatedMs: getStampElapsedMilliseconds(currentSession),
        pauseStartedAt: now,
      };
    });
    setTimerNow(now);
  }

  async function confirmStampModal() {
    const selectedNextProject =
      stampSelectionMode === "project"
        ? heroProjects.find((project) => project.id === stampProjectId)
        : null;
    const nextProjectId = selectedNextProject?.id ?? "";
    if (stampModalMode !== "stop" && stampSelectionMode === "project" && !selectedNextProject) {
      setStampError("Bitte ein Projekt auswählen.");
      return;
    }
    if ((stampModalMode === "change" || stampModalMode === "stop") && !stampComment.trim()) {
      setStampError("Bitte einen Kommentar zur abgeschlossenen Stempelung eingeben.");
      return;
    }

    if (stampModalMode === "change" || stampModalMode === "stop") {
      try {
        await closeCurrentStampSession(stampComment.trim());
      } catch (error) {
        setStampError(
          error instanceof Error ? error.message : "Stempelung konnte nicht gespeichert werden."
        );
        return;
      }
    }

    if (stampModalMode === "stop") {
      setStampSession(null);
      setIsStampModalOpen(false);
      setStampComment("");
      setStampError("");
      return;
    }

    startStampSession(stampSelectionMode, nextProjectId);
    setIsStampModalOpen(false);
    setStampComment("");
    setStampError("");
  }

  function startEditTimeEntry(entry: TimeEntryItem) {
    setEditingTimeEntryId(entry.id);
    setZeitDauer(String(entry.dauerMinuten));
    setZeitNotiz(entry.notiz);
  }

  function cancelEditTimeEntry() {
    setEditingTimeEntryId(null);
    setZeitDauer("");
    setZeitNotiz("");
  }

  async function deleteTimeEntry(entry: TimeEntryItem) {
    if (!editingTask) return;

    const reason = window.prompt("Bitte Begr\u00fcndung f\u00fcr das L\u00f6schen des Zeiteintrags angeben:");
    if (!reason?.trim()) {
      setErrorMessage("Zeiteinträge können nur mit Begründung gelöscht werden.");
      return;
    }

    const res = await fetch(`/api/tasks/${editingTask.id}/time-entries`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entryId: entry.id,
        actorId: activeUserId,
        reason,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorMessage(data?.error ?? "Zeiteintrag konnte nicht gelöscht werden.");
      return;
    }

    setEditingTask((current) => {
      if (!current) return current;

      return {
        ...current,
        gesamtzeitMinuten: current.gesamtzeitMinuten - entry.dauerMinuten,
        zeiteintraege: current.zeiteintraege.filter((timeEntry) => timeEntry.id !== entry.id),
      };
    });
    if (editingTimeEntryId === entry.id) cancelEditTimeEntry();
    await loadTasks();
    await loadNotifications(true);
  }

  async function addComment() {
    if (!editingTask || !kommentarText.trim()) return;

    const res = await fetch(`/api/tasks/${editingTask.id}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorId: activeUserId,
        text: kommentarText,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorMessage(data?.error ?? "Kommentar konnte nicht gespeichert werden.");
      return;
    }

    const comment = await res.json();
    setEditingTask((current) => {
      if (!current) return current;

      return {
        ...current,
        kommentare: [comment, ...(current.kommentare ?? [])],
      };
    });
    setKommentarText("");
    await loadTasks();
  }

  async function deleteTask(
    event: MouseEvent<HTMLButtonElement>,
    taskId: string,
    permanent = false
  ) {
    event.stopPropagation();

    const confirmed = window.confirm(
      permanent
        ? "Aufgabe endgültig aus dem Archiv löschen?"
        : "Aufgabe ins Archiv verschieben?"
    );
    if (!confirmed) return;

    const res = await fetch("/api/tasks", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: taskId, actorId: activeUserId, permanent }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorMessage(data?.error ?? "Aufgabe konnte nicht gel\u00f6scht werden.");
      return;
    }

    await loadTasks();
    await loadNotifications(true);
  }

  async function moveTaskToStatus(task: TaskItem, nextStatus: TaskStatus) {
    if (task.status === nextStatus) return;
    const completionValidationMessage = getCompletionValidationMessage(
      nextStatus,
      task.vorgabeMinuten,
      task.zeiteintraege.length
    );

    if (completionValidationMessage) {
      setErrorMessage(completionValidationMessage);
      return;
    }

    setTasks((currentTasks) =>
      currentTasks.map((currentTask) =>
        currentTask.id === task.id ? { ...currentTask, status: nextStatus } : currentTask
      )
    );

    const res = await fetch("/api/tasks", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: task.id,
        actorId: activeUserId,
        title: task.titel,
        description: task.beschreibung,
        status: nextStatus,
        priority: task.prioritaet,
        ownerId: task.zustaendigId,
        deadline: task.faelligkeit,
        customer: task.kunde,
        customerClass: task.kundenklasse || null,
        autoFeedbackEnabled: task.autoFeedbackEnabled,
        autoFeedbackRecipientId: task.autoFeedbackEnabled ? task.autoFeedbackRecipientId : null,
        recurrenceEnabled: task.recurrenceEnabled,
        recurrenceInterval: task.recurrenceEnabled ? task.recurrenceInterval : null,
        estimateMinutes: task.vorgabeMinuten,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorMessage(data?.error ?? "Status konnte nicht aktualisiert werden.");
      await loadTasks();
      return;
    }

    await loadTasks();
  }

  async function respondToTask(
    event: MouseEvent<HTMLButtonElement>,
    task: TaskItem,
    response: "accepted" | "rejected"
  ) {
    event.stopPropagation();

    const reason =
      response === "rejected"
        ? window.prompt("Bitte Begründung für die Ablehnung angeben:")
        : "";

    if (response === "rejected" && !reason?.trim()) {
      setErrorMessage("Eine Aufgabe kann nur mit Begründung abgelehnt werden.");
      return;
    }

    const res = await fetch("/api/tasks/respond", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        taskId: task.id,
        actorId: activeUserId,
        response,
        reason,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorMessage(data?.error ?? "Antwort konnte nicht gespeichert werden.");
      return;
    }

    await loadTasks();
    await loadNotifications(true);
  }

  async function restoreTask(event: MouseEvent<HTMLButtonElement>, taskId: string) {
    event.stopPropagation();

    const res = await fetch("/api/tasks", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: taskId, actorId: activeUserId, restore: true }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorMessage(data?.error ?? "Aufgabe konnte nicht wiederhergestellt werden.");
      return;
    }

    await loadTasks();
  }

  function handleKanbanDrop(nextStatus: TaskStatus) {
    if (!draggedTaskId) return;

    const task = tasks.find((currentTask) => currentTask.id === draggedTaskId);
    setDraggedTaskId(null);

    if (!task) return;
    moveTaskToStatus(task, nextStatus);
  }

  function resetUserForm() {
    setEditingUserId(null);
    setUserName("");
    setUserEmail("");
    setUserRole("MITARBEITER");
    setUserDailyWorkHours("8");
    setUserPassword("");
    setUserTeamIds([]);
    setUserAllTeams(false);
  }

  function editUser(user: UserOption) {
    setEditingUserId(user.id);
    setUserName(user.name);
    setUserEmail(user.email);
    setUserRole(user.role);
    setUserDailyWorkHours(user.dailyWorkHours.toString());
    setUserPassword("");
    setUserTeamIds(user.teamIds ?? []);
    setUserAllTeams(teams.length > 0 && user.teamIds.length === teams.length);
    setErrorMessage("");
  }

  function generateUserPassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const generatedPassword = Array.from({ length: 10 }, () =>
      alphabet[Math.floor(Math.random() * alphabet.length)]
    ).join("");

    setUserPassword(generatedPassword);
  }

  function getLoginCredentialsMessage(credentials: LoginCredentialsDraft) {
    const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/dashboard` : "";

    return [
      `Hallo ${credentials.name},`,
      "",
      "dein WorkPilot-Zugang wurde eingerichtet.",
      "",
      `Login: ${loginUrl}`,
      `E-Mail: ${credentials.email}`,
      `Passwort: ${credentials.password}`,
      "",
      "Bitte melde dich mit diesen Zugangsdaten an.",
    ].join("\n");
  }

  async function copyLoginCredentials() {
    if (!loginCredentialsDraft || typeof navigator === "undefined") return;
    await navigator.clipboard?.writeText(getLoginCredentialsMessage(loginCredentialsDraft));
  }

  function toggleUserTeam(teamId: string, checked: boolean) {
    setUserTeamIds((current) =>
      {
        const next = checked
          ? Array.from(new Set([...current, teamId]))
          : current.filter((id) => id !== teamId);

        setUserAllTeams(teams.length > 0 && next.length === teams.length);
        return next;
      }
    );
  }

  function resetTeamForm() {
    setEditingTeamId(null);
    setTeamName("");
  }

  function editTeam(team: TeamOption) {
    setEditingTeamId(team.id);
    setTeamName(team.name);
    setErrorMessage("");
  }

  function resetEscalationForm() {
    setEditingEscalationRuleId(null);
    setEscalationName("");
    setEscalationHours("24");
    setEscalationTargetRole("FUEHRUNGSKRAFT");
    setEscalationActive(true);
    setEscalationEmailEnabled(false);
    setEscalationEmailRecipients("");
  }

  function editEscalationRule(rule: EscalationRule) {
    setEditingEscalationRuleId(rule.id);
    setEscalationName(rule.name);
    setEscalationHours(rule.hoursAfterDue.toString());
    setEscalationTargetRole(rule.targetRole);
    setEscalationActive(rule.isActive);
    setEscalationEmailEnabled(rule.emailEnabled);
    setEscalationEmailRecipients(rule.emailRecipients);
    setErrorMessage("");
  }

  async function saveUser() {
    if (!userName.trim() || !userEmail.trim()) {
      setErrorMessage("Name und E-Mail sind Pflichtfelder.");
      return false;
    }

    if (!editingUserId && userPassword.trim().length < 4) {
      setErrorMessage("Bitte ein Passwort mit mindestens 4 Zeichen vergeben.");
      return false;
    }

    const res = await fetch("/api/users", {
      method: editingUserId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: editingUserId,
        name: userName,
        email: userEmail,
        role: userRole,
        password: userPassword,
        dailyWorkHours: Number(userDailyWorkHours),
        teamIds: userAllTeams ? teams.map((team) => team.id) : userTeamIds,
        allTeams: userAllTeams,
        actorId: activeUserId,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorMessage(data?.error ?? "Benutzer konnte nicht gespeichert werden.");
      return false;
    }

    const savedUser = (await res.json()) as UserOption;
    if (userPassword.trim()) {
      setLoginCredentialsDraft({
        name: savedUser.name,
        email: savedUser.email,
        password: userPassword.trim(),
      });
    }

    resetUserForm();
    await loadUsers();
    await loadTasks();
    return true;
  }

  function openEmployeeFile(user: UserOption) {
    editUser(user);
    setSelectedEmployeeId(user.id);
    setEmployeeTopTab("overview");
    setEmployeeSideTab("personal");
    setEmployeeSignature(
      `Mit freundlichen Grüxen\n\n${user.name}\n${user.roleLabel}\nOK solutions GmbH\nIm Krötenteich 3/4\n74722 Buchen`
    );
    setEmployeeSignatureHidden(false);
    setErrorMessage("");
  }

  function openCurrentEmployeeTimeTracking() {
    const user = activeUser ?? users[0];
    if (!user) return;
    editUser(user);
    setActiveTab("employees");
    setOpenSidebarMenus({ employees: true });
    setSelectedEmployeeId(user.id);
    setEmployeeTopTab("time");
    setEmployeeSideTab("personal");
    setEmployeeSignature(
      `Mit freundlichen Grüßen\n\n${user.name}\n${user.roleLabel}\nOK solutions GmbH\nIm Krötenteich 3/4\n74722 Buchen`
    );
    setEmployeeSignatureHidden(false);
    setErrorMessage("");
  }

  function openNewEmployeeFile() {
    resetUserForm();
    generateUserPassword();
    setSelectedEmployeeId("__new__");
    setEmployeeTopTab("overview");
    setEmployeeSideTab("personal");
    setEmployeeStatusView("active");
    setEmployeeSignature("Mit freundlichen Grüxen\n\n");
    setEmployeeSignatureHidden(false);
    setErrorMessage("");
  }

  async function saveEmployeeFile() {
    const saved = await saveUser();
    if (saved) {
      setSelectedEmployeeId("");
      setEmployeeTopTab("overview");
      setEmployeeSideTab("personal");
    }
  }

  async function saveTeam() {
    if (!teamName.trim()) {
      setErrorMessage("Bitte einen Teamnamen angeben.");
      return;
    }

    const res = await fetch("/api/teams", {
      method: editingTeamId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        teamId: editingTeamId,
        name: teamName,
        actorId: activeUserId,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorMessage(data?.error ?? "Team konnte nicht gespeichert werden.");
      return;
    }

    resetTeamForm();
    await loadTeams();
    await loadUsers();
  }

  async function deleteTeam(teamId: string) {
    const confirmed = window.confirm("Team wirklich löschen?");
    if (!confirmed) return;

    const res = await fetch("/api/teams", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ teamId, actorId: activeUserId }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorMessage(data?.error ?? "Team konnte nicht gelöscht werden.");
      return;
    }

    if (editingTeamId === teamId) resetTeamForm();
    await loadTeams();
    await loadUsers();
  }

  function resetTradeForm() {
    setEditingTradeId(null);
    setTradeName("");
    setTradePrefix("");
  }

  function editTrade(trade: TradeOption) {
    setEditingTradeId(trade.id);
    setTradeName(trade.name);
    setTradePrefix(trade.projectPrefix);
  }

  async function saveTrade() {
    if (!tradeName.trim()) {
      setErrorMessage("Bitte einen Gewerknamen angeben.");
      return;
    }

    const res = await fetch("/api/trades", {
      method: editingTradeId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tradeId: editingTradeId,
        name: tradeName,
        projectPrefix: normalizeProjectPrefixInput(tradePrefix),
        actorId: activeUserId,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorMessage(data?.error ?? "Gewerk konnte nicht gespeichert werden.");
      return;
    }

    resetTradeForm();
    await loadTrades();
    await loadTasks();
  }

  async function deleteTrade(tradeId: string) {
    const confirmed = window.confirm("Gewerk wirklich löschen?");
    if (!confirmed) return;

    const res = await fetch("/api/trades", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tradeId, actorId: activeUserId }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorMessage(data?.error ?? "Gewerk konnte nicht gelöscht werden.");
      return;
    }

    if (editingTradeId === tradeId) resetTradeForm();
    await loadTrades();
    await loadTasks();
  }

  async function saveEscalationRule() {
    if (!escalationName.trim()) {
      setErrorMessage("Bitte einen Namen für die Eskalationsstufe angeben.");
      return;
    }

    const res = await fetch("/api/escalation-rules", {
      method: editingEscalationRuleId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ruleId: editingEscalationRuleId,
        name: escalationName,
        hoursAfterDue: Number(escalationHours),
        targetRole: escalationTargetRole,
        isActive: escalationActive,
        emailEnabled: escalationEmailEnabled,
        emailRecipients: escalationEmailRecipients,
        actorId: activeUserId,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorMessage(data?.error ?? "Eskalationsregel konnte nicht gespeichert werden.");
      return;
    }

    resetEscalationForm();
    await loadEscalationRules();
  }

  async function deleteEscalationRule(ruleId: string) {
    const confirmed = window.confirm("Eskalationsregel wirklich löschen?");
    if (!confirmed) return;

    const res = await fetch("/api/escalation-rules", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ruleId, actorId: activeUserId }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorMessage(data?.error ?? "Eskalationsregel konnte nicht gelöscht werden.");
      return;
    }

    if (editingEscalationRuleId === ruleId) resetEscalationForm();
    await loadEscalationRules();
  }

  async function deleteUser(userId: string) {
    const confirmed = window.confirm("Benutzer wirklich entfernen?");
    if (!confirmed) return;

    const res = await fetch("/api/users", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, actorId: activeUserId }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorMessage(data?.error ?? "Benutzer konnte nicht entfernt werden.");
      return;
    }

    if (editingUserId === userId) resetUserForm();
    await loadUsers();
    await loadTasks();
  }

  const holidayDateKeys = new Set(holidays.map((holiday) => holiday.date));
  const activeTasks = tasks.filter((task) => task.status !== "archiviert");
  const archivedTasks = tasks.filter((task) => task.status === "archiviert");
  const offene = activeTasks.filter((task) => task.status === "offen").length;
  const bearbeitung = activeTasks.filter((task) => task.status === "in Bearbeitung").length;
  const erledigt = activeTasks.filter((task) => task.status === "erledigt").length;
  const ueberfaellig = activeTasks.filter(
    (task) => isTaskOverdueByWorkingTime(task, deadlineProgressTime, holidayDateKeys)
  ).length;
  const mayManageUsers = canManageUsers(activeUser?.role);
  const mayFilterPlanningUsers = canAssignOther(activeUser?.role);
  const effectivePlanningOwnerFilter = mayFilterPlanningUsers
    ? planningOwnerFilter || ""
    : activeUserId;
  const customerOptions = Array.from(
    new Set([
      ...heroProjects.map((project) => project.customer).filter(Boolean),
      ...activeTasks.map((task) => task.kunde).filter(Boolean),
    ])
  ).sort((first, second) => first.localeCompare(second, "de"));
  const filteredHeroProjects = kunde
    ? heroProjects.filter((project) => project.customer === kunde)
    : [];
  const selectedHeroDetail = heroProjects.find((project) => project.id === selectedHeroDetailId);
  const selectedProjectFile =
    heroProjects.find((project) => project.id === selectedProjectFileId) ?? null;
  const activeProjectPipeline =
    projectPipelines.find((pipeline) => pipeline.tab === activeTab) ?? projectPipelines[0];
  const activePipelineProjects = heroProjects.filter((project) => {
    const projectType = (project.projectType ?? "").toLowerCase();
    const projectNumber = (project.projectNumber ?? "").toLowerCase();

    if (activeProjectPipeline.id === "immocare") {
      return projectType.includes("immocare") || projectNumber.startsWith("oki");
    }

    return (
      projectType.includes("solutions") ||
      projectNumber.startsWith("oks") ||
      (!projectType.includes("immocare") && !projectNumber.startsWith("oki"))
    );
  });
  const projectKindRows: Array<{
    key: ProjectDraft["projectKind"];
    label: string;
    count: number;
  }> = [
    {
      key: "Dauerläufer-Projekt",
      label: "Dauerläufer-Projekte",
      count: activePipelineProjects.filter(
        (project) => getProjectKind(project) === "Dauerläufer-Projekt"
      ).length,
    },
    {
      key: "einmaliges Projekt",
      label: "Einmalige-Projekte",
      count: activePipelineProjects.filter(
        (project) => getProjectKind(project) === "einmaliges Projekt"
      ).length,
    },
  ];
  const visibleHeroProjects = activePipelineProjects.filter((project) => {
    if (selectedProjectKindFilter && getProjectKind(project) !== selectedProjectKindFilter) {
      return false;
    }

    if (
      selectedProjectPipelineStatus !== "Alle Offenen" &&
      project.status !== selectedProjectPipelineStatus
    ) {
      return false;
    }

    const search = heroSearchTerm.trim().toLowerCase();
    if (!search) return true;

    return (
      project.projectNumber.toLowerCase().includes(search) ||
      project.title.toLowerCase().includes(search) ||
      project.customer.toLowerCase().includes(search) ||
      project.status.toLowerCase().includes(search) ||
      project.description.toLowerCase().includes(search) ||
      getProjectKind(project).toLowerCase().includes(search)
    );
  });
  const getPipelineStatusCount = (statusLabel: string) => {
    const projectsForKind = selectedProjectKindFilter
      ? activePipelineProjects.filter(
          (project) => getProjectKind(project) === selectedProjectKindFilter
        )
      : activePipelineProjects;

    if (statusLabel === "Alle Offenen") {
      return projectsForKind.length;
    }

    return projectsForKind.filter((project) => project.status === statusLabel).length;
  };
  const activePipelineStatus =
    activeProjectPipeline.statuses.find(
      (statusItem) => statusItem.label === selectedProjectPipelineStatus
    ) ?? activeProjectPipeline.statuses[1];
  const projectPipelineTitle =
    selectedProjectKindFilter === "Dauerläufer-Projekt"
      ? `Dauerläufer-Projekte ${activeProjectPipeline.company}`
      : selectedProjectKindFilter === "einmaliges Projekt"
        ? `Einmalige-Projekte ${activeProjectPipeline.company}`
        : activeProjectPipeline.label;
  const projectPipelineSubline =
    selectedProjectKindFilter === "Dauerläufer-Projekt"
      ? "Hier werden Projekte mit längerer Laufzeit gemanagt"
      : selectedProjectKindFilter === "einmaliges Projekt"
        ? "Hier werden einmalige Projekte gemanagt"
        : `Getrennte Pipeline für ${activeProjectPipeline.company} mit eigenen Status.`;

  async function updateSelectedProjectStatus(nextStatus: string) {
    if (!selectedProjectFileId) return;

    const currentProject = heroProjects.find((project) => project.id === selectedProjectFileId);
    if (!currentProject) return;

    const updatedProject = { ...currentProject, status: nextStatus };
    try {
      await persistProject(updatedProject);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Projektstatus konnte nicht gespeichert werden.");
      return;
    }

    setHeroProjects((currentProjects) =>
      currentProjects.map((project) =>
        project.id === selectedProjectFileId ? { ...project, status: nextStatus } : project
      )
    );
    setSelectedProjectPipelineStatus(nextStatus);
    setSelectedHeroDetailId(selectedProjectFileId);
    setIsProjectStatusMenuOpen(false);
  }

  function openProjectTaskModal(project: HeroProjectPreview, mode: "task" | "appointment") {
    const plannedDate = project.projectRuntimeFrom || formatDateKey(new Date());
    const defaultDeadline = `${plannedDate}T12:00`;

    setIsQuickCreateOpen(false);
    setEditingTask(null);
    setErrorMessage("");
    resetForm();
    setTitel(mode === "appointment" ? `Termin: ${project.title}` : project.title);
    setBeschreibung(
      [
        `${project.projectNumber || project.id} | ${project.title}`,
        project.description,
        project.address ? `Projektanschrift: ${project.address}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
    setKunde(project.customer || "");
    setSelectedHeroProjectId(project.id);
    setFaelligkeit(defaultDeadline);

    if (mode === "appointment") {
      setActiveTab("planningBoard");
      setVorgabeMinuten("60");
      setPlanningEnabled(true);
      setPlanningAllocations([{ date: plannedDate, minutes: 60 }]);
    }

    if (!hasLoadedHeroProjects) void loadHeroProjects();
    setIsModalOpen(true);
    setSelectedCalendarActionDate("");
  }

  function openProjectPlanningBoard() {
    setSelectedProjectFileId("");
    setProjectFileTab("logbook");
    setPlanningOwnerFilter(activeUserId || "");
    setActiveTab("planningBoard");
  }

  function printProjectOverview(project: HeroProjectPreview, address: string) {
    const printWindow = window.open("", "_blank", "width=900,height=700");

    if (!printWindow) {
      setErrorMessage("Projektübersicht konnte nicht geöffnet werden.");
      return;
    }

    const fields = [
      ["Projektnummer", project.projectNumber || project.id],
      ["Projektname", project.title],
      ["Kunde", project.customer || "-"],
      ["Projektverantwortlicher", project.responsibleName || activeUser?.name || "-"],
      ["Projektanschrift", address || "-"],
      ["Projektstatus", project.status || "-"],
      ["Projektstart", project.projectRuntimeFrom || "-"],
      ["Projektlaufzeit bis", project.projectRuntimeUntil || "-"],
      ["Fakturierungsintervall", project.billingInterval || "-"],
      ["Gewerk", project.trade || "-"],
      ["Niederlassung", project.branch || "-"],
      ["Quelle", project.source || "-"],
      ["Projektvolumen", project.volume || "-"],
      ["Projektzeitkontingent", project.timeBudgetHours || "-"],
      ["Erstellungsdatum", project.createdAt || "-"],
    ];

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Projektübersicht ${project.projectNumber || project.id}</title>
          <style>
            body { color: #0f172a; font-family: Arial, sans-serif; margin: 32px; }
            h1 { font-size: 24px; margin: 0 0 6px; }
            p { color: #475569; margin: 0 0 24px; }
            dl { display: grid; grid-template-columns: 210px 1fr; gap: 0; max-width: 760px; }
            dt, dd { border-bottom: 1px solid #d8e0ea; margin: 0; padding: 9px 0; }
            dt { font-weight: 700; }
            dd { color: #005fff; font-weight: 650; overflow-wrap: anywhere; }
          </style>
        </head>
        <body>
          <h1>${project.projectNumber || project.id} | ${project.title}</h1>
          <p>${project.customer || "Kunde noch nicht gesetzt"}</p>
          <dl>
            ${fields
              .map(
                ([label, value]) =>
                  `<dt>${label}</dt><dd>${String(value)
                    .replaceAll("&", "&amp;")
                    .replaceAll("<", "&lt;")
                    .replaceAll(">", "&gt;")}</dd>`
              )
              .join("")}
          </dl>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  const selectedProjectContact = contacts.find((contact) => contact.id === projectDraft.contactId);
  const selectedProjectCompany =
    selectedProjectContact && selectedProjectContact.type === "company"
      ? selectedProjectContact
      : selectedProjectContact
        ? getCustomerFileTarget(selectedProjectContact)
        : null;
  const projectContactPersons = selectedProjectCompany
    ? contacts
        .filter(
          (contact) =>
            contact.category === "Ansprechpartner" &&
            (contact.parentCompanyId === selectedProjectCompany.id ||
              (selectedProjectCompany.companyName &&
                contact.parentCompanyName === selectedProjectCompany.companyName))
        )
        .sort((first, second) => {
          if (first.isMainContact && !second.isMainContact) return -1;
          if (!first.isMainContact && second.isMainContact) return 1;
          return getContactDisplayName(first).localeCompare(getContactDisplayName(second), "de");
        })
    : [];
  const projectAddressOptions = selectedProjectCompany
    ? [
        selectedProjectCompany,
        ...contacts.filter(
          (contact) =>
            contact.id !== selectedProjectCompany.id &&
            (contact.parentCompanyId === selectedProjectCompany.id ||
              (selectedProjectCompany.companyName &&
                contact.parentCompanyName === selectedProjectCompany.companyName))
        ),
      ]
    : [];
  const projectContactPickerOptions = contacts
    .filter((contact) => contact.category !== "Ansprechpartner")
    .filter((contact) => {
      const search = projectContactPickerSearch.trim().toLowerCase();
      if (!search) return true;

      return [
        getContactLabel(contact),
        getContactAddressLine(contact),
        contact.customerNumber,
        contact.email,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search));
    })
    .slice(0, 8);
  const normalizeStampSearchValue = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const openStampProjects = heroProjects.filter(
    (project) => project.status !== "Abgeschlossen" && project.status !== "Archiviert"
  );
  const stampProjectSearchTerm = normalizeStampSearchValue(stampProjectSearch.trim());
  const stampProjectOptions = openStampProjects
    .filter((project) => {
      if (!stampProjectSearchTerm) return true;
      return [
        project.projectNumber,
        project.title,
        project.customer,
      ]
        .filter(Boolean)
        .some((value) => normalizeStampSearchValue(value).includes(stampProjectSearchTerm));
    })
    .slice(0, 10);
  const selectedStampProject = heroProjects.find((project) => project.id === stampProjectId);
  const todayStampDate = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(timerNow));
  const completedTodayStampMilliseconds = stampEntries
    .filter((entry) => {
      if (entry.date !== todayStampDate) return false;
      if (!activeUser?.name) return true;
      return entry.employee === activeUser.name;
    })
    .reduce((sum, entry) => sum + entry.durationMs, 0);
  const modalCompletionHint = getCompletionValidationMessage(
    status,
    vorgabeMinuten ? Number(vorgabeMinuten) : null,
    editingTask?.zeiteintraege.length ?? 0
  );
  const kanbanStatuses: TaskStatus[] = [
    "offen",
    "in Bearbeitung",
    "wartet auf R\u00fcckmeldung",
    "erledigt",
    "\u00fcberf\u00e4llig",
  ];
  const kanbanTasks = kanbanOwnerFilter
    ? activeTasks.filter((task) => task.zustaendigId === kanbanOwnerFilter)
    : activeTasks;
  const calendarDays = getMonthDays(calendarDate);
  const calendarVisibleDateKeys = new Set(
    calendarDays.filter((day): day is Date => Boolean(day)).map(formatDateKey)
  );
  const weekDays = getWeekDays(calendarDate);
  const weekVisibleDateKeys = new Set(weekDays.map(formatDateKey));
  const getTaskPlanningEntries = (task: TaskItem) =>
    task.planningAllocations.length > 0
      ? task.planningAllocations
      : [
          {
            date: task.faelligkeit.slice(0, 10),
            minutes: task.vorgabeMinuten ?? 0,
          },
        ];
  const getTaskPlannedMinutesForDate = (task: TaskItem, dateKey: string) =>
    getTaskPlanningEntries(task)
      .filter((allocation) => allocation.date === dateKey)
      .reduce((total, allocation) => total + allocation.minutes, 0);
  const planningTasks = activeTasks.filter(
    (task) =>
      task.status !== "erledigt" &&
      (!effectivePlanningOwnerFilter || task.zustaendigId === effectivePlanningOwnerFilter)
  );
  const tasksByDate = planningTasks.reduce<Record<string, TaskItem[]>>((groupedTasks, task) => {
    if (!task.faelligkeit) return groupedTasks;

    getTaskPlanningEntries(task).forEach((allocation) => {
      groupedTasks[allocation.date] = [...(groupedTasks[allocation.date] ?? []), task];
    });
    return groupedTasks;
  }, {});
  const planningAbsences = absences.filter(
    (absence) => !effectivePlanningOwnerFilter || absence.userId === effectivePlanningOwnerFilter
  );
  const absencesByDate = planningAbsences.reduce<Record<string, AbsenceItem[]>>(
    (groupedAbsences, absence) => {
      groupedAbsences[absence.date] = [...(groupedAbsences[absence.date] ?? []), absence];
      return groupedAbsences;
    },
    {}
  );
  const holidaysByDate = holidays.reduce<Record<string, HolidayItem>>((groupedHolidays, holiday) => {
    groupedHolidays[holiday.date] = holiday;
    return groupedHolidays;
  }, {});
  const getHolidayForDateKey = (dateKey: string) => holidaysByDate[dateKey];
  const isWeekendDateKey = (dateKey: string) => {
    const day = new Date(`${dateKey}T12:00`).getDay();
    return day === 0 || day === 6;
  };
  const planningBoardDays = Array.from({ length: 29 }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + index);
    return date;
  });
  const planningDetailGroups = planningBoardSections.flatMap((section) => section.detailGroups);
  const selectedPlanningGroupEmployees =
    planningDetailGroups.find((group) => group.name === selectedPlanningGroup)?.employees ??
    planningDetailGroups[0]?.employees ??
    [];
  const selectedPlanningDate = new Date(`${selectedPlanningDateKey}T12:00`);
  const selectedPlanningHoliday = getHolidayForDateKey(selectedPlanningDateKey);
  const selectedPlanningIsWeekend = isWeekendDateKey(selectedPlanningDateKey);
  const getPlanningGroupLoad = (groupName: string, dateKey: string, dayIndex: number) => {
    if (isWeekendDateKey(dateKey)) return 0;
    if (getHolidayForDateKey(dateKey)) return 0;

    const values = [98, 96, 98, 97, 93, 99, 96, 95, 97];
    return values[(dayIndex + groupName.length) % values.length];
  };
  const getPlanningBoardLoad = (
    section: (typeof planningBoardSections)[number],
    groupName: string,
    dateKey: string,
    dayIndex: number
  ) => {
    if (groupName !== "Gesamt") return getPlanningGroupLoad(groupName, dateKey, dayIndex);

    const groupLoads = section.detailGroups.map((group) =>
      getPlanningGroupLoad(group.name, dateKey, dayIndex)
    );
    if (groupLoads.length === 0) return 0;

    return Math.round(groupLoads.reduce((total, load) => total + load, 0) / groupLoads.length);
  };
  const getPlanningSlotIndex = (time: string) => {
    const hour = Number(time.slice(0, 2));
    const minute = Number(time.slice(3, 5));
    return Math.max(0, Math.min(planningSlotColumnCount, (hour - 6) * 4 + minute / 15));
  };
  const getPlanningAssignmentsForEmployee = (employeeName: string) => {
    const normalizedEmployee = normalizeStampSearchValue(employeeName);
    const isFirstEmployee = normalizedEmployee.length % 2 === 0;

    if (selectedPlanningIsWeekend || selectedPlanningHoliday) return [];

    const assignments = isFirstEmployee
      ? [
          { label: "Projekt ASS-388", start: "07:00", end: "10:00" },
          { label: "Pause", start: "12:00", end: "12:30" },
          { label: "Projekt HR-129", start: "13:00", end: "16:00" },
        ]
      : [
          { label: "Projekt MKG-136", start: "09:00", end: "12:00" },
          { label: "Pause", start: "12:00", end: "12:30" },
          { label: "Projekt WID-166", start: "14:00", end: "17:00" },
        ];

    return assignments.map((assignment) => ({
      ...assignment,
      startColumn: getPlanningSlotIndex(assignment.start) + 1,
      endColumn: getPlanningSlotIndex(assignment.end) + 1,
    }));
  };
  const getUserAbsenceForDay = (userId: string, date: Date) =>
    absences.find((absence) => absence.userId === userId && absence.date === formatDateKey(date));
  const getUserAbsenceForDateKey = (userId: string, dateKey: string) =>
    absences.find((absence) => absence.userId === userId && absence.date === dateKey);
  const getUserAbsentUntil = (userId: string, dateKey: string) => {
    const userAbsenceDates = absences
      .filter((absence) => absence.userId === userId)
      .map((absence) => absence.date)
      .sort((first, second) => first.localeCompare(second));

    if (!userAbsenceDates.includes(dateKey)) return "";

    let until = dateKey;
    while (userAbsenceDates.includes(addDaysToDateKey(until, 1))) {
      until = addDaysToDateKey(until, 1);
    }

    return until;
  };
  const absenceLabel = (type: AbsenceItem["type"]) => (type === "urlaub" ? "Urlaub" : "Krank");
  const getAbsenceGroupKey = (absence: AbsenceItem) =>
    [
      absence.userId,
      absence.type,
      absence.representativeUserId ?? "",
      absence.note ?? "",
    ].join("|");
  const getMatchingAbsenceForDate = (groupKey: string, dateKey: string) =>
    (absencesByDate[dateKey] ?? []).find(
      (absence) => getAbsenceGroupKey(absence) === groupKey
    );
  const getAbsenceBarSpan = (absence: AbsenceItem, dateKey: string, maxDaysInRow: number) => {
    const groupKey = getAbsenceGroupKey(absence);
    let span = 1;

    while (
      span < maxDaysInRow &&
      Boolean(getMatchingAbsenceForDate(groupKey, addDaysToDateKey(dateKey, span)))
    ) {
      span += 1;
    }

    return span;
  };
  const selectedDayTasks = tasksByDate[formatDateKey(calendarDate)] ?? [];
  const selectedDayAbsences = absencesByDate[formatDateKey(calendarDate)] ?? [];
  const filteredTasks = activeTasks.filter((task) => {
    const search = searchTerm.trim().toLowerCase();
    const taskNumber = getTaskNumber(task.id, tasks).toLowerCase();
    const matchesSearch =
      !search ||
      taskNumber.includes(search) ||
      task.titel.toLowerCase().includes(search) ||
      task.beschreibung.toLowerCase().includes(search) ||
      task.kunde.toLowerCase().includes(search) ||
      task.zustaendig.toLowerCase().includes(search);
    const matchesDeadlineFilter =
      !deadlineFilter ||
      (deadlineFilter === "due"
        ? isTaskOverdueByWorkingTime(task, deadlineProgressTime, holidayDateKeys)
        : getDeadlineProgressState(task, deadlineProgressTime, holidayDateKeys) === deadlineFilter);

    return (
      matchesSearch &&
      (!statusFilter || task.status === statusFilter) &&
      matchesDeadlineFilter &&
      (!priorityFilter || task.prioritaet === priorityFilter) &&
      (!customerFilter || task.kunde === customerFilter) &&
      (!ownerFilter || task.zustaendigId === ownerFilter)
    );
  }).sort((first, second) => {
    const firstNumber = getTaskNumberValue(first.id, tasks);
    const secondNumber = getTaskNumberValue(second.id, tasks);
    return taskNumberSort === "asc" ? firstNumber - secondNumber : secondNumber - firstNumber;
  });
  const reportDays = Array.from({ length: 10 }, (_, index) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + index);
    return day;
  });
  const productivityDays = getProductivityPeriodDays(productivityPeriod);
  const reportTasks = activeTasks.filter(
    (task) => task.status !== "erledigt" && task.status !== "abgelehnt"
  );
  const getUserUtilizationForDay = (userId: string, date: Date) => {
    const user = users.find((currentUser) => currentUser.id === userId);
    const dateKey = formatDateKey(date);
    const absence = getUserAbsenceForDay(userId, date);
    const holiday = getHolidayForDateKey(dateKey);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const capacityMinutes = absence || holiday || isWeekend ? 0 : (user?.dailyWorkHours ?? 8) * 60;
    const plannedMinutes = reportTasks
      .filter((task) => task.zustaendigId === userId)
      .reduce((total, task) => total + getTaskPlannedMinutesForDate(task, dateKey), 0);
    const utilization = capacityMinutes > 0 ? Math.round((plannedMinutes / capacityMinutes) * 100) : 0;

    return {
      capacityMinutes,
      plannedMinutes,
      utilization,
      absence,
      holiday,
    };
  };
  const todayUtilization = activeUserId
    ? getUserUtilizationForDay(activeUserId, reportDays[0])
    : { capacityMinutes: 0, plannedMinutes: 0, utilization: 0, absence: undefined, holiday: undefined };
  const openInvoiceCount = Math.max(1, activeTasks.filter((task) => task.status === "erledigt").length);
  const projectTradeSelectOptions = trades.length > 0 ? trades.map((trade) => trade.name) : projectTradeOptions;
  const monthlyTrackedMinutes = activeTasks.reduce(
    (total, task) => total + task.gesamtzeitMinuten,
    0
  );
  const globalSearchResults = useMemo(() => {
    const query = globalSearchTerm.trim().toLowerCase();
    if (!query) return [];

    const matchesQuery = (values: Array<string | number | null | undefined>) =>
      values
        .filter((value) => value !== null && value !== undefined)
        .join(" ")
        .toLowerCase()
        .includes(query);
    const results: GlobalSearchResult[] = [];

    heroProjects.forEach((project) => {
      const projectContact =
        contacts.find((contact) => contact.id === project.contactId) ||
        contacts.find((contact) => contact.id === project.contactPersonId) ||
        contacts.find((contact) => contact.id === project.addressContactId);
      const projectContactLabel = projectContact ? getContactLabel(projectContact) : "";
      if (
        !matchesQuery([
          project.projectNumber,
          project.title,
          project.customer,
          projectContactLabel,
          projectContact?.customerNumber,
          projectContact?.email,
          projectContact?.phone,
          projectContact?.mobile,
          projectContact?.city,
          project.status,
          project.trade,
          project.address,
          project.description,
        ])
      ) {
        return;
      }

      results.push({
        id: `project-${project.id}`,
        category: "Projekt",
        title: `${project.projectNumber || project.id} | ${project.title}`,
        subtitle: [project.customer || projectContactLabel, project.status].filter(Boolean).join(" - "),
        detail: [project.trade, project.address].filter(Boolean).join(" - "),
        target: { kind: "project", id: project.id },
      });
    });

    contacts.forEach((contact) => {
      if (
        !matchesQuery([
          contact.customerNumber,
          contact.companyName,
          contact.firstName,
          contact.lastName,
          contact.email,
          contact.phone,
          contact.mobile,
          contact.city,
          contact.street,
          contact.category,
        ])
      ) {
        return;
      }

      results.push({
        id: `contact-${contact.id}`,
        category: "Kontakt",
        title: getContactLabel(contact),
        subtitle: [contact.customerNumber, contact.category].filter(Boolean).join(" - "),
        detail: [contact.email, contact.phone || contact.mobile, contact.city].filter(Boolean).join(" - "),
        target: { kind: "contact", id: contact.id },
      });
    });

    activeTasks.forEach((task) => {
      const taskNumber = getTaskNumber(task.id, tasks);
      if (
        !matchesQuery([
          taskNumber,
          task.titel,
          task.beschreibung,
          task.kunde,
          task.zustaendig,
          task.status,
          task.prioritaet,
        ])
      ) {
        return;
      }

      results.push({
        id: `task-${task.id}`,
        category: "Aufgabe",
        title: `${taskNumber} | ${task.titel}`,
        subtitle: [task.kunde, task.status].filter(Boolean).join(" - "),
        detail: [task.zustaendig, formatDeadline(task.faelligkeit)].filter(Boolean).join(" - "),
        target: { kind: "task", id: task.id },
      });
    });

    documentTypes
      .filter((documentType) => !documentType.isArchived)
      .forEach((documentType) => {
        if (
          !matchesQuery([
            documentType.name,
            documentType.baseType,
            documentType.folder,
            documentType.status,
          ])
        ) {
          return;
        }

        results.push({
          id: `document-type-${documentType.id}`,
          category: documentType.folder === "Rechnungen" ? "Rechnung" : "Dokument",
          title: documentType.name,
          subtitle: [documentType.folder, documentType.status].filter(Boolean).join(" - "),
          detail: documentType.baseType,
          target: { kind: "documentType", id: documentType.id },
        });
      });

    documentTexts.forEach((documentText) => {
      if (!matchesQuery([documentText.title, documentText.body, documentText.source])) return;

      results.push({
        id: `document-text-${documentText.id}`,
        category: documentText.kind === "title" ? "Titel" : "Text",
        title: documentText.title,
        subtitle: documentText.source,
        detail: documentText.body.replace(/\s+/g, " ").slice(0, 90),
        target: { kind: "documentText", id: documentText.id },
      });
    });

    const categoryOrder: Record<string, number> = {
      Projekt: 0,
      Aufgabe: 1,
      Kontakt: 2,
      Rechnung: 3,
      Dokument: 4,
      Text: 5,
      Titel: 6,
    };

    return results
      .sort((first, second) => {
        const firstOrder = categoryOrder[first.category] ?? 99;
        const secondOrder = categoryOrder[second.category] ?? 99;

        if (firstOrder !== secondOrder) return firstOrder - secondOrder;
        return first.title.localeCompare(second.title, "de");
      })
      .slice(0, 12);
  }, [activeTasks, contacts, documentTexts, documentTypes, globalSearchTerm, heroProjects, tasks]);
  const contactColumns: ContactColumn[] = [
    {
      id: "type",
      label: "Typ",
      filterType: "select",
      options: ["Person", "Firma"],
      value: (contact) => (contact.type === "company" ? "Firma" : "Person"),
      render: (contact) => (
        <span className={styles.contactTypeBadge}>{contact.type === "company" ? "Firma" : "Person"}</span>
      ),
    },
    { id: "customerNumber", label: "Kundennummer", value: (contact) => contact.customerNumber },
    {
      id: "companyName",
      label: "Firmenname",
      value: (contact) => contact.companyName || contact.parentCompanyName,
      render: (contact) =>
        renderContactFileLink(contact, contact.companyName || contact.parentCompanyName),
    },
    { id: "salutation", label: "Anrede", value: (contact) => contact.salutation },
    {
      id: "additionalSalutation",
      label: "Weitere Anrede",
      value: (contact) => contact.additionalSalutation,
    },
    {
      id: "firstName",
      label: "Vorname",
      value: (contact) => contact.firstName,
      render: (contact) => renderContactFileLink(contact, contact.firstName),
    },
    {
      id: "lastName",
      label: "Nachname",
      value: (contact) => contact.lastName,
      render: (contact) => renderContactFileLink(contact, contact.lastName),
    },
    { id: "email", label: "E-Mail", value: (contact) => contact.email },
    {
      id: "category",
      label: "Kategorie",
      filterType: "select",
      options: ["Kunde", "Lieferant", "Partner", "Ansprechpartner"],
      value: (contact) => contact.category,
    },
    {
      id: "location",
      label: "Ort",
      value: (contact) =>
        [contact.street, contact.postalCode, contact.city].filter(Boolean).join(" "),
      render: (contact) => (
        <>
          {[contact.postalCode, contact.city].filter(Boolean).join(" ") || "-"}
          {contact.street && <span className={styles.metaLine}>{contact.street}</span>}
        </>
      ),
    },
    { id: "phone", label: "Telefon", value: (contact) => contact.phone },
    { id: "mobile", label: "Mobil", value: (contact) => contact.mobile },
    {
      id: "createdAt",
      label: "Erstellungsdatum",
      value: (contact) => formatDeadline(contact.createdAt),
    },
    { id: "birthDate", label: "Geburtsdatum", value: () => "" },
    { id: "fax", label: "Fax", value: (contact) => contact.fax },
    { id: "website", label: "Website", value: (contact) => contact.website },
    { id: "source", label: "Quelle", value: (contact) => contact.source },
    { id: "reachability", label: "Erreichbarkeit", value: (contact) => contact.reachability },
    {
      id: "paymentTermDays",
      label: "Zahlungsziel",
      value: (contact) => (contact.paymentTermDays === null ? "" : `${contact.paymentTermDays}`),
    },
    {
      id: "discountPercent",
      label: "Skonto",
      value: (contact) => (contact.discountPercent === null ? "" : `${contact.discountPercent}`),
    },
    {
      id: "discountTermDays",
      label: "Skontoziel",
      value: (contact) => (contact.discountTermDays === null ? "" : `${contact.discountTermDays}`),
    },
    { id: "priceGroup", label: "VK-Gruppe", value: (contact) => contact.priceGroup },
    { id: "leitwegId", label: "Leitweg-ID", value: (contact) => contact.leitwegId },
  ];
  const visibleContactColumns = contactColumns.filter((column) =>
    visibleContactColumnIds.includes(column.id)
  );
  const searchedContactColumns = contactColumns.filter((column) =>
    column.label.toLowerCase().includes(contactColumnSearch.trim().toLowerCase())
  );
  const visibleContacts = contacts.filter((contact) => {
    const search = contactSearchTerm.trim().toLowerCase();
    const matchesCategory = !contactCategoryFilter || contact.category === contactCategoryFilter;
    const matchesSearch =
      !search ||
      contactColumns
        .map((column) => column.value(contact))
        .some((value) => value.toLowerCase().includes(search));
    const matchesColumnFilters = contactColumns.every((column) => {
      const filterValue = contactColumnFilters[column.id]?.trim().toLowerCase();
      if (!filterValue) return true;

      return column.value(contact).toLowerCase().includes(filterValue);
    });

    return matchesCategory && matchesSearch && matchesColumnFilters;
  });
  const contactPageCount = Math.max(1, Math.ceil(visibleContacts.length / contactPageSize));
  const activeContactPage = Math.min(contactPage, contactPageCount);
  const paginatedContacts = visibleContacts.slice(
    (activeContactPage - 1) * contactPageSize,
    activeContactPage * contactPageSize
  );
  const contactBulkCount = selectedContactIds.length || visibleContacts.length;
  const contactCategoryCounts = contacts.reduce<Record<string, number>>((counts, contact) => {
    counts[contact.category] = (counts[contact.category] ?? 0) + 1;
    return counts;
  }, {});
  const selectedCustomerFile =
    contacts.find((contact) => contact.id === selectedCustomerFileId) ?? null;
  const customerFileContacts = selectedCustomerFile
    ? contacts
        .filter(
          (contact) =>
            contact.type === "person" &&
            (contact.parentCompanyId === selectedCustomerFile.id ||
              (selectedCustomerFile.companyName &&
                contact.parentCompanyName === selectedCustomerFile.companyName))
        )
        .sort((first, second) => {
          if (first.isMainContact && !second.isMainContact) return -1;
          if (!first.isMainContact && second.isMainContact) return 1;
          return getContactDisplayName(first).localeCompare(getContactDisplayName(second), "de");
        })
    : [];
  const overviewModules: Array<{
    tab: AppTab;
    kicker: string;
    title: string;
    value: string;
    body: string;
    action: string;
    tone: "blue" | "teal" | "amber" | "rose" | "slate";
  }> = [
    {
      tab: "projectsSolutions",
      kicker: "Projekte",
      title: "Projektpipeline",
      value: `${projectPipelines.reduce((total, pipeline) => total + pipeline.total, 0)}`,
      body: `Zwei getrennte Pipelines für OK solutions und OK immocare mit eigenen Status.`,
      action: "Projekte anzeigen",
      tone: "blue",
    },
    {
      tab: "contacts",
      kicker: "CRM",
      title: "Kontakte",
      value: `${contacts.length || customerOptions.length}`,
      body: "Kunden, Ansprechpartner und Adressen werden hier als nächstes zentral ausgebaut.",
      action: "Kontakte öffnen",
      tone: "teal",
    },
    {
      tab: "documents",
      kicker: "Dokumente",
      title: "Angebote & Rechnungen",
      value: `${openInvoiceCount}`,
      body: "Angebote, Auftragsbestätigungen, Rechnungen und Projektdateien bekommen ein eigenes Modul.",
      action: "Dokumente öffnen",
      tone: "amber",
    },
    {
      tab: "dashboard",
      kicker: "Aufgaben",
      title: "Tagesarbeit",
      value: `${offene}`,
      body: `${bearbeitung} Aufgaben laufen, ${erledigt} sind erledigt und ${ueberfaellig} brauchen Aufmerksamkeit.`,
      action: "Aufgaben anzeigen",
      tone: "rose",
    },
    {
      tab: "calendar",
      kicker: "Planung",
      title: "Einsatzplanung",
      value: `${todayUtilization.utilization}%`,
      body: `${formatMinutes(todayUtilization.plannedMinutes)} heute geplant von ${formatMinutes(todayUtilization.capacityMinutes)} verfügbar.`,
      action: "Plantafel öffnen",
      tone: "blue",
    },
    {
      tab: "accounting",
      kicker: "Buchhaltung",
      title: "Offene Posten",
      value: `${openInvoiceCount}`,
      body: "Rechnungen, Zahlungseingänge, Mahnwesen und Auswertungen werden hier gebündelt.",
      action: "Buchhaltung öffnen",
      tone: "slate",
    },
    {
      tab: "employees",
      kicker: "Team",
      title: "Mitarbeiter",
      value: `${users.length}`,
      body: `${absences.length} Abwesenheiten und ${formatMinutes(monthlyTrackedMinutes)} erfasste Arbeitszeit.`,
      action: "Mitarbeiter anzeigen",
      tone: "teal",
    },
  ];
  const plannedModuleLabels: Partial<Record<AppTab, string>> = {
    contacts: "Kontakte und CRM",
    documents: "Dokumente",
    orders: "Aufträge",
    accounting: "Buchhaltung",
    personalData: "Persönliche Daten",
    employees: "Mitarbeiter",
    absenceRequests: "Abwesenheitsanträge",
    timeTracking: "Zeiterfassung",
    timeCategories: "Zeitkategorien",
    breakManagement: "Pausenverwaltung",
  };
  const visibleReportUsers = users.filter((user) => {
    if (!activeUser) return false;
    if (activeUser.role === "ADMIN" || activeUser.role === "GESCHAEFTSFUEHRER") return true;
    if (activeUser.role === "FUEHRUNGSKRAFT") {
      const activeTeamIds = activeUser.teamIds.length > 0 ? activeUser.teamIds : [activeUser.teamId].filter(Boolean);
      return (
        user.id === activeUser.id ||
        user.teamIds.some((teamId) => activeTeamIds.includes(teamId)) ||
        (user.teamId ? activeTeamIds.includes(user.teamId) : false)
      );
    }

    return user.id === activeUser.id;
  });
  const unproductiveRows = visibleReportUsers.map((user) => {
    const days = productivityDays.map((day) => {
      const utilization = getUserUtilizationForDay(user.id, day);
      const productiveMinutes = utilization.plannedMinutes;
      const unproductiveMinutes = Math.max(0, utilization.capacityMinutes - utilization.plannedMinutes);
      const overbookedMinutes =
        utilization.capacityMinutes > 0
          ? Math.max(0, utilization.plannedMinutes - utilization.capacityMinutes)
          : 0;

      return {
        date: day,
        utilization,
        productiveMinutes,
        unproductiveMinutes,
        overbookedMinutes,
      };
    });
    const capacityMinutes = days.reduce((total, day) => total + day.utilization.capacityMinutes, 0);
    const plannedMinutes = days.reduce((total, day) => total + day.utilization.plannedMinutes, 0);
    const productiveMinutes = plannedMinutes;
    const unproductiveMinutes = Math.max(0, capacityMinutes - productiveMinutes);
    const overbookedMinutes = Math.max(0, productiveMinutes - capacityMinutes);
    const unproductivePercent = getPercent(unproductiveMinutes, capacityMinutes);
    const productivePercent = getPercent(productiveMinutes, capacityMinutes);

    return {
      user,
      days,
      capacityMinutes,
      plannedMinutes,
      productiveMinutes,
      unproductiveMinutes,
      overbookedMinutes,
      productivePercent,
      unproductivePercent,
    };
  });
  const unproductiveSummary = unproductiveRows.reduce(
    (summary, row) => ({
      capacityMinutes: summary.capacityMinutes + row.capacityMinutes,
      plannedMinutes: summary.plannedMinutes + row.plannedMinutes,
      productiveMinutes: summary.productiveMinutes + row.productiveMinutes,
      unproductiveMinutes: summary.unproductiveMinutes + row.unproductiveMinutes,
      overbookedMinutes: summary.overbookedMinutes + row.overbookedMinutes,
    }),
    {
      capacityMinutes: 0,
      plannedMinutes: 0,
      productiveMinutes: 0,
      unproductiveMinutes: 0,
      overbookedMinutes: 0,
    }
  );
  const unproductiveSummaryPercent =
    getPercent(unproductiveSummary.unproductiveMinutes, unproductiveSummary.capacityMinutes);
  const productiveSummaryPercent =
    getPercent(unproductiveSummary.productiveMinutes, unproductiveSummary.capacityMinutes);
  const getPerformanceForPeriod = (period: PerformancePeriod) => {
    const referenceDate = new Date();
    const rows = activeTasks
      .filter((task) => !activeUserId || task.zustaendigId === activeUserId)
      .filter((task) => isDateInPerformancePeriod(task.faelligkeit, period, referenceDate))
      .map((task) => {
        const trackedMinutes = task.gesamtzeitMinuten;
        const estimateMinutes = task.vorgabeMinuten ?? 0;

        return {
          task,
          estimateMinutes,
          trackedMinutes,
          performanceGrade: getPerformanceGrade(estimateMinutes, trackedMinutes),
        };
      })
      .filter((row) => row.estimateMinutes > 0 && row.trackedMinutes > 0);

    const totalEstimateMinutes = rows.reduce((total, row) => total + row.estimateMinutes, 0);
    const totalTrackedMinutes = rows.reduce((total, row) => total + row.trackedMinutes, 0);

    return {
      rows,
      totalEstimateMinutes,
      totalTrackedMinutes,
      performanceGrade: getPerformanceGrade(totalEstimateMinutes, totalTrackedMinutes),
    };
  };
  const performancePeriods: Array<{
    period: PerformancePeriod;
    label: string;
    result: ReturnType<typeof getPerformanceForPeriod>;
  }> = (["day", "month", "year"] as PerformancePeriod[]).map((period) => ({
    period,
    label: performancePeriodLabel(period),
    result: getPerformanceForPeriod(period),
  }));
  const selectedPerformanceResult = selectedPerformancePeriod
    ? performancePeriods.find((entry) => entry.period === selectedPerformancePeriod)?.result
    : null;

  if (!authChecked) {
    return (
      <main className={styles.page}>
        <section className={`${styles.shell} ${styles.bootShell}`}>
          <img className={styles.bootLogo} src="/workpilot-logo.png" alt="WorkPilot" />
          <p>Sitzung wird geprüft...</p>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className={styles.page}>
        <section className={`${styles.shell} ${styles.loginShell}`}>
          <div className={styles.loginLayout}>
            <aside className={styles.loginPanel}>
              <img className={styles.loginLogo} src="/workpilot-logo.png" alt="WorkPilot" />

              <form
                className={styles.loginCard}
                onSubmit={(event) => {
                  event.preventDefault();
                  handleLogin();
                }}
              >
                <div className={styles.loginAvatar} aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M20 21a8 8 0 0 0-16 0" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>

                <label>
                  E-Mail
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                    placeholder="name@unternehmen.de"
                    autoComplete="email"
                  />
                </label>

                <label>
                  Passwort
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    placeholder="demo"
                    autoComplete="current-password"
                  />
                </label>

                {loginError && <p className={styles.modalWarning}>{loginError}</p>}

                <button
                  className={styles.primaryButton}
                  type="submit"
                  disabled={!loginEmail.trim() || !loginPassword}
                >
                  Einloggen
                </button>

                <p className={styles.loginHint}>Demo-Passwort: demo</p>
              </form>

              <div className={styles.creatorBadge}>
                <img src="/ok-solutions-logo.png" alt="OK solutions" />
                <span>created by OK solutions</span>
              </div>
            </aside>

            <section className={styles.loginHero}>
              <div className={styles.loginHeroContent}>
                <p className={styles.loginKicker}>WorkPilot Aufgabenmanagement</p>
                <h1>Fokus, Verantwortung und Deadlines an einem Ort.</h1>
                <p>
                  WorkPilot bündelt Aufgaben, Zeiten, Abwesenheiten, Eskalationen und
                  Projektdaten in einer klaren Arbeitsoberfläche. Mitarbeiter sehen, was jetzt
                  wichtig ist. Führungskräfte erkennen frühzeitig Engpässe, offene Sbergaben und
                  überfällige Deadlines.
                </p>

                <div className={styles.loginFeatureGrid}>
                  <article>
                    <strong>Klare Zuständigkeit</strong>
                    <span>Aufgaben mit Verantwortlichen, Status, Priorität und Annahmeprozess.</span>
                  </article>
                  <article>
                    <strong>Planbare Auslastung</strong>
                    <span>Vorgabezeiten, Tageskapazitäten, Urlaub und Krank direkt im Report.</span>
                  </article>
                  <article>
                    <strong>Keine stillen Fristen</strong>
                    <span>Deadline-Fortschritt, Benachrichtigungen und Eskalationen sichtbar.</span>
                  </article>
                </div>
              </div>
            </section>
          </div>
        </section>
      </main>
    );
  }

  function renderCustomerFile() {
    if (!selectedCustomerFile) return null;

    const menuItems: Array<{ id: CustomerFileTab; label: string; icon: string }> = [
      { id: "logbook", label: "Logbuch", icon: "" },
      { id: "images", label: "Bilder", icon: "" },
      { id: "documents", label: "Dokumente", icon: "" },
      { id: "gaeb", label: "Ausschreibungen (GAEB)", icon: "" },
      { id: "contacts", label: "Ansprechpartner", icon: "•" },
      { id: "tasks", label: "Aufgaben", icon: "✓" },
      { id: "orders", label: "Aufträge", icon: "A" },
      { id: "projects", label: "Projekte", icon: "" },
      { id: "addresses", label: "Objektadressen", icon: "" },
    ];
    const documentTypes: CustomerDocumentType[] = [
      "Allgemeine Dokumente",
      "Anfragen",
      "Angebote",
      "Angebote: Sonderangebote",
      "Tätigkeitsberichte",
      "Mahnung",
      "Rechnungen",
    ];
    const title =
      selectedCustomerFile.type === "company"
        ? `Firma ${selectedCustomerFile.companyName || selectedCustomerFile.customerNumber}`
        : getContactDisplayName(selectedCustomerFile);
    const mainContact =
      customerFileContacts.find((contact) => contact.isMainContact) ||
      customerFileContacts.find(
        (contact) =>
          selectedCustomerFile.mainContactName &&
          getContactDisplayName(contact).includes(
            selectedCustomerFile.mainContactName.replace(/^(Herr|Frau)\s+/i, "")
          )
      );
    const logbookEntries = [
      ...customerLogbookEntries
        .filter((entry) => entry.customerId === selectedCustomerFile.id)
        .map((entry) => ({
          date: entry.date,
          text: entry.text,
          attachments: entry.attachments,
          taskTitle: entry.taskTitle,
          colleague: entry.colleague,
        })),
      {
        date: "16.02.2026 11:08",
        text: `Aufgabe "Heckenrückschnitt ${selectedCustomerFile.companyName || title}" wurde erstellt.`,
      },
      {
        date: "10.02.2026 15:00",
        text: "Aufgabe \"Entsorgung von verschiedenem Müll\" wurde erstellt.",
      },
      {
        date: "03.02.2026 16:20",
        text: "Aufgabe \"Auf- und Abbau Stehtische\" wurde erstellt.",
      },
      {
        date: "21.01.2026 11:01",
        text: "Zeiten wurden geprüft und im Kundenlogbuch abgelegt.",
      },
    ];

    return (
      <section className={styles.customerFile}>
        <div className={styles.customerFileHeader}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setSelectedCustomerFileId("")}
          >
            Zurück zu Kontakte
          </button>
          <h1>{title}</h1>
        </div>

        <div className={styles.customerFileGrid}>
          <aside className={styles.customerFileNav}>
            {menuItems.map((item) =>
              item.id === "documents" ? (
                <div key={item.id} className={styles.customerFileNavGroup}>
                  <button
                    type="button"
                    data-active={customerFileTab === item.id}
                    onClick={() => setCustomerFileTab(item.id)}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                    <b>v</b>
                  </button>
                  {customerFileTab === "documents" && (
                    <div className={styles.customerFileSubNav}>
                      {documentTypes.map((type) => (
                        <button
                          key={type}
                          type="button"
                          data-active={selectedCustomerDocumentType === type}
                          onClick={() => {
                            setCustomerFileTab("documents");
                            setSelectedCustomerDocumentType(type);
                          }}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  data-active={customerFileTab === item.id}
                  onClick={() => setCustomerFileTab(item.id)}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </button>
              )
            )}
          </aside>

          <section className={styles.customerFileMain}>
            {customerFileTab === "contacts" ? (
              <>
                <div className={styles.customerFileMainHeader}>
                  <h2>Ansprechpartner</h2>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => {
                      setContactDraft({
                        ...emptyContact,
                        category: "Ansprechpartner",
                        customerNumber: "",
                        parentCompanyId: selectedCustomerFile.id,
                        parentCompanyName: selectedCustomerFile.companyName,
                        mainContactName: selectedCustomerFile.mainContactName,
                      });
                      setEditingContactId(null);
                      setContactFormTab("details");
                      setIsContactModalOpen(true);
                    }}
                  >
                    + Ansprechpartner
                  </button>
                </div>

                <div className={styles.customerContactList}>
                  {customerFileContacts.length === 0 ? (
                    <p>Für diese Firma sind noch keine Ansprechpartner verknüpft.</p>
                  ) : (
                    customerFileContacts.map((contact) => (
                      <article key={contact.id} className={styles.customerContactRow}>
                        <div>
                          <button
                            type="button"
                            className={styles.tableTextLink}
                            onClick={() => openEditContactModal(contact)}
                          >
                            {getContactDisplayName(contact)}
                          </button>
                          {contact.position && <span>({contact.position})</span>}
                          {contact.isMainContact && <strong>Hauptkontakt</strong>}
                          {contact.isInvoiceRecipient && <strong>Rechnungsempfänger</strong>}
                          <small>
                            {[contact.phone && `} ${contact.phone}`, contact.email && `S0 ${contact.email}`]
                              .filter(Boolean)
                              .join("   ")}
                          </small>
                        </div>
                        <div className={styles.customerProjects}>
                          <b>Projekte</b>
                          <a>#100 Renovierungsarbeiten GEL</a>
                          <a>#103 Grünflächen- und Gartenpflege GEL</a>
                          <a>#126 Arbeitssicherheit KRN</a>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </>
            ) : customerFileTab === "logbook" ? (
              <>
                <div className={styles.customerLogToolbar}>
                  <input placeholder="Suche Dateien, Kommentare, Termine ..." />
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => openLogbookModal("customer")}
                  >
                    + Eintrag
                  </button>
                </div>
                <div className={styles.customerTimeline}>
                  {logbookEntries.map((entry) => (
                    <article key={entry.date}>
                      <div className={styles.customerAvatar}>CG</div>
                      <div>
                        <a>{entry.date}</a>
                        <p>{entry.text}</p>
                        {"colleague" in entry && entry.colleague && (
                          <small className={styles.customerLogMeta}>
                            Benachrichtigung: {entry.colleague}
                          </small>
                        )}
                        {"attachments" in entry && entry.attachments.length > 0 && (
                          <div className={styles.customerLogAttachments}>
                            {entry.attachments.map((attachment) => (
                              <span key={`${entry.date}-${attachment.name}`}>
                                {attachment.type}: {attachment.name}
                              </span>
                            ))}
                          </div>
                        )}
                        {"taskTitle" in entry && entry.taskTitle && (
                          <small className={styles.customerLogTask}>
                            Aufgabe vorbereitet: {entry.taskTitle}
                          </small>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : customerFileTab === "documents" ? (
              <div className={styles.customerDocumentModule}>
                <div className={styles.customerFileMainHeader}>
                  <h2>{selectedCustomerDocumentType}</h2>
                  <button type="button" className={styles.primaryButton}>
                    + Dokument
                  </button>
                </div>
                <div className={styles.customerDocumentEmpty}>
                  <strong>Noch keine Dokumente vorhanden.</strong>
                  <p>
                    Hier werden später alle Dateien dieser Dokumentenart für diesen Kunden abgelegt.
                    Anhänge aus Logbucheinträgen können wir im nächsten Schritt automatisch hier
                    einsortieren.
                  </p>
                </div>
              </div>
            ) : (
              <div className={styles.customerEmptyModule}>
                <h2>{menuItems.find((item) => item.id === customerFileTab)?.label}</h2>
                <p>Dieser Bereich ist für die Kundenakte vorbereitet und wird als nächstes funktional ausgebaut.</p>
              </div>
            )}
          </section>

          <aside className={styles.customerFileAside}>
            <article className={styles.customerInfoCard}>
              <h2>Kontaktdaten</h2>
              <dl>
                <dt>Name</dt>
                <dd>
                  {title}
                  {mainContact && <span>({getContactDisplayName(mainContact)})</span>}
                </dd>
                <dt>Kundennummer</dt>
                <dd>{selectedCustomerFile.customerNumber || "-"}</dd>
                <dt>Telefon</dt>
                <dd>{selectedCustomerFile.phone || mainContact?.phone || "-"}</dd>
                <dt>Fax</dt>
                <dd>{selectedCustomerFile.fax || "-"}</dd>
                <dt>Erreichbarkeit</dt>
                <dd>{selectedCustomerFile.reachability || "Sonstige"}</dd>
              </dl>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => openEditContactModal(selectedCustomerFile)}
              >
                Kontaktdaten
              </button>
            </article>

            <article className={styles.customerInfoCard}>
              <h2>Notizen</h2>
              <textarea placeholder="Hier können Informationen eingetragen werden, die dauerhaft für den Kunden sichtbar bleiben." />
            </article>
          </aside>
        </div>
      </section>
    );
  }

  function renderProjectFile() {
    if (!selectedProjectFile) return null;

    const documentTypes: CustomerDocumentType[] = [
      "Allgemeine Dokumente",
      "Anfragen",
      "Angebote",
      "Angebote: Sonderangebote",
      "Tätigkeitsberichte",
      "Mahnung",
      "Rechnungen",
    ];
    const menuItems: Array<{ id: ProjectFileTab; label: string; icon: string }> = [
      { id: "logbook", label: "Logbuch", icon: "" },
      { id: "images", label: "Bilder", icon: "" },
      { id: "documents", label: "Dokumente", icon: "" },
      { id: "gaeb", label: "Ausschreibungen (GAEB)", icon: "" },
      { id: "time", label: "Zeit & Lohn", icon: "" },
      { id: "appointments", label: "Termine", icon: "" },
      { id: "tasks", label: "Aufgaben", icon: "" },
      { id: "material", label: "Material", icon: "€" },
      { id: "comparison", label: "Soll/Ist Vergleich", icon: "" },
      { id: "participants", label: "Projektbeteiligte", icon: "•" },
      { id: "checklists", label: "Checklisten", icon: "✓" },
    ];
    const selectedContact = selectedProjectFile.contactId
      ? contacts.find((contact) => contact.id === selectedProjectFile.contactId)
      : null;
    const selectedContactPerson = selectedProjectFile.contactPersonId
      ? contacts.find((contact) => contact.id === selectedProjectFile.contactPersonId)
      : null;
    const address =
      selectedProjectFile.address ||
      (selectedContact ? getContactAddressLine(selectedContact) : "") ||
      "Projektanschrift noch nicht hinterlegt";
    const logEntries = [
      {
        actor: "CG",
        date: selectedProjectFile.createdAt || "29.04.2026 08:13",
        title: "Projekt zugewiesen",
        text: `${activeUser?.name || "Christine Giesswein"} wurde dem Projekt hinzugefügt.`,
      },
      {
        actor: "System",
        date: selectedProjectFile.createdAt || "29.04.2026 08:13",
        title: "Projekt erstellt",
        text: `Das Projekt wurde in ${selectedProjectFile.status || "Lead / Klärung"} angelegt.`,
      },
      {
        actor: "System",
        date: selectedProjectFile.createdAt || "29.04.2026 08:13",
        title: "Status",
        text: `Das Projekt ist aktuell in ${selectedProjectFile.status || "-"}.`,
      },
    ];
    const projectLogbookQuery = projectLogbookSearch.trim().toLowerCase();
    const savedProjectLogEntries = projectLogbookEntries
      .filter((entry) => String(entry.projectId) === String(selectedProjectFile.id))
      .filter((entry) => {
        if (!projectLogbookQuery) return true;

        return [
          entry.title,
          entry.text,
          entry.author,
          entry.colleague,
          entry.date,
          ...entry.attachments.map((attachment) => attachment.name),
        ]
          .join(" ")
          .toLowerCase()
          .includes(projectLogbookQuery);
      });
    const visibleProjectLogEntries = [
      ...savedProjectLogEntries,
      ...logEntries.filter((entry) => {
        if (!projectLogbookQuery) return true;

        return [entry.title, entry.text, entry.actor, entry.date]
          .join(" ")
          .toLowerCase()
          .includes(projectLogbookQuery);
      }),
    ];
    const projectStampEntries = stampEntries.filter(
      (entry) =>
        entry.mode === "project" && String(entry.projectId) === String(selectedProjectFile.id)
    );
    const projectTrackedHours =
      projectStampEntries.reduce((sum, entry) => sum + entry.durationMs, 0) / 3_600_000;
    const projectBudgetHours = parseHoursInput(selectedProjectFile.timeBudgetHours);
    const projectRemainingHours = projectBudgetHours > 0 ? projectBudgetHours - projectTrackedHours : 0;
    const projectBudgetUsagePercent =
      projectBudgetHours > 0 ? clampPercent((projectTrackedHours / projectBudgetHours) * 100) : 0;
    const projectResponsibleName = selectedProjectFile.responsibleName || activeUser?.name || "Christian Eid";
    const projectStartDate = parseProjectDate(selectedProjectFile.projectRuntimeFrom);
    const projectEndDate = parseProjectDate(selectedProjectFile.projectRuntimeUntil);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayMs = 24 * 60 * 60 * 1000;
    const projectRuntimeTotalDays =
      projectStartDate && projectEndDate
        ? Math.max(0, Math.ceil((projectEndDate.getTime() - projectStartDate.getTime()) / dayMs))
        : 0;
    const projectRuntimeElapsedDays =
      projectStartDate && projectEndDate
        ? Math.min(
            projectRuntimeTotalDays,
            Math.max(0, Math.ceil((today.getTime() - projectStartDate.getTime()) / dayMs))
          )
        : 0;
    const projectRuntimeRemainingDays =
      projectStartDate && projectEndDate
        ? Math.max(0, Math.ceil((projectEndDate.getTime() - today.getTime()) / dayMs))
        : 0;
    const projectRuntimeUsagePercent =
      projectRuntimeTotalDays > 0
        ? clampPercent((projectRuntimeElapsedDays / projectRuntimeTotalDays) * 100)
        : 0;

    return (
      <section className={styles.projectFile}>
        <header className={styles.projectFileHeader}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setSelectedProjectFileId("")}
          >
            Zurück zur Pipeline
          </button>
          <div>
            <h1>
              {selectedProjectFile.projectNumber || selectedProjectFile.id} |{" "}
              {selectedProjectFile.title}
            </h1>
            <p>
              {selectedProjectFile.customer || "Kunde noch nicht gesetzt"} | {address}
            </p>
          </div>
          <div className={styles.projectFileActions}>
            <div className={styles.projectResponsibleBadge}>
              <span>Projektverantwortlicher</span>
              <strong>{projectResponsibleName}</strong>
            </div>
            <div className={styles.projectStatusAction}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setIsProjectStatusMenuOpen((isOpen) => !isOpen)}
              >
                Status ändern
              </button>
              {isProjectStatusMenuOpen ? (
                <div className={styles.projectStatusMenu}>
                  {projectLifecycleStatuses
                    .filter((statusItem) => statusItem.label !== "Alle Offenen")
                    .map((statusItem) => (
                      <button
                        key={statusItem.label}
                        type="button"
                        data-active={selectedProjectFile.status === statusItem.label}
                        onClick={() => updateSelectedProjectStatus(statusItem.label)}
                      >
                        <span>{getProjectStatusStripLabel(statusItem.label)}</span>
                        <strong>{getPipelineStatusCount(statusItem.label)}</strong>
                      </button>
                    ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => openProjectTaskModal(selectedProjectFile, "task")}
            >
              Aufgabe anlegen
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={openProjectPlanningBoard}
            >
              Erinnerung anlegen
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => printProjectOverview(selectedProjectFile, address)}
            >
              Projekt drucken
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={openProjectPlanningBoard}
            >
              Termin einplanen
            </button>
          </div>
        </header>

        <div className={styles.projectFileGrid}>
          <aside className={styles.customerFileNav}>
            {menuItems.map((item) =>
              item.id === "documents" ? (
                <div key={item.id} className={styles.customerFileNavGroup}>
                  <button
                    type="button"
                    data-active={projectFileTab === item.id}
                    onClick={() => setProjectFileTab(item.id)}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                    <b>v</b>
                  </button>
                  {projectFileTab === "documents" && (
                    <div className={styles.customerFileSubNav}>
                      {documentTypes.map((type) => (
                        <button
                          key={type}
                          type="button"
                          data-active={selectedProjectDocumentType === type}
                          onClick={() => {
                            setProjectFileTab("documents");
                            setSelectedProjectDocumentType(type);
                          }}
                        >
                          {type}
                          {type === "Angebote" && <strong>1</strong>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : item.id === "tasks" ? (
                <div key={item.id} className={styles.customerFileNavGroup}>
                  <button
                    type="button"
                    data-active={projectFileTab === item.id}
                    onClick={() => setProjectFileTab(item.id)}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                    <b>v</b>
                  </button>
                  {projectFileTab === "tasks" && (
                    <div className={styles.customerFileSubNav}>
                      <button type="button">Offene Aufgaben</button>
                      <button type="button">Erledigte Aufgaben</button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  data-active={projectFileTab === item.id}
                  onClick={() => setProjectFileTab(item.id)}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </button>
              )
            )}
          </aside>

          <main className={styles.projectFileMain}>
            {projectFileTab === "logbook" ? (
              <>
                <div className={styles.customerLogToolbar}>
                  <input
                    value={projectLogbookSearch}
                    onChange={(event) => setProjectLogbookSearch(event.target.value)}
                    placeholder="Suche Dateien, Kommentare, Termine ..."
                  />
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => openLogbookModal("project")}
                  >
                    + Eintrag
                  </button>
                </div>
                <div className={styles.customerTimeline}>
                  {logbookError ? <p className={styles.emptyState}>{logbookError}</p> : null}
                  {visibleProjectLogEntries.length === 0 ? (
                    <p className={styles.emptyState}>Keine Logbucheinträge zur Suche gefunden.</p>
                  ) : (
                    visibleProjectLogEntries.map((entry) => (
                      <article key={`${entry.title}-${entry.date}-${"id" in entry ? entry.id : entry.actor}`}>
                        <div className={styles.customerAvatar}>
                          {"author" in entry
                            ? getInitials(entry.author || activeUser?.name || "CE")
                            : entry.actor}
                        </div>
                        <div>
                          <a>
                            {entry.title} {entry.date}
                          </a>
                          <p>{entry.text}</p>
                          {"author" in entry && entry.author ? (
                            <small className={styles.customerLogMeta}>Erfasst von: {entry.author}</small>
                          ) : null}
                          {"colleague" in entry && entry.colleague ? (
                            <small className={styles.customerLogMeta}>
                              Benachrichtigung: {entry.colleague}
                            </small>
                          ) : null}
                          {"attachments" in entry && entry.attachments.length > 0 ? (
                            <div className={styles.customerLogAttachments}>
                              {entry.attachments.map((attachment, index) =>
                                attachment.dataUrl ? (
                                  <a
                                    key={`${entry.date}-${attachment.name}-${index}`}
                                    href={attachment.dataUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {attachment.type}: {attachment.name}
                                  </a>
                                ) : (
                                  <span key={`${entry.date}-${attachment.name}-${index}`}>
                                    {attachment.type}: {attachment.name}
                                  </span>
                                )
                              )}
                            </div>
                          ) : null}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </>
            ) : projectFileTab === "documents" ? (
              <div className={styles.customerDocumentModule}>
                <div className={styles.customerFileMainHeader}>
                  <h2>{selectedProjectDocumentType}</h2>
                  <button type="button" className={styles.primaryButton}>
                    + Dokument
                  </button>
                </div>
                <div className={styles.customerDocumentEmpty}>
                  <strong>Noch keine Projektdokumente vorhanden.</strong>
                  <p>
                    Diese Ablage ist für {selectedProjectDocumentType} im Projekt vorbereitet.
                    Tätigkeitsberichte ersetzen hier die Aufmax-Kategorie.
                  </p>
                </div>
              </div>
            ) : projectFileTab === "time" ? (
              <div className={styles.projectTimeModule}>
                <div className={styles.customerFileMainHeader}>
                  <h2>Zeit & Lohn</h2>
                  <span>{projectStampEntries.length} Zeiteinträge</span>
                </div>
                {projectStampEntries.length === 0 ? (
                  <div className={styles.customerDocumentEmpty}>
                    <strong>Noch keine Projektzeiten erfasst.</strong>
                    <p>
                      Zeiten erscheinen hier automatisch, sobald über die Stempelfunktion auf
                      dieses Projekt gebucht und anschließend gewechselt wurde.
                    </p>
                  </div>
                ) : (
                  <table className={styles.projectTimeTable}>
                    <thead>
                      <tr>
                        <th>Datum</th>
                        <th>Uhrzeit</th>
                        <th>Laufzeit</th>
                        <th>Pause</th>
                        <th>Mitarbeiter</th>
                        <th>Kommentar</th>
                        <th>Aktion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectStampEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td>{entry.date}</td>
                          <td>
                            {entry.startTime} - {entry.endTime}
                          </td>
                          <td>{formatStampDuration(entry.durationMs)}</td>
                          <td>{formatStampDuration(entry.pauseMs)}</td>
                          <td>{entry.employee}</td>
                          <td>{entry.comment}</td>
                          <td>
                            <button
                              type="button"
                              className={styles.timeEntryEditButton}
                              disabled={!canManageProjectTimeEntries}
                              onClick={() => openStampEntryEditModal(entry)}
                              title={
                                canManageProjectTimeEntries
                                  ? "Zeiteintrag bearbeiten"
                                  : "Nur Geschäftsführer / CEO dürfen Zeiteinträge bearbeiten"
                              }
                            >
                              Bearbeiten
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              <div className={styles.customerEmptyModule}>
                <h2>{menuItems.find((item) => item.id === projectFileTab)?.label}</h2>
                <p>Dieser Projektbereich ist vorbereitet und wird als nächstes funktional ausgebaut.</p>
              </div>
            )}
          </main>

          <aside className={styles.projectFileAside}>
            <article className={styles.projectMetricCard}>
              <h2>Verbrauchte Zeitkontingente</h2>
              <div className={styles.projectTimeBudget}>
                <div>
                  <span>Gebucht</span>
                  <strong>{formatHours(projectTrackedHours)} Std.</strong>
                </div>
                <div>
                  <span>Rest</span>
                  <strong data-state={projectRemainingHours < 0 ? "over" : "ok"}>
                    {formatHours(projectRemainingHours)} Std.
                  </strong>
                </div>
                <div className={styles.projectTimeBudgetBar}>
                  <span style={{ width: `${projectBudgetUsagePercent}%` }} />
                </div>
              </div>
            </article>

            <article className={styles.projectMetricCard}>
              <h2>Restlaufzeit bis Projektende</h2>
              <div className={styles.projectTimeBudget}>
                <div>
                  <span>Verstrichen</span>
                  <strong>{projectRuntimeElapsedDays} Tg.</strong>
                </div>
                <div>
                  <span>Rest</span>
                  <strong>{projectRuntimeRemainingDays} Tg.</strong>
                </div>
                <div className={styles.projectTimeBudgetBar}>
                  <span style={{ width: `${projectRuntimeUsagePercent}%` }} />
                </div>
              </div>
            </article>

            <article className={styles.customerInfoCard}>
              <h2>Projektdaten</h2>
              <dl>
                <dt>Projektname</dt>
                <dd>{selectedProjectFile.title}</dd>
                <dt>Projektanschrift</dt>
                <dd>{address}</dd>
                <dt>Kunde</dt>
                <dd>{selectedProjectFile.customer || "-"}</dd>
                <dt>Ansprechpartner/in</dt>
                <dd>{selectedContactPerson ? getContactDisplayName(selectedContactPerson) : "-"}</dd>
                <dt>Projekttyp</dt>
                <dd>{selectedProjectFile.projectType || "Projekt OK solutions"}</dd>
                <dt>Projektart</dt>
                <dd>{selectedProjectFile.projectKind || "einmaliges Projekt"}</dd>
                {selectedProjectFile.projectKind === "Dauerläufer-Projekt" && (
                  <>
                    <dt>Projektstart</dt>
                    <dd>{formatProjectDate(selectedProjectFile.projectRuntimeFrom)}</dd>
                    <dt>Projektlaufzeit bis</dt>
                    <dd>{formatProjectDate(selectedProjectFile.projectRuntimeUntil)}</dd>
                    <dt>Laufzeit</dt>
                    <dd>
                      {formatProjectRuntimeDuration(
                        selectedProjectFile.projectRuntimeFrom,
                        selectedProjectFile.projectRuntimeUntil
                      )}
                    </dd>
                    <dt>Fakturierungsintervall</dt>
                    <dd>{selectedProjectFile.billingInterval || "-"}</dd>
                  </>
                )}
                <dt>Projektstatus</dt>
                <dd>{selectedProjectFile.status || "-"}</dd>
                <dt>Gewerk</dt>
                <dd>{selectedProjectFile.trade || "-"}</dd>
                <dt>Niederlassung</dt>
                <dd>{selectedProjectFile.branch || "-"}</dd>
                <dt>Quelle</dt>
                <dd>{selectedProjectFile.source || "-"}</dd>
                <dt>Projektvolumen</dt>
                <dd>{selectedProjectFile.volume ? `${selectedProjectFile.volume} €` : "0,00 €"}</dd>
                <dt>Projektzeitkontingent</dt>
                <dd>{projectBudgetHours > 0 ? `${formatHours(projectBudgetHours)} Std.` : "-"}</dd>
                <dt>Projektbeteiligte</dt>
                <dd>{selectedProjectFile.participants || "-"}</dd>
                <dt>Erstellungsdatum</dt>
                <dd>{selectedProjectFile.createdAt || "-"}</dd>
              </dl>
              {selectedProjectFile.timeBudgetHistory &&
                selectedProjectFile.timeBudgetHistory.length > 0 && (
                  <details className={styles.projectBudgetHistory}>
                    <summary>Zeitkontingent-Historie anzeigen</summary>
                    <ul>
                      {selectedProjectFile.timeBudgetHistory.map((entry) => (
                        <li key={entry.id}>
                          <strong>{entry.changedAt}</strong>
                          <span>
                            {entry.previousHours || "0"} Std. {"->"} {entry.nextHours || "0"} Std.
                          </span>
                          <small>{entry.changedBy}</small>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => openProjectDataModal(selectedProjectFile)}
              >
                Projektdaten
              </button>
            </article>
          </aside>
        </div>

        <section className={styles.projectFileFields}>
          <div className={styles.customerFileMainHeader}>
            <h2>Eigene Felder</h2>
            <button type="button" className={styles.secondaryButton}>
              Zu den Einstellungen
            </button>
          </div>
          <div>
            <label>
              Projektlaufzeit (von/bis)
              <input />
            </label>
            <label>
              Nachfass-Info
              <input />
            </label>
            <label>
              Spezielle Kundenwünsche
              <input />
            </label>
            <label>
              Spezielle Abmachungen
              <input />
            </label>
          </div>
        </section>

        <section className={styles.projectFileFields}>
          <div className={styles.customerFileMainHeader}>
            <h2>Datenerfassungsbogen</h2>
          </div>
        </section>
      </section>
    );
  }

  function renderPlanningBoard() {
    const allDetailGroups = planningBoardSections.flatMap((section) => section.detailGroups);

    if (isPlanningDayOpen) {
      return (
        <section className={styles.planningBoardPage}>
          <section className={styles.planningDayPanel}>
            <div className={styles.planningDayHeader}>
              <div>
                <p className={styles.eyebrow}>Tagesplanung</p>
                <h1>
                  {selectedPlanningDate.toLocaleDateString("de-DE", {
                    weekday: "long",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </h1>
                <p>
                  {selectedPlanningHoliday
                    ? `Feiertag: ${selectedPlanningHoliday.name}`
                    : selectedPlanningIsWeekend
                      ? "Wochenende"
                      : `Planungsgruppe ${selectedPlanningGroup}`}
                </p>
              </div>
              <div className={styles.planningDayActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setIsPlanningDayOpen(false)}
                >
                  Zurück zum Planungsboard
                </button>
                <div className={styles.planningGroupSwitch}>
                  {allDetailGroups.map((group) => (
                    <button
                      key={group.name}
                      type="button"
                      data-active={selectedPlanningGroup === group.name}
                      onClick={() => setSelectedPlanningGroup(group.name)}
                    >
                      {group.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.planningTimelineWrap}>
              <div className={styles.planningTimelineBoard}>
                <div className={styles.planningWorkerHead}>Worker</div>
                <div
                  className={styles.planningHourScale}
                  style={{
                    gridTemplateColumns: `repeat(${planningSlotColumnCount}, minmax(24px, 1fr))`,
                  }}
                >
                  {planningHourLabels.map((hour, index) => (
                    <span
                      key={hour}
                      style={{
                        gridColumn: `${index * 4 + 1} / span 4`,
                      }}
                    >
                      {hour}
                    </span>
                  ))}
                </div>

                {selectedPlanningGroupEmployees.map((employee, index) => {
                  const assignments = getPlanningAssignmentsForEmployee(employee);

                  return (
                    <div key={employee} className={styles.planningWorkerRow}>
                      <div className={styles.planningWorkerCell}>
                        <strong>{employee}</strong>
                        <span>
                          {index === 0 ? "8h verf. / 2,9h fix / Fest planbar" : "8h verf. / 0h fix / Fest planbar"}
                        </span>
                      </div>
                      <div
                        className={styles.planningTimelineLane}
                        data-muted={selectedPlanningIsWeekend || Boolean(selectedPlanningHoliday)}
                        style={{
                          gridTemplateColumns: `repeat(${planningSlotColumnCount}, minmax(24px, 1fr))`,
                        }}
                      >
                        {assignments.map((assignment) => (
                          <span
                            key={`${employee}-${assignment.label}-${assignment.start}`}
                            className={styles.planningTimelineBlock}
                            data-pause={assignment.label === "Pause"}
                            style={{
                              gridColumn: `${assignment.startColumn} / ${assignment.endColumn}`,
                            }}
                          >
                            {assignment.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </section>
      );
    }

    return (
      <section className={styles.planningBoardPage}>
        <div className={styles.topline}>
          <div>
            <p className={styles.eyebrow}>Planung</p>
            <h1>Planungsboard</h1>
            <p className={styles.subline}>
              Ansicht ab heute für vier Wochen. Wochenenden sind ausgegraut, Feiertage werden
              markiert.
            </p>
          </div>
        </div>

        <div className={styles.planningBoardStack}>
          {planningBoardSections.map((section) => (
            <section key={section.company} className={styles.planningBoardCard}>
              <h2>{section.title}</h2>
              <div className={styles.planningBoardScroll}>
                <div
                  className={styles.planningBoardMatrix}
                  style={{
                    gridTemplateColumns: `120px repeat(${planningBoardDays.length}, minmax(78px, 1fr))`,
                  }}
                >
                  <div className={styles.planningBoardCorner} />
                  {planningBoardDays.map((day) => {
                    const dateKey = formatDateKey(day);
                    const holiday = getHolidayForDateKey(dateKey);
                    const isWeekend = isWeekendDateKey(dateKey);
                    const isSelected = selectedPlanningDateKey === dateKey;

                    return (
                      <button
                        key={`${section.company}-${dateKey}-header`}
                        type="button"
                        className={styles.planningBoardDayHeader}
                        data-weekend={isWeekend}
                        data-holiday={Boolean(holiday)}
                        data-active={isSelected}
                        title={holiday?.name}
                        onClick={() => {
                          setSelectedPlanningDateKey(dateKey);
                          setSelectedPlanningGroup(section.detailGroups[0]?.name ?? "Marketing");
                          setIsPlanningDayOpen(true);
                        }}
                      >
                        <strong>
                          {day.toLocaleDateString("de-DE", { weekday: "short" }).toUpperCase()}
                        </strong>
                        <span>
                          {day.toLocaleDateString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </span>
                        {holiday && <small>Feiertag</small>}
                      </button>
                    );
                  })}

                  {section.groups.map((groupName) => (
                    <div key={`${section.company}-${groupName}`} className={styles.planningBoardRow}>
                      <div className={styles.planningBoardRowLabel}>{groupName}</div>
                      {planningBoardDays.map((day, dayIndex) => {
                        const dateKey = formatDateKey(day);
                        const holiday = getHolidayForDateKey(dateKey);
                        const isWeekend = isWeekendDateKey(dateKey);
                        const load = getPlanningBoardLoad(section, groupName, dateKey, dayIndex);
                        const targetGroup =
                          groupName === "Gesamt" ? section.detailGroups[0]?.name ?? "Marketing" : groupName;
                        const isSelected =
                          groupName !== "Gesamt" &&
                          selectedPlanningDateKey === dateKey &&
                          selectedPlanningGroup === targetGroup;

                        return (
                          <button
                            key={`${section.company}-${groupName}-${dateKey}`}
                            type="button"
                            className={styles.planningBoardCell}
                            data-weekend={isWeekend}
                            data-holiday={Boolean(holiday)}
                            data-active={isSelected}
                            title={holiday?.name}
                            onClick={() => {
                              setSelectedPlanningDateKey(dateKey);
                              setSelectedPlanningGroup(targetGroup);
                              setIsPlanningDayOpen(true);
                            }}
                          >
                            {!isWeekend && !holiday ? (
                              <>
                                <span>{load}%</span>
                                <b>
                                  <i style={{ width: `${Math.max(8, Math.min(load, 100))}%` }} />
                                </b>
                              </>
                            ) : (
                              <em>{holiday ? holiday.name : "Wochenende"}</em>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>

      </section>
    );
  }

  function renderEmployeeManagement() {
    const selectedEmployee =
      selectedEmployeeId && selectedEmployeeId !== "__new__"
        ? users.find((user) => user.id === selectedEmployeeId) ?? null
        : null;
    const isNewEmployee = selectedEmployeeId === "__new__";
    const employeeName = isNewEmployee ? userName || "Mitarbeiter anlegen" : selectedEmployee?.name ?? "";
    const employeeNameParts = userName.trim().split(/\s+/).filter(Boolean);
    const employeeFirstName = employeeNameParts.slice(0, -1).join(" ") || employeeNameParts[0] || "";
    const employeeLastName =
      employeeNameParts.length > 1 ? employeeNameParts[employeeNameParts.length - 1] : "";
    const filteredEmployees = users.filter((user) => {
      const search = employeeSearchTerm.trim().toLowerCase();
      if (!search) return true;

      return [user.name, user.email, user.roleLabel, user.teamIds.join(" ")]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search));
    });
    const visibleEmployees =
      employeeStatusView === "active" ? filteredEmployees : [];
    const employeeTopTabs: Array<{ id: EmployeeTopTab; label: string }> = [
      { id: "overview", label: "Übersicht" },
      { id: "absence", label: "Urlaub und Abwesenheiten" },
      { id: "time", label: "Zeiterfassung" },
      { id: "balance", label: "Stundenausgleich" },
      { id: "documents", label: "Dokumente" },
    ];
    const employeeSideTabs: Array<{ id: EmployeeSideTab; label: string }> = [
      { id: "personal", label: "Persönliches" },
      { id: "permissions", label: "Berechtigungen" },
      { id: "mailserver", label: "Mailserver" },
      { id: "employment", label: "Anstellung" },
      { id: "tax", label: "Steuerdaten" },
      { id: "bank", label: "Bankdaten" },
      { id: "password", label: "Passwort ändern" },
    ];
    const now = new Date(timerNow);
    const employeePeriodStart =
      employeeTimePeriod === "day"
        ? now
        : employeeTimePeriod === "month"
          ? new Date(now.getFullYear(), now.getMonth(), 1)
          : employeeTimePeriod === "year"
            ? new Date(now.getFullYear(), 0, 1)
            : employeeTimeFrom
              ? new Date(employeeTimeFrom)
              : now;
    const employeePeriodEnd =
      employeeTimePeriod === "day"
        ? now
        : employeeTimePeriod === "month"
          ? new Date(now.getFullYear(), now.getMonth() + 1, 0)
          : employeeTimePeriod === "year"
            ? new Date(now.getFullYear(), 11, 31)
            : employeeTimeTo
              ? new Date(employeeTimeTo)
              : now;
    const employeeTimeEntries = stampEntries.filter((entry) => {
      if (!employeeName || entry.employee !== employeeName) return false;
      const entryDate = parseGermanDate(entry.date);
      return entryDate ? isDateInRange(entryDate, employeePeriodStart, employeePeriodEnd) : false;
    });
    const employeeProductiveMs = employeeTimeEntries
      .filter((entry) => entry.mode === "project")
      .reduce((sum, entry) => sum + entry.durationMs, 0);
    const employeeUnproductiveMs = employeeTimeEntries
      .filter((entry) => entry.mode === "unproductive")
      .reduce((sum, entry) => sum + entry.durationMs, 0);
    const employeeTotalTimeMs = employeeProductiveMs + employeeUnproductiveMs;

    if (selectedEmployee || isNewEmployee) {
      return (
        <section className={styles.employeeFile}>
          <header className={styles.employeeFileHeader}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                setSelectedEmployeeId("");
                resetUserForm();
              }}
            >
              Zurück zur Mitarbeiterliste
            </button>
            <div>
              <p className={styles.eyebrow}>Mitarbeiterverwaltung</p>
              <h1>{employeeName}</h1>
            </div>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={!mayManageUsers}
              onClick={saveEmployeeFile}
            >
              Speichern
            </button>
          </header>

          <nav className={styles.employeeTopTabs}>
            {employeeTopTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-active={employeeTopTab === tab.id}
                onClick={() => setEmployeeTopTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {employeeTopTab === "overview" ? (
            <div className={styles.employeeFileLayout}>
              <aside className={styles.employeeFileSidebar}>
                <div className={styles.employeePhoto}>
                  {selectedEmployee?.profileImageDataUrl ? (
                    <img src={selectedEmployee.profileImageDataUrl} alt={selectedEmployee.name} />
                  ) : (
                    <span>{getInitials(employeeName || "MA")}</span>
                  )}
                </div>
                <div className={styles.employeeSideTabs}>
                  {employeeSideTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      data-active={employeeSideTab === tab.id}
                      onClick={() => setEmployeeSideTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </aside>

              <section className={styles.employeeDetailPanel}>
                {employeeSideTab === "personal" && (
                  <>
                    <div className={styles.employeeSectionHeader}>
                      <h2>Persönliches</h2>
                    </div>
                    <div className={styles.employeeFormGrid}>
                      <label>
                        Anrede
                        <select defaultValue="Herr">
                          <option>Herr</option>
                          <option>Frau</option>
                          <option>Divers</option>
                        </select>
                      </label>
                      <label>
                        Anzeigename *
                        <input
                          value={userName}
                          disabled={!mayManageUsers}
                          onChange={(event) => setUserName(event.target.value)}
                          placeholder="Vorname Nachname"
                        />
                      </label>
                      <label>
                        Vorname
                        <input value={employeeFirstName} readOnly />
                      </label>
                      <label>
                        Nachname
                        <input value={employeeLastName} readOnly />
                      </label>
                      <label>
                        Geburtsdatum
                        <input type="date" />
                      </label>
                      <label>
                        Anzeigesprache
                        <select defaultValue="Deutsch (Deutschland)">
                          <option>Deutsch (Deutschland)</option>
                        </select>
                      </label>
                      <label className={styles.fullWidth}>
                        E-Mail-Adresse *
                        <input
                          type="email"
                          value={userEmail}
                          disabled={!mayManageUsers}
                          onChange={(event) => setUserEmail(event.target.value)}
                        />
                      </label>
                      <label>
                        Telefonnummer
                        <input placeholder="+49..." />
                      </label>
                      <label>
                        Mobilfunknummer
                        <input placeholder="+49..." />
                      </label>
                      <label className={styles.fullWidth}>
                        Straxe & Hausnummer
                        <input placeholder="Straxe und Hausnummer" />
                      </label>
                      <label>
                        Postleitzahl
                        <input />
                      </label>
                      <label>
                        Ort
                        <input />
                      </label>
                      <div className={`${styles.fullWidth} ${styles.employeeSignatureEditor}`}>
                        <label className={styles.checkboxField}>
                          <input
                            type="checkbox"
                            checked={employeeSignatureHidden}
                            onChange={(event) => setEmployeeSignatureHidden(event.target.checked)}
                          />
                          Keine Signatur anzeigen
                        </label>
                        <div className={styles.signatureToolbar} aria-label="Signatur-Editor Toolbar">
                          <button type="button" title="Formatierung">S</button>
                          <select title="Schriftgröxe" defaultValue="15">
                            <option>12</option>
                            <option>15</option>
                            <option>18</option>
                          </select>
                          <button type="button" title="Fett">B</button>
                          <button type="button" title="Unterstrichen">U</button>
                          <button type="button" title="Kursiv">I</button>
                          <select title="Schriftart" defaultValue="Arial">
                            <option>Arial</option>
                            <option>Outfit</option>
                            <option>Calibri</option>
                          </select>
                          <button type="button" title="Textfarbe">A</button>
                          <button type="button" title="Aufzählung">•</button>
                          <button type="button" title="Nummerierung">1.</button>
                          <button type="button" title="Ausrichtung">0</button>
                          <button type="button" title="Tabelle"></button>
                          <button type="button" title="Dokument"></button>
                          <button type="button" title="Quellcode anzeigen">&lt;/&gt;</button>
                          <button type="button" title="Link">Link</button>
                        </div>
                        <textarea
                          rows={10}
                          value={employeeSignature}
                          disabled={employeeSignatureHidden}
                          placeholder="Signatur für E-Mails hinterlegen"
                          onChange={(event) => setEmployeeSignature(event.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}

                {employeeSideTab === "permissions" && (
                  <>
                    <div className={styles.employeeSectionHeader}>
                      <h2>Berechtigungen</h2>
                    </div>
                    <div className={styles.employeeFormGrid}>
                      <label className={styles.fullWidth}>
                        Zugewiesene Niederlassungen *
                        <select
                          multiple
                          value={userTeamIds}
                          disabled={!mayManageUsers}
                          onChange={(event) =>
                            setUserTeamIds(
                              Array.from(event.target.selectedOptions).map((option) => option.value)
                            )
                          }
                        >
                          {teams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Benutzerrechte *
                        <select
                          value={userRole}
                          disabled={!mayManageUsers}
                          onChange={(event) => setUserRole(event.target.value as UserRole)}
                        >
                          {roleOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Account-Typ
                        <select defaultValue="Standard-Nutzer">
                          <option>Standard-Nutzer</option>
                          <option>App-Nutzer</option>
                        </select>
                      </label>
                    </div>
                  </>
                )}

                {employeeSideTab === "mailserver" && (
                  <>
                    <div className={styles.employeeSectionHeader}>
                      <h2>Mailservereinstellungen</h2>
                    </div>
                    <div className={styles.employeeFormGrid}>
                      <label>
                        Ihre E-Mail-Adresse
                        <input value={userEmail} readOnly />
                      </label>
                      <label>
                        Anbieter
                        <select defaultValue="Outlook / Hotmail (via OAuth2)">
                          <option>Outlook / Hotmail (via OAuth2)</option>
                          <option>Gmail / Google Workspace</option>
                          <option>Anderer Anbieter</option>
                        </select>
                      </label>
                      <label className={styles.fullWidth}>
                        BCC (Blindkopie)
                        <input placeholder="example@gmail.com" />
                      </label>
                    </div>
                  </>
                )}

                {employeeSideTab === "employment" && (
                  <>
                    <div className={styles.employeeSectionHeader}>
                      <h2>Informationen zum Anstellungsverhältnis</h2>
                    </div>
                    <div className={styles.employeeFormGrid}>
                      <label>
                        Jobtitel
                        <input placeholder="z.B. Monteur, CEO, Teamleiter" />
                      </label>
                      <label>
                        Beschäftigungsart
                        <select defaultValue="Vollzeit">
                          <option>Vollzeit</option>
                          <option>Teilzeit</option>
                          <option>Minijob</option>
                        </select>
                      </label>
                      <label>
                        Vertragsbeginn
                        <input type="date" />
                      </label>
                      <label>
                        Vertragsende
                        <input type="date" />
                      </label>
                      <label>
                        Arbeitszeit pro Tag
                        <input
                          type="number"
                          min="0"
                          step="0.25"
                          value={userDailyWorkHours}
                          disabled={!mayManageUsers}
                          onChange={(event) => setUserDailyWorkHours(event.target.value)}
                        />
                      </label>
                      <label>
                        Urlaubstage pro Jahr
                        <input type="number" min="0" defaultValue={30} />
                      </label>
                    </div>
                  </>
                )}

                {employeeSideTab === "tax" && (
                  <>
                    <div className={styles.employeeSectionHeader}>
                      <h2>Steuerdaten und Versicherungen</h2>
                    </div>
                    <div className={styles.employeeFormGrid}>
                      <label>
                        Steuer-ID
                        <input />
                      </label>
                      <label>
                        Familienstand
                        <select defaultValue="nicht bekannt">
                          <option>nicht bekannt</option>
                          <option>ledig</option>
                          <option>verheiratet</option>
                        </select>
                      </label>
                      <label>
                        Steuerklasse
                        <input />
                      </label>
                      <label>
                        Kinderfreibetrag
                        <input type="number" min="0" />
                      </label>
                      <label>
                        Sozialversicherungsnummer
                        <input />
                      </label>
                      <label>
                        Krankenversicherung
                        <select defaultValue="Gesetzlich pflichtversichert">
                          <option>Gesetzlich pflichtversichert</option>
                          <option>Privat versichert</option>
                        </select>
                      </label>
                    </div>
                  </>
                )}

                {employeeSideTab === "bank" && (
                  <>
                    <div className={styles.employeeSectionHeader}>
                      <h2>Bankdaten</h2>
                    </div>
                    <div className={styles.employeeFormGrid}>
                      <label className={styles.fullWidth}>
                        Zahlungsempfänger
                        <input />
                      </label>
                      <label className={styles.fullWidth}>
                        IBAN
                        <input />
                      </label>
                      <label className={styles.fullWidth}>
                        BIC
                        <input />
                      </label>
                    </div>
                  </>
                )}

                {employeeSideTab === "password" && (
                  <>
                    <div className={styles.employeeSectionHeader}>
                      <h2>Passwort ändern</h2>
                    </div>
                    <div className={styles.employeeFormGrid}>
                      <label className={styles.fullWidth}>
                        Neues Passwort{isNewEmployee ? " *" : ""}
                        <input
                          type="text"
                          value={userPassword}
                          disabled={!mayManageUsers}
                          onChange={(event) => setUserPassword(event.target.value)}
                          placeholder={isNewEmployee ? "Passwort für Login vergeben" : "Leer lassen, wenn unverändert"}
                        />
                      </label>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        disabled={!mayManageUsers}
                        onClick={generateUserPassword}
                      >
                        Passwort generieren
                      </button>
                    </div>
                  </>
                )}
              </section>
            </div>
          ) : (
            <section className={styles.employeeDetailPanel}>
              {employeeTopTab === "absence" && (
                <>
                  <div className={styles.employeeKpiGrid}>
                    <article>
                      <span>Aktuelles Urlaubsbudget</span>
                      <strong>30 t</strong>
                      <small>noch verfügbar</small>
                    </article>
                    <article>
                      <span>Beantragt</span>
                      <strong>0 t</strong>
                      <small>offene Abwesenheitsanträge</small>
                    </article>
                    <article>
                      <span>Genehmigt</span>
                      <strong>0 t</strong>
                      <small>für dieses Jahr</small>
                    </article>
                  </div>
                  <section className={styles.tableCard}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Zeitraum</th>
                          <th>Dauer</th>
                          <th>Abwesenheitsart</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={4}>Keine passenden Einträge gefunden.</td>
                        </tr>
                      </tbody>
                    </table>
                  </section>
                </>
              )}
              {employeeTopTab === "time" && (
                <>
                  <div className={styles.employeeTimeFilters}>
                    <div className={styles.segmentedControl}>
                      {[
                        ["day", "Tag"],
                        ["month", "Monat"],
                        ["year", "Jahr"],
                        ["custom", "Zeitraum"],
                      ].map(([period, label]) => (
                        <button
                          key={period}
                          type="button"
                          data-active={employeeTimePeriod === period}
                          onClick={() => setEmployeeTimePeriod(period as EmployeeTimePeriod)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {employeeTimePeriod === "custom" && (
                      <div className={styles.employeeTimeRange}>
                        <label>
                          Von
                          <input
                            type="date"
                            value={employeeTimeFrom}
                            onChange={(event) => setEmployeeTimeFrom(event.target.value)}
                          />
                        </label>
                        <label>
                          Bis
                          <input
                            type="date"
                            value={employeeTimeTo}
                            onChange={(event) => setEmployeeTimeTo(event.target.value)}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                  <div className={styles.employeeKpiGrid}>
                    <article>
                      <span>Ist Gesamt</span>
                      <strong>{formatStampDuration(employeeTotalTimeMs)}</strong>
                      <small>Produktiv + unproduktiv</small>
                    </article>
                    <article>
                      <span>Ist-Produktiv</span>
                      <strong>{formatStampDuration(employeeProductiveMs)}</strong>
                      <small>Projektzeiten</small>
                    </article>
                    <article>
                      <span>Ist-Unproduktiv</span>
                      <strong>{formatStampDuration(employeeUnproductiveMs)}</strong>
                      <small>Unproduktive Stempelungen</small>
                    </article>
                    <article>
                      <span>Soll</span>
                      <strong>{Number(userDailyWorkHours || 0) * 5}:00</strong>
                      <small>Wochenarbeitszeit</small>
                    </article>
                    <article>
                      <span>Saldo</span>
                      <strong>00:00</strong>
                      <small>Stunden</small>
                    </article>
                  </div>
                  <section className={styles.tableCard}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Datum</th>
                          <th>Art</th>
                          <th>Dauer</th>
                          <th>Pause</th>
                          <th>Projekt / Bereich</th>
                          <th>Kommentar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeTimeEntries.length === 0 ? (
                          <tr>
                            <td colSpan={6}>Keine Zeiteinträge im gewählten Zeitraum.</td>
                          </tr>
                        ) : (
                          employeeTimeEntries.map((entry) => (
                            <tr key={entry.id}>
                              <td>{entry.date}</td>
                              <td>{entry.mode === "project" ? "Produktiv" : "Unproduktiv"}</td>
                              <td>{formatStampDuration(entry.durationMs)}</td>
                              <td>{formatStampDuration(entry.pauseMs)}</td>
                              <td>{entry.mode === "project" ? entry.projectLabel : "Unproduktiv"}</td>
                              <td>{entry.comment || "-"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </section>
                </>
              )}
              {employeeTopTab === "balance" && (
                <section className={styles.tableCard}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Mitarbeiter</th>
                        <th>Zeit</th>
                        <th>Ausgleichsart</th>
                        <th>Verrechnungszeitpunkt</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={4}>Keine passenden Einträge gefunden.</td>
                      </tr>
                    </tbody>
                  </table>
                </section>
              )}
              {employeeTopTab === "documents" && (
                <section className={styles.tableCard}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Dateiname</th>
                        <th>Kategorie</th>
                        <th>Erstellt am</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={3}>Noch keine Dokumente hinterlegt.</td>
                      </tr>
                    </tbody>
                  </table>
                </section>
              )}
            </section>
          )}
        </section>
      );
    }

    return (
      <section className={styles.employeePage}>
        <div className={styles.topline}>
          <div>
            <p className={styles.eyebrow}>Team</p>
            <h1>Mitarbeiterverwaltung</h1>
            <p className={styles.subline}>Verwaltung der Mitarbeiter im Projektmanagement.</p>
          </div>
          <button type="button" className={styles.primaryButton} onClick={openNewEmployeeFile}>
            + Mitarbeiter
          </button>
        </div>

        <div className={styles.employeeTabs}>
          <button
            type="button"
            data-active={employeeStatusView === "active"}
            onClick={() => setEmployeeStatusView("active")}
          >
            Aktiv
          </button>
          <button
            type="button"
            data-active={employeeStatusView === "inactive"}
            onClick={() => setEmployeeStatusView("inactive")}
          >
            Inaktive
          </button>
        </div>

        <section className={styles.contactToolbar}>
          <label>
            Suche
            <input
              value={employeeSearchTerm}
              onChange={(event) => setEmployeeSearchTerm(event.target.value)}
              placeholder="Name, E-Mail, Rolle oder Niederlassung"
            />
          </label>
          <div className={styles.contactToolbarActions}>
            <strong>{visibleEmployees.length} Einträge gefunden</strong>
          </div>
        </section>

        <section className={`${styles.tableCard} ${styles.employeeTableCard}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Mitarbeiter</th>
                <th>Benutzerrechte</th>
                <th>Position</th>
                <th>Niederlassungen</th>
                <th>Erstellt</th>
              </tr>
            </thead>
            <tbody>
              {visibleEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6}>Keine passenden Einträge gefunden.</td>
                </tr>
              ) : (
                visibleEmployees.map((user, index) => (
                  <tr key={user.id} className={styles.clickableRow} onClick={() => openEmployeeFile(user)}>
                    <td>{132421 + index}</td>
                    <td className={styles.employeeIdentityCell}>
                      {user.profileImageDataUrl ? (
                        <img src={user.profileImageDataUrl} alt={user.name} />
                      ) : (
                        <span>{getInitials(user.name)}</span>
                      )}
                      <div>
                        <strong>{user.name} <small>(Standard-Nutzer)</small></strong>
                        <em>{user.email}</em>
                      </div>
                    </td>
                    <td>{user.roleLabel}</td>
                    <td>{user.role === "MITARBEITER" ? "Mitarbeiter" : user.roleLabel}</td>
                    <td>
                      {user.teamIds.length === teams.length && teams.length > 0
                        ? "2 Niederlassungen"
                        : user.teamIds
                            .map((teamId) => teams.find((team) => team.id === teamId)?.name)
                            .filter(Boolean)
                            .join(", ") || "-"}
                    </td>
                    <td>-</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </section>
    );
  }

  function renderFirmSettings() {
    const activeSettingsLabel =
      firmSettingsTabs.find((item) => item.id === firmSettingsTab)?.label ?? "Firmeneinstellungen";
    const projectTypeRows = [
      {
        name: "Projekt OK solutions",
        prefix: "OKS",
        numberPrefix: "ASS",
        nextNumber: "388",
        pipeline: "OK solutions",
      },
      {
        name: "Projekt OK immocare",
        prefix: "OKI",
        numberPrefix: "IMM",
        nextNumber: "81",
        pipeline: "OK immocare",
      },
    ];
    const companyProfileRows = [
      ["Firmenname", "OK solutions GmbH"],
      ["Anschrift", "Im Krötenteich 3/4, 74722 Buchen"],
      ["Telefonnummer", "06281 3263110"],
      ["Mobilfunknummer", ""],
      ["Faxnummer", ""],
      ["Webseite", "https://www.ok-solutions.com"],
      ["Gründung", "04.04.24"],
      ["Rechtsform", "GmbH"],
      ["Kontoinhaber", ""],
      ["Bank", "Sparkasse Neckartal-Odenwald"],
      ["IBAN", "DE85674500480004369971"],
      ["BIC", "SOLADES1MOS"],
      ["Steuernummer", ""],
      ["Handelsregisternummer", "HRB 750622"],
      ["USt-IdNr.", "DE367346374"],
    ];
    const serviceRows = [
      "Arbeitssicherheit",
      "Dachreinigung",
      "Fassadenreinigung",
      "Glasreinigung",
      "Grünflächen- und Gartenpflege",
      "Hausmeisterservice",
      "Hausverwaltung",
      "Winterdienst",
      "Wartung",
      "Reinigung",
    ];
    const holidayCatalog = buildGermanHolidayCatalog(new Date().getFullYear(), 50);

    return (
      <section className={styles.settingsPanel}>
        <div className={styles.topline}>
          <div>
            <p className={styles.eyebrow}>Firmeneinstellungen</p>
            <h1>{activeSettingsLabel}</h1>
            <p className={styles.subline}>
              Grundlagen für Firmenprofil, Projektlogik, Dokumente, Rechte und Automationen.
            </p>
          </div>
        </div>

        {firmSettingsTab === "profile" ? (
          <section className={styles.companyProfileGrid}>
            <article className={`${styles.settingsCard} ${styles.companyProfileCard}`}>
              <div className={styles.settingsHeader}>
                <div>
                  <h2>Firmendaten</h2>
                </div>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => {
                    setCompanyProfileEditTab("general");
                    setIsCompanyProfileModalOpen(true);
                  }}
                >
                  Bearbeiten
                </button>
              </div>
              <div className={styles.companyProfileData}>
                {companyProfileRows.map(([label, value]) => (
                  <div key={label}>
                    <strong>{label}</strong>
                    <span data-empty={!value ? "true" : undefined}>{value || "-"}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className={`${styles.settingsCard} ${styles.companyProfileCard}`}>
              <div className={styles.settingsHeader}>
                <div>
                  <h2>Gewerke & Leistungen</h2>
                </div>
                <button
                  type="button"
                  className={styles.secondaryButton}
                    onClick={() => {
                      setTradeDraftName("");
                      setTradeDraftPrefix("");
                      setTradeManagementError("");
                      setIsTradeManagementModalOpen(true);
                    }}
                >
                  Gewerke bearbeiten
                </button>
              </div>
              <div className={styles.companyServicesTable}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Kürzel</th>
                      <th>Beschreibung</th>
                      <th>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(trades.length > 0 ? trades.map((trade) => trade.name) : serviceRows).map((service) => (
                      <tr key={service}>
                        <td className={styles.title}>{service}</td>
                        <td>{trades.find((trade) => trade.name === service)?.projectPrefix || getProjectTradePrefix(service)}</td>
                        <td />
                        <td>
                          <button type="button" className={styles.secondaryButton}>
                            Beschreibung
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        ) : firmSettingsTab === "projectTypes" ? (
          <section className={styles.settingsCard}>
            <div className={styles.settingsHeader}>
              <div>
                <h2>Projekttypen und Nummernlogik</h2>
                <p>
                  Hier legen wir später fest, welches Kürzel und welcher nächste Nummernkreis bei
                  der Projektanlage verwendet wird.
                </p>
              </div>
              <button type="button" className={styles.primaryButton}>
                + Projekttyp
              </button>
            </div>
            <div className={styles.companySettingsTable}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Projekttyp</th>
                    <th>Pipeline</th>
                    <th>Interner Code</th>
                    <th>Projektnummer-Präfix</th>
                    <th>Nächste Nummer</th>
                    <th>Beispiel</th>
                  </tr>
                </thead>
                <tbody>
                  {projectTypeRows.map((row) => (
                    <tr key={row.name}>
                      <td className={styles.title}>{row.name}</td>
                      <td>{row.pipeline}</td>
                      <td>
                        <input defaultValue={row.prefix} />
                      </td>
                      <td>
                        <input defaultValue={row.numberPrefix} />
                      </td>
                      <td>
                        <input defaultValue={row.nextNumber} />
                      </td>
                      <td className={styles.number}>
                        {row.numberPrefix}-{row.nextNumber}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.settingsHeader}>
              <div>
                <h2>Feiertagskalender</h2>
                <p>Alle Bundesländer sind für die nächsten 50 Jahre hinterlegt.</p>
              </div>
            </div>
            <div className={styles.companySettingsTable}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Bundesland</th>
                    <th>Kürzel</th>
                    <th>Zeitraum</th>
                    <th>Feiertage</th>
                  </tr>
                </thead>
                <tbody>
                  {holidayCatalog.map((stateOption) => (
                    <tr key={stateOption.value}>
                      <td className={styles.title}>{stateOption.label}</td>
                      <td>{stateOption.value}</td>
                      <td>
                        {new Date().getFullYear()}-{new Date().getFullYear() + 49}
                      </td>
                      <td>{stateOption.holidays.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : firmSettingsTab === "branches" ? (
          <section className={styles.settingsCard}>
            <div className={styles.settingsHeader}>
              <div>
                <h2>Niederlassungen</h2>
                <p>Diese Werte steuern später die Auswahl in Projektanlage und Dokumenten.</p>
              </div>
              <button type="button" className={styles.primaryButton}>
                + Niederlassung
              </button>
            </div>
            <div className={styles.companySettingsList}>
              <article>
                <strong>OK solutions GmbH</strong>
                <span>Standard für Projekt OK solutions</span>
              </article>
              <article>
                <strong>OK immocare GmbH</strong>
                <span>Standard für Projekt OK immocare</span>
              </article>
            </div>
            <div className={styles.settingsHeader}>
              <div>
                <h2>Feiertagskalender</h2>
                <p>Alle Bundesländer sind für die nächsten 50 Jahre hinterlegt.</p>
              </div>
            </div>
            <div className={styles.companySettingsTable}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Bundesland</th>
                    <th>Kürzel</th>
                    <th>Zeitraum</th>
                    <th>Feiertage</th>
                  </tr>
                </thead>
                <tbody>
                  {holidayCatalog.map((stateOption) => (
                    <tr key={stateOption.value}>
                      <td className={styles.title}>{stateOption.label}</td>
                      <td>{stateOption.value}</td>
                      <td>
                        {new Date().getFullYear()}-{new Date().getFullYear() + 49}
                      </td>
                      <td>{stateOption.holidays.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className={styles.settingsCard}>
            <div className={styles.settingsHeader}>
              <div>
                <h2>{activeSettingsLabel}</h2>
                <p>
                  Dieser Bereich ist angelegt. Die konkrete Logik bauen wir aus, sobald die
                  Grundlagen für Projekttypen, Nummernkreise und Dokumentenordner final stehen.
                </p>
              </div>
            </div>
            <div className={styles.plannedModuleGrid}>
              <article>
                <strong>Daten pflegen</strong>
                <span>Stammdaten und Auswahllisten für die operative Arbeit.</span>
              </article>
              <article>
                <strong>Regeln verbinden</strong>
                <span>Automatische Nummern, Ordner, Rechte und Vorlagen.</span>
              </article>
              <article>
                <strong>In Masken nutzen</strong>
                <span>Projektanlage, Kundenakte, Dokumente und Aufgaben greifen darauf zu.</span>
              </article>
            </div>
          </section>
        )}
      </section>
    );
  }

  function updateDocumentLayoutConfig<K extends keyof DocumentLayoutConfig>(
    key: K,
    value: DocumentLayoutConfig[K]
  ) {
    setDocumentLayoutConfig((current) => ({
      ...current,
      [key]: value,
    }));
    setDocumentConfigSaveMessage("");
  }

  function openDocumentTypeEditor(documentType?: DocumentTypeSummary) {
    if (documentType) {
      setEditingDocumentTypeId(documentType.id);
      setDocumentLayoutConfig({
        ...defaultDocumentLayoutConfig,
        ...documentType.config,
        name: documentType.name,
        baseType: documentType.baseType,
        folder: documentType.folder,
        status: documentType.status,
      });
    } else {
      setEditingDocumentTypeId("");
      setDocumentLayoutConfig({
        ...defaultDocumentLayoutConfig,
        name: "Neuer Dokumenttyp",
      });
    }
    setDocumentConfigSection("general");
    setDocumentPreviewPage("first");
    setDocumentConfigSaveMessage("");
    setDocumentTypeError("");
    setIsDocumentTypeEditorOpen(true);
  }

  async function saveDocumentLayoutConfig() {
    const method = editingDocumentTypeId ? "PATCH" : "POST";
    const res = await fetch("/api/document-types", {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: editingDocumentTypeId,
        name: documentLayoutConfig.name,
        baseType: documentLayoutConfig.baseType,
        folder: documentLayoutConfig.folder,
        status: documentLayoutConfig.status,
        config: documentLayoutConfig,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setDocumentTypeError(data?.error ?? "Dokumententyp konnte nicht gespeichert werden.");
      return;
    }

    const data = (await res.json()) as DocumentTypeSummary[];
    setDocumentTypes(data);
    const saved = data.find((item) => item.name === documentLayoutConfig.name);
    if (saved) setEditingDocumentTypeId(saved.id);
    setDocumentConfigSaveMessage("Gespeichert");
    setDocumentTypeError("");
  }

  async function archiveDocumentType(documentTypeId: string) {
    const res = await fetch("/api/document-types", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: documentTypeId }),
    });

    if (!res.ok) {
      setDocumentTypeError("Dokumententyp konnte nicht archiviert werden.");
      return;
    }

    const data = (await res.json()) as DocumentTypeSummary[];
    setDocumentTypes(data);
    setDocumentTypeError("");
  }

  function handleLetterheadUpload(file: File | null) {
    if (!file) return;

    if (file.type !== "application/pdf") {
      setDocumentTypeError("Bitte eine PDF-Datei als Briefpapier hochladen.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setDocumentLayoutConfig((current) => ({
        ...current,
        showLetterhead: true,
        letterheadFileName: file.name,
        letterheadDataUrl: String(reader.result ?? ""),
      }));
      setDocumentTypeError("");
      setDocumentConfigSaveMessage("");
    };
    reader.readAsDataURL(file);
  }

  function removeLetterheadUpload() {
    setDocumentLayoutConfig((current) => ({
      ...current,
      letterheadFileName: "",
      letterheadDataUrl: "",
    }));
    setDocumentConfigSaveMessage("");
    if (letterheadUploadRef.current) {
      letterheadUploadRef.current.value = "";
    }
  }

  function renderDocumentField<K extends keyof DocumentLayoutConfig>(
    label: string,
    key: K,
    options?: {
      type?: "text" | "number" | "select" | "textarea";
      choices?: string[];
      full?: boolean;
      suffix?: string;
    }
  ) {
    const value = documentLayoutConfig[key];

    return (
      <label
        className={`${styles.documentConfigField} ${
          options?.full ? styles.documentConfigFieldFull : ""
        }`}
      >
        <span>{label}</span>
        <div className={styles.documentConfigInputWrap}>
          {options?.type === "select" ? (
            <select
              value={String(value)}
              onChange={(event) =>
                updateDocumentLayoutConfig(key, event.target.value as DocumentLayoutConfig[K])
              }
            >
              {options.choices && !options.choices.includes(String(value)) ? (
                <option value={String(value)}>{String(value)}</option>
              ) : null}
              {(options.choices ?? []).map((choice) => (
                <option key={choice} value={choice}>
                  {choice}
                </option>
              ))}
            </select>
          ) : options?.type === "textarea" ? (
            <textarea
              value={String(value)}
              onChange={(event) =>
                updateDocumentLayoutConfig(key, event.target.value as DocumentLayoutConfig[K])
              }
              rows={4}
            />
          ) : (
            <input
              type={options?.type === "number" ? "number" : "text"}
              value={String(value)}
              onChange={(event) =>
                updateDocumentLayoutConfig(key, event.target.value as DocumentLayoutConfig[K])
              }
            />
          )}
          {options?.suffix ? <strong>{options.suffix}</strong> : null}
        </div>
      </label>
    );
  }

  function renderDocumentCheckbox<K extends keyof DocumentLayoutConfig>(label: string, key: K) {
    return (
      <label className={styles.documentConfigCheckbox}>
        <input
          type="checkbox"
          checked={Boolean(documentLayoutConfig[key])}
          onChange={(event) =>
            updateDocumentLayoutConfig(key, event.target.checked as DocumentLayoutConfig[K])
          }
        />
        <span>{label}</span>
      </label>
    );
  }

  function renderDocumentEditor<K extends keyof DocumentLayoutConfig>(label: string, key: K) {
    return (
      <label className={`${styles.documentConfigField} ${styles.documentConfigFieldFull}`}>
        <span>{label}</span>
        <div className={styles.documentMiniEditor}>
          <div className={styles.documentEditorToolbar}>
            {["B", "I", "U", "15", "A", "Liste", "Tabelle", "</>"].map((item) => (
              <button key={item} type="button">
                {item}
              </button>
            ))}
          </div>
          <textarea
            value={String(documentLayoutConfig[key])}
            onChange={(event) =>
              updateDocumentLayoutConfig(key, event.target.value as DocumentLayoutConfig[K])
            }
            rows={5}
          />
        </div>
      </label>
    );
  }

  function renderDocumentConfiguratorForm() {
    if (documentConfigSection === "general") {
      return (
        <section className={styles.documentConfigSection}>
          <h2>Allgemeine Einstellungen</h2>
          <div className={styles.documentConfigGrid}>
            {renderDocumentField("Basistyp", "baseType")}
            {renderDocumentField("Name", "name")}
            {renderDocumentField("Status", "status", {
              type: "select",
              choices: ["Aktiv", "Inaktiv", "Entwurf"],
            })}
            {renderDocumentField("Standardordner", "folder", {
              type: "select",
              choices: ["Angebote", "Rechnungen", "Anfragen", "Mahnung", "Taetigkeitsberichte"],
            })}
            {renderDocumentField("Nummernkreis fuer diesen Dokumententyp", "numberRange")}
            {renderDocumentField("Projekt nach Erstellung verschieben in", "moveProjectStatus", {
              type: "select",
              choices: [
                "(keine Aenderung)",
                "Angebot",
                "Warten auf Kunde",
                "Zur Planung bereit",
                "Abrechnungsbereit",
              ],
            })}
          </div>
        </section>
      );
    }

    if (documentConfigSection === "layout") {
      return (
        <section className={styles.documentConfigSection}>
          <h2>Seitenraender</h2>
          <div className={styles.documentConfigGrid}>
            {renderDocumentField("Oben", "marginTop", { type: "number" })}
            {renderDocumentField("Links", "marginLeft", { type: "number" })}
            {renderDocumentField("Unten", "marginBottom", { type: "number" })}
            {renderDocumentField("Rechts", "marginRight", { type: "number" })}
          </div>

          <h2>Layout</h2>
          <div className={styles.documentConfigGrid}>
            {renderDocumentField("Grundlayout", "baseLayout", {
              type: "select",
              choices: ["Klassisch", "Modern", "Kompakt"],
            })}
            {renderDocumentField("Schriftart", "fontFamily", {
              type: "select",
              choices: ["Arial", "Inter", "Calibri", "Helvetica"],
            })}
            {renderDocumentField("Schriftgroesse", "fontSize", {
              type: "select",
              choices: ["8pt", "9pt", "10pt", "11pt", "12pt"],
            })}
            <div className={styles.documentConfigCheckboxRow}>
              {renderDocumentCheckbox("Falzmarken auf erster Seite anzeigen", "showFoldMarks")}
            </div>
          </div>

          <h2>Hauptblock</h2>
          <div className={styles.documentConfigGrid}>
            {renderDocumentField("Oben", "mainTop", { type: "number" })}
            {renderDocumentField("Links", "mainLeft", { type: "number" })}
            {renderDocumentField("Rechts", "mainRight", { type: "number" })}
            {renderDocumentField("Einleitungstext", "introText", {
              type: "select",
              choices: documentTexts
                .filter((item) => item.kind === "text" && item.title.toLowerCase().includes("einleitung"))
                .map((item) => item.title),
            })}
            {renderDocumentField("Abschlusstext", "closingText", {
              type: "select",
              choices: documentTexts
                .filter((item) => item.kind === "text" && item.title.toLowerCase().includes("abschluss"))
                .map((item) => item.title),
            })}
          </div>

          <h2>Positionen</h2>
          <div className={styles.documentConfigCheckboxGrid}>
            {renderDocumentCheckbox("Positions-Beschreibung", "showPositionDescription")}
            {renderDocumentCheckbox("Positions-Bilder", "showPositionImages")}
            {renderDocumentCheckbox("Aufmass in PDF anzeigen", "showQuantityPdf")}
            {renderDocumentCheckbox("EAN-Nummer", "showEan")}
            {renderDocumentCheckbox("Artikelnummer anzeigen", "showArticleNumbers")}
            {renderDocumentCheckbox("Einzelpreise ausblenden", "hideSinglePrices")}
            {renderDocumentCheckbox("Titelsummen anzeigen", "showTitleSums")}
            {renderDocumentCheckbox("Bestellwert ausblenden", "hideOrderValue")}
            {renderDocumentCheckbox("MwSt. ausweisen", "showVat")}
            {renderDocumentCheckbox("MwSt.-Satz ausweisen", "showVatRate")}
            {renderDocumentCheckbox("Zusammenfassung der Titel", "showTitleSummary")}
            {renderDocumentCheckbox("Aufschlag anzeigen", "showSurcharge")}
            {renderDocumentCheckbox("Lohn/Maschinenkosten anzeigen", "showLaborMachineCosts")}
            {renderDocumentCheckbox("Artikelpreise in Leistungen anzeigen", "showArticlePricesInServices")}
          </div>

          <h2>Fusszeile</h2>
          <div className={styles.documentConfigGrid}>
            {renderDocumentField("Fusszeile", "footerText", { full: true })}
            {renderDocumentField("Abstand zum Hauptblock", "footerDistance", { type: "number" })}
            {renderDocumentField("Schriftgroesse Fusszeile", "footerFontSize", {
              type: "select",
              choices: ["6pt", "7pt", "8pt", "9pt"],
            })}
          </div>

          <h2>Briefpapier</h2>
          <div className={styles.documentLetterheadUpload}>
            <div>
              {renderDocumentCheckbox("Briefpapier anzeigen", "showLetterhead")}
              <p>
                PDF hochladen, die beim Dokument als Hintergrund bzw. Briefbogen verwendet wird.
              </p>
            </div>
            <div className={styles.documentLetterheadActions}>
              <input
                ref={letterheadUploadRef}
                type="file"
                accept="application/pdf"
                onChange={(event) => handleLetterheadUpload(event.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => letterheadUploadRef.current?.click()}
              >
                PDF hochladen
              </button>
              {documentLayoutConfig.letterheadFileName ? (
                <>
                  <span>{documentLayoutConfig.letterheadFileName}</span>
                  <button type="button" onClick={removeLetterheadUpload}>
                    Entfernen
                  </button>
                </>
              ) : (
                <span>Noch kein Briefpapier hinterlegt</span>
              )}
            </div>
          </div>
        </section>
      );
    }

    if (documentConfigSection === "firstPage") {
      return (
        <section className={styles.documentConfigSection}>
          <h2>Adresszeile</h2>
          <div className={styles.documentConfigGrid}>
            <div className={styles.documentConfigCheckboxRow}>
              {renderDocumentCheckbox("Eigene Adresszeile", "addressLineEnabled")}
            </div>
            {renderDocumentField("Adresszeile", "addressLineText", { full: true })}
            {renderDocumentField("Position oben", "addressLineTop", { type: "number" })}
            {renderDocumentField("Position links", "addressLineLeft", { type: "number" })}
          </div>

          <h2>Betreffzeile 1</h2>
          <div className={styles.documentConfigGrid}>
            {renderDocumentCheckbox("Betreffzeile 1 anzeigen", "subjectOneEnabled")}
            {renderDocumentCheckbox("fettgedruckt", "subjectOneBold")}
            {renderDocumentField("Inhalt", "subjectOneSource", {
              type: "select",
              choices: ["Projektname", "Dokumentnummer", "Kundenname"],
            })}
            {renderDocumentField("Schriftart", "subjectOneFont", {
              type: "select",
              choices: ["Arial", "Inter", "Calibri"],
            })}
            {renderDocumentField("Schriftgroesse", "subjectOneSize", {
              type: "select",
              choices: ["11pt", "12pt", "13pt", "14pt"],
            })}
            {renderDocumentField("Praefix", "subjectOnePrefix")}
          </div>

          <h2>Logo und Firmenanschrift</h2>
          <div className={styles.documentConfigGrid}>
            {renderDocumentCheckbox("Logo", "showFirstPageLogo")}
            {renderDocumentCheckbox("Anschrift", "showFirstPageAddress")}
            {renderDocumentField("Position oben", "firstPageLogoTop", { type: "number" })}
            {renderDocumentField("Position links", "firstPageLogoLeft", { type: "number" })}
            {renderDocumentField("Breite", "firstPageLogoWidth", { type: "number" })}
            {renderDocumentField("Hoehe", "firstPageLogoHeight", { type: "number" })}
            {renderDocumentEditor("Anschrift", "firstPageAddressText")}
          </div>

          <h2>Dokumentinformationen und Kontaktdaten</h2>
          <div className={styles.documentConfigCheckboxGrid}>
            {renderDocumentCheckbox("Infoblock anzeigen", "firstPageInfoBlock")}
            {renderDocumentCheckbox("Kundennummer", "showCustomerNumber")}
            {renderDocumentCheckbox("Dokumentnummer", "showDocumentNumber")}
            {renderDocumentCheckbox("USt-IdNr. des Empfaengers", "showRecipientVatId")}
            {renderDocumentCheckbox("Name", "showContactName")}
            {renderDocumentCheckbox("Telefon", "showContactPhone")}
            {renderDocumentCheckbox("Mobil", "showContactMobile")}
            {renderDocumentCheckbox("Fax", "showContactFax")}
            {renderDocumentCheckbox("E-Mail", "showContactEmail")}
          </div>
          <div className={styles.documentConfigGrid}>
            {renderDocumentField("Liefer- oder Leistungsdatum anzeigen", "deliveryDateMode", {
              type: "select",
              choices: ["Nicht anzeigen", "Lieferdatum", "Leistungsdatum"],
            })}
            {renderDocumentField("Zahlungsart", "paymentTypeMode", {
              type: "select",
              choices: ["Nicht anzeigen", "Anzeigen"],
            })}
            {renderDocumentField("Ansprechpartner/in", "contactDisplayMode", {
              type: "select",
              choices: ["Hauptansprechpartner/in", "Projektansprechpartner/in", "Rechnungsempfaenger/in"],
            })}
          </div>

          <h2>Freitext-Informationsblock</h2>
          <div className={styles.documentConfigGrid}>
            {renderDocumentCheckbox("Infoblock anzeigen", "showFreeInfoBlock")}
            {renderDocumentField("Oben", "freeInfoTop", { type: "number" })}
            {renderDocumentField("Links", "freeInfoLeft", { type: "number" })}
            {renderDocumentField("Breite", "freeInfoWidth", { type: "number" })}
            {renderDocumentEditor("Inhalt", "freeInfoContent")}
          </div>
        </section>
      );
    }

    if (documentConfigSection === "followingPages") {
      return (
        <section className={styles.documentConfigSection}>
          <h2>Layout Folgeseiten</h2>
          <div className={styles.documentConfigGrid}>
            {renderDocumentCheckbox("Logo", "followingShowLogo")}
            {renderDocumentCheckbox("Anschrift", "followingShowAddress")}
            {renderDocumentField("Position oben", "followingLogoTop", { type: "number" })}
            {renderDocumentField("Position links", "followingLogoLeft", { type: "number" })}
            {renderDocumentField("Breite", "followingLogoWidth", { type: "number" })}
            {renderDocumentField("Hoehe", "followingLogoHeight", { type: "number" })}
          </div>

          <h2>Informationsblock im Kopfbereich</h2>
          <div className={styles.documentConfigGrid}>
            {renderDocumentCheckbox("Infoblock auf Folgeseiten anzeigen", "followingInfoBlock")}
            {renderDocumentCheckbox("Infoblock auch auf erster Seite anzeigen", "followingInfoAlsoFirstPage")}
            {renderDocumentField("Oben", "followingInfoTop", { type: "number" })}
            {renderDocumentField("Links", "followingInfoLeft", { type: "number" })}
            {renderDocumentField("Breite", "followingInfoWidth", { type: "number" })}
          </div>
          <div className={styles.documentConfigCheckboxGrid}>
            {renderDocumentCheckbox("Dokumentnummer", "followingShowDocumentNumber")}
            {renderDocumentCheckbox("Projektnummer", "followingShowProjectNumber")}
            {renderDocumentCheckbox("Ansprechpartner", "followingShowContact")}
            {renderDocumentCheckbox("Telefon", "followingShowPhone")}
            {renderDocumentCheckbox("Mobil", "followingShowMobile")}
            {renderDocumentCheckbox("Fax", "followingShowFax")}
            {renderDocumentCheckbox("E-Mail", "followingShowEmail")}
          </div>
        </section>
      );
    }

    if (documentConfigSection === "options") {
      return (
        <section className={styles.documentConfigSection}>
          <h2>Allgemein</h2>
          <div className={styles.documentConfigGrid}>
            {renderDocumentField("Betreff Praefix", "subjectPrefix", { full: true })}
          </div>
        </section>
      );
    }

    return (
      <section className={styles.documentConfigSection}>
        <h2>Einstellungen</h2>
        <div className={styles.documentConfigGrid}>
          {renderDocumentCheckbox("Buchungsrelevant", "bookingRelevant")}
          {renderDocumentField("Buchungskategorie", "bookingCategory", {
            type: "select",
            choices: ["Standard", "Material", "Dienstleistung", "Sonstige"],
          })}
          {renderDocumentField("Buchungsseite", "bookingSide", {
            type: "select",
            choices: ["Soll", "Haben"],
          })}
          {renderDocumentField("Standard-Buchungskonto", "bookingAccount")}
          {renderDocumentField("Kostenstelle", "costCenter", {
            type: "select",
            choices: ["", "OK solutions", "OK immocare", "Marketing", "Buchhaltung"],
          })}
          {renderDocumentField(
            "Dokumenttyp fuer Stornorechnungen und Rechnungskorrekturen",
            "correctionDocumentType",
            {
              type: "select",
              choices: ["Stornorechnung", "Rechnungskorrektur", "Gutschrift"],
            }
          )}
        </div>
      </section>
    );
  }

  function renderDocumentPreview() {
    const isFirstPage = documentPreviewPage === "first";
    const hasLetterheadBackground =
      documentLayoutConfig.showLetterhead && Boolean(documentLayoutConfig.letterheadDataUrl);
    const previewPdfPage = isFirstPage ? 1 : 2;
    const introTemplate = documentTexts.find((item) => item.title === documentLayoutConfig.introText);
    const closingTemplate = documentTexts.find(
      (item) => item.title === documentLayoutConfig.closingText
    );
    const introPreview =
      introTemplate?.body
        .replace("{{customer.titleFullName}}", "Sehr geehrter Herr Mustermann")
        .replace("{{partner.fullName}}", "Ramona Eid")
        .replace("{{project.name}}", "Musterprojekt")
        .replace("{{project.displayId}}", "ANG-10367")
        .split("\n")
        .filter(Boolean)
        .slice(0, 2)
        .join(" ") ??
      "Sehr geehrter Herr Mustermann, wir danken Ihnen fuer Ihre Anfrage und unterbreiten Ihnen auf den folgenden Seiten unser Angebot.";
    const closingPreview =
      closingTemplate?.body
        .replace("{{partner.fullName}}", "Ramona Eid")
        .replace("{{projectPartner.fullName}}", "Ramona Eid")
        .split("\n")
        .filter(Boolean)
        .slice(0, 2)
        .join(" ") ?? "";
    const mainTop = Number.parseInt(documentLayoutConfig.mainTop, 10);
    const mainLeft = Number.parseInt(documentLayoutConfig.mainLeft, 10);
    const mainRight = Number.parseInt(documentLayoutConfig.mainRight, 10);
    const mainBlockStyle = {
      "--document-main-top": `${Number.isFinite(mainTop) ? mainTop : 100}px`,
      "--document-main-left": `${Number.isFinite(mainLeft) ? mainLeft : 25}px`,
      "--document-main-right": `${Number.isFinite(mainRight) ? mainRight : 15}px`,
    } as CSSProperties;
    const showLogo = isFirstPage
      ? documentLayoutConfig.showFirstPageLogo
      : documentLayoutConfig.followingShowLogo;
    const showInfo = isFirstPage
      ? documentLayoutConfig.firstPageInfoBlock
      : documentLayoutConfig.followingInfoBlock;

    return (
      <aside className={styles.documentPreviewPanel}>
        <div className={styles.documentPreviewTabs}>
          <button
            type="button"
            data-active={documentPreviewPage === "first"}
            onClick={() => setDocumentPreviewPage("first")}
          >
            Vorschau Seite 1
          </button>
          <button
            type="button"
            data-active={documentPreviewPage === "following"}
            onClick={() => setDocumentPreviewPage("following")}
          >
            Folgeseiten
          </button>
        </div>
        <div className={styles.documentPreviewPaper}>
          {documentLayoutConfig.showLetterhead && documentLayoutConfig.letterheadDataUrl ? (
            <div className={styles.documentPreviewLetterheadLayer} aria-hidden="true">
              <DocumentLetterheadCanvas
                key={`${documentLayoutConfig.letterheadFileName}-${previewPdfPage}`}
                dataUrl={documentLayoutConfig.letterheadDataUrl}
                fileName={documentLayoutConfig.letterheadFileName}
                pageNumber={previewPdfPage}
              />
            </div>
          ) : null}
          {documentLayoutConfig.showFoldMarks && !hasLetterheadBackground ? (
            <>
              <span className={styles.documentFoldMark} data-pos="top" />
              <span className={styles.documentFoldMark} data-pos="bottom" />
            </>
          ) : null}
          {showLogo && !hasLetterheadBackground ? (
            <div className={styles.documentPreviewLogo}>
              <strong>OK</strong>
              <span>immocare</span>
            </div>
          ) : null}
          {isFirstPage && documentLayoutConfig.addressLineEnabled ? (
            <p className={styles.documentPreviewAddressLine}>
              {documentLayoutConfig.addressLineText}
            </p>
          ) : null}
          <div className={styles.documentPreviewRecipient}>
            <span>Max Mustermann</span>
            <span>Musterstrasse 17a</span>
            <span>12345 Musterstadt</span>
          </div>
          {showInfo ? (
            <dl className={styles.documentPreviewInfoBlock}>
              {documentLayoutConfig.showDocumentNumber ||
              documentLayoutConfig.followingShowDocumentNumber ? (
                <>
                  <dt>Angebotsnummer</dt>
                  <dd>ANG-10367</dd>
                </>
              ) : null}
              {documentLayoutConfig.showCustomerNumber ? (
                <>
                  <dt>Kundennummer</dt>
                  <dd>1008</dd>
                </>
              ) : null}
              <dt>Datum</dt>
              <dd>04.05.2026</dd>
              {documentLayoutConfig.showContactName || documentLayoutConfig.followingShowContact ? (
                <>
                  <dt>Ansprechpartner</dt>
                  <dd>Ramona Eid</dd>
                </>
              ) : null}
              {documentLayoutConfig.showContactPhone || documentLayoutConfig.followingShowPhone ? (
                <>
                  <dt>Telefon</dt>
                  <dd>+49 6281 3263110</dd>
                </>
              ) : null}
              {documentLayoutConfig.showContactEmail || documentLayoutConfig.followingShowEmail ? (
                <>
                  <dt>E-Mail</dt>
                  <dd>ramona.eid@ok-solutions.com</dd>
                </>
              ) : null}
            </dl>
          ) : null}
          <div className={styles.documentPreviewMainBlock} style={mainBlockStyle}>
            <div className={styles.documentPreviewSubject}>
              {documentLayoutConfig.subjectOneEnabled ? (
                <strong>
                  {documentLayoutConfig.subjectOnePrefix} Musterprojekt
                </strong>
              ) : null}
              {documentLayoutConfig.subjectTwoEnabled ? (
                <strong>
                  {documentLayoutConfig.subjectPrefix} ANG-10367
                </strong>
              ) : null}
            </div>
            <p className={styles.documentPreviewText}>{introPreview}</p>
            <table className={styles.documentPreviewTable}>
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Menge</th>
                  <th>Bezeichnung</th>
                  {!documentLayoutConfig.hideSinglePrices ? <th>Einheitspreis</th> : null}
                  {!documentLayoutConfig.hideOrderValue ? <th>Gesamt</th> : null}
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((item) => (
                  <tr key={item}>
                    <td>{documentLayoutConfig.showArticleNumbers ? `1.00${item}` : `Pos. ${item}`}</td>
                    <td>{item === 2 ? "10 m2" : "1 Stk"}</td>
                    <td>
                      <strong>Position {item}</strong>
                      {documentLayoutConfig.showPositionDescription ? (
                        <span>Beschreibung der Leistung mit allen Arbeitsschritten.</span>
                      ) : null}
                    </td>
                    {!documentLayoutConfig.hideSinglePrices ? <td>{item * 100},00 EUR</td> : null}
                    {!documentLayoutConfig.hideOrderValue ? <td>{item * 100},00 EUR</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
            {documentLayoutConfig.showVat ? (
              <p className={styles.documentPreviewVat}>
                Alle Preise verstehen sich zzgl. gesetzlicher MwSt.
              </p>
            ) : null}
            {closingPreview ? (
              <p className={styles.documentPreviewClosing}>{closingPreview}</p>
            ) : null}
          </div>
          {documentLayoutConfig.showLetterhead && !hasLetterheadBackground ? (
            <footer className={styles.documentPreviewFooter}>
              {documentLayoutConfig.footerText}
            </footer>
          ) : null}
          {!hasLetterheadBackground ? (
            <span className={styles.documentPreviewWatermark}>WorkPilot360</span>
          ) : null}
        </div>
      </aside>
    );
  }

  function renderDocumentConfiguratorOverview() {
    const normalizedSearch = documentTypeSearch.trim().toLowerCase();
    const visibleDocumentTypes = documentTypes
      .filter((documentType) =>
        documentTypeView === "archive" ? documentType.isArchived : !documentType.isArchived
      )
      .filter((documentType) => {
        if (!normalizedSearch) return true;
        return [documentType.name, documentType.folder, documentType.status, documentType.baseType]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .slice(0, documentTypePageSize);

    return (
      <section className={styles.documentTypeOverview}>
        <div className={styles.documentTypeHeader}>
          <div>
            <h1>Dokumentenkonfigurator</h1>
            <p>Dokumenttypen und Layout-Vorlagen fuer WorkPilot360 verwalten.</p>
          </div>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => openDocumentTypeEditor()}
          >
            + Dokumententyp
          </button>
        </div>

        <div className={styles.documentTypeTabs}>
          <button
            type="button"
            data-active={documentTypeView === "active"}
            onClick={() => setDocumentTypeView("active")}
          >
            Alle
          </button>
          <button
            type="button"
            data-active={documentTypeView === "archive"}
            onClick={() => setDocumentTypeView("archive")}
          >
            Archiv
          </button>
        </div>

        <div className={styles.documentTypeToolbar}>
          <label>
            Zeige
            <select
              value={documentTypePageSize}
              onChange={(event) => setDocumentTypePageSize(Number(event.target.value))}
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            Eintraege
          </label>
          <label>
            Suchen:
            <input
              value={documentTypeSearch}
              onChange={(event) => setDocumentTypeSearch(event.target.value)}
            />
          </label>
        </div>

        {documentTypeError ? <p className={styles.formError}>{documentTypeError}</p> : null}

        <div className={styles.documentTypeTableWrap}>
          <table className={styles.documentTypeTable}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Standardordner</th>
                <th>Stand (letzte Aenderung)</th>
                <th>Status</th>
                <th aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {visibleDocumentTypes.length === 0 ? (
                <tr>
                  <td colSpan={5}>Keine Dokumenttypen gefunden.</td>
                </tr>
              ) : (
                visibleDocumentTypes.map((documentType) => (
                  <tr key={documentType.id}>
                    <td>
                      <button
                        type="button"
                        className={styles.documentTypeLink}
                        onClick={() => openDocumentTypeEditor(documentType)}
                      >
                        {documentType.name}
                      </button>
                    </td>
                    <td>{documentType.folder}</td>
                    <td>{documentType.updatedAtLabel}</td>
                    <td>{documentType.status}</td>
                    <td>
                      <div className={styles.documentTypeActions}>
                        <button
                          type="button"
                          aria-label="Bearbeiten"
                          onClick={() => openDocumentTypeEditor(documentType)}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
                            <path d="m14 7 3 3" />
                          </svg>
                        </button>
                        {!documentType.isArchived ? (
                          <button
                            type="button"
                            aria-label="Archivieren"
                            onClick={() => archiveDocumentType(documentType.id)}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M4 7h16" />
                              <path d="M6 7v12h12V7" />
                              <path d="M9 11h6" />
                              <path d="M8 4h8l1 3H7l1-3Z" />
                            </svg>
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderDocumentConfigurator() {
    if (!isDocumentTypeEditorOpen) {
      return renderDocumentConfiguratorOverview();
    }

    return (
      <section className={styles.documentConfiguratorPage}>
        <div className={styles.documentConfiguratorHeader}>
          <div>
            <p className={styles.eyebrow}>Dokumente</p>
            <h1>Dokumentenkonfigurator</h1>
            <p className={styles.subline}>
              Layout-Einstellungen fuer {documentLayoutConfig.name}
            </p>
          </div>
          <div className={styles.documentConfiguratorActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setIsDocumentTypeEditorOpen(false)}
            >
              Zurueck zur Uebersicht
            </button>
            <button type="button" className={styles.secondaryButton}>
              Vorlagen
            </button>
            <button type="button" className={styles.secondaryButton}>
              Aus Typ kopieren
            </button>
            <button type="button" className={styles.primaryButton} onClick={saveDocumentLayoutConfig}>
              Speichern
            </button>
            {documentConfigSaveMessage ? (
              <span className={styles.documentConfigSaved}>{documentConfigSaveMessage}</span>
            ) : null}
          </div>
        </div>

        <div className={styles.documentConfiguratorShell}>
          <nav className={styles.documentConfiguratorNav}>
            {documentConfiguratorSections.map((section) => (
              <button
                key={section.id}
                type="button"
                data-active={documentConfigSection === section.id}
                onClick={() => setDocumentConfigSection(section.id)}
              >
                {section.label}
              </button>
            ))}
          </nav>

          <div className={styles.documentConfiguratorForm}>
            {renderDocumentConfiguratorForm()}
            <div className={styles.documentConfigSaveRow}>
              <button type="button" className={styles.primaryButton} onClick={saveDocumentLayoutConfig}>
                Speichern
              </button>
              {documentConfigSaveMessage ? (
                <span className={styles.documentConfigSaved}>{documentConfigSaveMessage}</span>
              ) : null}
            </div>
          </div>

          {renderDocumentPreview()}
        </div>
      </section>
    );
  }

  function renderDocumentTextsAndTitles() {
    const visibleItems = documentTexts
      .filter((item) =>
        documentTextView === "titles" ? item.kind === "title" : item.kind === "text"
      )
      .filter((item) => {
        const search = documentTextSearch.trim().toLowerCase();
        if (!search) return true;
        return [item.source, item.title, item.body].join(" ").toLowerCase().includes(search);
      })
      .slice(0, documentTextPageSize);

    return (
      <section className={styles.documentTypeOverview}>
        <div className={styles.documentTypeHeader}>
          <div>
            <h1>Texte</h1>
            <p>Verwaltung fuer Dokumente, Titel und WorkPilot360-Template-Syntax.</p>
          </div>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => openDocumentTextModal()}
          >
            {documentTextView === "titles" ? "+ Titel" : "+ Text"}
          </button>
        </div>

        <div className={styles.documentTypeTabs}>
          <button
            type="button"
            data-active={documentTextView === "texts"}
            onClick={() => setDocumentTextView("texts")}
          >
            Texte
          </button>
          <button
            type="button"
            data-active={documentTextView === "titles"}
            onClick={() => setDocumentTextView("titles")}
          >
            Titel
          </button>
          <button
            type="button"
            data-active={documentTextView === "syntax"}
            onClick={() => setDocumentTextView("syntax")}
          >
            Template-Syntax
          </button>
        </div>

        {documentTextView === "syntax" ? (
          <div className={styles.documentTypeTableWrap}>
            <table className={styles.documentTypeTable}>
              <thead>
                <tr>
                  <th>Platzhalter</th>
                  <th>Bedeutung</th>
                </tr>
              </thead>
              <tbody>
                {documentTemplateSyntax.map((item) => (
                  <tr key={item.placeholder}>
                    <td>
                      <code>{item.placeholder}</code>
                    </td>
                    <td>{item.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <div className={styles.documentTypeToolbar}>
              <label>
                Zeige
                <select
                  value={documentTextPageSize}
                  onChange={(event) => setDocumentTextPageSize(Number(event.target.value))}
                >
                  {[10, 25, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                Eintraege
              </label>
              <label>
                Suchen:
                <input
                  value={documentTextSearch}
                  onChange={(event) => setDocumentTextSearch(event.target.value)}
                />
              </label>
            </div>

            <div className={styles.documentTypeTableWrap}>
              <table className={`${styles.documentTypeTable} ${styles.documentTextTable}`}>
                <thead>
                  <tr>
                    <th>Quelle</th>
                    <th>Titel</th>
                    <th>Text</th>
                    <th>Erstellt</th>
                    <th>Veraendert</th>
                    <th aria-label="Aktionen" />
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.length === 0 ? (
                    <tr>
                      <td colSpan={6}>Keine Eintraege gefunden.</td>
                    </tr>
                  ) : (
                    visibleItems.map((item) => (
                      <tr key={item.id}>
                        <td>{item.source}</td>
                        <td>
                          <button
                            type="button"
                            className={styles.documentTypeLink}
                            onClick={() => openDocumentTextModal(item)}
                          >
                            {item.title}
                          </button>
                        </td>
                        <td>{item.body}</td>
                        <td>{item.createdAtLabel}</td>
                        <td>{item.updatedAtLabel}</td>
                        <td>
                          <div className={styles.documentTypeActions}>
                            <button
                              type="button"
                              aria-label="Bearbeiten"
                              onClick={() => openDocumentTextModal(item)}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
                                <path d="m14 7 3 3" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              aria-label="Kopieren"
                              onClick={() => openDocumentTextModal(item, true)}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M8 8h10v12H8z" />
                                <path d="M6 16H5a1 1 0 0 1-1-1V5h10v1" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              aria-label="Loeschen"
                              onClick={() => deleteDocumentText(item)}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M4 7h16" />
                                <path d="M10 11v6" />
                                <path d="M14 11v6" />
                                <path d="M6 7l1 14h10l1-14" />
                                <path d="M9 7V4h6v3" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {isDocumentTextModalOpen && (
          <div className={styles.overlay}>
            <div className={`${styles.modal} ${styles.documentTextModal}`} role="dialog" aria-modal="true">
              <div className={styles.contactModalHeader}>
                <h2>{editingDocumentTextId ? "Eintrag bearbeiten" : "Eintrag anlegen"}</h2>
                <button
                  type="button"
                  className={styles.modalCloseButton}
                  aria-label="Schliessen"
                  onClick={closeDocumentTextModal}
                >
                  x
                </button>
              </div>

              <div className={styles.documentTextModalBody}>
                <div className={styles.formGrid}>
                  <label>
                    Typ
                    <select
                      value={documentTextDraftKind}
                      onChange={(event) =>
                        setDocumentTextDraftKind(event.target.value === "title" ? "title" : "text")
                      }
                    >
                      <option value="text">Text</option>
                      <option value="title">Titel</option>
                    </select>
                  </label>

                  <label>
                    Quelle
                    <select
                      value={documentTextDraftSource}
                      onChange={(event) => setDocumentTextDraftSource(event.target.value)}
                    >
                      <option value="Eigene">Eigene</option>
                      <option value="System">System</option>
                    </select>
                  </label>

                  <label className={styles.fullWidth}>
                    Titel
                    <input
                      value={documentTextDraftTitle}
                      onChange={(event) => setDocumentTextDraftTitle(event.target.value)}
                      placeholder="z.B. Angebot - Einleitung"
                    />
                  </label>

                  <label className={styles.fullWidth}>
                    Text
                    <textarea
                      rows={12}
                      value={documentTextDraftBody}
                      onChange={(event) => setDocumentTextDraftBody(event.target.value)}
                      placeholder="Text mit optionalen Platzhaltern wie {{customer.name}}"
                    />
                  </label>
                </div>

                <aside className={styles.documentTextSyntaxBox}>
                  <strong>Template-Syntax</strong>
                  <p>Diese Platzhalter koennen im Text verwendet werden.</p>
                  <div>
                    {documentTemplateSyntax.slice(0, 8).map((item) => (
                      <button
                        key={item.placeholder}
                        type="button"
                        onClick={() =>
                          setDocumentTextDraftBody((current) =>
                            current ? `${current} ${item.placeholder}` : item.placeholder
                          )
                        }
                      >
                        {item.placeholder}
                      </button>
                    ))}
                  </div>
                </aside>
              </div>

              {documentTextDraftError && (
                <p className={styles.stampError}>{documentTextDraftError}</p>
              )}

              <div className={styles.modalFooter}>
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={closeDocumentTextModal}
                  >
                    Abbrechen
                  </button>
                  <button type="button" className={styles.primaryButton} onClick={saveDocumentTextDraft}>
                    Speichern
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brandBlock}>
            <img className={styles.logo} src="/workpilot360-logo-header.png" alt="WorkPilot360" />
          </div>

          <label className={styles.globalSearch}>
            <span>Suchen</span>
            <input
              value={globalSearchTerm}
              onChange={(event) => {
                setGlobalSearchTerm(event.target.value);
                setIsGlobalSearchOpen(true);
                if (!hasLoadedHeroProjects && !isHeroProjectsLoading) void loadHeroProjects();
              }}
              onFocus={() => {
                setIsGlobalSearchOpen(true);
                if (!hasLoadedHeroProjects && !isHeroProjectsLoading) void loadHeroProjects();
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setIsGlobalSearchOpen(false);
                  event.currentTarget.blur();
                }
                if (event.key === "Enter" && globalSearchResults[0]) {
                  event.preventDefault();
                  openGlobalSearchResult(globalSearchResults[0]);
                }
              }}
              placeholder="Projekt, Kunde, Aufgabe oder Rechnung suchen..."
            />
            {isGlobalSearchOpen && globalSearchTerm.trim() ? (
              <div className={styles.globalSearchResults}>
                {globalSearchResults.length > 0 ? (
                  globalSearchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => openGlobalSearchResult(result)}
                    >
                      <small>{result.category}</small>
                      <strong>{result.title}</strong>
                      <span>{result.subtitle || result.detail}</span>
                      {result.subtitle && result.detail ? <em>{result.detail}</em> : null}
                    </button>
                  ))
                ) : isHeroProjectsLoading ? (
                  <p>Projekte werden geladen...</p>
                ) : (
                  <p>Keine Treffer gefunden.</p>
                )}
              </div>
            ) : null}
          </label>

          <div className={styles.headerActions}>
            <div className={styles.quickCreate}>
              <button
                className={styles.quickCreateButton}
                onClick={() => {
                  setIsQuickCreateOpen((current) => !current);
                  setIsUserMenuOpen(false);
                  setIsNotificationsOpen(false);
                }}
              >
                + Neu
              </button>
              {isQuickCreateOpen && (
                <div className={styles.quickCreateMenu}>
                  <button type="button" onClick={openCreateProjectModal}>
                    <span>+</span> Projekt
                  </button>
                  <button type="button" onClick={() => openCreateContactModal("contact")}>
                    <span>+</span> Kontakt
                  </button>
                  <button type="button" onClick={() => openCreateModal()}>
                    <span>+</span> Aufgabe
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickCreateOpen(false);
                      setErrorMessage("Dokumente werden als nächstes Modul angebunden.");
                    }}
                  >
                    <span>+</span> Dokument
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickCreateOpen(false);
                      setErrorMessage("Termine werden mit der Einsatzplanung verbunden.");
                    }}
                  >
                    <span>+</span> Termin
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickCreateOpen(false);
                      setErrorMessage("Zeiteinträge werden direkt an Aufgaben angebunden.");
                    }}
                  >
                    <span>+</span> Zeiteintrag
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickCreateOpen(false);
                      setErrorMessage("Aufträge folgen nach der Projektbasis.");
                    }}
                  >
                    <span>+</span> Auftrag
                  </button>
                </div>
              )}
            </div>
            <div className={styles.userMenu}>
              <button
                className={styles.userMenuButton}
                onClick={() => {
                  setIsUserMenuOpen((current) => !current);
                  setIsNotificationsOpen(false);
                }}
                aria-label="Benutzermenü"
              >
                {activeUser?.profileImageDataUrl ? (
                  <img src={activeUser.profileImageDataUrl} alt="" />
                ) : (
                  <span>{activeUser?.name.slice(0, 1) ?? "U"}</span>
                )}
              </button>

              {isUserMenuOpen && (
                <div className={styles.userMenuPanel}>
                  <strong>{activeUser?.name}</strong>
                  <span>{activeUser?.roleLabel}</span>
                  <button onClick={openOwnSettings}>Eigene Einstellungen</button>
                  <button onClick={handleLogout}>Abmelden</button>
                </div>
              )}
            </div>

          <div className={styles.notificationCenter}>
            <button
              className={`${styles.notificationBell} ${
                unreadNotifications.length > 0 ? styles.notificationBellActive : ""
              }`}
              onClick={() => {
                setIsNotificationsOpen((current) => !current);
                setIsUserMenuOpen(false);
                setShowNotificationHistory(false);
                setNotificationSearchTerm("");
              }}
              aria-label="Benachrichtigungen"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16l-2-2Z" />
                <path d="M10 21h4" />
              </svg>
              {unreadNotifications.length > 0 && (
                <span className={styles.notificationCount}>{unreadNotifications.length}</span>
              )}
            </button>

            {isNotificationsOpen && (
              <div className={styles.notificationPanel}>
                <div className={styles.notificationHeader}>
                  <strong>Benachrichtigungen</strong>
                  {unreadNotifications.length > 0 && (
                    <button onClick={markNotificationsRead}>Alle gelesen</button>
                  )}
                </div>

                <div className={styles.notificationTabs}>
                  <button
                    type="button"
                    data-active={!showNotificationHistory}
                    onClick={() => {
                      setShowNotificationHistory(false);
                      setNotificationSearchTerm("");
                    }}
                  >
                    Neu
                    {unreadNotifications.length > 0 && <span>{unreadNotifications.length}</span>}
                  </button>
                  <button
                    type="button"
                    data-active={showNotificationHistory}
                    onClick={() => setShowNotificationHistory(true)}
                  >
                    Historie
                    {sortedNotifications.length > 0 && <span>{sortedNotifications.length}</span>}
                  </button>
                </div>

                {showNotificationHistory && (
                  <label className={styles.notificationSearch}>
                    Suche
                    <input
                      value={notificationSearchTerm}
                      onChange={(event) => setNotificationSearchTerm(event.target.value)}
                      placeholder="Betreff oder Inhalt suchen"
                    />
                  </label>
                )}

                {desktopPermission !== "granted" && (
                  <button
                    className={styles.notificationPermission}
                    onClick={requestDesktopNotifications}
                  >
                    Desktop-Benachrichtigungen aktivieren
                  </button>
                )}

                <div className={styles.notificationList}>
                  {visibleNotifications.length === 0 ? (
                    <p>
                      {showNotificationHistory
                        ? "Keine passenden Benachrichtigungen gefunden."
                        : "Keine neuen Benachrichtigungen."}
                    </p>
                  ) : (
                    visibleNotifications.map((notification) => (
                      <article
                        key={notification.id}
                        className={styles.notificationItem}
                        data-unread={!notification.readAt}
                      >
                        <div className={styles.notificationItemHeader}>
                          <strong>{notification.subject}</strong>
                          {notification.readAt ? <small>Gelesen</small> : <small>Neu</small>}
                        </div>
                        <span>{formatDeadline(notification.createdAt)}</span>
                        <p>{notification.body}</p>
                      </article>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          </div>
        </header>

        <nav className={styles.tabs}>
          {navigationTabs.map(([tab, label]) => {
            const projectLogo =
              tab === "projectsSolutions"
                ? "/oks-logo.png"
                : tab === "projectsImmocare"
                  ? "/oki-logo.png"
                  : "";

            if (tab === "settings") {
              return (
                <div key={tab} className={styles.sidebarGroup}>
                  <button
                    className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ""}`}
                    onClick={() => {
                      setActiveTab(tab);
                      setOpenSidebarMenus({});
                      setOpenProjectNav({ projectsSolutions: false, projectsImmocare: false });
                      setIsFirmSettingsNavOpen((isOpen) => !isOpen);
                    }}
                  >
                    <span className={styles.navLabel}>
                      <SidebarIcon tab={tab} />
                      {label}
                    </span>
                    <b>{isFirmSettingsNavOpen ? "R" : "v"}</b>
                  </button>
                  {isFirmSettingsNavOpen && (
                    <div className={styles.sidebarSubTabs}>
                      {firmSettingsTabs.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          data-active={firmSettingsTab === item.id}
                          onClick={() => {
                            setActiveTab("settings");
                            setFirmSettingsTab(item.id);
                            setOpenSidebarMenus({});
                            setOpenProjectNav({ projectsSolutions: false, projectsImmocare: false });
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            if (tab === "dashboard") {
              const isOpen = openSidebarMenus[tab] ?? false;
              const children: Array<{ id: AppTab; label: string }> = [
                { id: "calendar", label: "Kalenderübersicht" },
                { id: "kanban", label: "Kanban" },
                { id: "archive", label: "Archiv" },
              ];
              const isActiveGroup =
                activeTab === tab || children.some((item) => item.id === activeTab);

              return (
                <div key={tab} className={styles.sidebarGroup}>
                  <button
                    className={`${styles.tab} ${isActiveGroup ? styles.activeTab : ""}`}
                    onClick={() => {
                      setActiveTab(tab);
                      setIsFirmSettingsNavOpen(false);
                      setOpenProjectNav({ projectsSolutions: false, projectsImmocare: false });
                      setOpenSidebarMenus({ [tab]: !isOpen });
                    }}
                  >
                    <span className={styles.navLabel}>
                      <SidebarIcon tab={tab} />
                      {label}
                    </span>
                    <b>{isOpen ? "^" : "v"}</b>
                  </button>
                  {isOpen && (
                    <div className={styles.sidebarSubTabs}>
                      {children.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          data-active={activeTab === item.id}
                          onClick={() => {
                            setActiveTab(item.id);
                            setIsFirmSettingsNavOpen(false);
                            setOpenProjectNav({ projectsSolutions: false, projectsImmocare: false });
                            setOpenSidebarMenus({ [tab]: true });
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            if (tab === "employees") {
              const isOpen = openSidebarMenus[tab] ?? false;
              const children: Array<{ id: AppTab; label: string }> = [
                { id: "employees", label: "Mitarbeiter" },
                { id: "absenceRequests", label: "Abwesenheitsanträge" },
                { id: "timeTracking", label: "Zeiterfassung" },
                { id: "timeCategories", label: "Zeitkategorien" },
                { id: "breakManagement", label: "Pausenverwaltung" },
              ];
              const isActiveGroup =
                activeTab === tab || children.some((item) => item.id === activeTab);

              return (
                <div key={tab} className={styles.sidebarGroup}>
                  <button
                    className={`${styles.tab} ${isActiveGroup ? styles.activeTab : ""}`}
                    onClick={() => {
                      setActiveTab(tab);
                      setIsFirmSettingsNavOpen(false);
                      setOpenProjectNav({ projectsSolutions: false, projectsImmocare: false });
                      setOpenSidebarMenus({ [tab]: !isOpen });
                    }}
                  >
                    <span className={styles.navLabel}>
                      <SidebarIcon tab={tab} />
                      {label}
                    </span>
                    <b>{isOpen ? "^" : "v"}</b>
                  </button>
                  {isOpen && (
                    <div className={styles.sidebarSubTabs}>
                      {children.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          data-active={activeTab === item.id}
                          onClick={() => {
                            setActiveTab(item.id);
                            setIsFirmSettingsNavOpen(false);
                            setOpenProjectNav({ projectsSolutions: false, projectsImmocare: false });
                            setOpenSidebarMenus({ [tab]: true });
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            if (projectLogo) {
              const isProjectNavOpen = openProjectNav[tab] ?? false;
              const projectKindLinks: Array<{ label: string; value: ProjectKindFilter }> = [
                { label: "Dauerläufer-Projekte", value: "Dauerläufer-Projekt" },
                { label: "Einmalige-Projekte", value: "einmaliges Projekt" },
              ];

              return (
                <div key={tab} className={styles.sidebarGroup}>
                  <button
                    className={`${styles.tab} ${styles.projectTab} ${
                      activeTab === tab ? styles.activeTab : ""
                    }`}
                    onClick={() => {
                      setActiveTab(tab);
                      setSelectedProjectKindFilter("");
                      setIsFirmSettingsNavOpen(false);
                      setOpenSidebarMenus({});
                      setOpenProjectNav({
                        projectsSolutions: tab === "projectsSolutions" ? !isProjectNavOpen : false,
                        projectsImmocare: tab === "projectsImmocare" ? !isProjectNavOpen : false,
                      });
                    }}
                  >
                    <span className={styles.projectTabLabel}>
                      <SidebarIcon tab={tab} />
                      Projekte
                      <img
                        className={styles.projectTabLogo}
                        src={projectLogo}
                        alt={tab === "projectsSolutions" ? "OK solutions" : "OK immocare"}
                      />
                    </span>
                    <b>{isProjectNavOpen ? "^" : "v"}</b>
                  </button>
                  {isProjectNavOpen && (
                    <div className={`${styles.sidebarSubTabs} ${styles.projectKindSubTabs}`}>
                      {projectKindLinks.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          data-active={activeTab === tab && selectedProjectKindFilter === item.value}
                          onClick={() => {
                            setActiveTab(tab);
                            setSelectedProjectKindFilter(item.value);
                            setIsFirmSettingsNavOpen(false);
                            setOpenSidebarMenus({});
                            setOpenProjectNav({
                              projectsSolutions: tab === "projectsSolutions",
                              projectsImmocare: tab === "projectsImmocare",
                            });
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            if (tab === "documents" || tab === "articles") {
              const isOpen = openSidebarMenus[tab] ?? false;
              const children: Array<{ id: AppTab; label: string }> =
                tab === "documents"
                  ? [
                      { id: "documentOverview", label: "Dokumentenübersicht" },
                      { id: "documentTexts", label: "Texte & Titel" },
                      { id: "documentTemplates", label: "Vorlagen" },
                      { id: "documentConfigurator", label: "Konfigurator" },
                      { id: "documentGaeb", label: "Ausschreibungen (GAEB)" },
                    ]
                  : [
                      { id: "articles", label: "Artikel" },
                      { id: "services", label: "Leistungen" },
                      { id: "salesPrices", label: "Verkaufspreise" },
                      { id: "datanorm", label: "Datanorm" },
                    ];
              const isActiveGroup =
                activeTab === tab || children.some((item) => item.id === activeTab);

              return (
                <div key={tab} className={styles.sidebarGroup}>
                  <button
                    className={`${styles.tab} ${isActiveGroup ? styles.activeTab : ""}`}
                    onClick={() => {
                      setActiveTab(tab);
                      setIsFirmSettingsNavOpen(false);
                      setOpenProjectNav({ projectsSolutions: false, projectsImmocare: false });
                      setOpenSidebarMenus({ [tab]: !isOpen });
                    }}
                  >
                    <span className={styles.navLabel}>
                      <SidebarIcon tab={tab} />
                      {label}
                    </span>
                    <b>{isOpen ? "^" : "v"}</b>
                  </button>
                  {isOpen && (
                    <div className={styles.sidebarSubTabs}>
                      {children.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          data-active={activeTab === item.id}
                          onClick={() => {
                            setActiveTab(item.id);
                            setIsFirmSettingsNavOpen(false);
                            setOpenProjectNav({ projectsSolutions: false, projectsImmocare: false });
                            setOpenSidebarMenus({ [tab]: true });
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button
                key={tab}
                className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ""}`}
                onClick={() => {
                  setActiveTab(tab);
                  setIsFirmSettingsNavOpen(false);
                  setOpenSidebarMenus({});
                  setOpenProjectNav({ projectsSolutions: false, projectsImmocare: false });
                }}
              >
                <span className={styles.navLabel}>
                  <SidebarIcon tab={tab} />
                  {label}
                </span>
              </button>
            );
          })}
          <div className={styles.stampWidget}>
            <div className={styles.stampStatusDot} data-state={stampSession ? "active" : "idle"} />
            <button
              type="button"
              className={styles.stampPlayButton}
              data-paused={Boolean(stampSession?.pauseStartedAt)}
              data-running={Boolean(stampSession && !stampSession.pauseStartedAt)}
              onClick={toggleStampTimer}
              aria-label={stampSession?.pauseStartedAt ? "Stempelung fortsetzen" : stampSession ? "Stempelung pausieren" : "Stempelung starten"}
            >
              {stampSession && !stampSession.pauseStartedAt ? "Pause" : "Start"}
            </button>
            <button
              type="button"
              className={styles.stampReadout}
              onClick={openCurrentEmployeeTimeTracking}
              aria-label="Zur Zeiterfassung"
            >
              <strong>
                {formatStampDuration(
                  stampSession ? getStampElapsedMilliseconds() : completedTodayStampMilliseconds
                )}
              </strong>
              <span>
                {stampSession
                  ? stampSession.pauseStartedAt
                    ? `Pause ${formatStampDuration(getStampPauseMilliseconds())}`
                    : stampSession.mode === "project"
                      ? getStampProjectLabel(stampSession.projectId)
                      : "Unproduktiv"
                  : completedTodayStampMilliseconds > 0
                    ? "Heute gesamt"
                    : "Nicht eingestempelt"}
              </span>
            </button>
            <button
              type="button"
              className={styles.stampChangeButton}
              disabled={!stampSession}
              onClick={openStampChangeModal}
              aria-label="Folgetätigkeit auswählen"
            >
              Wechsel
            </button>
            <button
              type="button"
              className={styles.stampStopButton}
              disabled={!stampSession}
              onClick={openStampStopModal}
              aria-label="Stempelung stoppen"
            >
              Stop
            </button>
          </div>
        </nav>

        <section className={styles.content}>
          {errorMessage && !isModalOpen && <div className={styles.notice}>{errorMessage}</div>}

          {activeTab === "overview" ? (
            <section className={styles.overviewPanel}>
              <div className={styles.overviewHero}>
                <div>
                  <p className={styles.eyebrow}>Übersicht</p>
                  <h1>
                    Hallo {activeUser?.name?.trim().split(/\s+/)[0] || "Benutzer"},
                    <span>willkommen zu deinem Dashboard</span>
                  </h1>
                </div>
              </div>

              <section className={styles.moduleGrid}>
                {overviewModules.map((module) => (
                  <article key={module.title} className={styles.moduleCard} data-tone={module.tone}>
                    <div className={styles.moduleCardTop}>
                      <span>{module.kicker}</span>
                      <strong>{module.value}</strong>
                    </div>
                    <h2>{module.title}</h2>
                    <p>{module.body}</p>
                    <button
                      className={styles.moduleAction}
                      type="button"
                      onClick={() => setActiveTab(module.tab)}
                    >
                      {module.action}
                    </button>
                  </article>
                ))}
              </section>

              <section className={styles.nextBuildPanel}>
                <div>
                  <p className={styles.eyebrow}>Ausbaupfad</p>
                  <h2>Nächster sinnvoller Schritt</h2>
                  <p>
                    Aus Aufgaben und HERO-Projekten machen wir als naechstes echte Projekte mit
                    Kundenstamm, Ansprechpartnern, Dokumentenmappe und kaufmännischem Status.
                  </p>
                </div>
                <button className={styles.primaryButton} onClick={() => setActiveTab("projectsSolutions")}>
                  Projektmodul starten
                </button>
              </section>
            </section>
          ) : activeTab === "settings" ? (
            renderFirmSettings()
          ) : false ? (
            <section className={`${styles.settingsPanel} ${styles.projectPipelinePanel}`}>
              <div className={styles.topline}>
                <div>
                  <p className={styles.eyebrow}>Einstellungen</p>
                  <h1>Benutzer und Rollen</h1>
                  <p className={styles.subline}>
                    Verwalte Zuständigkeiten, Rollen und die aktuelle Demo-Sitzung.
                  </p>
                </div>
              </div>

              <section className={styles.settingsGrid}>
                <article className={styles.settingsCard}>
                  <h2>Aktuelle Sitzung</h2>
                  <p>
                    Angemeldet als {activeUser?.name ?? "Benutzer"} -{" "}
                    {activeUser?.roleLabel ?? "Rolle"}
                  </p>
                  <button className={styles.secondaryButton} onClick={handleLogout}>
                    Abmelden
                  </button>
                </article>

                <article className={styles.settingsCard}>
                  <h2>Rechte</h2>
                  <p>Admin/Geschäftsführung: Rollen verwalten und Aufgaben löschen.</p>
                  <p>Führungskraft: Aufgaben anderen Personen zuweisen.</p>
                  <p>Mitarbeiter: eigene Aufgaben erstellen und bearbeiten.</p>
                </article>
              </section>

              <section className={styles.settingsCard}>
                <div className={styles.settingsHeader}>
                  <div>
                    <h2>Feiertage</h2>
                    <p>
                      Feiertage werden für das gewählte Bundesland für die nächsten 50 Jahre
                      berechnet und in Planung sowie Reports berücksichtigt.
                    </p>
                  </div>
                </div>
                <div className={styles.teamForm}>
                  <label>
                    Bundesland
                    <select
                      value={holidayState}
                      onChange={(event) => setHolidayState(event.target.value as GermanStateCode)}
                    >
                      {germanStateOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className={styles.settingsInfo}>
                    <strong>{holidays.length}</strong>
                    <span>Feiertage geladen, beginnend ab {new Date().getFullYear()}</span>
                  </div>
                </div>
              </section>

              <section className={styles.settingsCard}>
                <div className={styles.settingsHeader}>
                  <div>
                    <h2>{editingUserId ? "Benutzer bearbeiten" : "Benutzer anlegen"}</h2>
                    <p>Neue Mitarbeiter können hier für den MVP direkt angelegt werden.</p>
                  </div>
                  {editingUserId && (
                    <button className={styles.secondaryButton} onClick={resetUserForm}>
                      Neu anlegen
                    </button>
                  )}
                </div>

                <div className={styles.userForm}>
                  <label>
                    Name
                    <input
                      value={userName}
                      disabled={!mayManageUsers}
                      onChange={(event) => setUserName(event.target.value)}
                    />
                  </label>

                  <label>
                    E-Mail
                    <input
                      type="email"
                      value={userEmail}
                      disabled={!mayManageUsers}
                      onChange={(event) => setUserEmail(event.target.value)}
                    />
                  </label>

                  <label>
                    Rolle
                    <select
                      value={userRole}
                      disabled={!mayManageUsers}
                      onChange={(event) => setUserRole(event.target.value as UserRole)}
                    >
                      {roleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Tagesarbeitszeit (Std.)
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      value={userDailyWorkHours}
                      disabled={!mayManageUsers}
                      onChange={(event) => setUserDailyWorkHours(event.target.value)}
                    />
                  </label>

                  <label>
                    Passwort
                    <input
                      type="text"
                      value={userPassword}
                      disabled={!mayManageUsers}
                      onChange={(event) => setUserPassword(event.target.value)}
                      placeholder={
                        editingUserId
                          ? "Leer lassen, wenn unverändert"
                          : "Passwort für Login vergeben"
                      }
                    />
                  </label>

                  <button
                    type="button"
                    className={styles.secondaryButton}
                    disabled={!mayManageUsers}
                    onClick={generateUserPassword}
                  >
                    Passwort generieren
                  </button>

                  <div className={styles.teamPicker}>
                    <span>Team</span>
                    <label className={styles.checkboxField}>
                      <input
                        type="checkbox"
                        checked={userAllTeams}
                        disabled={!mayManageUsers}
                        onChange={(event) => {
                          setUserAllTeams(event.target.checked);
                          if (event.target.checked) {
                            setUserTeamIds(teams.map((team) => team.id));
                          } else {
                            setUserTeamIds([]);
                          }
                        }}
                      />
                      Alle Teams
                    </label>
                    {teams.map((team) => (
                      <label key={team.id} className={styles.checkboxField}>
                        <input
                          type="checkbox"
                          checked={userTeamIds.includes(team.id)}
                          disabled={!mayManageUsers}
                          onChange={(event) => {
                            toggleUserTeam(team.id, event.target.checked);
                          }}
                        />
                        {team.name}
                      </label>
                    ))}
                  </div>

                  <button
                    className={styles.primaryButton}
                    disabled={!mayManageUsers}
                    onClick={saveUser}
                  >
                    {editingUserId ? "Änderungen speichern" : "Benutzer anlegen"}
                  </button>
                </div>

                {loginCredentialsDraft && (
                  <div className={styles.credentialsBox}>
                    <div>
                      <strong>Login-Daten vorbereitet</strong>
                      <p>
                        {loginCredentialsDraft!.name} kann sich jetzt mit eigener E-Mail und
                        Passwort anmelden.
                      </p>
                    </div>
                    <textarea
                      readOnly
                      value={getLoginCredentialsMessage(loginCredentialsDraft!)}
                      rows={7}
                    />
                    <div className={styles.actionGroup}>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={copyLoginCredentials}
                      >
                        Text kopieren
                      </button>
                      <a
                        className={styles.secondaryButton}
                        href={`mailto:${encodeURIComponent(
                          loginCredentialsDraft!.email
                        )}?subject=${encodeURIComponent(
                          "Deine WorkPilot Login-Daten"
                        )}&body=${encodeURIComponent(
                          getLoginCredentialsMessage(loginCredentialsDraft!)
                        )}`}
                      >
                        Per E-Mail senden
                      </a>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => setLoginCredentialsDraft(null)}
                      >
                        Schließen
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section className={`${styles.tableCard} ${styles.taskTableCard}`}>
                <table className={`${styles.table} ${styles.taskTable}`}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>E-Mail</th>
                      <th>Rolle</th>
                      <th>Tagesarbeitszeit</th>
                      <th>Team</th>
                      <th>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className={styles.title}>{user.name}</td>
                        <td>{user.email}</td>
                        <td>{user.roleLabel}</td>
                        <td>{user.dailyWorkHours} Std.</td>
                        <td>
                          {user.teamIds.length === teams.length && teams.length > 0
                            ? "Alle Teams"
                            : user.teamIds
                                .map((teamId) => teams.find((team) => team.id === teamId)?.name)
                                .filter(Boolean)
                                .join(", ") || "-"}
                        </td>
                        <td>
                          <div className={styles.actionGroup}>
                            <button
                              className={styles.secondaryButton}
                              disabled={!mayManageUsers}
                              onClick={() => editUser(user)}
                            >
                              Bearbeiten
                            </button>
                            <button
                              className={styles.deleteButton}
                              disabled={!mayManageUsers || user.id === activeUserId}
                              onClick={() => deleteUser(user.id)}
                            >
                              Löschen
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className={styles.settingsCard}>
                <div className={styles.settingsHeader}>
                  <div>
                    <h2>{editingTradeId ? "Gewerk bearbeiten" : "Gewerk anlegen"}</h2>
                    <p>Gewerke können hier gepflegt und in Aufgaben ausgewählt werden.</p>
                  </div>
                  {editingTradeId && (
                    <button className={styles.secondaryButton} onClick={resetTradeForm}>
                      Neu anlegen
                    </button>
                  )}
                </div>

                <div className={styles.teamForm}>
                  <label>
                    Gewerkname
                    <input
                      value={tradeName}
                      disabled={!mayManageUsers}
                      onChange={(event) => setTradeName(event.target.value)}
                    />
                  </label>
                  <label>
                    Projektkürzel
                    <input
                      value={tradePrefix}
                      disabled={!mayManageUsers}
                      maxLength={5}
                      onChange={(event) => setTradePrefix(normalizeProjectPrefixInput(event.target.value))}
                      placeholder="z.B. ASS"
                    />
                  </label>

                  <button
                    className={styles.primaryButton}
                    disabled={!mayManageUsers}
                    onClick={saveTrade}
                  >
                    {editingTradeId ? "Änderungen speichern" : "Gewerk anlegen"}
                  </button>
                </div>
              </section>

              <section className={styles.tableCard}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Gewerk</th>
                      <th>Kürzel</th>
                      <th>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.length === 0 ? (
                      <tr>
                        <td colSpan={3}>Noch keine Gewerke angelegt.</td>
                      </tr>
                    ) : (
                      trades.map((trade) => (
                        <tr key={trade.id}>
                          <td className={styles.title}>{trade.name}</td>
                          <td>{trade.projectPrefix || getProjectTradePrefix(trade.name)}</td>
                          <td>
                            <div className={styles.actionGroup}>
                              <button
                                className={styles.secondaryButton}
                                disabled={!mayManageUsers}
                                onClick={() => editTrade(trade)}
                              >
                                Bearbeiten
                              </button>
                              <button
                                className={styles.deleteButton}
                                disabled={!mayManageUsers}
                                onClick={() => deleteTrade(trade.id)}
                              >
                                Löschen
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </section>

              <section className={styles.settingsCard}>
                <div className={styles.settingsHeader}>
                  <div>
                    <h2>{editingTeamId ? "Team bearbeiten" : "Team anlegen"}</h2>
                    <p>Teams bündeln Benutzer und können hier zentral verwaltet werden.</p>
                  </div>
                  {editingTeamId && (
                    <button className={styles.secondaryButton} onClick={resetTeamForm}>
                      Neu anlegen
                    </button>
                  )}
                </div>

                <div className={styles.teamForm}>
                  <label>
                    Teamname
                    <input
                      value={teamName}
                      disabled={!mayManageUsers}
                      onChange={(event) => setTeamName(event.target.value)}
                    />
                  </label>

                  <button
                    className={styles.primaryButton}
                    disabled={!mayManageUsers}
                    onClick={saveTeam}
                  >
                    {editingTeamId ? "Änderungen speichern" : "Team anlegen"}
                  </button>
                </div>
              </section>

              <section className={styles.tableCard}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th>Benutzer</th>
                      <th>Aufgaben</th>
                      <th>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((team) => (
                      <tr key={team.id}>
                        <td className={styles.title}>{team.name}</td>
                        <td>{team.userCount}</td>
                        <td>{team.taskCount}</td>
                        <td>
                          <div className={styles.actionGroup}>
                            <button
                              className={styles.secondaryButton}
                              disabled={!mayManageUsers}
                              onClick={() => editTeam(team)}
                            >
                              Bearbeiten
                            </button>
                            <button
                              className={styles.deleteButton}
                              disabled={!mayManageUsers}
                              onClick={() => deleteTeam(team.id)}
                            >
                              Löschen
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className={styles.settingsCard}>
                <div className={styles.settingsHeader}>
                  <div>
                    <h2>
                      {editingEscalationRuleId
                        ? "Eskalationsstufe bearbeiten"
                        : "Eskalationsstufe anlegen"}
                    </h2>
                    <p>
                      Definiere, nach wie vielen Stunden nach der Deadline eine Meldung an eine
                      Rolle geht.
                    </p>
                  </div>
                  {editingEscalationRuleId && (
                    <button className={styles.secondaryButton} onClick={resetEscalationForm}>
                      Neu anlegen
                    </button>
                  )}
                </div>

                <div className={styles.escalationForm}>
                  <label>
                    Bezeichnung
                    <input
                      value={escalationName}
                      disabled={!mayManageUsers}
                      placeholder="z. B. Erste Eskalation"
                      onChange={(event) => setEscalationName(event.target.value)}
                    />
                  </label>

                  <label>
                    Stunden nach Deadline
                    <input
                      type="number"
                      min="0"
                      value={escalationHours}
                      disabled={!mayManageUsers}
                      onChange={(event) => setEscalationHours(event.target.value)}
                    />
                  </label>

                  <label>
                    Empfängerrolle
                    <select
                      value={escalationTargetRole}
                      disabled={!mayManageUsers}
                      onChange={(event) => setEscalationTargetRole(event.target.value as UserRole)}
                    >
                      {roleOptions
                        .filter((option) => option.value !== "GAST")
                        .map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label className={styles.checkboxField}>
                    <input
                      type="checkbox"
                      checked={escalationActive}
                      disabled={!mayManageUsers}
                      onChange={(event) => setEscalationActive(event.target.checked)}
                    />
                    Aktiv
                  </label>

                  <label className={styles.checkboxField}>
                    <input
                      type="checkbox"
                      checked={escalationEmailEnabled}
                      disabled={!mayManageUsers}
                      onChange={(event) => setEscalationEmailEnabled(event.target.checked)}
                    />
                    E-Mail senden
                  </label>

                  <label className={styles.fullWidth}>
                    E-Mail-Empfänger
                    <input
                      value={escalationEmailRecipients}
                      disabled={!mayManageUsers || !escalationEmailEnabled}
                      placeholder="z. B. fuehrung@firma.de, gf@firma.de oder Rolle: Führungskraft"
                      onChange={(event) => setEscalationEmailRecipients(event.target.value)}
                    />
                  </label>

                  <button
                    className={styles.primaryButton}
                    disabled={!mayManageUsers}
                    onClick={saveEscalationRule}
                  >
                    {editingEscalationRuleId ? "Änderungen speichern" : "Stufe anlegen"}
                  </button>
                </div>
              </section>

              <section className={styles.tableCard}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Stufe</th>
                      <th>Zeitpunkt</th>
                      <th>Empfänger</th>
                      <th>E-Mail</th>
                      <th>Status</th>
                      <th>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {escalationRules.map((rule) => (
                      <tr key={rule.id}>
                        <td className={styles.title}>{rule.name}</td>
                        <td>{rule.hoursAfterDue} Std. nach Deadline</td>
                        <td>{rule.targetRoleLabel}</td>
                        <td>
                          {rule.emailEnabled
                            ? rule.emailRecipients || "Empfängerrolle"
                            : "Nein"}
                        </td>
                        <td>
                          <span
                            className={`${styles.badge} ${
                              rule.isActive ? styles.status : styles.priority
                            }`}
                            data-status={rule.isActive ? "erledigt" : "archiviert"}
                          >
                            {rule.isActive ? "aktiv" : "inaktiv"}
                          </span>
                        </td>
                        <td>
                          <div className={styles.actionGroup}>
                            <button
                              className={styles.secondaryButton}
                              disabled={!mayManageUsers}
                              onClick={() => editEscalationRule(rule)}
                            >
                              Bearbeiten
                            </button>
                            <button
                              className={styles.deleteButton}
                              disabled={!mayManageUsers}
                              onClick={() => deleteEscalationRule(rule.id)}
                            >
                              Löschen
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

            </section>
          ) : activeTab === "hero" ||
            activeTab === "projectsSolutions" ||
            activeTab === "projectsImmocare" ? (
            selectedProjectFile ? (
              renderProjectFile()
            ) : (
            <section className={styles.settingsPanel}>
              <div className={styles.topline}>
                <div>
                  <p className={styles.eyebrow}>Projektpipeline</p>
                  <h1>{projectPipelineTitle}</h1>
                  <p className={styles.subline}>{projectPipelineSubline}</p>
                </div>

                <div className={styles.actionGroup}>
                  {projectPipelines.map((pipeline) => (
                    <button
                      key={pipeline.id}
                      className={styles.secondaryButton}
                      data-active={activeProjectPipeline.id === pipeline.id}
                      onClick={() => {
                        setActiveTab(pipeline.tab);
                        setSelectedProjectPipelineStatus("Alle Offenen");
                        setSelectedProjectKindFilter("");
                      }}
                    >
                      {pipeline.company}
                    </button>
                  ))}
                  <button
                    className={styles.secondaryButton}
                    disabled={isHeroProjectsLoading}
                    onClick={loadHeroProjects}
                  >
                    {isHeroProjectsLoading ? "Projekte werden geladen..." : "Projekte neu laden"}
                  </button>
                </div>
              </div>

              <section className={styles.heroSearchBar}>
                <label>
                  Suche
                  <input
                    value={heroSearchTerm}
                    onChange={(event) => setHeroSearchTerm(event.target.value)}
                    placeholder="Projekt, Projektnummer, Kunde oder Status"
                  />
                </label>
                <span>
                  {visibleHeroProjects.length} Projekte
                  {selectedProjectKindFilter
                    ? ` in "${projectKindRows.find((row) => row.key === selectedProjectKindFilter)?.label}"`
                    : ` in "${activePipelineStatus.label}"`}
                </span>
              </section>

              <section className={styles.projectPipelineBoard}>
                <div className={styles.projectStatusStrip}>
                  <div className={styles.projectStatusStripMeta}>
                    <strong>{activeProjectPipeline.company}</strong>
                    <span>{activeProjectPipeline.total} offene Projekte</span>
                  </div>
                  <div className={styles.projectPipelineStatusList}>
                    {activeProjectPipeline.statuses.map((statusItem) => {
                      const statusCount = getPipelineStatusCount(statusItem.label);

                      return (
                        <button
                          key={statusItem.label}
                          type="button"
                          data-active={activePipelineStatus.label === statusItem.label}
                          onClick={() => setSelectedProjectPipelineStatus(statusItem.label)}
                        >
                          <span>
                            {statusItem.icon && (
                              <em data-numbered={/^\d+$/.test(statusItem.icon) ? "true" : undefined}>
                                {statusItem.icon}
                              </em>
                            )}
                          {getProjectStatusStripLabel(statusItem.label)}
                          </span>
                          {statusCount > 0 ? (
                            <strong data-urgent={statusItem.urgent ? "true" : undefined}>{statusCount}</strong>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={styles.projectPipelineWorkspace}>
                <section className={`${styles.tableCard} ${styles.heroTableCard}`}>
                  <div className={styles.heroTableScroll}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Gewerk</th>
                          <th>Projekt-ID</th>
                          <th>Kunde</th>
                          <th>Projektname</th>
                          <th>Projektanschrift</th>
                          <th>Erreichbarkeit</th>
                          <th>Niederlassung</th>
                          <th>Quelle</th>
                          <th>Partner</th>
                          <th>Status</th>
                          <th>Erstellt</th>
                          <th>Erinnerung</th>
                          <th>Projektvolumen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isHeroProjectsLoading ? (
                          <tr>
                            <td colSpan={13}>HERO-Projekte werden geladen...</td>
                          </tr>
                        ) : heroProjects.length === 0 ? (
                          <tr>
                            <td colSpan={13}>Noch keine HERO-Projekte geladen.</td>
                          </tr>
                        ) : visibleHeroProjects.length === 0 ? (
                          <tr>
                            <td colSpan={13}>Keine Projekte zur Suche gefunden.</td>
                          </tr>
                        ) : (
                          visibleHeroProjects.map((project) => (
                            <tr
                              key={project.id}
                              className={styles.clickableRow}
                              onClick={() => {
                                setSelectedProjectFileId(project.id);
                                setProjectFileTab("logbook");
                              }}
                            >
                              <td className={styles.number}>{getProjectNumberPrefix(project.projectNumber || project.id)}</td>
                              <td className={styles.number}>{getProjectNumberSuffix(project.projectNumber || project.id)}</td>
                              <td className={styles.title}>{project.customer || "-"}</td>
                              <td>{project.title}</td>
                              <td>{project.address || "-"}</td>
                              <td>{project.source ? "Sonstige" : "-"}</td>
                              <td>{project.branch || activeProjectPipeline.company}</td>
                              <td>{project.source || "-"}</td>
                              <td>-</td>
                              <td>{project.status || "-"}</td>
                              <td>{project.createdAt || "-"}</td>
                              <td>-</td>
                              <td>{project.volume ? `${project.volume} €` : "-"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {heroProjects.length > 0 ? (
                    <p className={styles.heroTableHint}>
                      Alle {visibleHeroProjects.length} Treffer sind geladen und in dieser Liste scrollbar.
                    </p>
                  ) : null}
                </section>

                </div>
              </section>
            </section>
            )
          ) : activeTab === "planningBoard" ? (
            renderPlanningBoard()
          ) : activeTab === "documentConfigurator" ? (
            renderDocumentConfigurator()
          ) : activeTab === "documentTexts" ? (
            renderDocumentTextsAndTitles()
          ) : isPreparedSidebarTab(activeTab) ? (
            <section className={styles.settingsPanel}>
              <div className={styles.topline}>
                <div>
                  <p className={styles.eyebrow}>
                    {activeTab.startsWith("document") || activeTab === "documents"
                      ? "Dokumente"
                      : "Artikel & Leistungen"}
                  </p>
                  <h1>
                    {preparedSidebarTabLabels[activeTab]}
                  </h1>
                  <p className={styles.subline}>
                    Dieser Bereich ist in der Navigation vorbereitet und wird im nächsten Schritt
                    funktional ausgebaut.
                  </p>
                </div>
              </div>
            </section>
          ) : activeTab === "contacts" ? selectedCustomerFile ? (
            renderCustomerFile()
          ) : (
            <section className={styles.contactsPanel}>
              <div className={styles.topline}>
                <div>
                  <p className={styles.eyebrow}>CRM</p>
                  <h1>Kontakte</h1>
                  <p className={styles.subline}>
                    Kunden, Lieferanten, Partner und Ansprechpartner zentral verwalten.
                  </p>
                </div>

                <button className={styles.primaryButton} onClick={() => openCreateContactModal()}>
                  + Kontakt
                </button>
              </div>

              <section className={styles.contactSummaryGrid}>
                {[
                  { label: "Alle", value: "", count: contacts.length },
                  { label: "Kunden", value: "Kunde", count: contactCategoryCounts.Kunde ?? 0 },
                  { label: "Lieferanten", value: "Lieferant", count: contactCategoryCounts.Lieferant ?? 0 },
                  { label: "Partner", value: "Partner", count: contactCategoryCounts.Partner ?? 0 },
                  { label: "Ansprechpartner", value: "Ansprechpartner", count: contactCategoryCounts.Ansprechpartner ?? 0 },
                ].map((item) => (
                  <button
                    key={item.label}
                    className={styles.contactSummaryCard}
                    data-active={contactCategoryFilter === item.value}
                    onClick={() => setContactCategoryFilter(item.value)}
                  >
                    <span>{item.label}</span>
                    <strong>{item.count}</strong>
                  </button>
                ))}
              </section>

              <section className={styles.contactToolbar}>
                <label>
                  Suche
                  <input
                    value={contactSearchTerm}
                    onChange={(event) => setContactSearchTerm(event.target.value)}
                    placeholder="Name, Firma, Kundennummer, E-Mail, Ort"
                  />
                </label>
                <label>
                  Kategorie
                  <select
                    value={contactCategoryFilter}
                    onChange={(event) => setContactCategoryFilter(event.target.value)}
                  >
                    <option value="">Alle</option>
                    <option value="Kunde">Kunden</option>
                    <option value="Lieferant">Lieferanten</option>
                    <option value="Partner">Partner</option>
                    <option value="Ansprechpartner">Ansprechpartner</option>
                  </select>
                </label>
                <div className={styles.contactToolbarActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => setIsContactBulkModalOpen(true)}
                  >
                    Gruppenaktion
                  </button>
                  <div className={styles.contactExportPicker}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => setIsContactExportMenuOpen((isOpen) => !isOpen)}
                    >
                      Export v
                    </button>
                    {isContactExportMenuOpen && (
                      <div className={styles.contactExportMenu}>
                        <button type="button" onClick={() => downloadContactExport("csv")}>
                          CSV
                        </button>
                        <button type="button" onClick={() => downloadContactExport("excel")}>
                          Excel
                        </button>
                      </div>
                    )}
                  </div>
                  <div className={styles.contactColumnPicker}>
                    <button
                      type="button"
                      className={styles.iconButton}
                aria-label="Spalten auswählen"
                      onClick={() => setIsContactColumnMenuOpen((isOpen) => !isOpen)}
                    >
                      1.
                    </button>
                    {isContactColumnMenuOpen && (
                      <div className={styles.contactColumnMenu}>
                        <input
                          value={contactColumnSearch}
                          onChange={(event) => setContactColumnSearch(event.target.value)}
                          placeholder="Suche"
                        />
                        <button
                          type="button"
                          className={styles.contactColumnReset}
                          onClick={resetContactColumns}
                        >
                          Standard wiederherstellen
                        </button>
                        <div className={styles.contactColumnOptions}>
                          {searchedContactColumns.map((column) => (
                            <label key={column.id}>
                              <input
                                type="checkbox"
                                checked={visibleContactColumnIds.includes(column.id)}
                                onChange={(event) =>
                                  toggleContactColumn(column.id, event.target.checked)
                                }
                              />
                              {column.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className={`${styles.tableCard} ${styles.contactsTableCard}`}>
                <div className={styles.contactPagination}>
                  <span>Seite</span>
                  <button
                    type="button"
                    className={styles.paginationButton}
                    disabled={activeContactPage <= 1}
                    onClick={() => setContactPage((page) => Math.max(1, page - 1))}
                  >
                    ←
                  </button>
                  <input
                    aria-label="Kontaktseite"
                    min={1}
                    max={contactPageCount}
                    type="number"
                    value={activeContactPage}
                    onChange={(event) => {
                      const nextPage = Number(event.target.value);
                      if (Number.isFinite(nextPage)) {
                        setContactPage(Math.min(Math.max(1, nextPage), contactPageCount));
                      }
                    }}
                  />
                  <button
                    type="button"
                    className={styles.paginationButton}
                    disabled={activeContactPage >= contactPageCount}
                    onClick={() => setContactPage((page) => Math.min(contactPageCount, page + 1))}
                  >
                    →
                  </button>
                  <span>von {contactPageCount}</span>
                  <span>Zeige</span>
                  <select
                    value={contactPageSize}
                    onChange={(event) => setContactPageSize(Number(event.target.value))}
                  >
                    {[25, 50, 100, 250].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                  <span>Einträge</span>
                  <strong>{visibleContacts.length} Einträge gefunden</strong>
                  <span>
                    {selectedContactIds.length
                      ? `${selectedContactIds.length} Zeilen ausgewählt`
                      : "Klicken, um Zeilen auszuwählen"}
                  </span>
                </div>
                <table className={`${styles.table} ${styles.contactsTable}`}>
                  <thead>
                    <tr>
                      {visibleContactColumns.map((column) => (
                        <th key={column.id}>{column.label}</th>
                      ))}
                    </tr>
                    <tr className={styles.contactFilterRow}>
                      {visibleContactColumns.map((column) => (
                        <th key={`${column.id}-filter`}>
                          {column.filterType === "select" ? (
                            <select
                              value={contactColumnFilters[column.id] ?? ""}
                              onChange={(event) =>
                                updateContactColumnFilter(column.id, event.target.value)
                              }
                            >
                              <option value="">Alle</option>
                              {(column.options ?? []).map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={contactColumnFilters[column.id] ?? ""}
                              onChange={(event) =>
                                updateContactColumnFilter(column.id, event.target.value)
                              }
                              placeholder="Filtern"
                            />
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleContacts.length === 0 ? (
                      <tr>
                        <td colSpan={visibleContactColumns.length}>Noch keine Kontakte gefunden.</td>
                      </tr>
                    ) : (
                      paginatedContacts.map((contact, pageIndex) => (
                        <tr
                          key={contact.id}
                          className={styles.clickableRow}
                          data-selected={selectedContactIds.includes(contact.id)}
                          onClick={(event) => handleContactRowClick(event, contact, pageIndex)}
                          onDoubleClick={() => openEditContactModal(contact)}
                        >
                          {visibleContactColumns.map((column) => (
                            <td
                              key={`${contact.id}-${column.id}`}
                              className={
                                column.id === "customerNumber"
                                  ? styles.number
                                  : column.id === "companyName"
                                    ? styles.title
                                    : undefined
                              }
                            >
                              {(column.render?.(contact) ?? column.value(contact)) || "-"}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <div className={styles.contactPagination}>
                  <span>Seite</span>
                  <button
                    type="button"
                    className={styles.paginationButton}
                    disabled={activeContactPage <= 1}
                    onClick={() => setContactPage((page) => Math.max(1, page - 1))}
                  >
                    ←
                  </button>
                  <input
                    aria-label="Kontaktseite unten"
                    min={1}
                    max={contactPageCount}
                    type="number"
                    value={activeContactPage}
                    onChange={(event) => {
                      const nextPage = Number(event.target.value);
                      if (Number.isFinite(nextPage)) {
                        setContactPage(Math.min(Math.max(1, nextPage), contactPageCount));
                      }
                    }}
                  />
                  <button
                    type="button"
                    className={styles.paginationButton}
                    disabled={activeContactPage >= contactPageCount}
                    onClick={() => setContactPage((page) => Math.min(contactPageCount, page + 1))}
                  >
                    →
                  </button>
                  <span>von {contactPageCount}</span>
                  <span>Zeige</span>
                  <select
                    value={contactPageSize}
                    onChange={(event) => setContactPageSize(Number(event.target.value))}
                  >
                    {[25, 50, 100, 250].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                  <span>Einträge</span>
                  <strong>{visibleContacts.length} Einträge gefunden</strong>
                </div>
              </section>
            </section>
          ) : activeTab === "employees" ||
            activeTab === "absenceRequests" ||
            activeTab === "timeTracking" ||
            activeTab === "timeCategories" ||
            activeTab === "breakManagement" ? (
            renderEmployeeManagement()
          ) : plannedModuleLabels[activeTab] ? (
            <section className={styles.plannedModule}>
              <div>
                <p className={styles.eyebrow}>Modul im Aufbau</p>
                <h1>{plannedModuleLabels[activeTab]}</h1>
                <p>
                  Dieser Bereich ist in der neuen HERO-ähnlichen Struktur angelegt. Als nächstes
                  bekommt er Datenmodell, Eingabemasken, Listen, Rechte und Dokumentenlogik.
                </p>
              </div>

              <div className={styles.plannedModuleGrid}>
                <article>
                  <strong>1. Datenmodell</strong>
                  <span>Kunden, Projekte, Belege, Zahlungen und Stammdaten sauber verknuepfen.</span>
                </article>
                <article>
                  <strong>2. Arbeitsmaske</strong>
                  <span>Suchen, filtern, anlegen, bearbeiten und direkt mit Aufgaben verbinden.</span>
                </article>
                <article>
                  <strong>3. Automationen</strong>
                  <span>Statuswechsel, Folgeaufgaben, Zahlungserinnerungen und Auswertungen.</span>
                </article>
              </div>
            </section>
          ) : activeTab === "archive" ? (
            <section>
              <div className={styles.topline}>
                <div>
                  <p className={styles.eyebrow}>Archiv</p>
                  <h1>Archivierte Aufgaben</h1>
                  <p className={styles.subline}>
                    Archivierte und gelöschte Aufgaben bleiben nachvollziehbar erhalten.
                  </p>
                </div>
              </div>

              <section className={styles.tableCard}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Nr.</th>
                      <th>Aufgabe</th>
                      <th>Kunde</th>
                      <th>Zuständig</th>
                      <th>Archiviert am</th>
                      <th>Grund</th>
                      <th>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedTasks.length === 0 ? (
                      <tr>
                        <td colSpan={7}>Noch keine Aufgaben im Archiv.</td>
                      </tr>
                    ) : (
                      archivedTasks.map((task, index) => (
                        <tr key={task.id}>
                          <td className={styles.number}>A-{1001 + index}</td>
                          <td className={styles.title}>
                            {task.titel}
                            {task.beschreibung && (
                              <span className={styles.description}>{task.beschreibung}</span>
                            )}
                          </td>
                          <td>{task.kunde || "-"}</td>
                          <td>
                            {task.zustaendig}
                            <span className={styles.metaLine}>{task.rolle}</span>
                          </td>
                          <td>{task.archivedAt ? formatDeadline(task.archivedAt) : "-"}</td>
                          <td>{task.archiveReason || "-"}</td>
                          <td>
                            {canManageUsers(activeUser?.role) ? (
                              <div className={styles.actionGroup}>
                                <button
                                  onClick={(event) => restoreTask(event, task.id)}
                                  className={styles.acceptButton}
                                >
                                  Wiederherstellen
                                </button>
                                <button
                                  onClick={(event) => deleteTask(event, task.id, true)}
                                  className={styles.deleteButton}
                                >
                                  Endgültig löschen
                                </button>
                              </div>
                            ) : (
                              <span className={styles.metaLine}>Keine Rechte</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </section>
            </section>
          ) : activeTab === "kanban" ? (
            <section>
              <div className={styles.topline}>
                <div>
                  <p className={styles.eyebrow}>Kanban</p>
                  <h1>Aufgabenboard</h1>
                  <p className={styles.subline}>
                    Verfolge den Status deiner Aufgaben als Board.
                  </p>
                </div>

                <div className={styles.kanbanActions}>
                  <label>
                    Benutzer
                    <select
                      value={kanbanOwnerFilter}
                      onChange={(event) => setKanbanOwnerFilter(event.target.value)}
                    >
                      <option value="">Alle</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button className={styles.primaryButton} onClick={() => openCreateModal()}>
                    Neue Aufgabe
                  </button>
                </div>
              </div>

              <section className={styles.kanbanBoard}>
                {kanbanStatuses.map((kanbanStatus) => {
                  const columnTasks = kanbanTasks.filter((task) => task.status === kanbanStatus);

                  return (
                    <article key={kanbanStatus} className={styles.kanbanColumn}>
                      <header className={styles.kanbanHeader}>
                        <h2>{kanbanStatus}</h2>
                        <span>{columnTasks.length}</span>
                      </header>

                      <div
                        className={`${styles.kanbanCards} ${
                          draggedTaskId ? styles.kanbanDropZone : ""
                        }`}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => handleKanbanDrop(kanbanStatus)}
                      >
                        {columnTasks.length === 0 ? (
                          <p className={styles.emptyState}>Keine Aufgaben</p>
                        ) : (
                          columnTasks.map((task) => (
                            <button
                              key={task.id}
                              draggable
                              className={`${styles.kanbanCard} ${
                                draggedTaskId === task.id ? styles.draggingCard : ""
                              }`}
                              data-status={task.status}
                              onDragStart={() => setDraggedTaskId(task.id)}
                              onDragEnd={() => setDraggedTaskId(null)}
                              onClick={() => openEditModal(task)}
                            >
                              <strong>{task.titel}</strong>
                              <span>{task.zustaendig}</span>
                              <div className={styles.kanbanMeta}>
                                <span
                                  className={`${styles.badge} ${styles.priority}`}
                                  data-priority={task.prioritaet}
                                >
                                  {task.prioritaet}
                                </span>
                                <span
                                  className={styles.deadlinePill}
                                  data-state={getDeadlineProgressState(task, deadlineProgressTime, holidayDateKeys)}
                                  style={getDeadlineProgressStyle(task, deadlineProgressTime, holidayDateKeys)}
                                  title={getDeadlineProgressText(task, deadlineProgressTime, holidayDateKeys)}
                                >
                                  <span>{formatDeadline(task.faelligkeit)}</span>
                                </span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </article>
                  );
                })}
              </section>
            </section>
          ) : activeTab === "calendar" ? (
            <section>
              <div className={styles.topline}>
                <div>
                  <p className={styles.eyebrow}>Kalender</p>
                  <h1>Kalenderübersicht</h1>
                  <p className={styles.subline}>
                    Sieh auf einen Blick, welche Aufgaben an welchem Tag fällig sind.
                  </p>
                </div>

                <div className={styles.toplineActions}>
                  {mayFilterPlanningUsers && (
                    <label className={styles.inlineSelectLabel}>
                      Benutzer
                      <select
                        value={planningOwnerFilter}
                        onChange={(event) => setPlanningOwnerFilter(event.target.value)}
                      >
                        <option value="">Alle</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button className={styles.primaryButton} onClick={() => openCreateModal()}>
                    Neue Aufgabe
                  </button>
                  <button className={styles.secondaryButton} onClick={() => openAbsenceModal()}>
                    Neue Abwesenheit
                  </button>
                </div>
              </div>

              <section className={styles.calendarToolbar}>
                <button
                  className={styles.secondaryButton}
                  onClick={() => {
                    const nextDate = new Date(calendarDate);
                    if (calendarView === "month") {
                      nextDate.setMonth(calendarDate.getMonth() - 1, 1);
                    } else if (calendarView === "week") {
                      nextDate.setDate(calendarDate.getDate() - 7);
                    } else {
                      nextDate.setDate(calendarDate.getDate() - 1);
                    }
                    setCalendarDate(nextDate);
                  }}
                >
                  Zurück
                </button>

                <div className={styles.calendarTitleGroup}>
                  <div className={styles.viewSwitch}>
                    <button
                      className={calendarView === "month" ? styles.activeViewButton : ""}
                      onClick={() => setCalendarView("month")}
                    >
                      Monat
                    </button>
                    <button
                      className={calendarView === "week" ? styles.activeViewButton : ""}
                      onClick={() => setCalendarView("week")}
                    >
                      Woche
                    </button>
                    <button
                      className={calendarView === "day" ? styles.activeViewButton : ""}
                      onClick={() => setCalendarView("day")}
                    >
                      Tag
                    </button>
                  </div>
                  <h2>
                    {calendarView === "month"
                      ? formatCalendarTitle(calendarDate)
                      : calendarView === "week"
                        ? formatWeekTitle(calendarDate)
                        : formatDayTitle(calendarDate)}
                  </h2>
                </div>

                <button
                  className={styles.secondaryButton}
                  onClick={() => {
                    const nextDate = new Date(calendarDate);
                    if (calendarView === "month") {
                      nextDate.setMonth(calendarDate.getMonth() + 1, 1);
                    } else if (calendarView === "week") {
                      nextDate.setDate(calendarDate.getDate() + 7);
                    } else {
                      nextDate.setDate(calendarDate.getDate() + 1);
                    }
                    setCalendarDate(nextDate);
                  }}
                >
                  Weiter
                </button>
              </section>

              {calendarView === "month" && (
                <section className={styles.calendarGrid}>
                  {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((weekday) => (
                    <div key={weekday} className={styles.calendarWeekday}>
                      {weekday}
                    </div>
                  ))}

                  {calendarDays.map((day, index) => {
                    const dateKey = day ? formatDateKey(day) : `empty-${index}`;
                    const dayTasks = day ? tasksByDate[dateKey] ?? [] : [];
                    const dayAbsences = day ? absencesByDate[dateKey] ?? [] : [];
                    const holiday = day ? getHolidayForDateKey(dateKey) : undefined;
                    const isWeekend = day ? isWeekendDateKey(dateKey) : false;
                    const isToday = day && formatDateKey(day) === formatDateKey(new Date());
                    const weekdayIndex = day ? (day.getDay() + 6) % 7 : 0;
                    const monthAbsenceBars = day
                      ? dayAbsences
                          .filter((absence) => {
                            const previousDateKey = addDaysToDateKey(dateKey, -1);
                            const hasPreviousInCurrentMonth =
                              calendarVisibleDateKeys.has(previousDateKey);
                            const previousAbsence = getMatchingAbsenceForDate(
                              getAbsenceGroupKey(absence),
                              previousDateKey
                            );

                            return weekdayIndex === 0 || !hasPreviousInCurrentMonth || !previousAbsence;
                          })
                          .map((absence, absenceIndex) => ({
                            absence,
                            span: getAbsenceBarSpan(absence, dateKey, 7 - weekdayIndex),
                            row: absenceIndex,
                          }))
                      : [];
                    const hasAbsenceContinuation =
                      day &&
                      weekdayIndex !== 0 &&
                      dayAbsences.some((absence) =>
                        Boolean(
                          getMatchingAbsenceForDate(
                            getAbsenceGroupKey(absence),
                            addDaysToDateKey(dateKey, -1)
                          )
                        )
                      );

                    return (
                      <article
                        key={dateKey}
                        className={`${styles.calendarDay} ${!day ? styles.emptyDay : ""} ${
                          isToday ? styles.today : ""
                        } ${monthAbsenceBars.length > 0 ? styles.hasAbsenceBar : ""} ${
                          hasAbsenceContinuation ? styles.hasAbsenceContinuation : ""
                        }`}
                        data-weekend={isWeekend && dayTasks.length === 0}
                        data-holiday={Boolean(holiday)}
                        onClick={() => day && toggleCalendarDayActions(day)}
                      >
                        {day && (
                          <>
                            <div className={styles.calendarDayHeader}>
                              <strong>{day.getDate()}</strong>
                              <span>{dayTasks.length}</span>
                            </div>

                            {holiday && <span className={styles.holidayChip}>{holiday.name}</span>}

                            {selectedCalendarActionDate === dateKey && (
                              <div
                                className={styles.calendarDayActions}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <button type="button" onClick={() => openCreateModal(day)}>
                                  Aufgabe anlegen
                                </button>
                                <button type="button" onClick={() => openAbsenceModal(day)}>
                                  Abwesenheit anlegen
                                </button>
                              </div>
                            )}

                            {monthAbsenceBars.length > 0 && (
                              <div className={styles.monthAbsenceBars}>
                                {monthAbsenceBars.map(({ absence, span, row }) => (
                                  <button
                                    key={absence.id}
                                    className={styles.monthAbsenceBar}
                                    data-type={absence.type}
                                    style={
                                      {
                                        "--absence-span": span,
                                        "--absence-row": row,
                                      } as CSSProperties
                                    }
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openEditAbsenceModal(absence);
                                    }}
                                    title="Abwesenheit bearbeiten"
                                  >
                                    {absence.userName}: {absenceLabel(absence.type)}
                                  </button>
                                ))}
                              </div>
                            )}

                            <div className={styles.calendarTasks}>
                              {dayTasks.map((task) => (
                                <button
                                  key={task.id}
                                  className={styles.calendarTask}
                                  data-status={task.status}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openEditModal(task);
                                  }}
                                >
                                  <strong>{task.titel}</strong>
                                  <span>
                                    {task.zustaendig}
                                    {getTaskPlannedMinutesForDate(task, dateKey) > 0
                                      ? ` · ${formatMinutes(getTaskPlannedMinutesForDate(task, dateKey))}`
                                      : ""}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </article>
                    );
                  })}
                </section>
              )}

              {calendarView === "week" && (
                <section className={styles.weekGrid}>
                  {weekDays.map((day) => {
                    const dateKey = formatDateKey(day);
                    const dayTasks = tasksByDate[dateKey] ?? [];
                    const dayAbsences = absencesByDate[dateKey] ?? [];
                    const holiday = getHolidayForDateKey(dateKey);
                    const isWeekend = isWeekendDateKey(dateKey);
                    const isToday = dateKey === formatDateKey(new Date());
                    const weekdayIndex = (day.getDay() + 6) % 7;
                    const weekAbsenceBars = dayAbsences
                      .filter((absence) => {
                        const previousDateKey = addDaysToDateKey(dateKey, -1);
                        const previousAbsence = getMatchingAbsenceForDate(
                          getAbsenceGroupKey(absence),
                          previousDateKey
                        );

                        return weekdayIndex === 0 || !weekVisibleDateKeys.has(previousDateKey) || !previousAbsence;
                      })
                      .map((absence, absenceIndex) => ({
                        absence,
                        span: getAbsenceBarSpan(absence, dateKey, 7 - weekdayIndex),
                        row: absenceIndex,
                      }));
                    const hasAbsenceContinuation =
                      weekdayIndex !== 0 &&
                      dayAbsences.some((absence) =>
                        Boolean(
                          getMatchingAbsenceForDate(
                            getAbsenceGroupKey(absence),
                            addDaysToDateKey(dateKey, -1)
                          )
                        )
                      );

                    return (
                      <article
                        key={dateKey}
                        className={`${styles.weekDay} ${isToday ? styles.today : ""} ${
                          weekAbsenceBars.length > 0 ? styles.hasAbsenceBar : ""
                        } ${hasAbsenceContinuation ? styles.hasAbsenceContinuation : ""}`}
                        data-weekend={isWeekend && dayTasks.length === 0}
                        data-holiday={Boolean(holiday)}
                        onClick={() => toggleCalendarDayActions(day)}
                      >
                        <div className={styles.calendarDayHeader}>
                          <strong>
                            {new Intl.DateTimeFormat("de-DE", {
                              weekday: "short",
                              day: "2-digit",
                              month: "2-digit",
                            }).format(day)}
                          </strong>
                          <span>{dayTasks.length}</span>
                        </div>
                        {holiday && <span className={styles.holidayChip}>{holiday.name}</span>}
                        {selectedCalendarActionDate === dateKey && (
                          <div
                            className={styles.calendarDayActions}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button type="button" onClick={() => openCreateModal(day)}>
                              Aufgabe anlegen
                            </button>
                            <button type="button" onClick={() => openAbsenceModal(day)}>
                              Abwesenheit anlegen
                            </button>
                          </div>
                        )}
                        {weekAbsenceBars.length > 0 && (
                          <div className={`${styles.monthAbsenceBars} ${styles.weekAbsenceBars}`}>
                            {weekAbsenceBars.map(({ absence, span, row }) => (
                              <button
                                key={absence.id}
                                className={styles.monthAbsenceBar}
                                data-type={absence.type}
                                style={
                                  {
                                    "--absence-span": span,
                                    "--absence-row": row,
                                  } as CSSProperties
                                }
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditAbsenceModal(absence);
                                }}
                                title="Abwesenheit bearbeiten"
                              >
                                {absence.userName}: {absenceLabel(absence.type)}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className={styles.calendarTasks}>
                          {dayTasks.length === 0 ? (
                            <p className={styles.emptyState}>Keine Aufgaben</p>
                          ) : (
                            dayTasks.map((task) => (
                              <button
                                key={task.id}
                                className={styles.calendarTask}
                                data-status={task.status}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditModal(task);
                                }}
                              >
                                <strong>{task.titel}</strong>
                                <span>
                                  {task.zustaendig}
                                  {getTaskPlannedMinutesForDate(task, dateKey) > 0
                                    ? ` · ${formatMinutes(getTaskPlannedMinutesForDate(task, dateKey))}`
                                    : ""}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      </article>
                    );
                  })}
                </section>
              )}

              {calendarView === "day" && (
                <section className={styles.dayView}>
                  {getHolidayForDateKey(formatDateKey(calendarDate)) && (
                    <span className={styles.holidayChip}>
                      {getHolidayForDateKey(formatDateKey(calendarDate)).name}
                    </span>
                  )}
                  <div className={styles.dayViewActions}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => openCreateModal(calendarDate)}
                    >
                      Aufgabe anlegen
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => openAbsenceModal(calendarDate)}
                    >
                      Abwesenheit anlegen
                    </button>
                  </div>
                  {selectedDayAbsences.length > 0 && (
                    <div className={styles.absenceChips}>
                      {selectedDayAbsences.map((absence) => (
                        <button
                          key={absence.id}
                          className={styles.absenceChip}
                          data-type={absence.type}
                          onClick={() => openEditAbsenceModal(absence)}
                          title="Abwesenheit bearbeiten"
                        >
                          {absence.userName}: {absenceLabel(absence.type)}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedDayTasks.length === 0 ? (
                    <p className={styles.emptyState}>Keine Aufgaben an diesem Tag.</p>
                  ) : (
                    selectedDayTasks.map((task) => (
                      <button
                        key={task.id}
                        className={styles.dayTask}
                        data-status={task.status}
                        onClick={() => openEditModal(task)}
                      >
                        <div>
                          <strong>{task.titel}</strong>
                          <span>
                            {task.zustaendig}
                            {getTaskPlannedMinutesForDate(task, formatDateKey(calendarDate)) > 0
                              ? ` · ${formatMinutes(
                                  getTaskPlannedMinutesForDate(task, formatDateKey(calendarDate))
                                )}`
                              : ""}
                          </span>
                        </div>
                        <span
                          className={styles.deadlinePill}
                          data-state={getDeadlineProgressState(task, deadlineProgressTime, holidayDateKeys)}
                          style={getDeadlineProgressStyle(task, deadlineProgressTime, holidayDateKeys)}
                          title={getDeadlineProgressText(task, deadlineProgressTime, holidayDateKeys)}
                        >
                          <span>{formatDeadline(task.faelligkeit)}</span>
                        </span>
                      </button>
                    ))
                  )}
                </section>
              )}
            </section>
          ) : activeTab === "reports" ? (
            <section className={styles.settingsPanel}>
              <div className={styles.topline}>
                <div>
                  <p className={styles.eyebrow}>Reports</p>
                  <h1>Auslastung</h1>
                  <p className={styles.subline}>
                    Kapazität je Mitarbeiter aus Tagesarbeitszeit und geplanter Vorgabezeit.
                  </p>
                </div>
              </div>

              <section className={styles.reportHero}>
                <div>
                  <span>Heute</span>
                  <h2>
                    {todayUtilization.absence
                      ? `${activeUser?.name ?? "Aktiver Benutzer"} ist heute ${absenceLabel(todayUtilization.absence.type)}`
                      : `${activeUser?.name ?? "Aktiver Benutzer"} ist heute zu ${todayUtilization.utilization}% ausgelastet`}
                  </h2>
                  <p>
                    {todayUtilization.absence
                      ? "Der Tag wird in der Auslastung ohne verfügbare Kapazität gerechnet."
                      : `${formatMinutes(todayUtilization.plannedMinutes)} geplant von ${formatMinutes(todayUtilization.capacityMinutes)} verfügbarer Tagesarbeitszeit.${
                          todayUtilization.holiday ? ` Heute ist ${todayUtilization.holiday.name}.` : ""
                        }`}
                  </p>
                </div>
                <div className={styles.reportProgress} aria-label="Auslastung heute">
                  <span style={{ width: `${clampPercent(todayUtilization.utilization)}%` }} />
                </div>
              </section>

              <section className={styles.reportPanel}>
                <div className={styles.reportHeader}>
                  <div>
                    <p className={styles.eyebrow}>Produktivität</p>
                    <h2>Produktivität und offene Kapazität</h2>
                  </div>
                  <p>
                    Zeigt, welcher Anteil der verfügbaren Arbeitszeit durch geplante Aufgaben
                    produktiv gedeckt ist und welche Kapazität noch offen bleibt.
                  </p>
                </div>

                <div className={styles.periodSelector} aria-label="Zeitraum Produktivität">
                  {(["day", "week", "month", "quarter", "year"] as ProductivityPeriod[]).map(
                    (period) => (
                      <button
                        key={period}
                        type="button"
                        className={productivityPeriod === period ? styles.activePeriod : ""}
                        onClick={() => setProductivityPeriod(period)}
                      >
                        {productivityPeriodLabel(period)}
                      </button>
                    )
                  )}
                </div>

                <div className={styles.unproductiveSummaryGrid}>
                  <article>
                    <span>Produktiv geplant</span>
                    <strong>{formatMinutes(unproductiveSummary.productiveMinutes)}</strong>
                    <small>{formatPercent(productiveSummaryPercent)}% der verfügbaren Zeit</small>
                  </article>
                  <article>
                    <span>Offene Kapazität</span>
                    <strong>{formatMinutes(unproductiveSummary.unproductiveMinutes)}</strong>
                    <small>{formatPercent(unproductiveSummaryPercent)}% noch nicht verplant</small>
                  </article>
                  <article>
                    <span>Verfügbare Zeit</span>
                    <strong>{formatMinutes(unproductiveSummary.capacityMinutes)}</strong>
                    <small>
                      {visibleReportUsers.length} Benutzer · {productivityPeriodLabel(productivityPeriod)}
                    </small>
                  </article>
                </div>

                <div className={styles.unproductiveRows}>
                  {unproductiveRows.map((row) => (
                    <article key={row.user.id} className={styles.unproductiveRow}>
                      <div className={styles.unproductiveUser}>
                        <strong>{row.user.name}</strong>
                        <span>
                          {formatMinutes(row.productiveMinutes)} produktiv geplant ·{" "}
                          {formatMinutes(row.unproductiveMinutes)} offen
                        </span>
                      </div>
                      <div className={`${styles.productivityEndpoint} ${styles.productivityEndpointPositive}`}>
                        <strong>{formatPercent(row.productivePercent)}%</strong>
                        <span>produktiv</span>
                      </div>
                      <div
                        className={styles.unproductiveBar}
                        title={`${formatPercent(row.productivePercent)}% produktiv geplant, ${formatPercent(row.unproductivePercent)}% offen`}
                      >
                        <span
                          className={styles.productiveSegment}
                          style={{ width: `${clampPercent(row.productivePercent)}%` }}
                        />
                        <span
                          className={styles.unproductiveSegment}
                          style={{ width: `${clampPercent(row.unproductivePercent)}%` }}
                        />
                      </div>
                      <div className={`${styles.productivityEndpoint} ${styles.productivityEndpointOpen}`}>
                        <strong>{formatPercent(row.unproductivePercent)}%</strong>
                        <span>offen</span>
                      </div>
                      {row.overbookedMinutes > 0 && (
                        <span className={styles.overbookedBadge}>
                          {formatMinutes(row.overbookedMinutes)} überplant
                        </span>
                      )}
                    </article>
                  ))}
                </div>
              </section>

              <section className={styles.reportPanel}>
                <div className={styles.reportHeader}>
                  <div>
                    <p className={styles.eyebrow}>Leistung</p>
                    <h2>Leistungsgrad</h2>
                  </div>
                  <p>Vorgabezeit geteilt durch erfasste Zeit. Sber 100% bedeutet schneller als Vorgabe.</p>
                </div>

                <div className={styles.performanceGaugeGrid}>
                  {performancePeriods.map(({ period, label, result }) => (
                    <button
                      key={period}
                      className={styles.performanceGauge}
                      data-state={getPerformanceState(result.performanceGrade)}
                      data-selected={selectedPerformancePeriod === period}
                      style={getPerformanceGaugeStyle(result.performanceGrade)}
                      onClick={() =>
                        setSelectedPerformancePeriod((current) =>
                          current === period ? null : period
                        )
                      }
                    >
                      <strong>{label}</strong>
                      <div className={styles.gaugeDial}>
                        <span className={styles.gaugeNeedle} />
                      </div>
                      <b>{result.performanceGrade === null ? "-" : `${result.performanceGrade}%`}</b>
                      <small>
                        <span>Vorgabezeit = {formatMinutes(result.totalEstimateMinutes)}</span>
                        <span>Benötigte Zeit = {formatMinutes(result.totalTrackedMinutes)}</span>
                      </small>
                    </button>
                  ))}
                </div>

                {selectedPerformancePeriod && selectedPerformanceResult && (
                  <div className={styles.performanceDetail}>
                    <div className={styles.reportHeader}>
                      <div>
                        <p className={styles.eyebrow}>Details</p>
                        <h2>{performancePeriodLabel(selectedPerformancePeriod)} nachvollziehen</h2>
                      </div>
                      <p>Diese Aufgaben bilden den ausgewählten Leistungsgrad.</p>
                    </div>

                    <div className={styles.tableCard}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Nr.</th>
                            <th>Aufgabe</th>
                            <th>Zuständig</th>
                            <th>Vorgabe</th>
                            <th>Erfasst</th>
                            <th>Leistungsgrad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPerformanceResult.rows.length === 0 ? (
                            <tr>
                              <td colSpan={6}>
                                Keine passenden Aufgaben mit Vorgabezeit und Zeiteinträgen.
                              </td>
                            </tr>
                          ) : (
                            selectedPerformanceResult.rows.map(
                              ({ task, estimateMinutes, trackedMinutes, performanceGrade }) => (
                                <tr key={task.id}>
                                  <td className={styles.number}>
                                    {getTaskNumber(task.id, activeTasks)}
                                  </td>
                                  <td>
                                    <div className={styles.title}>{task.titel}</div>
                                    <span className={styles.description}>
                                      {truncateText(task.beschreibung, 30)}
                                    </span>
                                  </td>
                                  <td>
                                    {task.zustaendig}
                                    <span className={styles.metaLine}>{task.rolle}</span>
                                  </td>
                                  <td>{formatMinutes(estimateMinutes)}</td>
                                  <td>{formatMinutes(trackedMinutes)}</td>
                                  <td>
                                    <span
                                      className={styles.performanceBadge}
                                      data-state={getPerformanceState(performanceGrade)}
                                    >
                                      {performanceGrade === null ? "-" : `${performanceGrade}%`}
                                    </span>
                                  </td>
                                </tr>
                              )
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>

              <section className={styles.reportPanel}>
                <div className={styles.reportHeader}>
                  <div>
                    <p className={styles.eyebrow}>Planung</p>
                    <h2>Auslastung für die nächsten Tage</h2>
                  </div>
                  <p>Urlaub und Krank werden ohne verfügbare Kapazität gerechnet. Feiertage bleiben planbar und zählen als verfügbare Zeit.</p>
                </div>

                <div className={styles.workloadGrid}>
                  <div className={styles.workloadHeaderCell}>Mitarbeiter</div>
                  {reportDays.map((day) => {
                    const dateKey = formatDateKey(day);
                    const holiday = getHolidayForDateKey(dateKey);

                    return (
                      <div
                        key={dateKey}
                        className={styles.workloadDayHeader}
                        data-weekday={day.getDay() !== 0 && day.getDay() !== 6}
                        data-holiday={Boolean(holiday)}
                        title={holiday?.name ?? undefined}
                      >
                        {formatShortDate(day)}
                      </div>
                    );
                  })}

                  {visibleReportUsers.map((user) => (
                    <div key={user.id} className={styles.workloadRowGroup}>
                      <div className={styles.workloadUser}>
                        <strong>{user.name}</strong>
                        <span>{user.dailyWorkHours} Std./Tag</span>
                      </div>
                      {reportDays.map((day) => {
                        const utilization = getUserUtilizationForDay(user.id, day);
                        const state =
                          utilization.utilization >= 100
                            ? "over"
                            : utilization.utilization >= 80
                              ? "high"
                              : utilization.utilization > 0
                                ? "normal"
                                : "empty";

                        return (
                          <div
                            key={formatDateKey(day)}
                            className={styles.workloadCell}
                            data-state={state}
                            data-weekday={day.getDay() !== 0 && day.getDay() !== 6}
                            data-absence={utilization.absence?.type ?? ""}
                            data-holiday={Boolean(utilization.holiday)}
                          >
                            {utilization.absence ? (
                              <>
                                <strong>{absenceLabel(utilization.absence.type)}</strong>
                                <small>
                                  {utilization.absence.representativeName
                                    ? `Vertretung: ${utilization.absence.representativeName}`
                                    : utilization.absence.note || "Abwesend"}
                                </small>
                              </>
                            ) : (
                              <>
                                <strong>{utilization.utilization}%</strong>
                                <div className={styles.workloadMiniBar}>
                                  <span style={{ width: `${clampPercent(utilization.utilization)}%` }} />
                                </div>
                                <small>
                                  {formatMinutes(utilization.plannedMinutes)} / {formatMinutes(utilization.capacityMinutes)}
                                  {utilization.holiday ? ` · ${utilization.holiday.name}` : ""}
                                </small>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </section>

            </section>
          ) : (
            <>
              <div className={styles.topline}>
                <div>
                  <p className={styles.eyebrow}>WorkPilot</p>
                  <h1>Meine Aufgaben</h1>
                  <p className={styles.subline}>
                    Plane, priorisiere und verfolge deine Aufgaben an einem Ort.
                  </p>
                </div>

                <button className={styles.primaryButton} onClick={() => openCreateModal()}>
                  Neue Aufgabe
                </button>
              </div>

              <section className={styles.cards}>
                <button
                  className={`${styles.card} ${styles.clickableCard}`}
                  onClick={() => {
                    setStatusFilter("");
                    setDeadlineFilter("");
                  }}
                >
                  <span>Gesamt</span>
                  <strong>{activeTasks.length}</strong>
                </button>

                <button
                  className={`${styles.card} ${styles.clickableCard} ${
                    offene > 0 ? styles.warningCard : ""
                  }`}
                  onClick={() => {
                    setStatusFilter("offen");
                    setDeadlineFilter("");
                  }}
                >
                  <span>
                    Offen
                    {offene > 0 && <span className={styles.warningPulse}>!</span>}
                  </span>
                  <strong>{offene}</strong>
                </button>

                <button
                  className={`${styles.card} ${styles.clickableCard}`}
                  onClick={() => {
                    setStatusFilter("in Bearbeitung");
                    setDeadlineFilter("");
                  }}
                >
                  <span>In Bearbeitung</span>
                  <strong>{bearbeitung}</strong>
                </button>

                <button
                  className={`${styles.card} ${styles.clickableCard} ${
                    ueberfaellig > 0 ? styles.alertCard : ""
                  }`}
                  onClick={() => {
                    setStatusFilter("");
                    setDeadlineFilter("due");
                  }}
                >
                  <span>
                    Sberfällig
                    {ueberfaellig > 0 && <span className={styles.pulseAlert}>!</span>}
                  </span>
                  <strong>{ueberfaellig}</strong>
                </button>

                <button
                  className={`${styles.card} ${styles.clickableCard}`}
                  onClick={() => {
                    setStatusFilter("erledigt");
                    setDeadlineFilter("");
                  }}
                >
                  <span>Erledigt</span>
                  <strong>{erledigt}</strong>
                </button>
              </section>

              <section className={styles.filterBar}>
                <label>
                  Suche
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Aufgabennummer, Aufgabe, Kunde, Zuständigkeit"
                  />
                </label>

                <label>
                  Status
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="">Alle</option>
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Priorität
                  <select
                    value={priorityFilter}
                    onChange={(event) => setPriorityFilter(event.target.value)}
                  >
                    <option value="">Alle</option>
                    {priorityOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Kunde
                  <select
                    value={customerFilter}
                    onChange={(event) => setCustomerFilter(event.target.value)}
                  >
                    <option value="">Alle</option>
                    {customerOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Zuständig
                  <select
                    value={ownerFilter}
                    onChange={(event) => setOwnerFilter(event.target.value)}
                  >
                    <option value="">Alle</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Sortierung
                  <select
                    value={taskNumberSort}
                    onChange={(event) => setTaskNumberSort(event.target.value as "desc" | "asc")}
                  >
                    <option value="desc">Nr. absteigend</option>
                    <option value="asc">Nr. aufsteigend</option>
                  </select>
                </label>

                <button
                  className={styles.secondaryButton}
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("");
                    setDeadlineFilter("");
                    setPriorityFilter("");
                    setCustomerFilter("");
                    setOwnerFilter(activeUserId);
                    setTaskNumberSort("desc");
                  }}
                >
                  Zurücksetzen
                </button>
              </section>

              <section className={`${styles.tableCard} ${styles.taskTableCard}`}>
                <table className={`${styles.table} ${styles.dashboardTaskTable}`}>
                  <thead>
                    <tr>
                      <th>Timer</th>
                      <th>Nr.</th>
                      <th>Aufgabe</th>
                      <th>Status</th>
                      <th>Priorität</th>
                      <th>Kunde</th>
                      <th>Zuständig</th>
                      <th>Deadline</th>
                      <th>Vorgabe</th>
                      <th>Restzeit</th>
                      <th>Aktion</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredTasks.map((task) => (
                      <tr
                        key={task.id}
                        onClick={() => openEditModal(task)}
                        className={styles.clickableRow}
                        data-status={task.status}
                      >
                        <td>
                          <div className={styles.timerCell}>
                            <div
                              className={styles.timerUsageBar}
                              data-state={getTaskTimerUsageState(task)}
                              title={
                                task.vorgabeMinuten
                                  ? `${getTaskTimerUsagePercent(task)}% der Vorgabezeit erfasst`
                                  : "Keine Vorgabezeit hinterlegt"
                              }
                            >
                              <span style={{ width: `${getTaskTimerUsagePercent(task)}%` }} />
                            </div>
                            <div className={styles.timerControl}>
                              <button
                                type="button"
                                className={styles.timerButton}
                                data-running={Boolean(runningTaskTimers[task.id])}
                                disabled={task.status === "erledigt"}
                                onClick={(event) =>
                                  runningTaskTimers[task.id]
                                    ? stopTaskTimer(event, task)
                                    : startTaskTimer(event, task)
                                }
                                aria-label={
                                  runningTaskTimers[task.id]
                                    ? "Zeiterfassung stoppen"
                                    : "Zeiterfassung starten"
                                }
                              >
                                <span
                                  className={
                                    runningTaskTimers[task.id] ? styles.stopIcon : styles.playIcon
                                  }
                                />
                              </button>
                              <span className={styles.timerReadout}>
                                {formatStopwatch(getTaskTimerMilliseconds(task))}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className={styles.number}>
                          <span className={styles.taskNumberStack}>
                            {task.status === "erledigt" && (
                              <span className={styles.doneMarker}>{"\u2713"}</span>
                            )}
                            <span>{getTaskNumber(task.id, tasks)}</span>
                          </span>
                        </td>
                        <td className={styles.title}>
                          {task.titel}
                          {task.beschreibung && (
                            <span className={styles.description}>
                              {truncateText(task.beschreibung, 30)}
                            </span>
                          )}
                          {task.acceptanceStatus === "pending" && (
                            <span className={styles.pendingHint}>wartet auf Annahme</span>
                          )}
                          {task.acceptanceStatus === "rejected" && task.rejectionReason && (
                            <span className={styles.pendingHint}>
                              abgelehnt: {task.rejectionReason}
                            </span>
                          )}
                          <span className={styles.editHint}>bearbeiten</span>
                        </td>
                        <td>
                          <span
                            className={`${styles.badge} ${styles.status}`}
                            data-status={task.status}
                          >
                            {task.status}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`${styles.badge} ${styles.priority}`}
                            data-priority={task.prioritaet}
                          >
                            {task.prioritaet}
                          </span>
                        </td>
                        <td>
                          {task.kunde || "-"}
                          {task.kundenklasse && (
                            <span className={styles.metaLine}>Klasse {task.kundenklasse}</span>
                          )}
                        </td>
                        <td>
                          {task.zustaendig}
                          <span className={styles.metaLine}>{task.rolle}</span>
                        </td>
                        <td>
                          <span
                            className={styles.deadlinePill}
                            data-state={getDeadlineProgressState(task, deadlineProgressTime, holidayDateKeys)}
                            style={getDeadlineProgressStyle(task, deadlineProgressTime, holidayDateKeys)}
                            title={getDeadlineProgressText(task, deadlineProgressTime, holidayDateKeys)}
                          >
                            {getDeadlineProgressState(task, deadlineProgressTime, holidayDateKeys) === "open" && (
                              <span className={styles.deadlineIcon}>{"\u2713"}</span>
                            )}
                            {["soon", "due"].includes(getDeadlineProgressState(task, deadlineProgressTime, holidayDateKeys)) && (
                              <span className={styles.deadlineIcon}>!</span>
                            )}
                            <span>{formatDeadline(task.faelligkeit)}</span>
                          </span>
                          {formatArchiveCountdown(task) && (
                            <span className={styles.archiveCountdown}>
                              {formatArchiveCountdown(task)}
                            </span>
                          )}
                        </td>
                        <td>{formatMinutes(task.vorgabeMinuten)}</td>
                        <td>
                          <span
                            className={styles.remainingTime}
                            data-state={
                              getRemainingMinutes(task) === null
                                ? "empty"
                                : getRemainingMinutes(task)! < 0
                                  ? "over"
                                  : "ok"
                            }
                          >
                            {formatRemainingTime(task)}
                          </span>
                        </td>
                        <td>
                          {task.acceptanceStatus === "pending" &&
                          task.zustaendigId === activeUserId ? (
                            <div className={styles.actionGroup}>
                              <button
                                onClick={(event) => respondToTask(event, task, "accepted")}
                                className={styles.acceptButton}
                              >
                                Annehmen
                              </button>
                              <button
                                onClick={(event) => respondToTask(event, task, "rejected")}
                                className={styles.deleteButton}
                              >
                                Ablehnen
                              </button>
                            </div>
                          ) : canManageUsers(activeUser?.role) ? (
                            <button
                              onClick={(event) => deleteTask(event, task.id)}
                              className={styles.deleteButton}
                            >
                              Archivieren
                            </button>
                          ) : (
                            <span className={styles.metaLine}>Keine Rechte</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}
        </section>
      </section>

      {isCompanyProfileModalOpen && (
        <div className={styles.overlay} onClick={() => setIsCompanyProfileModalOpen(false)}>
          <div
            className={`${styles.modal} ${styles.companyProfileModal}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.contactModalHeader}>
              <h2>OK solutions GmbH bearbeiten</h2>
              <button
                className={styles.modalCloseButton}
                type="button"
                onClick={() => setIsCompanyProfileModalOpen(false)}
                aria-label="Firmendaten schließen"
              >
                
              </button>
            </div>

            <div className={styles.companyProfileModalBody}>
              <div className={styles.contactFormTabs}>
                {[
                  ["general", "ALLGEMEIN"],
                  ["contact", "KONTAKTDATEN"],
                  ["bank", "BANKINFORMATIONEN"],
                ].map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    data-active={companyProfileEditTab === tab}
                    onClick={() => setCompanyProfileEditTab(tab as CompanyProfileEditTab)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {companyProfileEditTab === "general" && (
                <section className={styles.companyProfileEditGrid}>
                  <label className={styles.companyLogoUpload}>
                    Firmenlogo
                    <div>
                      <img src="/oks-logo.png" alt="OK solutions" />
                      <img src="/oki-logo.png" alt="OK immocare" />
                    </div>
                    <button type="button" className={styles.secondaryButton}>
                      + Dateien hineinziehen oder auswählen
                    </button>
                  </label>
                  <label>
                    Name
                    <input defaultValue="OK solutions GmbH" />
                  </label>
                  <label>
                    Rechtsform
                    <select defaultValue="GmbH">
                      {legalFormOptions.map((legalForm) => (
                        <option key={legalForm} value={legalForm}>
                          {legalForm}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Gründungsdatum
                    <input defaultValue="04.04.2024" />
                  </label>
                  <label className={styles.fullWidth}>
                    Straxe & Hausnummer
                    <input defaultValue="Im Krötenteich 3/4" />
                  </label>
                  <label>
                    Postleitzahl
                    <input defaultValue="74722" />
                  </label>
                  <label>
                    Stadt
                    <input defaultValue="Buchen" />
                  </label>
                  <label>
                    Land
                    <select defaultValue="Deutschland">
                      <option>Deutschland</option>
                    </select>
                  </label>
                  <label className={styles.fullWidth}>
                    Feiertage (nur Deutschland)
                    <select defaultValue="Baden-Württemberg">
                      <option>Baden-Württemberg</option>
                      <option>Bayern</option>
                      <option>Hessen</option>
                      {germanStateOptions
                        .filter(
                          (stateOption) =>
                            !["Baden-Württemberg", "Bayern", "Hessen"].includes(
                              stateOption.label
                            )
                        )
                        .map((stateOption) => (
                          <option key={stateOption.value}>{stateOption.label}</option>
                        ))}
                    </select>
                  </label>
                  <label className={styles.fullWidth}>
                    Land der Geschäftstätigkeit
                    <select defaultValue="Deutsch (Deutschland)">
                      <option>Deutsch (Deutschland)</option>
                    </select>
                  </label>
                  <strong className={styles.companyProfileEditSection}>Geschäftsführung</strong>
                  <label className={styles.fullWidth}>
                    Alternative Bezeichnung
                    <input defaultValue="Geschäftsführer" />
                  </label>
                  <label className={styles.fullWidth}>
                    Name/n der vorstehenden Person/en
                    <input defaultValue="Ramona Eid" />
                  </label>
                </section>
              )}

              {companyProfileEditTab === "contact" && (
                <section className={styles.companyProfileEditGrid}>
                  <label>
                    Telefonnummer
                    <input defaultValue="+4962813263110" />
                  </label>
                  <label>
                    Mobilfunknummer
                    <input />
                  </label>
                  <label>
                    Faxnummer
                    <input />
                  </label>
                  <label>
                    Webseite
                    <input defaultValue="https://www.ok-solutions.com" />
                  </label>
                </section>
              )}

              {companyProfileEditTab === "bank" && (
                <section className={styles.companyProfileEditGrid}>
                  <label className={styles.fullWidth}>
                    Kontoinhaber
                    <input />
                  </label>
                  <label className={styles.fullWidth}>
                    Bank
                    <input defaultValue="Sparkasse Neckartal-Odenwald" />
                  </label>
                  <label className={styles.fullWidth}>
                    IBAN
                    <input defaultValue="DE85674500480004369971" />
                  </label>
                  <label className={styles.fullWidth}>
                    BIC
                    <input defaultValue="SOLADES1MOS" />
                  </label>
                  <label className={styles.fullWidth}>
                    Steuernummer
                    <input placeholder="z.B. 000/000/0000" />
                  </label>
                  <label className={styles.fullWidth}>
                    Handelsregisternummer und Gerichtsstand
                    <input defaultValue="HRB 750622" />
                  </label>
                  <label className={styles.fullWidth}>
                    Umsatzsteuer-Identifikationsnummer
                    <input defaultValue="DE367346374" />
                  </label>
                </section>
              )}
            </div>

            <div className={styles.modalFooter}>
              <span />
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setIsCompanyProfileModalOpen(false)}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => setIsCompanyProfileModalOpen(false)}
                >
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isTradeManagementModalOpen && (
        <div className={styles.overlay} onClick={() => setIsTradeManagementModalOpen(false)}>
          <div
            className={`${styles.modal} ${styles.tradeManagementModal}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.contactModalHeader}>
              <h2>Gewerke von OK solutions GmbH bearbeiten</h2>
              <button
                className={styles.modalCloseButton}
                type="button"
                onClick={() => setIsTradeManagementModalOpen(false)}
                aria-label="Gewerke schließen"
              >
                
              </button>
            </div>

            <div className={styles.tradeManagementBody}>
              <div className={styles.contactFormTabs}>
                <button type="button" data-active="true">
                  GEWERKE
                </button>
              </div>

              <label className={styles.tradeCreateField}>
                Neues Gewerk anlegen
                <div>
                  <input
                    value={tradeDraftName}
                    onChange={(event) => setTradeDraftName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        createTrade();
                      }
                    }}
                    placeholder="z.B. Winterdienst"
                  />
                  <input
                    value={tradeDraftPrefix}
                    maxLength={5}
                    onChange={(event) => setTradeDraftPrefix(normalizeProjectPrefixInput(event.target.value))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        createTrade();
                      }
                    }}
                    placeholder="Kürzel"
                  />
                  <button type="button" className={styles.primaryButton} onClick={createTrade}>
                    + Gewerk
                  </button>
                </div>
              </label>

              {tradeManagementError && (
                <div className={styles.modalSaveNotice}>{tradeManagementError}</div>
              )}

              <div className={styles.tradeAssignmentBox}>
                <span>Zugewiesene Gewerke</span>
                <div className={styles.tradeChipList}>
                  {trades.map((trade) => (
                    <span key={trade.id} className={styles.tradeChip}>
                      <button
                        type="button"
                        onClick={() => deleteCompanyProfileTrade(trade.id)}
                        aria-label={`${trade.name} entfernen`}
                      >
                        
                      </button>
                      {trade.name}
                      <strong>{trade.projectPrefix || getProjectTradePrefix(trade.name)}</strong>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <span />
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setIsTradeManagementModalOpen(false)}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => setIsTradeManagementModalOpen(false)}
                >
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLogbookModalOpen && (
        <div className={styles.overlay} onClick={() => setIsLogbookModalOpen(false)}>
          <div
            className={`${styles.modal} ${styles.logbookEntryModal}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.contactModalHeader}>
              <h2>Nachricht ergänzen</h2>
              <button
                className={styles.modalCloseButton}
                type="button"
                onClick={() => setIsLogbookModalOpen(false)}
                aria-label="Nachricht schliessen"
              >
                
              </button>
            </div>

            <div className={styles.logbookEntryBody}>
              <div className={styles.contactFormTabs}>
                <button type="button" data-active="true">
                  NACHRICHT
                </button>
              </div>

              <label className={styles.logbookMessageField}>
                <span>Nachricht</span>
                <textarea
                  value={logbookMessage}
                  onChange={(event) => setLogbookMessage(event.target.value)}
                  placeholder="Tragen Sie hier Ihre Nachricht ein"
                />
              </label>

              <div className={styles.logbookAttachmentGrid}>
                <label>
                  Bild anhängen
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => addLogbookAttachments(event.target.files, "Bild")}
                  />
                </label>
                <label>
                  Dokument anhängen
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*"
                    multiple
                    onChange={(event) => addLogbookAttachments(event.target.files, "Dokument")}
                  />
                </label>
              </div>

              {logbookAttachments.length > 0 && (
                <div className={styles.logbookAttachmentList}>
                  {logbookAttachments.map((attachment, index) => (
                    <span key={`${attachment.name}-${index}`}>
                      {attachment.type}: {attachment.name}
                      <button
                        type="button"
                        onClick={() =>
                          setLogbookAttachments((currentAttachments) =>
                            currentAttachments.filter((_, itemIndex) => itemIndex !== index)
                          )
                        }
                      >
                        
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <label className={styles.logbookMessageField}>
                <span>Den Nachrichteninhalt auch per E-Mail an einen Kollegen versenden</span>
                <input
                  value={logbookColleague}
                  onChange={(event) => setLogbookColleague(event.target.value)}
                  placeholder="Kollegenname suchen - Liste folgt aus der Mitarbeiterverwaltung"
                />
              </label>

              <div className={styles.logbookVisibility}>
                <span>Sichtbar für</span>
                {[
                  ["Geschaeftsfuehrer", "Geschäftsführer"],
                  ["Vertriebler", "Vertriebler"],
                  ["Niederlassungsleiter", "Niederlassungsleiter"],
                  ["Monteur", "Monteur"],
                  ["Buchhaltung", "Buchhaltung"],
                ].map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="checkbox"
                      checked={logbookVisibleFor.includes(value)}
                      onChange={(event) => toggleLogbookVisibleFor(value, event.target.checked)}
                    />
                    {label}
                  </label>
                ))}
              </div>

              <label className={styles.logbookTaskToggle}>
                <input
                  type="checkbox"
                  checked={logbookCreateTask}
                  onChange={(event) => setLogbookCreateTask(event.target.checked)}
                />
                Aus diesem Eintrag eine Aufgabe anlegen
              </label>

              {logbookCreateTask && (
                <label className={styles.logbookMessageField}>
                  <span>Aufgabentitel</span>
                  <input
                    value={logbookTaskTitle}
                    onChange={(event) => setLogbookTaskTitle(event.target.value)}
                    placeholder="Titel der Aufgabe"
                  />
                </label>
              )}
            </div>

            <div className={styles.modalFooter}>
              <span />
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setIsLogbookModalOpen(false)}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={!logbookMessage.trim()}
                  onClick={saveLogbookEntry}
                >
                  Abschicken
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isContactBulkModalOpen && (
        <div className={styles.overlay} onClick={() => setIsContactBulkModalOpen(false)}>
          <div
            className={`${styles.modal} ${styles.contactBulkModal}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.contactModalHeader}>
              <h2>Gruppenaktion für {contactBulkCount} Kontakte</h2>
              <button
                className={styles.modalCloseButton}
                type="button"
                onClick={() => setIsContactBulkModalOpen(false)}
                aria-label="Gruppenaktion schließen"
              >
                
              </button>
            </div>

            <div className={styles.contactBulkBody}>
              <div className={styles.contactFormTabs}>
                <button type="button" data-active="true">
                  AKTION
                </button>
                <button type="button">LISTE</button>
              </div>

              <select
                value={contactBulkAction}
                onChange={(event) => setContactBulkAction(event.target.value)}
              >
                <option value="Archivieren">Archivieren</option>
              </select>

              <p className={styles.contactBulkHelp}>
                Um Zeilen für Gruppenaktionen auszuwählen, klicke diese an. Mit STRG + Klick
                wählst du zusätzliche Zeilen einzeln aus und mit SHIFT + Klick wählst du alle
                Zeilen bis zur angeklickten.
              </p>
              <p className={styles.contactBulkNotice}>
                <strong>Hinweis:</strong> Diese Aktion wird im Hintergrund ausgeführt und kann
                aufgrund der Datenmenge einige Minuten dauern.
              </p>
            </div>

            <div className={styles.modalFooter}>
              <span />
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setIsContactBulkModalOpen(false)}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={contactBulkCount === 0}
                  onClick={applyContactBulkAction}
                >
                  Auf {contactBulkCount} Kontakte anwenden
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isContactModalOpen && (
        <div
          className={`${styles.overlay} ${
            isProjectModalOpen ? styles.stackedModalOverlay : ""
          }`}
          onClick={() => setIsContactModalOpen(false)}
        >
          <div
            className={`${styles.modal} ${styles.contactModal}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.contactModalHeader}>
              <div>
                <p className={styles.eyebrow}>CRM</p>
                <h2>{editingContactId ? "Kontakt bearbeiten" : "Kontakt erstellen"}</h2>
              </div>
              <button
                className={styles.modalCloseButton}
                type="button"
                onClick={() => setIsContactModalOpen(false)}
                aria-label="Kontaktmaske schließen"
              >
                
              </button>
            </div>

            <div className={styles.contactModalBody}>
              <section className={styles.contactFormTopGrid}>
                {!editingContactId && (
                  <label>
                    Kategorie
                    <select
                      value={contactDraft.category}
                      onChange={(event) => updateContactDraft("category", event.target.value)}
                    >
                      <option value="Kunde">Kunde</option>
                      <option value="Lieferant">Lieferant</option>
                      <option value="Partner">Partner</option>
                      <option value="Ansprechpartner">Ansprechpartner</option>
                    </select>
                  </label>
                )}

                {!editingContactId && (
                  <div className={styles.contactTypeSwitch}>
                    <span>Typ</span>
                    <div>
                      <button
                        type="button"
                        data-active={contactDraft.type === "person"}
                        onClick={() => updateContactDraft("type", "person")}
                      >
                        Person
                      </button>
                      <button
                        type="button"
                        data-active={contactDraft.type === "company"}
                        onClick={() => updateContactDraft("type", "company")}
                      >
                        Firma
                      </button>
                    </div>
                  </div>
                )}

              <label>
                Kundennummer
                <input
                  value={contactDraft.customerNumber}
                  onChange={(event) => updateContactDraft("customerNumber", event.target.value)}
                />
              </label>

              <label>
                Anrede
                <select
                  value={contactDraft.salutation}
                  onChange={(event) => updateContactDraft("salutation", event.target.value)}
                >
                  <option value=""></option>
                  <option value="Frau">Frau</option>
                  <option value="Herr">Herr</option>
                  <option value="Divers">Divers</option>
                </select>
              </label>

              <label>
                Weitere Anrede
                <input
                  value={contactDraft.additionalSalutation}
                  onChange={(event) =>
                    updateContactDraft("additionalSalutation", event.target.value)
                  }
                />
              </label>

              <label>
                Position/Funktion
                <input
                  value={contactDraft.position}
                  onChange={(event) => updateContactDraft("position", event.target.value)}
                />
              </label>

              {(!editingContactId || contactDraft.type === "company") && (
                <label>
                  Firmenname
                  <input
                    value={contactDraft.companyName}
                    onChange={(event) => updateContactDraft("companyName", event.target.value)}
                  />
                </label>
              )}

              {contactDraft.type === "company" && (
                <label>
                  Rechtsform
                  <select
                    value={contactDraft.legalForm}
                    onChange={(event) => updateContactDraft("legalForm", event.target.value)}
                  >
                    <option value="">Bitte auswählen</option>
                    {legalFormOptions.map((legalForm) => (
                      <option key={legalForm} value={legalForm}>
                        {legalForm}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label>
                Vorname
                <input
                  value={contactDraft.firstName}
                  onChange={(event) => updateContactDraft("firstName", event.target.value)}
                />
              </label>

              <label>
                Nachname
                <input
                  value={contactDraft.lastName}
                  onChange={(event) => updateContactDraft("lastName", event.target.value)}
                />
              </label>
              </section>

              <nav className={styles.contactFormTabs}>
              {[
                ["details", "Kontaktdetails"],
                ["address", "Adresse"],
                ["terms", "Konditionen"],
                ["payment", "Zahlungsdaten"],
                ["zugferd", "ZUGFeRD 2.0"],
              ].map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  data-active={contactFormTab === tab}
                  onClick={() => setContactFormTab(tab as ContactFormTab)}
                >
                  {label}
                </button>
              ))}
              </nav>

              {contactFormTab === "details" && (
              <section className={styles.contactFormGrid}>
                <label>
                  E-Mail-Adresse
                  <input
                    type="email"
                    value={contactDraft.email}
                    onChange={(event) => updateContactDraft("email", event.target.value)}
                  />
                </label>
                <label className={styles.checkboxField}>
                  <input
                    type="checkbox"
                    checked={contactDraft.isInvoiceRecipient}
                    onChange={(event) =>
                      updateContactDraft("isInvoiceRecipient", event.target.checked)
                    }
                  />
                  Rechnungsempfänger
                </label>
                <label>
                  Erreichbarkeit
                  <select
                    value={contactDraft.reachability}
                    onChange={(event) => updateContactDraft("reachability", event.target.value)}
                  >
                    <option>Sonstige</option>
                    <option>Telefonisch</option>
                    <option>Per E-Mail</option>
                    <option>Mobil</option>
                  </select>
                </label>
                <label>
                  Quelle
                  <select
                    value={contactDraft.source}
                    onChange={(event) => updateContactDraft("source", event.target.value)}
                  >
                    <option>E-Mail</option>
                    <option>Telefon</option>
                    <option>Website</option>
                    <option>Empfehlung</option>
                    <option>HERO Import</option>
                  </select>
                </label>
                <label>
                  Festnetz
                  <input
                    value={contactDraft.phone}
                    onChange={(event) => updateContactDraft("phone", event.target.value)}
                  />
                </label>
                <label>
                  Mobiltelefon
                  <input
                    value={contactDraft.mobile}
                    onChange={(event) => updateContactDraft("mobile", event.target.value)}
                  />
                </label>
                <label>
                  Website
                  <input
                    value={contactDraft.website}
                    onChange={(event) => updateContactDraft("website", event.target.value)}
                  />
                </label>
                <label>
                  Fax
                  <input
                    value={contactDraft.fax}
                    onChange={(event) => updateContactDraft("fax", event.target.value)}
                  />
                </label>
              </section>
              )}

              {contactFormTab === "address" && (
              <section className={styles.contactFormGrid}>
                <label>
                  Straxe & Hausnummer
                  <input
                    value={contactDraft.street}
                    onChange={(event) => updateContactDraft("street", event.target.value)}
                  />
                </label>
                <label>
                  1. Adresszeile
                  <input
                    value={contactDraft.addressLine1}
                    onChange={(event) => updateContactDraft("addressLine1", event.target.value)}
                  />
                </label>
                <label>
                  2. Adresszeile
                  <input
                    value={contactDraft.addressLine2}
                    onChange={(event) => updateContactDraft("addressLine2", event.target.value)}
                  />
                </label>
                <label>
                  Postleitzahl
                  <input
                    value={contactDraft.postalCode}
                    onChange={(event) => updateContactDraft("postalCode", event.target.value)}
                  />
                </label>
                <label>
                  Ort
                  <input
                    value={contactDraft.city}
                    onChange={(event) => updateContactDraft("city", event.target.value)}
                  />
                </label>
                <label>
                  Land
                  <input
                    value={contactDraft.country}
                    onChange={(event) => updateContactDraft("country", event.target.value)}
                  />
                </label>
              </section>
              )}

              {contactFormTab === "terms" && (
              <section className={styles.contactFormGrid}>
                <label>
                  Zahlungsziel (Tage)
                  <input
                    type="number"
                    value={contactDraft.paymentTermDays ?? ""}
                    onChange={(event) =>
                      updateContactDraft(
                        "paymentTermDays",
                        event.target.value ? Number(event.target.value) : null
                      )
                    }
                  />
                </label>
                <label>
                  Skonto %
                  <input
                    type="number"
                    value={contactDraft.discountPercent ?? ""}
                    onChange={(event) =>
                      updateContactDraft(
                        "discountPercent",
                        event.target.value ? Number(event.target.value) : null
                      )
                    }
                  />
                </label>
                <label>
                  Skontoziel (Tage)
                  <input
                    type="number"
                    value={contactDraft.discountTermDays ?? ""}
                    onChange={(event) =>
                      updateContactDraft(
                        "discountTermDays",
                        event.target.value ? Number(event.target.value) : null
                      )
                    }
                  />
                </label>
                <label>
                  Verkaufspreis-Gruppe
                  <select
                    value={contactDraft.priceGroup}
                    onChange={(event) => updateContactDraft("priceGroup", event.target.value)}
                  >
                    <option>(Standard-VK)</option>
                    <option>Projektkunden</option>
                    <option>Wartungskunden</option>
                    <option>Groxkunden</option>
                  </select>
                </label>
              </section>
              )}

              {contactFormTab === "payment" && (
              <section className={styles.contactFormGrid}>
                <label>
                  IBAN
                  <input
                    value={contactDraft.iban}
                    onChange={(event) => updateContactDraft("iban", event.target.value)}
                  />
                </label>
                <label>
                  BIC
                  <input
                    value={contactDraft.bic}
                    onChange={(event) => updateContactDraft("bic", event.target.value)}
                  />
                </label>
                <label>
                  Bank Name
                  <input
                    value={contactDraft.bankName}
                    onChange={(event) => updateContactDraft("bankName", event.target.value)}
                  />
                </label>
                <label>
                  Umsatzsteuer ID
                  <input
                    value={contactDraft.taxId}
                    onChange={(event) => updateContactDraft("taxId", event.target.value)}
                  />
                </label>
                <label>
                  Debitor / Kreditor Konto
                  <input
                    value={contactDraft.debtorCreditorAccount}
                    onChange={(event) =>
                      updateContactDraft("debtorCreditorAccount", event.target.value)
                    }
                  />
                </label>
              </section>
              )}

              {contactFormTab === "zugferd" && (
              <section className={styles.contactFormGrid}>
                <label>
                  Leitweg-ID / Leitwegsnummer
                  <input
                    value={contactDraft.leitwegId}
                    onChange={(event) => updateContactDraft("leitwegId", event.target.value)}
                  />
                </label>
                <div className={styles.contactInfoBox}>
                  <strong>ZUGFeRD 2.0 Standard</strong>
                  <p>
                    Diese Information wird später für elektronische Rechnungen an öffentliche
                    Auftraggeber verwendet.
                  </p>
                </div>
              </section>
              )}
            </div>

            <div className={styles.modalFooter}>
              <div>
                {editingContactId && (
                  <button className={styles.deleteButton} onClick={deleteContact}>
                    Löschen
                  </button>
                )}
              </div>
              <div className={styles.modalActions}>
                <button className={styles.secondaryButton} onClick={() => setIsContactModalOpen(false)}>
                  Abbrechen
                </button>
                <button className={styles.primaryButton} onClick={saveContact}>
                  {editingContactId ? "Speichern" : "Erstellen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAbsenceModalOpen && (
        <div className={styles.overlay} onClick={() => setIsAbsenceModalOpen(false)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <h2>{editingAbsenceId ? "Abwesenheit bearbeiten" : "Neue Abwesenheit"}</h2>

            <div className={styles.formGrid}>
              <label>
                Benutzer
                <select value={absenceUserId} onChange={(event) => setAbsenceUserId(event.target.value)}>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Abwesenheitsart
                <select
                  value={absenceType}
                  onChange={(event) => setAbsenceType(event.target.value as AbsenceItem["type"])}
                >
                  <option value="urlaub">Urlaub</option>
                  <option value="krank">Krank</option>
                </select>
              </label>

              <label>
                Datum von
                <input
                  type="date"
                  value={absenceDateFrom}
                  onChange={(event) => {
                    setAbsenceDateFrom(event.target.value);
                    setAbsenceDateTo((current) => current < event.target.value ? event.target.value : current);
                  }}
                />
              </label>

              <label>
                Datum bis
                <input
                  type="date"
                  value={absenceDateTo}
                  min={absenceDateFrom}
                  onChange={(event) => setAbsenceDateTo(event.target.value)}
                />
              </label>

              <label className={styles.fullWidth}>
                Vertreter
                <select
                  value={absenceRepresentativeUserId}
                  onChange={(event) => setAbsenceRepresentativeUserId(event.target.value)}
                >
                  <option value="">Kein Vertreter ausgewählt</option>
                  {users
                    .filter((user) => user.id !== absenceUserId)
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                </select>
              </label>

              <label className={styles.fullWidth}>
                Notiz
                <input
                  value={absenceNote}
                  onChange={(event) => setAbsenceNote(event.target.value)}
                  placeholder="Optional"
                />
              </label>
            </div>

            {absenceType === "urlaub" && (
              <section className={styles.handoverChecklist}>
                <div>
                  <p className={styles.eyebrow}>Urlaubsübergabe</p>
                  <h3>Checkliste vor dem Abschicken</h3>
                  <p>
                    Der Urlaub kann erst gespeichert werden, wenn alle Punkte erledigt und die
                    Sbergabe bestätigt wurde.
                  </p>
                </div>

                <div className={styles.checklistItems}>
                  {vacationHandoverItems.map((item, index) => (
                    <label key={item} className={styles.checkboxLine}>
                      <input
                        type="checkbox"
                        checked={absenceChecklist[index]}
                        onChange={(event) =>
                          setAbsenceChecklist((current) =>
                            current.map((checked, currentIndex) =>
                              currentIndex === index ? event.target.checked : checked
                            )
                          )
                        }
                      />
                      {item}
                    </label>
                  ))}
                </div>

                <label className={styles.checkboxLine}>
                  <input
                    type="checkbox"
                    checked={absenceHandoverConfirmed}
                    onChange={(event) => setAbsenceHandoverConfirmed(event.target.checked)}
                  />
                  Ich bestätige, dass die Urlaubsübergabe vollständig erledigt ist.
                </label>
              </section>
            )}

            {(absenceWarning ||
              !absenceRepresentativeUserId ||
              (absenceType === "urlaub" && !isVacationHandoverComplete)) && (
              <p className={styles.modalWarning}>
                {absenceWarning ||
                  (!absenceRepresentativeUserId
                    ? "Bitte einen Vertreter auswählen. Eine Abwesenheit kann nur mit Vertreter gespeichert werden."
                    : "Bitte die Urlaubsübergabe vollständig ausfüllen und bestätigen.")}
              </p>
            )}

            <div className={styles.modalActions}>
              <button
                className={styles.primaryButton}
                onClick={saveAbsence}
                disabled={!absenceRepresentativeUserId || !isVacationHandoverComplete}
              >
                {editingAbsenceId ? "Änderungen speichern" : "Speichern"}
              </button>
              {editingAbsenceId && (
                <button
                  className={styles.deleteButton}
                  onClick={() => deleteAbsence(editingAbsenceId)}
                >
                  Löschen
                </button>
              )}
              <button className={styles.secondaryButton} onClick={() => setIsAbsenceModalOpen(false)}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {isOwnSettingsOpen && (
        <div className={styles.overlay} onClick={() => setIsOwnSettingsOpen(false)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <h2>Eigene Einstellungen</h2>

            <div className={styles.formGrid}>
              <div className={`${styles.profileImageEditor} ${styles.fullWidth}`}>
                <div className={styles.profileImagePreview}>
                  {ownProfileImageDataUrl ? (
                    <img src={ownProfileImageDataUrl} alt="Profilbild Vorschau" />
                  ) : (
                    <span>{ownName.slice(0, 1) || "U"}</span>
                  )}
                </div>
                <div>
                  <strong>Profilbild</strong>
                  <p>JPG oder PNG hochladen. Das Bild wird direkt als Avatar verwendet.</p>
                  <label className={styles.fileButton}>
                    Bild auswählen
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        handleOwnProfileImageUpload(event.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                  {ownProfileImageDataUrl && (
                    <button
                      className={styles.secondaryButton}
                      onClick={() => setOwnProfileImageDataUrl("")}
                    >
                      Bild entfernen
                    </button>
                  )}
                </div>
              </div>

              <label className={styles.fullWidth}>
                Name
                <input value={ownName} onChange={(event) => setOwnName(event.target.value)} />
              </label>

              <label className={styles.fullWidth}>
                E-Mail
                <input
                  type="email"
                  value={ownEmail}
                  onChange={(event) => setOwnEmail(event.target.value)}
                />
              </label>

              <label>
                Tagesarbeitszeit in Stunden
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={ownDailyWorkHours}
                  onChange={(event) => setOwnDailyWorkHours(event.target.value)}
                />
              </label>

              <label>
                Rolle
                <input value={activeUser?.roleLabel ?? ""} disabled />
              </label>

              <div className={`${styles.passwordResetBox} ${styles.fullWidth}`}>
                <h3>Passwort ändern</h3>
                <p>Leer lassen, wenn das aktuelle Passwort bestehen bleiben soll.</p>

                <div className={styles.formGrid}>
                  <label>
                    Neues Passwort
                    <input
                      type="password"
                      value={ownPassword}
                      onChange={(event) => setOwnPassword(event.target.value)}
                      placeholder="Mindestens 6 Zeichen"
                    />
                  </label>

                  <label>
                    Passwort wiederholen
                    <input
                      type="password"
                      value={ownPasswordConfirm}
                      onChange={(event) => setOwnPasswordConfirm(event.target.value)}
                      placeholder="Nochmals eingeben"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.primaryButton} onClick={saveOwnSettings}>
                Speichern
              </button>
              <button
                className={styles.secondaryButton}
                onClick={() => setIsOwnSettingsOpen(false)}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {isProjectModalOpen && (
        <div className={styles.overlay} onClick={closeProjectModal}>
          <div
            className={`${styles.modal} ${styles.projectCreateModal}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.contactModalHeader}>
              <h2>{editingProjectDataId ? "Projektdaten bearbeiten" : "Projekt erstellen"}</h2>
              <button
                className={styles.modalCloseButton}
                type="button"
                onClick={closeProjectModal}
                aria-label="Projektmaske schließen"
              >
                
              </button>
            </div>

            <div className={styles.projectCreateBody}>
              <label className={styles.projectSelectWithAction}>
                Kontakt
                <div>
                  <div className={styles.projectContactPicker}>
                    <button
                      type="button"
                      className={styles.projectContactPickerButton}
                      onClick={() => setIsProjectContactPickerOpen((isOpen) => !isOpen)}
                    >
                      <span>
                        {selectedProjectContact
                          ? getContactLabel(selectedProjectContact)
                          : "Bitte auswählen"}
                      </span>
                      <strong>{isProjectContactPickerOpen ? "" : ""}</strong>
                    </button>
                    {isProjectContactPickerOpen && (
                      <div className={styles.projectContactPickerMenu}>
                        <div className={styles.projectContactSearch}>
                          <input
                            autoFocus
                            value={projectContactPickerSearch}
                            onChange={(event) =>
                              setProjectContactPickerSearch(event.target.value)
                            }
                          />
                          <span>R"</span>
                        </div>
                        <div className={styles.projectContactOptions}>
                          {projectContactPickerOptions.length === 0 ? (
                            <p>Keine Kontakte gefunden.</p>
                          ) : (
                            projectContactPickerOptions.map((contact) => (
                              <button
                                key={contact.id}
                                type="button"
                                data-active={projectDraft.contactId === contact.id}
                                onClick={() => {
                                  updateProjectDraft("contactId", contact.id);
                                  setIsProjectContactPickerOpen(false);
                                  setProjectContactPickerSearch("");
                                }}
                              >
                                <span>
                                  <strong>{getContactLabel(contact)}</strong>
                                  {getContactAddressLine(contact) && (
                                    <em>{getContactAddressLine(contact)}</em>
                                  )}
                                </span>
                                <small>{contact.customerNumber}</small>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => openCreateContactModal("contact")}>
                    + Neu
                  </button>
                </div>
              </label>

              <strong className={styles.projectSectionTitle}>Projektdetails</strong>

              <label className={styles.projectSelectWithAction}>
                Ansprechpartner/in
                <div>
                  <select
                    value={projectDraft.contactPersonId}
                    disabled={!projectDraft.contactId}
                    onChange={(event) => updateProjectDraft("contactPersonId", event.target.value)}
                  >
                    <option value="">Bitte auswählen</option>
                    {projectContactPersons.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {getContactLabel(contact)}
                      </option>
                    ))}
                  </select>
                  {projectDraft.contactId && projectContactPersons.length === 0 && (
                    <small className={styles.projectSelectHint}>
                      Keine Ansprechpartner zu diesem Kontakt hinterlegt.
                    </small>
                  )}
                  <button
                    type="button"
                    disabled={!projectDraft.contactId}
                    onClick={() => openCreateContactModal("person")}
                  >
                    + Neu
                  </button>
                </div>
              </label>

              <label className={styles.projectSelectWithAction}>
                Projektadresse
                <div>
                  <select
                    value={projectDraft.addressContactId}
                    disabled={!projectDraft.contactId}
                    onChange={(event) => updateProjectDraft("addressContactId", event.target.value)}
                  >
                    <option value="">Bitte auswählen</option>
                    {projectAddressOptions.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {[contact.street, contact.postalCode, contact.city].filter(Boolean).join(", ") ||
                          getContactLabel(contact)}
                      </option>
                    ))}
                  </select>
                  {projectDraft.contactId && projectAddressOptions.length === 0 && (
                    <small className={styles.projectSelectHint}>
                      Keine Adresse zu diesem Kontakt hinterlegt.
                    </small>
                  )}
                  <button
                    type="button"
                    disabled={!projectDraft.contactId}
                    onClick={() => openCreateContactModal("address")}
                  >
                    + Neu
                  </button>
                </div>
              </label>

              <label>
                Projekttyp
                <select
                  value={projectDraft.projectType}
                  onChange={(event) =>
                    updateProjectDraft(
                      "projectType",
                      event.target.value as ProjectDraft["projectType"]
                    )
                  }
                >
                  <option value="Projekt OK solutions">Projekt OK solutions</option>
                  <option value="Projekt OK immocare">Projekt OK immocare</option>
                </select>
              </label>

              <label>
                Projektart
                <select
                  value={projectDraft.projectKind}
                  onChange={(event) =>
                    updateProjectDraft(
                      "projectKind",
                      event.target.value as ProjectDraft["projectKind"]
                    )
                  }
                >
                  <option value="einmaliges Projekt">einmaliges Projekt</option>
                  <option value="Dauerläufer-Projekt">Dauerläufer-Projekt</option>
                </select>
              </label>

              {projectDraft.projectKind === "Dauerläufer-Projekt" && (
                <div className={styles.projectTwoColumn}>
                  <label>
                    Geplanter Projektstart
                    <input
                      type="date"
                      value={projectDraft.projectRuntimeFrom}
                      onChange={(event) =>
                        updateProjectDraft("projectRuntimeFrom", event.target.value)
                      }
                    />
                  </label>

                  <label>
                    Projektlaufzeit bis
                    <input
                      type="date"
                      value={projectDraft.projectRuntimeUntil}
                      onChange={(event) =>
                        updateProjectDraft("projectRuntimeUntil", event.target.value)
                      }
                    />
                  </label>

                  <p className={styles.projectRuntimeHint}>
                    Laufzeit:{" "}
                    {formatProjectRuntimeDuration(
                      projectDraft.projectRuntimeFrom,
                      projectDraft.projectRuntimeUntil
                    )}
                  </p>

                  <label>
                    Fakturierungsintervall
                    <select
                      value={projectDraft.billingInterval}
                      onChange={(event) =>
                        updateProjectDraft(
                          "billingInterval",
                          event.target.value as ProjectDraft["billingInterval"]
                        )
                      }
                    >
                      <option value="monatlich">monatlich</option>
                      <option value="quartalsweise">quartalsweise</option>
                      <option value="jährlich">jährlich</option>
                    </select>
                  </label>
                </div>
              )}

              <div className={styles.projectTwoColumn}>
                <label>
                  Gewerk
                  <select
                    value={projectDraft.trade}
                    onChange={(event) => updateProjectDraft("trade", event.target.value)}
                  >
                    {projectDraft.trade && !projectTradeSelectOptions.includes(projectDraft.trade) && (
                      <option value={projectDraft.trade}>{projectDraft.trade}</option>
                    )}
                    {projectTradeSelectOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Niederlassung
                  <select
                    value={projectDraft.branch}
                    onChange={(event) => updateProjectDraft("branch", event.target.value)}
                  >
                    <option value="OK solutions GmbH">OK solutions GmbH</option>
                    <option value="OK immocare GmbH">OK immocare GmbH</option>
                  </select>
                </label>
              </div>

              <label>
                Projektname (optional)
                <input
                  value={projectDraft.name}
                  onChange={(event) => updateProjectDraft("name", event.target.value)}
                />
              </label>

              <div className={styles.projectTwoColumn}>
                <label>
                  Potentielles Projektvolumen (optional)
                  <div className={styles.moneyInput}>
                    <input
                      type="number"
                      min="0"
                      value={projectDraft.volume}
                      onChange={(event) => updateProjectDraft("volume", event.target.value)}
                    />
                    <span>EUR</span>
                  </div>
                </label>

                <label>
                  Quelle (optional)
                  <select
                    value={projectDraft.source}
                    onChange={(event) => updateProjectDraft("source", event.target.value)}
                  >
                    <option value="">Bitte auswählen</option>
                    {projectSourceOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Projektzeitkontingent (Stunden)
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={projectDraft.timeBudgetHours}
                  placeholder="z.B. 40"
                  onChange={(event) => updateProjectDraft("timeBudgetHours", event.target.value)}
                />
              </label>

              <label>
                Zusätzliche Projektbeteiligte (optional)
                <input
                  value={projectDraft.participants}
                  placeholder="Bitte auswählen"
                  onChange={(event) => updateProjectDraft("participants", event.target.value)}
                />
              </label>
            </div>

            <div className={styles.modalFooter}>
              <span />
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={closeProjectModal}
                >
                  Abbrechen
                </button>
                <button type="button" className={styles.primaryButton} onClick={saveProjectDraft}>
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingStampEntry && (
        <div className={styles.overlay} onClick={closeStampEntryEditModal}>
          <div
            className={`${styles.modal} ${styles.stampModal}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.contactModalHeader}>
              <h2>Zeiteintrag bearbeiten</h2>
              <button
                className={styles.modalCloseButton}
                type="button"
                onClick={closeStampEntryEditModal}
                aria-label="Zeiteintrag schließen"
              >
                Auswahl
              </button>
            </div>
            <div className={styles.stampModalBody}>
              <div className={styles.projectTwoColumn}>
                <label>
                  Datum
                  <input
                    value={stampEditDate}
                    onChange={(event) => setStampEditDate(event.target.value)}
                    placeholder="TT.MM.JJJJ"
                  />
                </label>
                <label>
                  Pause
                  <input
                    value={stampEditPause}
                    onChange={(event) => setStampEditPause(event.target.value)}
                    placeholder="0:00:00"
                  />
                </label>
              </div>
              <div className={styles.projectTwoColumn}>
                <label>
                  Start
                  <input
                    type="time"
                    value={stampEditStartTime}
                    onChange={(event) => setStampEditStartTime(event.target.value)}
                  />
                </label>
                <label>
                  Ende
                  <input
                    type="time"
                    value={stampEditEndTime}
                    onChange={(event) => setStampEditEndTime(event.target.value)}
                  />
                </label>
              </div>
              <label>
                Kommentar
                <textarea
                  rows={4}
                  value={stampEditComment}
                  onChange={(event) => setStampEditComment(event.target.value)}
                />
              </label>
              {stampEditError && <p className={styles.stampError}>{stampEditError}</p>}
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.deleteButton} onClick={deleteEditedStampEntry}>
                Löschen
              </button>
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={closeStampEntryEditModal}
                >
                  Abbrechen
                </button>
                <button type="button" className={styles.primaryButton} onClick={saveEditedStampEntry}>
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isStampModalOpen && (
        <div className={styles.overlay} onClick={() => setIsStampModalOpen(false)}>
          <div
            className={`${styles.modal} ${styles.stampModal}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.contactModalHeader}>
              <h2>
                {stampModalMode === "start"
                  ? "Stempelung starten"
                  : stampModalMode === "stop"
                    ? "Stempelung stoppen"
                    : "Folgetätigkeit auswählen"}
              </h2>
              <button
                className={styles.modalCloseButton}
                type="button"
                onClick={() => setIsStampModalOpen(false)}
                aria-label="Stempelmaske schließen"
              >
                
              </button>
            </div>
            <div className={styles.stampModalBody}>
              {(stampModalMode === "change" || stampModalMode === "stop") && (
                <label>
                  Kommentar zur abgeschlossenen Tätigkeit
                  <textarea
                    rows={4}
                    value={stampComment}
                    onChange={(event) => setStampComment(event.target.value)}
                    placeholder="Was wurde gemacht?"
                  />
                </label>
              )}

              {stampModalMode !== "stop" && (
                <div className={styles.stampChoiceGrid}>
                  <button
                    type="button"
                    data-active={stampSelectionMode === "project"}
                    onClick={() => setStampSelectionMode("project")}
                  >
                    Projekt
                  </button>
                  <button
                    type="button"
                    data-active={stampSelectionMode === "unproductive"}
                    onClick={() => setStampSelectionMode("unproductive")}
                  >
                    Ich bin unproduktiv
                  </button>
                </div>
              )}

              {stampModalMode !== "stop" && stampSelectionMode === "project" && (
                <div className={styles.stampProjectPicker}>
                  <label>
                    Projekt auswählen
                    <input
                      value={stampProjectSearch}
                      onChange={(event) => {
                        setStampProjectSearch(event.target.value);
                        setStampProjectId("");
                        setStampError("");
                        setIsStampProjectSearchOpen(true);
                      }}
                      onFocus={() => setIsStampProjectSearchOpen(true)}
                      placeholder="Kundenname, Projektname oder Projekt-ID suchen"
                    />
                  </label>
                  {selectedStampProject && !isStampProjectSearchOpen ? (
                    <div className={styles.stampSelectedProject}>
                      <strong>{selectedStampProject.projectNumber}</strong>
                      <span>{selectedStampProject.title}</span>
                      <small>{selectedStampProject.customer || "Kein Kunde hinterlegt"}</small>
                      <button
                        type="button"
                        onClick={() => {
                          setStampProjectSearch("");
                          setIsStampProjectSearchOpen(true);
                        }}
                      >
                        Ändern
                      </button>
                    </div>
                  ) : (
                    <div className={styles.stampProjectResults}>
                      {isHeroProjectsLoading ? (
                        <p>Offene Projekte werden geladen...</p>
                      ) : stampProjectOptions.length === 0 ? (
                        <p>Keine offenen Projekte gefunden.</p>
                      ) : (
                        stampProjectOptions.map((project) => (
                          <button
                            key={project.id}
                            type="button"
                            data-active={stampProjectId === project.id}
                            onClick={() => {
                              setStampProjectId(project.id);
                              setStampProjectSearch(`${project.projectNumber} | ${project.title}`);
                              setStampError("");
                              setIsStampProjectSearchOpen(false);
                            }}
                          >
                            <strong>{project.projectNumber}</strong>
                            <span>{project.title}</span>
                            <small>{project.customer || "Kein Kunde hinterlegt"}</small>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {stampError && <p className={styles.stampError}>{stampError}</p>}
            </div>
            <div className={styles.modalFooter}>
              <span />
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setIsStampModalOpen(false)}
                >
                  Abbrechen
                </button>
                <button type="button" className={styles.primaryButton} onClick={confirmStampModal}>
                  {stampModalMode === "start"
                    ? "Starten"
                    : stampModalMode === "stop"
                      ? "Stoppen"
                      : "Wechseln"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className={styles.overlay} onClick={closeTaskModal}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <h2>{editingTask ? "Aufgabe bearbeiten" : "Neue Aufgabe erstellen"}</h2>

            <div className={styles.formGrid}>
              <label className={styles.fullWidth}>
                Titel
                <input value={titel} onChange={(event) => setTitel(event.target.value)} />
              </label>

              <label className={styles.fullWidth}>
                Beschreibung
                <textarea
                  rows={4}
                  value={beschreibung}
                  onChange={(event) => setBeschreibung(event.target.value)}
                />
              </label>

              <label>
                Status
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as TaskStatus)}
                >
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Priorität
                <select
                  value={prioritaet}
                  onChange={(event) => setPrioritaet(event.target.value as TaskPriority)}
                >
                  {priorityOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Gewerk
                <select value={gewerkId} onChange={(event) => setGewerkId(event.target.value)}>
                  <option value="">Kein Gewerk ausgewählt</option>
                  {trades.map((trade) => (
                    <option key={trade.id} value={trade.id}>
                      {trade.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Zuständig
                <select
                  value={zustaendigId}
                  disabled={!canAssignOther(activeUser?.role)}
                  onChange={(event) => setZustaendigId(event.target.value)}
                >
                  {assignableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} - {user.roleLabel}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Deadline
                <input
                  type="datetime-local"
                  value={faelligkeit}
                  onChange={(event) => setFaelligkeit(normalizeDeadlineInput(event.target.value))}
                  onBlur={(event) => setFaelligkeit(normalizeDeadlineInput(event.target.value))}
                  onFocus={() => {
                    if (!faelligkeit) setFaelligkeit(getDefaultDeadlineValue());
                  }}
                />
              </label>

              <label>
                Kunde
                <select value={kunde} onChange={(event) => selectCustomer(event.target.value)}>
                  <option value="">Kein Kunde ausgewählt</option>
                  {customerOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Projekt
                <select
                  value={selectedHeroProjectId}
                  disabled={!kunde}
                  onChange={(event) => selectHeroProject(event.target.value)}
                >
                  <option value="">
                    {kunde ? "Kein HERO-Projekt ausgewählt" : "Bitte zuerst Kunde auswählen"}
                  </option>
                  {filteredHeroProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {[project.projectNumber, project.title].filter(Boolean).join(" - ")}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Kundenklasse
                <select
                  value={kundenklasse}
                  onChange={(event) => setKundenklasse(event.target.value as CustomerClass)}
                >
                  <option value="">Keine</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              </label>

              <label>
                Gesamt-Vorgabezeit der Aufgabe in Minuten
                <input
                  type="number"
                  min="0"
                  value={vorgabeMinuten}
                  onChange={(event) => setVorgabeMinuten(event.target.value)}
                />
              </label>

              <section className={`${styles.planningBox} ${styles.fullWidth}`}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={planningEnabled}
                    onChange={(event) => togglePlanningEnabled(event.target.checked)}
                  />
                  Verplanung der Vorgabezeit (bei Bedarf auf mehrere Tage)
                </label>

                {planningEnabled && (
                  <div className={styles.planningTool}>
                    <div className={styles.planningSummary}>
                      <span>
                        Verteilt:{" "}
                        {formatMinutes(
                          getNormalizedPlanningAllocations().reduce(
                            (total, allocation) => total + allocation.minutes,
                            0
                          )
                        )}
                      </span>
                      <span>Vorgabe: {formatMinutes(vorgabeMinuten ? Number(vorgabeMinuten) : null)}</span>
                    </div>

                    <div className={styles.planningRows}>
                      {planningAllocations.map((allocation, index) => (
                        <div key={`${allocation.date}-${index}`} className={styles.planningRow}>
                          <label>
                            Datum
                            <input
                              type="date"
                              value={allocation.date}
                              onChange={(event) =>
                                updatePlanningAllocation(index, "date", event.target.value)
                              }
                            />
                          </label>
                          <label>
                            Minuten
                            <input
                              type="number"
                              min="0"
                              value={allocation.minutes}
                              onChange={(event) =>
                                updatePlanningAllocation(index, "minutes", event.target.value)
                              }
                            />
                          </label>
                          <button
                            type="button"
                            className={styles.deleteButton}
                            onClick={() => removePlanningAllocation(index)}
                            disabled={planningAllocations.length <= 1}
                          >
                            Entfernen
                          </button>
                        </div>
                      ))}
                    </div>

                    {getNormalizedPlanningAllocations().reduce(
                      (total, allocation) => total + allocation.minutes,
                      0
                    ) > (vorgabeMinuten ? Number(vorgabeMinuten) : 0) && (
                      <p className={styles.planningWarning}>
                        Die verteilte Zeit ist höher als die Vorgabezeit. Bitte vor dem Speichern
                        korrigieren.
                      </p>
                    )}

                    <div className={styles.actionGroup}>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={addPlanningAllocation}
                      >
                        Tag hinzufügen
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={distributePlanningEvenly}
                        disabled={!vorgabeMinuten}
                      >
                        Gleichmäxig verteilen
                      </button>
                    </div>
                  </div>
                )}
              </section>

            {editingTask && (
              <section className={`${styles.timeBox} ${styles.fullWidth}`}>
                <div className={styles.timeHeader}>
                  <div>
                    <h3>Zeiterfassung</h3>
                    <p>Gesamt erfasst: {formatMinutes(editingTask.gesamtzeitMinuten)}</p>
                  </div>
                </div>

                <div className={styles.timeForm}>
                  <label>
                    Dauer in Minuten
                    <input
                      type="number"
                      min="1"
                      value={zeitDauer}
                      onChange={(event) => setZeitDauer(event.target.value)}
                    />
                  </label>

                  <label>
                    Dokumentation
                    <input
                      value={zeitNotiz}
                      onChange={(event) => setZeitNotiz(event.target.value)}
                      placeholder="Was wurde gemacht?"
                    />
                  </label>

                  <button className={styles.secondaryButton} onClick={addTimeEntry}>
                    {editingTimeEntryId ? "Zeit aktualisieren" : "Zeit speichern"}
                  </button>
                  {editingTimeEntryId && (
                    <button className={styles.secondaryButton} onClick={cancelEditTimeEntry}>
                      Abbrechen
                    </button>
                  )}
                </div>

                <div className={styles.timeEntries}>
                  {editingTask.zeiteintraege.length === 0 ? (
                    <p className={styles.emptyState}>Noch keine Zeit erfasst.</p>
                  ) : (
                    editingTask.zeiteintraege.map((entry) => (
                      <article key={entry.id} className={styles.timeEntry}>
                        <div>
                          <strong>{formatMinutes(entry.dauerMinuten)}</strong>
                          <span>{formatDeadline(entry.gestartetAm)}</span>
                          <p>{entry.notiz || "Keine Dokumentation hinterlegt."}</p>
                        </div>
                        <div className={styles.timeEntryActions}>
                          <button
                            className={styles.secondaryButton}
                            onClick={() => startEditTimeEntry(entry)}
                          >
                            Bearbeiten
                          </button>
                          <button
                            className={styles.deleteButton}
                            onClick={() => deleteTimeEntry(entry)}
                          >
                            Löschen
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            )}

            {editingTask && (
              <section className={`${styles.commentBox} ${styles.fullWidth}`}>
                <div className={styles.timeHeader}>
                  <div>
                    <h3>Kommentare</h3>
                    <p>{editingTask.kommentare.length} Kommentare</p>
                  </div>
                </div>

                <div className={styles.commentForm}>
                  <textarea
                    rows={3}
                    value={kommentarText}
                    onChange={(event) => setKommentarText(event.target.value)}
                    placeholder="Kommentar zur Aufgabe schreiben"
                  />
                  <button
                    className={styles.secondaryButton}
                    onClick={addComment}
                    disabled={!kommentarText.trim()}
                  >
                    Kommentar speichern
                  </button>
                </div>

                <div className={styles.commentList}>
                  {editingTask.kommentare.length === 0 ? (
                    <p className={styles.emptyState}>Noch keine Kommentare vorhanden.</p>
                  ) : (
                    editingTask.kommentare.map((comment) => (
                      <article key={comment.id} className={styles.commentItem}>
                        <div>
                          <strong>{comment.autor}</strong>
                          <span>{formatDeadline(comment.erstelltAm)}</span>
                        </div>
                        <p>{comment.text}</p>
                      </article>
                    ))
                  )}
                </div>
              </section>
            )}

              <div className={`${styles.feedbackOption} ${styles.fullWidth}`}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={autoFeedbackEnabled}
                    onChange={(event) => {
                      setAutoFeedbackEnabled(event.target.checked);
                      if (event.target.checked && !autoFeedbackRecipientId) {
                        setAutoFeedbackRecipientId(activeUserId);
                      }
                      if (!event.target.checked) setAutoFeedbackRecipientId("");
                    }}
                  />
                  Automatische Rückmeldung senden, wenn die Aufgabe erledigt wurde
                </label>

                <label>
                  Empfänger
                  <select
                    value={autoFeedbackRecipientId}
                    disabled={!autoFeedbackEnabled}
                    onChange={(event) => setAutoFeedbackRecipientId(event.target.value)}
                  >
                    <option value="">Benutzer auswählen</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} - {user.email}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className={`${styles.feedbackOption} ${styles.fullWidth}`}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={recurrenceEnabled}
                    onChange={(event) => {
                      setRecurrenceEnabled(event.target.checked);
                      if (event.target.checked && !recurrenceInterval) {
                        setRecurrenceInterval("weekly");
                      }
                    }}
                  />
                  Aufgabe wiederkehrend ab Aufgabeneröffnung anlegen
                </label>

                <label>
                  Intervall
                  <select
                    value={recurrenceInterval}
                    disabled={!recurrenceEnabled}
                    onChange={(event) =>
                      setRecurrenceInterval(event.target.value as RecurrenceInterval)
                    }
                  >
                    <option value="daily">Täglich</option>
                    <option value="weekly">Wöchentlich</option>
                    <option value="monthly">Monatlich</option>
                    <option value="yearly">Jährlich</option>
                  </select>
                </label>
              </div>
            </div>



            {status === "erledigt" && modalCompletionHint && (
              <div className={styles.modalWarning}>{modalCompletionHint}</div>
            )}

            {errorMessage && <div className={styles.modalSaveNotice}>{errorMessage}</div>}

            <div className={styles.modalFooter}>
              <div className={styles.modalActions}>
              <button className={styles.primaryButton} onClick={saveTask}>
                Speichern
              </button>
              <button className={styles.secondaryButton} onClick={closeTaskModal}>
                Abbrechen
              </button>
              </div>
              {editingTask?.createdAt && (
                <p className={styles.createdAtHint}>
                  Aufgabe erstellt am: {formatDeadline(editingTask.createdAt)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}



