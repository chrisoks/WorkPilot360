import { prisma } from "@/lib/db/client";
import { getJarvisActionDecision } from "@/lib/jarvis/actions";
import { extractJarvisProjectReferences } from "@/lib/jarvis/dialog-state";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import type {
  JarvisReadResponse,
  JarvisRecordResult,
} from "@/lib/jarvis/read-model";
import type { JarvisAccessProfile } from "@/lib/jarvis/security";

export type ProjectReviewState =
  | "unreviewed"
  | "needs_review"
  | "approved"
  | "unknown";

export type ProjectReviewInventoryItem = {
  id: string;
  projectNumber: string;
  title: string;
  customer: string | null;
  status: string;
  reviewStatus: string;
  projectType: string | null;
  projectKind: string | null;
  recurringBillingMode: string | null;
  branch: string | null;
  responsibleName: string | null;
  updatedAt: Date;
};

export type ProjectReviewInventorySource = {
  load(input: {
    organizationId: string;
  }): Promise<ProjectReviewInventoryItem[]>;
};

type ProjectReviewIntent = {
  presentation: "count" | "list" | "summary";
  state?: Exclude<ProjectReviewState, "unknown">;
  projectType?: "one_time" | "monthly_flat" | "hourly";
  branch?: "solutions" | "immocare";
};

const liveSource: ProjectReviewInventorySource = {
  async load({ organizationId }) {
    return prisma.workPilotProject.findMany({
      where: { organizationId },
      select: {
        id: true,
        projectNumber: true,
        title: true,
        customer: true,
        status: true,
        reviewStatus: true,
        projectType: true,
        projectKind: true,
        recurringBillingMode: true,
        branch: true,
        responsibleName: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: "desc" }, { projectNumber: "asc" }],
    });
  },
};

function normalize(value: string) {
  return normalizeJarvisIntentText(value)
    .replace(/\s+/g, " ")
    .trim();
}

function includesStem(value: string, stems: string[]) {
  return stems.some((stem) => value.includes(stem));
}

export function resolveJarvisProjectReviewInventoryIntent(
  question: string
): ProjectReviewIntent | undefined {
  if (extractJarvisProjectReferences(question).length > 0) return undefined;
  const value = normalize(question);
  const mentionsProjects =
    /\bprojekt(?:e|en|bestand|liste|daten)?\b/.test(value) ||
    value.includes("projektpruf") ||
    /\b(dauerlaufer|monatspauschale|stundenabrechnung|einmalprojekt)\b/.test(
      value
    );
  const mentionsReviewState =
    includesStem(value, [
      "pruf",
      "uberarbeit",
      "uberarb",
      "fachlich freige",
      "freigab",
      "freigegeb",
      "kontrollier",
    ]) ||
    /\b(?:ge|un)?pr[uf]{1,3}\w*\b/.test(value) ||
    /\bnoch (?:zu )?(?:bearbeiten|klaren|sichten)\b/.test(value);
  if (!mentionsProjects || !mentionsReviewState) return undefined;

  const asksForNotApproved =
    /\b(?:noch )?nicht (?:fachlich )?freigegeben\w*\b/.test(value) ||
    /\bfreigabe\b.*\b(aussteh|offen|fehl)\w*\b/.test(value);
  const state =
    !asksForNotApproved &&
    (/\b(?:fachlich )?freigegeben\w*\b|\bgepruft und freigegeben\w*\b/.test(
      value
    ))
      ? "approved"
      : /\b(?:erneut|noch einmal|wieder)\b.*\bpruf/.test(value) ||
          /\bprufung notwendig\b/.test(value) ||
          /\bnach anderungen\b/.test(value)
        ? "needs_review"
        : /\bnoch nie\b|\bungepruf\w*\b|\bnicht\s+(?:fachlich\s+)?(?:ge)?pr\w*\b/.test(
            value
          )
          ? "unreviewed"
          : undefined;
  const presentation =
    /\bwelche\b|\bzeig\w*\b|\bliste\b|\bnenn\w*\b/.test(value)
      ? "list"
      : /\bwie viel\w*\b|\banzahl\b|\bwie hoch\b/.test(value)
        ? "count"
        : "summary";
  const projectType =
    /\bmonatspauschale\b/.test(value)
      ? "monthly_flat"
      : /\bstundenabrechnung\b/.test(value)
        ? "hourly"
        : /\beinmal(?:ig(?:e[nsr]?)?|projekt)\b/.test(value)
          ? "one_time"
          : undefined;
  const branch =
    /\bimmocare\b/.test(value)
      ? "immocare"
      : /\bsolutions?\b/.test(value)
        ? "solutions"
        : undefined;

  return { presentation, state, projectType, branch };
}

export function normalizeProjectReviewState(value: string): ProjectReviewState {
  const normalized = normalize(value);
  if (normalized === "approved") return "approved";
  if (normalized === "needs_review" || normalized === "needs review") {
    return "needs_review";
  }
  if (normalized === "unreviewed") return "unreviewed";
  return "unknown";
}

function matchesProjectType(
  project: ProjectReviewInventoryItem,
  projectType: NonNullable<ProjectReviewIntent["projectType"]>
) {
  const value = normalize(
    [
      project.projectKind,
      project.projectType,
      project.recurringBillingMode,
    ]
      .filter(Boolean)
      .join(" ")
  );
  if (projectType === "monthly_flat") {
    return value.includes("monatspauschale") || value.includes("monthlyflat");
  }
  if (projectType === "hourly") {
    return value.includes("stundenabrechnung") || value.includes("hourly");
  }
  return (
    value.includes("einmal") ||
    value.includes("one time") ||
    value.includes("one_time")
  );
}

function matchesBranch(
  project: ProjectReviewInventoryItem,
  branch: NonNullable<ProjectReviewIntent["branch"]>
) {
  const value = normalize(project.branch ?? "");
  return branch === "immocare"
    ? value.includes("immocare")
    : value.includes("solution");
}

function statusLabel(state: ProjectReviewState) {
  if (state === "approved") return "Fachlich freigegeben";
  if (state === "needs_review") return "Erneute Prüfung notwendig";
  if (state === "unreviewed") return "Noch nie fachlich geprüft";
  return "Prüfstatus unklar";
}

function toRecord(project: ProjectReviewInventoryItem): JarvisRecordResult {
  const state = normalizeProjectReviewState(project.reviewStatus);
  return {
    id: `project-review-${project.id}`,
    kind: "project",
    title: `${project.projectNumber || "Ohne Nummer"} · ${project.title}`,
    subtitle: [project.customer, project.status].filter(Boolean).join(" · "),
    summary: project.responsibleName
      ? `Verantwortlich: ${project.responsibleName}`
      : "",
    status: statusLabel(state),
    target: { kind: "project", id: project.id },
  };
}

export async function resolveJarvisProjectReviewInventoryRequest(input: {
  question: string;
  organizationId: string;
  accessProfile: JarvisAccessProfile;
  source?: ProjectReviewInventorySource;
}): Promise<JarvisReadResponse | undefined> {
  const intent = resolveJarvisProjectReviewInventoryIntent(input.question);
  if (!intent) return undefined;

  const decision = getJarvisActionDecision("project.read", input.accessProfile);
  if (!decision.executable) {
    return {
      type: "refusal",
      topicId: "management.project-review-inventory",
      message:
        "Deine aktuelle WorkPilot-Rolle darf den Projektbestand nicht über JARVIS auswerten.",
      deterministic: true,
    };
  }

  const projects = await (input.source ?? liveSource).load({
    organizationId: input.organizationId,
  });
  const scopedProjects = projects.filter(
    (project) =>
      (!intent.projectType || matchesProjectType(project, intent.projectType)) &&
      (!intent.branch || matchesBranch(project, intent.branch))
  );
  const grouped = {
    unreviewed: scopedProjects.filter(
      (project) =>
        normalizeProjectReviewState(project.reviewStatus) === "unreviewed"
    ),
    needs_review: scopedProjects.filter(
      (project) =>
        normalizeProjectReviewState(project.reviewStatus) === "needs_review"
    ),
    approved: scopedProjects.filter(
      (project) =>
        normalizeProjectReviewState(project.reviewStatus) === "approved"
    ),
    unknown: scopedProjects.filter(
      (project) =>
        normalizeProjectReviewState(project.reviewStatus) === "unknown"
    ),
  };
  const requiringReview = [
    ...grouped.unreviewed,
    ...grouped.needs_review,
    ...grouped.unknown,
  ];
  const selected =
    intent.state === "approved"
      ? grouped.approved
      : intent.state === "needs_review"
        ? grouped.needs_review
        : intent.state === "unreviewed"
          ? grouped.unreviewed
          : requiringReview;
  const message =
    intent.state === "approved"
      ? selected.length === 0
        ? "Aktuell ist noch kein Projekt fachlich freigegeben."
        : `Aktuell ${selected.length === 1 ? "ist ein Projekt" : `sind ${selected.length} Projekte`} fachlich freigegeben.`
      : intent.state === "needs_review"
        ? selected.length === 0
          ? "Aktuell ist bei keinem Projekt nach Änderungen eine erneute fachliche Prüfung notwendig."
          : `Aktuell ist bei ${selected.length === 1 ? "einem Projekt" : `${selected.length} Projekten`} nach Änderungen eine erneute fachliche Prüfung notwendig.`
        : intent.state === "unreviewed"
          ? selected.length === 0
            ? "Aktuell gibt es kein Projekt, das noch nie fachlich geprüft wurde."
            : `Aktuell ${selected.length === 1 ? "wurde ein Projekt" : `wurden ${selected.length} Projekte`} noch nie fachlich geprüft.`
          : `Aktuell ${requiringReview.length === 0 ? "muss kein Projekt mehr" : requiringReview.length === 1 ? "muss noch ein Projekt" : `müssen noch ${requiringReview.length} Projekte`} fachlich geprüft werden. ${grouped.unreviewed.length === 0 ? "Keines davon wurde noch nie geprüft" : grouped.unreviewed.length === 1 ? "Davon wurde eines noch nie geprüft" : `Davon wurden ${grouped.unreviewed.length} noch nie geprüft`} und ${grouped.needs_review.length === 0 ? "bei keinem Projekt ist" : grouped.needs_review.length === 1 ? "bei einem Projekt ist" : `bei ${grouped.needs_review.length} Projekten ist`} nach Änderungen eine erneute Prüfung notwendig. ${grouped.approved.length === 0 ? "Noch kein Projekt ist" : grouped.approved.length === 1 ? "Ein Projekt ist" : `${grouped.approved.length} Projekte sind`} bereits fachlich freigegeben.${grouped.unknown.length > 0 ? ` Bei ${grouped.unknown.length === 1 ? "einem Projekt ist" : `${grouped.unknown.length} Projekten ist`} der gespeicherte Prüfstatus unklar und wird deshalb sicherheitshalber als prüfbedürftig behandelt.` : ""}`;

  return {
    type: "answer",
    topicId: "management.project-review-inventory",
    message,
    ...(intent.presentation === "list"
      ? { records: selected.slice(0, 20).map(toRecord) }
      : {}),
    structured: {
      title: "Fachlicher Prüfstand · Projekte",
      summary:
        intent.presentation === "list" && selected.length > 20
          ? `${selected.length} passende Projekte gefunden. Die 20 zuletzt geänderten Projekte werden angezeigt.`
          : message,
      facts: [
        {
          label: "Noch zu prüfen",
          value: String(requiringReview.length),
          tone: requiringReview.length > 0 ? "warning" : "positive",
        },
        {
          label: "Noch nie geprüft",
          value: String(grouped.unreviewed.length),
        },
        {
          label: "Erneut prüfen",
          value: String(grouped.needs_review.length),
          tone: grouped.needs_review.length > 0 ? "warning" : "neutral",
        },
        {
          label: "Freigegeben",
          value: String(grouped.approved.length),
          tone: grouped.approved.length > 0 ? "positive" : "neutral",
        },
      ],
      sections: [
        {
          title: "Einordnung",
          items: [
            "Die Antwort basiert auf dem gespeicherten fachlichen Prüfstatus der Projekte und nicht auf einer Vermutung von JARVIS.",
            "„Noch nie geprüft“ und „nach Änderungen erneut prüfen“ werden getrennt ausgewiesen.",
          ],
        },
      ],
    },
    deterministic: true,
  };
}
