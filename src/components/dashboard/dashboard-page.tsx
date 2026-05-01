"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import styles from "./dashboard.module.css";

type AppTab = "dashboard" | "kanban" | "calendar" | "reports" | "hero" | "archive" | "settings";
type CalendarView = "month" | "week" | "day";
type PerformancePeriod = "day" | "month" | "year";
type UserRole = "ADMIN" | "GESCHAEFTSFUEHRER" | "FUEHRUNGSKRAFT" | "MITARBEITER" | "GAST";
type TaskStatus =
  | "offen"
  | "in Bearbeitung"
  | "wartet auf R\u00fcckmeldung"
  | "erledigt"
  | "abgelehnt"
  | "\u00fcberf\u00e4llig"
  | "archiviert";
type TaskPriority = "niedrig" | "normal" | "hoch" | "kritisch";
type CustomerClass = "A" | "B" | "C" | "";
type RecurrenceInterval = "daily" | "weekly" | "monthly" | "yearly";

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

const navigationTabs: Array<[AppTab, string]> = [
  ["dashboard", "Dashboard"],
  ["kanban", "Kanban"],
  ["calendar", "Kalender"],
  ["reports", "Reports"],
  ["hero", "HERO Projekte"],
  ["archive", "Archiv"],
  ["settings", "Einstellungen"],
];

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
  kommentare: CommentItem[];
  zeiteintraege: TimeEntryItem[];
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

function getDeadlineProgress(task: TaskItem, nowMs: number) {
  if (!task.faelligkeit || !task.createdAt) return 0;

  const createdAt = new Date(task.createdAt).getTime();
  const deadline = new Date(task.faelligkeit).getTime();

  if (!Number.isFinite(createdAt) || !Number.isFinite(deadline)) return 0;
  if (deadline <= createdAt) return nowMs >= deadline ? 100 : 0;

  return clampPercent(Math.round(((nowMs - createdAt) / (deadline - createdAt)) * 100));
}

function getDeadlineProgressStyle(task: TaskItem, nowMs: number) {
  return {
    "--deadline-progress": `${getDeadlineProgress(task, nowMs)}%`,
  } as CSSProperties;
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

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
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

function getTaskNumber(taskId: string, taskList: TaskItem[]) {
  const index = taskList.findIndex((task) => task.id === taskId);
  return index >= 0 ? `T-${1001 + index}` : taskId;
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

export function DashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeTab, setActiveTab] = useState<AppTab>("dashboard");
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [trades, setTrades] = useState<TradeOption[]>([]);
  const [escalationRules, setEscalationRules] = useState<EscalationRule[]>([]);
  const [deadlineProgressTime, setDeadlineProgressTime] = useState(() => Date.now());
  const [absences, setAbsences] = useState<AbsenceItem[]>([]);
  const [heroProjects, setHeroProjects] = useState<HeroProjectPreview[]>([]);
  const [heroSearchTerm, setHeroSearchTerm] = useState("");
  const [selectedHeroDetailId, setSelectedHeroDetailId] = useState("");
  const [hasLoadedHeroProjects, setHasLoadedHeroProjects] = useState(false);
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
  const [zeitDauer, setZeitDauer] = useState("");
  const [zeitNotiz, setZeitNotiz] = useState("");
  const [editingTimeEntryId, setEditingTimeEntryId] = useState<string | null>(null);
  const [kommentarText, setKommentarText] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<UserRole>("MITARBEITER");
  const [userDailyWorkHours, setUserDailyWorkHours] = useState("8");
  const [ownName, setOwnName] = useState("");
  const [ownEmail, setOwnEmail] = useState("");
  const [ownDailyWorkHours, setOwnDailyWorkHours] = useState("8");
  const [ownProfileImageDataUrl, setOwnProfileImageDataUrl] = useState("");
  const [ownPassword, setOwnPassword] = useState("");
  const [ownPasswordConfirm, setOwnPasswordConfirm] = useState("");
  const [userTeamIds, setUserTeamIds] = useState<string[]>([]);
  const [userAllTeams, setUserAllTeams] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [tradeName, setTradeName] = useState("");
  const [editingEscalationRuleId, setEditingEscalationRuleId] = useState<string | null>(null);
  const [escalationName, setEscalationName] = useState("");
  const [escalationHours, setEscalationHours] = useState("24");
  const [escalationTargetRole, setEscalationTargetRole] = useState<UserRole>("FUEHRUNGSKRAFT");
  const [escalationActive, setEscalationActive] = useState(true);
  const [escalationEmailEnabled, setEscalationEmailEnabled] = useState(false);
  const [escalationEmailRecipients, setEscalationEmailRecipients] = useState("");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [selectedCalendarActionDate, setSelectedCalendarActionDate] = useState("");
  const [absenceUserId, setAbsenceUserId] = useState("");
  const [absenceDateFrom, setAbsenceDateFrom] = useState(() => formatDateKey(new Date()));
  const [absenceDateTo, setAbsenceDateTo] = useState(() => formatDateKey(new Date()));
  const [absenceType, setAbsenceType] = useState<AbsenceItem["type"]>("urlaub");
  const [absenceRepresentativeUserId, setAbsenceRepresentativeUserId] = useState("");
  const [absenceNote, setAbsenceNote] = useState("");
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
  const [kanbanOwnerFilter, setKanbanOwnerFilter] = useState("");
  const [selectedPerformancePeriod, setSelectedPerformancePeriod] =
    useState<PerformancePeriod | null>(null);

  const activeUser = useMemo(
    () => users.find((user) => user.id === activeUserId),
    [activeUserId, users]
  );
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
      return;
    }

    const data = await res.json();
    const storedUserId =
      typeof window !== "undefined" ? window.localStorage.getItem("workpilot-user-id") : null;
    const storedUser = data.find((demoUser: UserOption) => demoUser.id === storedUserId);

    setUsers(data);
    setActiveUserId((current) => current || storedUser?.id || "");
    setZustaendigId((current) => current || storedUser?.id || data[0]?.id || "");
    setAbsenceUserId((current) => current || storedUser?.id || data[0]?.id || "");
    setLoginEmail((current) => current || storedUser?.email || data[0]?.email || "");

    if (storedUser) {
      setIsAuthenticated(true);
    }
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
    setLoginPassword("");
    setLoginError("");
    setIsAuthenticated(true);
  }

  function handleLogout() {
    window.localStorage.removeItem("workpilot-user-id");
    setIsAuthenticated(false);
    setActiveUserId("");
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

  async function loadEscalationRules() {
    const res = await fetch("/api/escalation-rules", { cache: "no-store" });

    if (!res.ok) {
      setErrorMessage("Eskalationsregeln konnten nicht geladen werden.");
      return;
    }

    const data = await res.json();
    setEscalationRules(data);
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
    const res = await fetch("/api/hero/projects", { cache: "no-store" });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorMessage(data?.error ?? "HERO-Projekte konnten nicht geladen werden.");
      return;
    }

    const data = await res.json();
    setHeroProjects(data);
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
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
    setAbsenceChecklist(vacationHandoverItems.map(() => false));
    setAbsenceHandoverConfirmed(false);
    setAbsenceWarning("");
    setIsAbsenceModalOpen(false);
    await loadAbsences();
    await loadNotifications(false);
  }

  async function deleteAbsence(absenceId: string) {
    const res = await fetch("/api/absences", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorId: activeUserId,
        absenceId,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorMessage(data?.error ?? "Abwesenheit konnte nicht entfernt werden.");
      return;
    }

    await loadAbsences();
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
    setAbsenceChecklist(vacationHandoverItems.map(() => false));
    setAbsenceHandoverConfirmed(false);
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
  }, []);

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

    if (activeTab === "hero" && !hasLoadedHeroProjects) {
      void loadHeroProjects();
    }
  }, [activeTab, hasLoadedHeroProjects]);

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
    setKommentarText("");
  }

  function openCreateModal(date?: Date | string) {
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

  async function saveTask() {
    if (!titel.trim()) return;
    if (autoFeedbackEnabled && !autoFeedbackRecipientId) {
      setErrorMessage("Bitte einen Empfänger für die automatische Rückmeldung auswählen.");
      return;
    }

    const completionValidationMessage = getCompletionValidationMessage(
      status,
      vorgabeMinuten ? Number(vorgabeMinuten) : null,
      editingTask?.zeiteintraege.length ?? 0
    );

    if (completionValidationMessage) {
      setErrorMessage(completionValidationMessage);
      return;
    }

    const method = editingTask ? "PATCH" : "POST";
    const selectedOwnerId = canAssignOther(activeUser?.role) ? zustaendigId : activeUserId;

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
      estimateMinutes: vorgabeMinuten ? Number(vorgabeMinuten) : null,
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
    setUserTeamIds([]);
    setUserAllTeams(false);
  }

  function editUser(user: UserOption) {
    setEditingUserId(user.id);
    setUserName(user.name);
    setUserEmail(user.email);
    setUserRole(user.role);
    setUserDailyWorkHours(user.dailyWorkHours.toString());
    setUserTeamIds(user.teamIds ?? []);
    setUserAllTeams(teams.length > 0 && user.teamIds.length === teams.length);
    setErrorMessage("");
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
      return;
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
        dailyWorkHours: Number(userDailyWorkHours),
        teamIds: userAllTeams ? teams.map((team) => team.id) : userTeamIds,
        allTeams: userAllTeams,
        actorId: activeUserId,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorMessage(data?.error ?? "Benutzer konnte nicht gespeichert werden.");
      return;
    }

    resetUserForm();
    await loadUsers();
    await loadTasks();
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
  }

  function editTrade(trade: TradeOption) {
    setEditingTradeId(trade.id);
    setTradeName(trade.name);
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

  const activeTasks = tasks.filter((task) => task.status !== "archiviert");
  const archivedTasks = tasks.filter((task) => task.status === "archiviert");
  const offene = activeTasks.filter((task) => task.status === "offen").length;
  const bearbeitung = activeTasks.filter((task) => task.status === "in Bearbeitung").length;
  const erledigt = activeTasks.filter((task) => task.status === "erledigt").length;
  const ueberfaellig = activeTasks.filter(
    (task) => task.status !== "erledigt" && getDeadlineState(task.faelligkeit) === "due"
  ).length;
  const mayManageUsers = canManageUsers(activeUser?.role);
  const customerOptions = Array.from(
    new Set([
      ...heroProjects.map((project) => project.customer).filter(Boolean),
      ...activeTasks.map((task) => task.kunde).filter(Boolean),
    ])
  ).sort((first, second) => first.localeCompare(second, "de"));
  const filteredHeroProjects = kunde
    ? heroProjects.filter((project) => project.customer === kunde)
    : [];
  const visibleHeroProjects = heroProjects.filter((project) => {
    const search = heroSearchTerm.trim().toLowerCase();
    if (!search) return true;

    return (
      project.projectNumber.toLowerCase().includes(search) ||
      project.title.toLowerCase().includes(search) ||
      project.customer.toLowerCase().includes(search) ||
      project.status.toLowerCase().includes(search) ||
      project.description.toLowerCase().includes(search)
    );
  });
  const selectedHeroDetail = heroProjects.find((project) => project.id === selectedHeroDetailId);
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
  const weekDays = getWeekDays(calendarDate);
  const tasksByDate = activeTasks.reduce<Record<string, TaskItem[]>>((groupedTasks, task) => {
    if (!task.faelligkeit) return groupedTasks;

    const dateKey = task.faelligkeit.slice(0, 10);
    groupedTasks[dateKey] = [...(groupedTasks[dateKey] ?? []), task];
    return groupedTasks;
  }, {});
  const absencesByDate = absences.reduce<Record<string, AbsenceItem[]>>((groupedAbsences, absence) => {
    groupedAbsences[absence.date] = [...(groupedAbsences[absence.date] ?? []), absence];
    return groupedAbsences;
  }, {});
  const getUserAbsenceForDay = (userId: string, date: Date) =>
    absences.find((absence) => absence.userId === userId && absence.date === formatDateKey(date));
  const absenceLabel = (type: AbsenceItem["type"]) => (type === "urlaub" ? "Urlaub" : "Krank");
  const selectedDayTasks = tasksByDate[formatDateKey(calendarDate)] ?? [];
  const selectedDayAbsences = absencesByDate[formatDateKey(calendarDate)] ?? [];
  const filteredTasks = activeTasks.filter((task) => {
    const search = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !search ||
      task.titel.toLowerCase().includes(search) ||
      task.beschreibung.toLowerCase().includes(search) ||
      task.kunde.toLowerCase().includes(search) ||
      task.zustaendig.toLowerCase().includes(search);

    return (
      matchesSearch &&
      (!statusFilter || task.status === statusFilter) &&
      (!deadlineFilter || getDeadlineState(task.faelligkeit) === deadlineFilter) &&
      (!priorityFilter || task.prioritaet === priorityFilter) &&
      (!customerFilter || task.kunde === customerFilter) &&
      (!ownerFilter || task.zustaendigId === ownerFilter)
    );
  });
  const reportDays = Array.from({ length: 10 }, (_, index) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + index);
    return day;
  });
  const reportTasks = activeTasks.filter(
    (task) => task.status !== "erledigt" && task.status !== "abgelehnt"
  );
  const getUserUtilizationForDay = (userId: string, date: Date) => {
    const user = users.find((currentUser) => currentUser.id === userId);
    const dateKey = formatDateKey(date);
    const absence = getUserAbsenceForDay(userId, date);
    const capacityMinutes = absence ? 0 : (user?.dailyWorkHours ?? 8) * 60;
    const plannedMinutes = reportTasks
      .filter((task) => task.zustaendigId === userId && task.faelligkeit.slice(0, 10) === dateKey)
      .reduce((total, task) => total + (task.vorgabeMinuten ?? 0), 0);
    const utilization = capacityMinutes > 0 ? Math.round((plannedMinutes / capacityMinutes) * 100) : 0;

    return {
      capacityMinutes,
      plannedMinutes,
      utilization,
      absence,
    };
  };
  const todayUtilization = activeUserId
    ? getUserUtilizationForDay(activeUserId, reportDays[0])
    : { capacityMinutes: 0, plannedMinutes: 0, utilization: 0, absence: undefined };
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
                  wichtig ist. Führungskräfte erkennen frühzeitig Engpässe, offene Übergaben und
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

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <img className={styles.logo} src="/workpilot-logo.png" alt="WorkPilot" />
          <div className={styles.headerActions}>
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
          {navigationTabs.map(([tab, label]) => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {label}
            </button>
          ))}
        </nav>

        <section className={styles.content}>
          {errorMessage && <div className={styles.notice}>{errorMessage}</div>}

          {activeTab === "settings" ? (
            <section className={styles.settingsPanel}>
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
                      <th>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.length === 0 ? (
                      <tr>
                        <td colSpan={2}>Noch keine Gewerke angelegt.</td>
                      </tr>
                    ) : (
                      trades.map((trade) => (
                        <tr key={trade.id}>
                          <td className={styles.title}>{trade.name}</td>
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
          ) : activeTab === "hero" ? (
            <section className={styles.settingsPanel}>
              <div className={styles.topline}>
                <div>
                  <p className={styles.eyebrow}>HERO Projekte</p>
                  <h1>HERO Projekte</h1>
                  <p className={styles.subline}>
                    Aktive HERO-Projekte als Bezug für Kunden und Aufgaben anzeigen.
                  </p>
                </div>

                <div className={styles.actionGroup}>
                  <button className={styles.secondaryButton} onClick={loadHeroProjects}>
                    Projekte laden
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
                  {visibleHeroProjects.length} von {heroProjects.length} Projekten
                </span>
              </section>

              <section className={styles.heroProjectLayout}>
                <section className={`${styles.tableCard} ${styles.heroTableCard}`}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Projektnummer</th>
                        <th>Projekt</th>
                        <th>Kunde</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {heroProjects.length === 0 ? (
                        <tr>
                          <td colSpan={4}>Noch keine HERO-Projekte geladen.</td>
                        </tr>
                      ) : visibleHeroProjects.length === 0 ? (
                        <tr>
                          <td colSpan={4}>Keine Projekte zur Suche gefunden.</td>
                        </tr>
                      ) : (
                        visibleHeroProjects.map((project) => (
                          <tr
                            key={project.id}
                            className={styles.clickableRow}
                            data-selected={selectedHeroDetailId === project.id}
                            onClick={() => setSelectedHeroDetailId(project.id)}
                          >
                            <td className={styles.number}>{project.projectNumber || project.id}</td>
                            <td className={styles.title}>{project.title}</td>
                            <td>{project.customer || "-"}</td>
                            <td>{project.status || "-"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </section>

                <aside className={styles.heroDetailCard}>
                  {selectedHeroDetail ? (
                    <>
                      <div>
                        <p className={styles.eyebrow}>Projektdetails</p>
                        <h2>{selectedHeroDetail.title}</h2>
                      </div>

                      <div className={styles.heroDetailGrid}>
                        <article>
                          <span>Projektnummer</span>
                          <strong>{selectedHeroDetail.projectNumber || selectedHeroDetail.id}</strong>
                        </article>
                        <article>
                          <span>Kunde</span>
                          <strong>{selectedHeroDetail.customer || "-"}</strong>
                        </article>
                        <article>
                          <span>Status</span>
                          <strong>{selectedHeroDetail.status || "-"}</strong>
                        </article>
                        <article>
                          <span>Status-Code</span>
                          <strong>{selectedHeroDetail.statusCode || "-"}</strong>
                        </article>
                      </div>

                      <div className={styles.heroDescription}>
                        <span>Beschreibung</span>
                        <p>{selectedHeroDetail.description || "Keine weiteren Details vorhanden."}</p>
                      </div>
                    </>
                  ) : (
                    <div className={styles.heroEmptyDetail}>
                      <p className={styles.eyebrow}>Projektdetails</p>
                      <h2>Projekt auswählen</h2>
                      <p>Klicke links auf ein Projekt, um die Details direkt hier zu sehen.</p>
                    </div>
                  )}
                </aside>
              </section>
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
                                  data-state={getDeadlineState(task.faelligkeit)}
                                  style={getDeadlineProgressStyle(task, deadlineProgressTime)}
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
                    const isToday = day && formatDateKey(day) === formatDateKey(new Date());

                    return (
                      <article
                        key={dateKey}
                        className={`${styles.calendarDay} ${!day ? styles.emptyDay : ""} ${
                          isToday ? styles.today : ""
                        }`}
                        onClick={() => day && toggleCalendarDayActions(day)}
                      >
                        {day && (
                          <>
                            <div className={styles.calendarDayHeader}>
                              <strong>{day.getDate()}</strong>
                              <span>{dayTasks.length}</span>
                            </div>

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

                            {dayAbsences.length > 0 && (
                              <div className={styles.absenceChips}>
                                {dayAbsences.map((absence) => (
                                  <button
                                    key={absence.id}
                                    className={styles.absenceChip}
                                    data-type={absence.type}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      deleteAbsence(absence.id);
                                    }}
                                    title="Abwesenheit entfernen"
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
                                  <span>{task.zustaendig}</span>
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
                    const isToday = dateKey === formatDateKey(new Date());

                    return (
                      <article
                        key={dateKey}
                        className={`${styles.weekDay} ${isToday ? styles.today : ""}`}
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
                        {dayAbsences.length > 0 && (
                          <div className={styles.absenceChips}>
                            {dayAbsences.map((absence) => (
                              <button
                                key={absence.id}
                                className={styles.absenceChip}
                                data-type={absence.type}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  deleteAbsence(absence.id);
                                }}
                                title="Abwesenheit entfernen"
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
                                <span>{task.zustaendig}</span>
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
                          onClick={() => deleteAbsence(absence.id)}
                          title="Abwesenheit entfernen"
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
                          <span>{task.zustaendig}</span>
                        </div>
                        <span
                          className={styles.deadlinePill}
                          data-state={getDeadlineState(task.faelligkeit)}
                          style={getDeadlineProgressStyle(task, deadlineProgressTime)}
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
                      : `${formatMinutes(todayUtilization.plannedMinutes)} geplant von ${formatMinutes(todayUtilization.capacityMinutes)} verfügbarer Tagesarbeitszeit.`}
                  </p>
                </div>
                <div className={styles.reportProgress} aria-label="Auslastung heute">
                  <span style={{ width: `${clampPercent(todayUtilization.utilization)}%` }} />
                </div>
              </section>

              <section className={styles.reportPanel}>
                <div className={styles.reportHeader}>
                  <div>
                    <p className={styles.eyebrow}>Leistung</p>
                    <h2>Leistungsgrad</h2>
                  </div>
                  <p>Vorgabezeit geteilt durch erfasste Zeit. Über 100% bedeutet schneller als Vorgabe.</p>
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
                  <p>Urlaub und Krank werden als Abwesenheit markiert und ohne verfügbare Kapazität gerechnet.</p>
                </div>

                <div className={styles.workloadGrid}>
                  <div className={styles.workloadHeaderCell}>Mitarbeiter</div>
                  {reportDays.map((day) => (
                    <div
                      key={formatDateKey(day)}
                      className={styles.workloadDayHeader}
                      data-weekday={day.getDay() !== 0 && day.getDay() !== 6}
                    >
                      {formatShortDate(day)}
                    </div>
                  ))}

                  {users.map((user) => (
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
                    Überfällig
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
                    placeholder="Aufgabe, Kunde, Zuständigkeit"
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

                <button
                  className={styles.secondaryButton}
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("");
                    setDeadlineFilter("");
                    setPriorityFilter("");
                    setCustomerFilter("");
                    setOwnerFilter("");
                  }}
                >
                  Zurücksetzen
                </button>
              </section>

              <section className={styles.tableCard}>
                <table className={styles.table}>
                  <thead>
                    <tr>
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
                    {filteredTasks.map((task, index) => (
                      <tr
                        key={task.id}
                        onClick={() => openEditModal(task)}
                        className={styles.clickableRow}
                        data-status={task.status}
                      >
                        <td className={styles.number}>
                          {task.status === "erledigt" && (
                            <span className={styles.doneMarker}>✓</span>
                          )}
                          T-{1001 + index}
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
                            data-state={getDeadlineState(task.faelligkeit)}
                            style={getDeadlineProgressStyle(task, deadlineProgressTime)}
                          >
                            {getDeadlineState(task.faelligkeit) === "open" && (
                              <span className={styles.deadlineIcon}>✓</span>
                            )}
                            {["soon", "due"].includes(getDeadlineState(task.faelligkeit)) && (
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

      {isAbsenceModalOpen && (
        <div className={styles.overlay} onClick={() => setIsAbsenceModalOpen(false)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <h2>Neue Abwesenheit</h2>

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
                    Übergabe bestätigt wurde.
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
                Speichern
              </button>
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

      {isModalOpen && (
        <div className={styles.overlay} onClick={() => setIsModalOpen(false)}>
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
                Vorgabezeit in Minuten
                <input
                  type="number"
                  min="0"
                  value={vorgabeMinuten}
                  onChange={(event) => setVorgabeMinuten(event.target.value)}
                />
              </label>

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

            <div className={styles.modalFooter}>
              <div className={styles.modalActions}>
              <button className={styles.primaryButton} onClick={saveTask}>
                Speichern
              </button>
              <button className={styles.secondaryButton} onClick={() => setIsModalOpen(false)}>
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
