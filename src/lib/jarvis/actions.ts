import { Role } from "@prisma/client";
import {
  canAccessEmployeeCosts,
  canArchiveProjects,
  canDeleteContacts,
  canDeleteInvoices,
  canDeleteOffers,
  canDeleteTasks,
  canManageCatalogItems,
  canManageContacts,
  canManageInvoices,
  canManageOffers,
  canManagePlanningEntries,
  canManageProcessAutomation,
  canManageProjectTimeEntries,
  canManageProjects,
  canManageUsers,
  canSendDocumentMails,
  canReadContacts,
} from "@/lib/permissions";
import {
  canAccessJarvisDataClass,
  JarvisAccessProfile,
  JarvisActor,
  JarvisDataClass,
} from "@/lib/jarvis/security";

export type JarvisActionRisk = "read" | "prepare" | "write" | "critical";
export type JarvisActionImplementation = "planned" | "available";
export type JarvisConfirmationLevel = "none" | "preview" | "confirm" | "critical";

export type JarvisActionDefinition = {
  id: string;
  title: string;
  category:
    | "navigation"
    | "task"
    | "planning"
    | "time"
    | "project"
    | "contact"
    | "catalog"
    | "offer"
    | "invoice"
    | "document"
    | "personnel"
    | "bulk"
    | "automation";
  risk: JarvisActionRisk;
  confirmation: JarvisConfirmationLevel;
  dataClasses: JarvisDataClass[];
  implementation: JarvisActionImplementation;
  canUse: (actor: JarvisActor) => boolean;
};

export type JarvisActionDecision = {
  known: boolean;
  permitted: boolean;
  executable: boolean;
  requiresConfirmation: boolean;
  reason: "allowed" | "unknown_action" | "role" | "data_class" | "not_implemented";
  action?: JarvisActionDefinition;
};

const isActiveInternalUser = (actor: JarvisActor) => actor.role !== Role.GAST;

export const JARVIS_ACTIONS: JarvisActionDefinition[] = [
  {
    id: "navigation.open",
    title: "Bereich oder Datensatz öffnen",
    category: "navigation",
    risk: "read",
    confirmation: "none",
    dataClasses: ["internal"],
    implementation: "available",
    canUse: () => true,
  },
  {
    id: "project.read",
    title: "Projekt suchen oder zusammenfassen",
    category: "project",
    risk: "read",
    confirmation: "none",
    dataClasses: ["internal"],
    implementation: "available",
    canUse: isActiveInternalUser,
  },
  {
    id: "contact.read",
    title: "Kunde oder Kontakt suchen",
    category: "contact",
    risk: "read",
    confirmation: "none",
    dataClasses: ["customer"],
    implementation: "available",
    canUse: canReadContacts,
  },
  {
    id: "task.read",
    title: "Berechtigte Aufgabe suchen",
    category: "task",
    risk: "read",
    confirmation: "none",
    dataClasses: ["internal"],
    implementation: "available",
    canUse: isActiveInternalUser,
  },
  {
    id: "offer.read",
    title: "Angebot suchen oder zusammenfassen",
    category: "offer",
    risk: "read",
    confirmation: "none",
    dataClasses: ["customer"],
    implementation: "available",
    canUse: canManageOffers,
  },
  {
    id: "invoice.read",
    title: "Rechnung suchen oder zusammenfassen",
    category: "invoice",
    risk: "read",
    confirmation: "none",
    dataClasses: ["financial"],
    implementation: "available",
    canUse: canManageInvoices,
  },
  {
    id: "task.prepare",
    title: "Aufgabe vorbereiten",
    category: "task",
    risk: "prepare",
    confirmation: "preview",
    dataClasses: ["internal"],
    implementation: "planned",
    canUse: isActiveInternalUser,
  },
  {
    id: "task.create",
    title: "Aufgabe anlegen",
    category: "task",
    risk: "write",
    confirmation: "confirm",
    dataClasses: ["internal"],
    implementation: "planned",
    canUse: isActiveInternalUser,
  },
  {
    id: "task.delete",
    title: "Aufgabe löschen",
    category: "task",
    risk: "critical",
    confirmation: "critical",
    dataClasses: ["internal"],
    implementation: "planned",
    canUse: canDeleteTasks,
  },
  {
    id: "planning.prepare",
    title: "Termin oder Terminwunsch vorbereiten",
    category: "planning",
    risk: "prepare",
    confirmation: "preview",
    dataClasses: ["internal"],
    implementation: "planned",
    canUse: canManagePlanningEntries,
  },
  {
    id: "planning.create",
    title: "Termin oder Terminwunsch speichern",
    category: "planning",
    risk: "write",
    confirmation: "confirm",
    dataClasses: ["internal"],
    implementation: "planned",
    canUse: canManagePlanningEntries,
  },
  {
    id: "time.prepare",
    title: "Zeiteintrag vorbereiten",
    category: "time",
    risk: "prepare",
    confirmation: "preview",
    dataClasses: ["internal"],
    implementation: "planned",
    canUse: isActiveInternalUser,
  },
  {
    id: "time.manage",
    title: "Zeiteintrag für andere verwalten",
    category: "time",
    risk: "write",
    confirmation: "confirm",
    dataClasses: ["internal"],
    implementation: "planned",
    canUse: canManageProjectTimeEntries,
  },
  {
    id: "project.manage",
    title: "Projekt anlegen oder bearbeiten",
    category: "project",
    risk: "write",
    confirmation: "confirm",
    dataClasses: ["customer"],
    implementation: "planned",
    canUse: canManageProjects,
  },
  {
    id: "project.archive",
    title: "Projekt archivieren",
    category: "project",
    risk: "critical",
    confirmation: "critical",
    dataClasses: ["customer"],
    implementation: "planned",
    canUse: canArchiveProjects,
  },
  {
    id: "contact.manage",
    title: "Kontakt anlegen oder bearbeiten",
    category: "contact",
    risk: "write",
    confirmation: "confirm",
    dataClasses: ["customer"],
    implementation: "planned",
    canUse: canManageContacts,
  },
  {
    id: "contact.delete",
    title: "Kontakt löschen",
    category: "contact",
    risk: "critical",
    confirmation: "critical",
    dataClasses: ["customer"],
    implementation: "planned",
    canUse: canDeleteContacts,
  },
  {
    id: "offer.prepare",
    title: "Angebot oder Nachtrag vorbereiten",
    category: "offer",
    risk: "prepare",
    confirmation: "preview",
    dataClasses: ["customer"],
    implementation: "planned",
    canUse: canManageOffers,
  },
  {
    id: "offer.manage",
    title: "Angebot speichern oder Status ändern",
    category: "offer",
    risk: "write",
    confirmation: "confirm",
    dataClasses: ["customer"],
    implementation: "planned",
    canUse: canManageOffers,
  },
  {
    id: "offer.delete",
    title: "Angebot löschen",
    category: "offer",
    risk: "critical",
    confirmation: "critical",
    dataClasses: ["customer"],
    implementation: "planned",
    canUse: canDeleteOffers,
  },
  {
    id: "invoice.prepare",
    title: "Rechnungsentwurf oder Mahnung vorbereiten",
    category: "invoice",
    risk: "prepare",
    confirmation: "preview",
    dataClasses: ["financial"],
    implementation: "planned",
    canUse: canManageInvoices,
  },
  {
    id: "invoice.finalize",
    title: "Rechnung fakturieren",
    category: "invoice",
    risk: "critical",
    confirmation: "critical",
    dataClasses: ["financial"],
    implementation: "planned",
    canUse: canManageInvoices,
  },
  {
    id: "invoice.cancel",
    title: "Rechnung stornieren",
    category: "invoice",
    risk: "critical",
    confirmation: "critical",
    dataClasses: ["financial"],
    implementation: "planned",
    canUse: canManageInvoices,
  },
  {
    id: "invoice.delete",
    title: "Rechnung löschen",
    category: "invoice",
    risk: "critical",
    confirmation: "critical",
    dataClasses: ["financial"],
    implementation: "planned",
    canUse: canDeleteInvoices,
  },
  {
    id: "document.send",
    title: "Dokument per E-Mail versenden",
    category: "document",
    risk: "critical",
    confirmation: "critical",
    dataClasses: ["customer"],
    implementation: "planned",
    canUse: canSendDocumentMails,
  },
  {
    id: "catalog.manage",
    title: "Artikel, Leistung oder Paket verwalten",
    category: "catalog",
    risk: "write",
    confirmation: "confirm",
    dataClasses: ["internal"],
    implementation: "planned",
    canUse: canManageCatalogItems,
  },
  {
    id: "personnel.manage",
    title: "Personalstammdaten oder Rolle ändern",
    category: "personnel",
    risk: "critical",
    confirmation: "critical",
    dataClasses: ["personnel"],
    implementation: "planned",
    canUse: canManageUsers,
  },
  {
    id: "payroll.manage",
    title: "Lohn- oder Mitarbeiterkostendaten ändern",
    category: "personnel",
    risk: "critical",
    confirmation: "critical",
    dataClasses: ["payroll"],
    implementation: "planned",
    canUse: (actor) => canManageUsers(actor) && canAccessEmployeeCosts(actor),
  },
  {
    id: "bulk.update",
    title: "Massenänderung ausführen",
    category: "bulk",
    risk: "critical",
    confirmation: "critical",
    dataClasses: ["internal"],
    implementation: "planned",
    canUse: canManageUsers,
  },
  {
    id: "automation.manage",
    title: "Automation konfigurieren oder ausführen",
    category: "automation",
    risk: "critical",
    confirmation: "critical",
    dataClasses: ["internal"],
    implementation: "planned",
    canUse: canManageProcessAutomation,
  },
];

function bothActorsPass(profile: JarvisAccessProfile, predicate: (actor: JarvisActor) => boolean) {
  return predicate(profile.sessionActor) && predicate(profile.effectiveActor);
}

export function getJarvisActionDecision(
  actionId: string,
  profile: JarvisAccessProfile
): JarvisActionDecision {
  const action = JARVIS_ACTIONS.find((candidate) => candidate.id === actionId);
  if (!action) {
    return {
      known: false,
      permitted: false,
      executable: false,
      requiresConfirmation: false,
      reason: "unknown_action",
    };
  }

  if (!action.dataClasses.every((dataClass) => canAccessJarvisDataClass(profile, dataClass))) {
    return {
      known: true,
      permitted: false,
      executable: false,
      requiresConfirmation: action.confirmation !== "none",
      reason: "data_class",
      action,
    };
  }

  if (!bothActorsPass(profile, action.canUse)) {
    return {
      known: true,
      permitted: false,
      executable: false,
      requiresConfirmation: action.confirmation !== "none",
      reason: "role",
      action,
    };
  }

  return {
    known: true,
    permitted: true,
    executable: action.implementation === "available",
    requiresConfirmation: action.confirmation !== "none",
    reason: action.implementation === "available" ? "allowed" : "not_implemented",
    action,
  };
}

export function getJarvisActionCatalog(profile: JarvisAccessProfile) {
  return JARVIS_ACTIONS.map((action) => getJarvisActionDecision(action.id, profile));
}
