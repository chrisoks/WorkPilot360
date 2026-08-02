import { prisma } from "@/lib/db/client";
import { getDeadlineSettings } from "@/lib/company-settings/deadlines";
import { getProjectStatusEscalationSchedulerStatus } from "@/lib/automation/project-status-escalation-scheduler";
import { evaluateProjectStatusEscalations } from "@/lib/projects/status-escalation";
import { getJarvisActionDecision } from "@/lib/jarvis/actions";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import type { JarvisReadResponse } from "@/lib/jarvis/read-model";
import type { JarvisAccessProfile } from "@/lib/jarvis/security";
import type { User } from "@prisma/client";

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
  monitoredProjects: number;
  responsibleNotices: number;
  managementNotices: number;
  missingResponsible: number;
  openDeliveryEvents: number;
  latestDeliveryEventAt: string;
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
    const [openDeliveryEvents, latestDeliveryEvent] = await Promise.all([
      prisma.statusEscalationEvent.count({
        where: {
          organizationId,
          entityType: "project",
          ruleId: { startsWith: "project-status-v1:" },
          resolvedAt: null,
        },
      }),
      prisma.statusEscalationEvent.findFirst({
        where: {
          organizationId,
          entityType: "project",
          ruleId: { startsWith: "project-status-v1:" },
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);
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
      openDeliveryEvents,
      latestDeliveryEventAt: latestDeliveryEvent?.createdAt.toISOString() ?? "",
    };
  },
};

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
  return /\b(lauft|laufend|aktiv|inaktiv|status|stand|funktionier|warum|wann|letzte|scheduler|zustellung|meldung|betriebsbereit|eingeschaltet|ausgeschaltet)\w*/.test(
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
  const message = operational
    ? `Die Projektstatus-Automation ist vollständig betriebsbereit. ${enabledRules.length} Regeln überwachen ${snapshot.monitoredProjects} Projekte; aktuell liegen ${dueCount} Schwellenüberschreitungen vor.`
    : `Die Projektstatus-Automation ist nicht vollständig betriebsbereit: Organisationsschalter ${onOff(snapshot.organizationEnabled).toLowerCase()}, Serverscheduler ${onOff(snapshot.schedulerEnabled).toLowerCase()} und Zustellung ${onOff(snapshot.deliveryEnabled).toLowerCase()}. Der Dry-Run zeigt trotzdem ${snapshot.monitoredProjects} überwachte Projekte und ${dueCount} aktuelle Schwellenüberschreitungen.`;

  return {
    type: "answer",
    topicId: "automation.project-status.status",
    message,
    navigation: {
      label: "Status-Automation öffnen",
      tab: "statusAutomation",
    },
    structured: {
      title: "Projektstatus-Automation · Betriebsdiagnose",
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
        { label: "Aktive Regeln", value: `${enabledRules.length}/${snapshot.rules.length}` },
        { label: "Überwachte Projekte", value: String(snapshot.monitoredProjects) },
        {
          label: "Aktuelle Schwellen",
          value: String(dueCount),
          tone: dueCount > 0 ? "warning" : "positive",
        },
      ],
      sections: [
        {
          title: "Dry-Run · keine Zustellung",
          items: [
            `${snapshot.responsibleNotices} Treffer auf Stufe verantwortliche Person`,
            `${snapshot.managementNotices} Treffer auf Stufe Geschäftsführung`,
            `${snapshot.missingResponsible} Treffer ohne eindeutig auflösbare verantwortliche Person`,
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
            "Diese Diagnose ist rein lesend: Sie startet keinen Scheduler, versendet nichts und ändert keinen Projektstatus.",
          ],
        },
      ],
    },
    deterministic: true,
  };
}
