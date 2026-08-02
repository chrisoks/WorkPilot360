import { prisma } from "@/lib/db/client";
import { getDeadlineSettings } from "@/lib/company-settings/deadlines";
import { getProjectStatusEscalationSchedulerStatus } from "@/lib/automation/project-status-escalation-scheduler";
import { getSystemMailStatus } from "@/lib/mail/system";
import { evaluateProjectStatusEscalations } from "@/lib/projects/status-escalation";
import { getJarvisActionDecision } from "@/lib/jarvis/actions";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import type { JarvisReadResponse } from "@/lib/jarvis/read-model";
import type { JarvisAccessProfile } from "@/lib/jarvis/security";
import { Role, type User } from "@prisma/client";

export type ProjectStatusAutomationStatusSnapshot = {
  organizationEnabled: boolean;
  rules: Array<{
    status: string;
    enabled: boolean;
    responsibleAfterDays: number;
    managementAfterDays: number;
  }>;
  schedulerEnabled: boolean;
  schedulerRunning: boolean;
  schedulerLastAttemptAt: string;
  schedulerLastStatus: "ok" | "error" | "";
  schedulerLastHttpStatus: number;
  deliveryEnabled: boolean;
  systemMailConfigured: boolean;
  monitoredProjects: number;
  responsibleNotices: number;
  managementNotices: number;
  missingResponsible: number;
  ambiguousResponsible: number;
  openDeliveryEvents: number;
  latestDeliveryEventAt: string;
  configurationChangeCount: number;
  deliveryEventCount: number;
  configurationChanges: Array<{
    id: string;
    actorName: string;
    operation: "switch" | "rule" | "unknown";
    target: string;
    before: string;
    after: string;
    createdAt: string;
  }>;
  deliveryEvents: Array<{
    id: string;
    projectLabel: string;
    status: string;
    stage: "responsible" | "management" | "unknown";
    recipientName: string;
    resolved: boolean;
    createdAt: string;
  }>;
  activeManagementRecipients: string[];
  plannedRecipientNotifications: number;
  alreadyOpenRecipientNotifications: number;
  noticesWithoutRecipient: number;
  deliveryPlans: Array<{
    projectLabel: string;
    status: string;
    stage: "responsible" | "management";
    newRecipientNames: string[];
    alreadyOpenRecipientNames: string[];
    blockers: string[];
  }>;
};

export type ProjectStatusAutomationStatusSource = {
  load(input: {
    organizationId: string;
    users: readonly User[];
  }): Promise<ProjectStatusAutomationStatusSnapshot>;
};

const liveSource: ProjectStatusAutomationStatusSource = {
  async load({ organizationId, users }) {
    const settings = await getDeadlineSettings(organizationId);
    const preview = await evaluateProjectStatusEscalations({
      organizationId,
      users,
      enabled: settings.projectStatusEscalationEnabled,
      rules: settings.projectStatusRules,
    });
    const scheduler = getProjectStatusEscalationSchedulerStatus();
    const [
      openDeliveryEvents,
      deliveryEventCount,
      deliveryEvents,
      openDeliveryRecipients,
      configurationChangeCount,
      configurationAudits,
    ] = await Promise.all([
      prisma.statusEscalationEvent.count({
        where: {
          organizationId,
          entityType: "project",
          ruleId: { startsWith: "project-status-v1:" },
          resolvedAt: null,
        },
      }),
      prisma.statusEscalationEvent.count({
        where: {
          organizationId,
          entityType: "project",
          ruleId: { startsWith: "project-status-v1:" },
        },
      }),
      prisma.statusEscalationEvent.findMany({
        where: {
          organizationId,
          entityType: "project",
          ruleId: { startsWith: "project-status-v1:" },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          entityLabel: true,
          status: true,
          ruleId: true,
          recipientUserId: true,
          resolvedAt: true,
          createdAt: true,
        },
      }),
      prisma.statusEscalationEvent.findMany({
        where: {
          organizationId,
          entityType: "project",
          ruleId: { startsWith: "project-status-v1:" },
          resolvedAt: null,
          entityId: { in: preview.items.map((item) => item.projectId) },
        },
        select: {
          entityId: true,
          status: true,
          ruleId: true,
          recipientUserId: true,
        },
      }),
      prisma.auditLog.count({
        where: { organizationId, action: "automation.project-status.changed" },
      }),
      prisma.auditLog.findMany({
        where: { organizationId, action: "automation.project-status.changed" },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, actorId: true, payload: true, createdAt: true },
      }),
    ]);
    const userNames = new Map(
      users.map((user) => [
        user.id,
        [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email,
      ])
    );
    const configurationChanges = configurationAudits.map((audit) => {
      const payload = asObject(audit.payload);
      const before = asObject(payload.before);
      const after = asObject(payload.after);
      const operation: "switch" | "rule" | "unknown" =
        payload.operation === "switch" || payload.operation === "rule"
          ? payload.operation
          : "unknown";
      return {
        id: audit.id,
        actorName: audit.actorId ? userNames.get(audit.actorId) ?? "Unbekannter Akteur" : "System",
        operation,
        target:
          operation === "switch"
            ? "Organisationsschalter"
            : typeof before.status === "string"
              ? `Regel ${before.status}`
              : "Projektstatus-Regel",
        before: formatAuditState(before),
        after: formatAuditState(after),
        createdAt: audit.createdAt.toISOString(),
      };
    });
    const mappedDeliveryEvents = deliveryEvents.map((event) => ({
      id: event.id,
      projectLabel: event.entityLabel || "Projekt ohne Bezeichnung",
      status: event.status,
      stage: event.ruleId.endsWith(":responsible")
        ? ("responsible" as const)
        : event.ruleId.endsWith(":management")
          ? ("management" as const)
          : ("unknown" as const),
      recipientName: event.recipientUserId
        ? userNames.get(event.recipientUserId) ?? "Nicht mehr auflösbarer Empfänger"
        : "Kein Empfänger protokolliert",
      resolved: Boolean(event.resolvedAt),
      createdAt: event.createdAt.toISOString(),
    }));
    const activeManagementUsers = users.filter(
      (user) =>
        user.isActive &&
        (user.role === Role.ADMIN || user.role === Role.GESCHAEFTSFUEHRER)
    );
    const openRecipientKeys = new Set(
      openDeliveryRecipients.flatMap((event) =>
        event.recipientUserId
          ? [`${event.entityId}|${event.status}|${event.ruleId}|${event.recipientUserId}`]
          : []
      )
    );
    let plannedRecipientNotifications = 0;
    let alreadyOpenRecipientNotifications = 0;
    let noticesWithoutRecipient = 0;
    let ambiguousResponsible = 0;
    const deliveryPlans = preview.items.map((item) => {
      const recipientIds = new Set<string>();
      const blockers: string[] = [];
      if (item.responsibleUserId) {
        recipientIds.add(item.responsibleUserId);
        const normalizedResponsible = normalizePersonName(item.responsibleName);
        const matchingActiveUsers = users.filter(
          (user) =>
            user.isActive &&
            normalizePersonName(
              [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email
            ) === normalizedResponsible
        );
        if (normalizedResponsible && matchingActiveUsers.length > 1) {
          ambiguousResponsible += 1;
          blockers.push(
            `Verantwortlichkeit „${item.responsibleName}“ passt zu ${matchingActiveUsers.length} aktiven Benutzern und ist damit mehrdeutig.`
          );
        }
      } else {
        blockers.push(
          item.responsibleName
            ? `Verantwortlichkeit „${item.responsibleName}“ ist keinem aktiven Benutzer zugeordnet.`
            : "Am Projekt ist keine verantwortliche Person gepflegt."
        );
      }
      if (item.stage === "management") {
        if (activeManagementUsers.length === 0) {
          blockers.push("Es gibt keine aktive Administration oder Geschäftsführung als Eskalationsempfänger.");
        }
        activeManagementUsers.forEach((user) => recipientIds.add(user.id));
      }
      if (recipientIds.size === 0) noticesWithoutRecipient += 1;
      const ruleId = `project-status-v1:${item.status}:${item.stage}`;
      const newRecipientNames: string[] = [];
      const alreadyOpenRecipientNames: string[] = [];
      recipientIds.forEach((recipientId) => {
        const recipientName = userNames.get(recipientId) ?? "Nicht mehr auflösbarer Empfänger";
        const key = `${item.projectId}|${item.status}|${ruleId}|${recipientId}`;
        if (openRecipientKeys.has(key)) {
          alreadyOpenRecipientNotifications += 1;
          alreadyOpenRecipientNames.push(recipientName);
        } else {
          plannedRecipientNotifications += 1;
          newRecipientNames.push(recipientName);
        }
      });
      return {
        projectLabel: `${item.projectNumber} · ${item.projectTitle}`,
        status: item.status,
        stage: item.stage,
        newRecipientNames,
        alreadyOpenRecipientNames,
        blockers,
      };
    });
    return {
      organizationEnabled: settings.projectStatusEscalationEnabled,
      rules: settings.projectStatusRules,
      schedulerEnabled: scheduler.enabled,
      schedulerRunning: scheduler.schedulerRunning,
      schedulerLastAttemptAt: scheduler.schedulerLastAttemptAt,
      schedulerLastStatus:
        scheduler.schedulerLastStatus === "ok" || scheduler.schedulerLastStatus === "error"
          ? scheduler.schedulerLastStatus
          : "",
      schedulerLastHttpStatus: scheduler.schedulerLastHttpStatus,
      deliveryEnabled:
        process.env.WORKPILOT_PROJECT_STATUS_DELIVERY_ENABLED === "true",
      systemMailConfigured: getSystemMailStatus().configured,
      monitoredProjects: preview.monitoredProjects,
      responsibleNotices: preview.items.filter(
        (item) => item.stage === "responsible"
      ).length,
      managementNotices: preview.items.filter(
        (item) => item.stage === "management"
      ).length,
      missingResponsible: preview.items.filter(
        (item) => !item.responsibleUserId
      ).length,
      ambiguousResponsible,
      openDeliveryEvents,
      latestDeliveryEventAt: mappedDeliveryEvents[0]?.createdAt ?? "",
      configurationChangeCount,
      deliveryEventCount,
      configurationChanges,
      deliveryEvents: mappedDeliveryEvents,
      activeManagementRecipients: activeManagementUsers.map(
        (user) => userNames.get(user.id) ?? user.email
      ),
      plannedRecipientNotifications,
      alreadyOpenRecipientNotifications,
      noticesWithoutRecipient,
      deliveryPlans,
    };
  },
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizePersonName(value: string) {
  return value.trim().toLocaleLowerCase("de-DE").replace(/\s+/g, " ");
}

function formatAuditState(value: Record<string, unknown>) {
  if (typeof value.enabled !== "boolean") return "nicht vollständig protokolliert";
  const status = value.enabled ? "aktiv" : "inaktiv";
  if (
    typeof value.responsibleAfterDays === "number" &&
    typeof value.managementAfterDays === "number"
  ) {
    return `${status} · verantwortlich ${value.responsibleAfterDays} T. · Geschäftsführung ${value.managementAfterDays} T.`;
  }
  return status;
}

function normalize(value: string) {
  return normalizeJarvisIntentText(value).replace(/\s+/g, " ").trim();
}

export function looksLikeProjectStatusAutomationStatusQuestion(question: string) {
  const value = normalize(question);
  if (!/projektstatus/.test(value)) return false;
  if (!/(automation|automatik|fruhwarn|eskalation|scheduler|zustellung)/.test(value)) {
    return false;
  }
  if (/\b(aktivier|deaktivier|einschalt|ausschalt|abschalt|andere|setz)\w*/.test(value)) {
    return false;
  }
  if (wantsDeliveryPlan(question)) return true;
  if (wantsHistory(question)) return true;
  return /\b(lauft|laufend|aktiv|inaktiv|status|stand|funktionier|warum|wann|letzte|scheduler|zustellung|meldung|betriebsbereit|eingeschaltet|ausgeschaltet)\w*/.test(
    value
  );
}

function wantsDeliveryPlan(question: string) {
  const value = normalize(question);
  return /\b(empfanger|empfang|benachrichtig|zustellbar|blockier|wer bekommt|keine meldung|keinen hinweis)\w*/.test(
    value
  );
}

function wantsHistory(question: string) {
  const value = normalize(question);
  return /\b(protokoll|historie|audit|ausfuhrung|zugestellt|zustellereignis|konfigurationsanderung)\w*/.test(
    value
  );
}

function formatDateTime(value: string) {
  if (!value) return "noch kein Lauf seit dem letzten Serverstart protokolliert";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Zeitpunkt nicht lesbar";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(date);
}

function onOff(value: boolean) {
  return value ? "Aktiv" : "Ausgeschaltet";
}

export async function resolveJarvisProjectStatusAutomationStatus(input: {
  question: string;
  organizationId: string;
  users: readonly User[];
  accessProfile: JarvisAccessProfile;
  source?: ProjectStatusAutomationStatusSource;
}): Promise<JarvisReadResponse | undefined> {
  if (!looksLikeProjectStatusAutomationStatusQuestion(input.question)) {
    return undefined;
  }
  const decision = getJarvisActionDecision("automation.read", input.accessProfile);
  if (!decision.executable) {
    return {
      type: "refusal",
      topicId: "automation.project-status.status",
      message:
        "Deine aktuelle WorkPilot-Rolle darf die organisationsweite Projektstatus-Automation nicht über JARVIS einsehen.",
      deterministic: true,
    };
  }
  const snapshot = await (input.source ?? liveSource).load({
    organizationId: input.organizationId,
    users: input.users,
  });
  const enabledRules = snapshot.rules.filter((rule) => rule.enabled);
  const dueCount = snapshot.responsibleNotices + snapshot.managementNotices;
  const operational =
    snapshot.organizationEnabled &&
    snapshot.schedulerEnabled &&
    snapshot.schedulerRunning &&
    snapshot.deliveryEnabled;
  const historyRequested = wantsHistory(input.question);
  const deliveryPlanRequested = wantsDeliveryPlan(input.question);
  const statusMessage = operational
    ? `Die Projektstatus-Automation ist vollständig betriebsbereit. ${enabledRules.length} Regeln überwachen ${snapshot.monitoredProjects} Projekte; aktuell liegen ${dueCount} Schwellenüberschreitungen vor.`
    : `Die Projektstatus-Automation ist nicht vollständig betriebsbereit: Organisationsschalter ${onOff(snapshot.organizationEnabled).toLowerCase()}, Serverscheduler ${onOff(snapshot.schedulerEnabled).toLowerCase()} und Zustellung ${onOff(snapshot.deliveryEnabled).toLowerCase()}. Der Dry-Run zeigt trotzdem ${snapshot.monitoredProjects} überwachte Projekte und ${dueCount} aktuelle Schwellenüberschreitungen.`;
  const historyMessage = historyRequested
    ? `${statusMessage} Im Protokoll stehen ${snapshot.configurationChangeCount} ${snapshot.configurationChangeCount === 1 ? "Konfigurationsänderung" : "Konfigurationsänderungen"} und ${snapshot.deliveryEventCount} ${snapshot.deliveryEventCount === 1 ? "tatsächlich erzeugtes Zustellereignis" : "tatsächlich erzeugte Zustellereignisse"}.`
    : statusMessage;
  const message = deliveryPlanRequested
    ? `${historyMessage} Im aktuellen Dry-Run sind ${snapshot.plannedRecipientNotifications} neue Empfänger-Hinweise vorgesehen, ${snapshot.alreadyOpenRecipientNotifications} durch bereits offene Hinweise abgedeckt und ${snapshot.noticesWithoutRecipient} ${snapshot.noticesWithoutRecipient === 1 ? "Schwelle" : "Schwellen"} ohne jeden auflösbaren Empfänger.`
    : historyMessage;
  const deliveryBlockers = [
    ...(!snapshot.organizationEnabled ? ["Der fachliche Organisationsschalter ist ausgeschaltet."] : []),
    ...(!snapshot.schedulerEnabled
      ? ["Der serverseitige Scheduler-Kill-Switch ist ausgeschaltet."]
      : !snapshot.schedulerRunning
        ? ["Der Scheduler ist freigegeben, läuft auf diesem Server aber nicht."]
        : []),
    ...(!snapshot.deliveryEnabled ? ["Der Zustell-Kill-Switch ist ausgeschaltet."] : []),
    ...(!snapshot.systemMailConfigured
      ? ["Systemmail ist nicht vollständig konfiguriert; In-App-Hinweise wären davon getrennt möglich."]
      : []),
    ...(snapshot.missingResponsible > 0
      ? [snapshot.missingResponsible === 1
          ? "Eine fällige Schwelle hat keine einem aktiven Benutzer zugeordnete verantwortliche Person."
          : `${snapshot.missingResponsible} fällige Schwellen haben keine einem aktiven Benutzer zugeordnete verantwortliche Person.`]
      : []),
    ...(snapshot.ambiguousResponsible > 0
      ? [snapshot.ambiguousResponsible === 1
          ? "Eine fällige Schwelle hat eine mehrdeutige Namenszuordnung bei der verantwortlichen Person."
          : `${snapshot.ambiguousResponsible} fällige Schwellen haben eine mehrdeutige Namenszuordnung bei der verantwortlichen Person.`]
      : []),
    ...(snapshot.noticesWithoutRecipient > 0
      ? [snapshot.noticesWithoutRecipient === 1
          ? "Eine fällige Schwelle hat aktuell überhaupt keinen auflösbaren Empfänger."
          : `${snapshot.noticesWithoutRecipient} fällige Schwellen haben aktuell überhaupt keinen auflösbaren Empfänger.`]
      : []),
  ];

  return {
    type: "answer",
    topicId: "automation.project-status.status",
    message,
    navigation: {
      label: "Status-Automation öffnen",
      tab: "statusAutomation",
    },
    structured: {
      title: historyRequested
        ? "Projektstatus-Automation · Ausführungsprotokoll"
        : deliveryPlanRequested
          ? "Projektstatus-Automation · Zustellbarkeitsdiagnose"
        : "Projektstatus-Automation · Betriebsdiagnose",
      summary: message,
      facts: [
        {
          label: "Organisation",
          value: onOff(snapshot.organizationEnabled),
          tone: snapshot.organizationEnabled ? "positive" : "warning",
        },
        {
          label: "Serverscheduler",
          value:
            snapshot.schedulerEnabled && snapshot.schedulerRunning
              ? "Läuft"
              : snapshot.schedulerEnabled
                ? "Freigegeben, aber nicht laufend"
                : "Kill-Switch aus",
          tone:
            snapshot.schedulerEnabled && snapshot.schedulerRunning
              ? "positive"
              : "warning",
        },
        {
          label: "Zustellung",
          value: onOff(snapshot.deliveryEnabled),
          tone: snapshot.deliveryEnabled ? "positive" : "warning",
        },
        {
          label: "Systemmail",
          value: snapshot.systemMailConfigured ? "Konfiguriert" : "Nicht konfiguriert",
          tone: snapshot.systemMailConfigured ? "positive" : "warning",
        },
        {
          label: "Aktuelle Schwellen",
          value: String(dueCount),
          tone: dueCount > 0 ? "warning" : "positive",
        },
        { label: "Aktive Regeln", value: `${enabledRules.length}/${snapshot.rules.length}` },
        { label: "Überwachte Projekte", value: String(snapshot.monitoredProjects) },
      ],
      sections: [
        ...(historyRequested
          ? [
              {
                title: `Konfigurationsänderungen (${snapshot.configurationChangeCount})`,
                items:
                  snapshot.configurationChanges.length > 0
                    ? snapshot.configurationChanges.map(
                        (change) =>
                          `${formatDateTime(change.createdAt)} · ${change.actorName} · ${change.target}: ${change.before} → ${change.after}`
                      )
                    : ["Es ist noch keine Projektstatus-Automationsänderung protokolliert."],
                tone: "neutral" as const,
              },
              {
                title: `Tatsächliche Zustellereignisse (${snapshot.deliveryEventCount})`,
                items:
                  snapshot.deliveryEvents.length > 0
                    ? snapshot.deliveryEvents.map(
                        (event) =>
                          `${formatDateTime(event.createdAt)} · ${event.projectLabel} · ${event.status} · ${event.stage === "management" ? "Geschäftsführung" : event.stage === "responsible" ? "verantwortliche Person" : "unbekannte Stufe"} · ${event.recipientName} · ${event.resolved ? "erledigt" : "offen"}`
                      )
                    : ["Es wurde noch kein Projektstatus-Hinweis tatsächlich zugestellt."],
                tone: snapshot.openDeliveryEvents > 0 ? ("warning" as const) : ("neutral" as const),
              },
            ]
          : []),
        ...(deliveryPlanRequested
          ? [
              {
                title: `Empfängerplan (${snapshot.plannedRecipientNotifications} neue Hinweise)`,
                items:
                  snapshot.deliveryPlans.length > 0
                    ? snapshot.deliveryPlans.slice(0, 25).map((plan) => {
                        const stage =
                          plan.stage === "management"
                            ? "Geschäftsführung"
                            : "verantwortliche Person";
                        const newRecipients =
                          plan.newRecipientNames.length > 0
                            ? `neu: ${plan.newRecipientNames.join(", ")}`
                            : "neu: niemand";
                        const alreadyOpen =
                          plan.alreadyOpenRecipientNames.length > 0
                            ? ` · bereits offen: ${plan.alreadyOpenRecipientNames.join(", ")}`
                            : "";
                        const blockers =
                          plan.blockers.length > 0
                            ? ` · Hinweis: ${plan.blockers.join(" ")}`
                            : "";
                        return `${plan.projectLabel} · ${plan.status} · ${stage} · ${newRecipients}${alreadyOpen}${blockers}`;
                      })
                    : ["Aktuell ist keine Projektstatus-Schwelle fällig."],
                tone:
                  snapshot.noticesWithoutRecipient > 0
                    ? ("warning" as const)
                    : ("neutral" as const),
              },
              {
                title: "Zustellhindernisse",
                items:
                  deliveryBlockers.length > 0
                    ? deliveryBlockers
                    : ["Für die aktuelle In-App-Zustellkette ist kein Hindernis erkennbar."],
                tone: deliveryBlockers.length > 0 ? ("warning" as const) : ("positive" as const),
              },
              {
                title: `Aktiver Management-Empfängerkreis (${snapshot.activeManagementRecipients.length})`,
                items:
                  snapshot.activeManagementRecipients.length > 0
                    ? snapshot.activeManagementRecipients
                    : ["Keine aktive Administration oder Geschäftsführung vorhanden."],
                tone:
                  snapshot.activeManagementRecipients.length > 0
                    ? ("neutral" as const)
                    : ("warning" as const),
              },
            ]
          : []),
        {
          title: "Dry-Run · keine Zustellung",
          items: [
            `${snapshot.responsibleNotices} Treffer auf Stufe verantwortliche Person`,
            `${snapshot.managementNotices} Treffer auf Stufe Geschäftsführung`,
            `${snapshot.missingResponsible} Treffer ohne eindeutig auflösbare verantwortliche Person`,
            `${snapshot.ambiguousResponsible} Treffer mit mehrdeutiger Namenszuordnung`,
          ],
          tone: dueCount > 0 || snapshot.missingResponsible > 0 ? "warning" : "positive",
        },
        {
          title: "Regelkonfiguration",
          items: snapshot.rules.map(
            (rule) =>
              `${rule.status}: ${rule.enabled ? "aktiv" : "inaktiv"} · verantwortlich nach ${rule.responsibleAfterDays} Tagen · Geschäftsführung nach ${rule.managementAfterDays} Tagen`
          ),
        },
        {
          title: "Betriebs- und Zustellnachweis",
          items: [
            `Letzter Scheduler-Versuch: ${formatDateTime(snapshot.schedulerLastAttemptAt)}`,
            snapshot.schedulerLastStatus
              ? `Letzter Scheduler-Status: ${snapshot.schedulerLastStatus === "ok" ? "erfolgreich" : `Fehler${snapshot.schedulerLastHttpStatus ? ` (HTTP ${snapshot.schedulerLastHttpStatus})` : ""}`}`
              : "Seit dem letzten Serverstart ist noch kein Scheduler-Ergebnis im Arbeitsspeicher vorhanden.",
            `${snapshot.openDeliveryEvents} offene, bereits zugestellte Projektstatus-Eskalationsereignisse`,
            `Letztes persistentes Zustellereignis: ${snapshot.latestDeliveryEventAt ? formatDateTime(snapshot.latestDeliveryEventAt) : "keines vorhanden"}`,
          ],
          tone:
            snapshot.schedulerLastStatus === "error" || !operational
              ? "warning"
              : "neutral",
        },
        {
          title: "Wichtige Trennung",
          items: [
            "Der Organisationsschalter entscheidet, ob diese Organisation die Frühwarnung fachlich nutzt.",
            "Der serverseitige Scheduler-Kill-Switch entscheidet, ob automatische Prüfungen laufen.",
            "Der Zustell-Kill-Switch entscheidet, ob Notifications und Systemmails tatsächlich erzeugt werden.",
            "Ein bereits offenes Ereignis verhindert für dasselbe Projekt, denselben Status, dieselbe Stufe und denselben Empfänger eine doppelte Zustellung.",
            "Systemmail ist ein zusätzlicher Best-Effort-Kanal; das persistente Zustellereignis belegt zunächst den erzeugten In-App-Hinweis.",
            "Diese Diagnose ist rein lesend: Sie startet keinen Scheduler, versendet nichts und ändert keinen Projektstatus.",
          ],
        },
      ],
    },
    deterministic: true,
  };
}
