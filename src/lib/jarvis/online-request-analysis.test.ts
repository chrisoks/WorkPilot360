import { Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  resolveJarvisOnlineRequestAnalysis,
  resolveJarvisOnlineRequestIntent,
  type JarvisOnlineRequestRow,
  type JarvisOnlineRequestSource,
} from "@/lib/jarvis/online-request-analysis";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";

const request: JarvisOnlineRequestRow = {
  id: "request-1",
  referenceNumber: "OKI-20260730-A1B2C3",
  status: "new",
  requestType: "execution",
  tradeName: "Winterdienst",
  recommendationNames: ["Grünpflege"],
  desiredDate: "2026-11-02",
  desiredTimeWindow: "morning",
  callbackTimeWindow: null,
  urgency: "normal",
  street: "Musterstraße 1",
  postalCode: "74722",
  city: "Buchen",
  objectHint: "Hinterhaus",
  description: "Bitte den Winterdienst für das Objekt anbieten.",
  company: "Muster GmbH",
  firstName: "Max",
  lastName: "Muster",
  email: "max@example.test",
  phone: "012345",
  preferredContact: "email",
  assignedUserId: "sales-1",
  customerDecision: "existing",
  matchedContactId: "contact-1",
  convertedProjectId: null,
  createdAt: new Date("2026-07-30T08:00:00.000Z"),
  updatedAt: new Date("2026-07-30T09:00:00.000Z"),
  photoCount: 2,
  auditEventCount: 3,
};

function source(
  overrides: Partial<Awaited<ReturnType<JarvisOnlineRequestSource["load"]>>> = {}
): JarvisOnlineRequestSource {
  return {
    load: vi.fn().mockResolvedValue({
      statusCounts: {
        new: 2,
        in_review: 1,
        waiting_customer: 1,
        converted: 3,
        closed: 4,
      },
      requests: [request],
      assigneeNames: { "sales-1": "Verena Vertrieb" },
      assigneeDetails: {
        "sales-1": {
          name: "Verena Vertrieb",
          isActive: true,
          canConvert: true,
        },
      },
      matchedContacts: {
        "contact-1": {
          customerNumber: "7000049",
          name: "Muster GmbH",
        },
      },
      convertedProjects: {},
      ...overrides,
    }),
  };
}

const salesProfile = createJarvisAccessProfile({
  id: "sales-1",
  role: Role.VERTRIEB,
});

describe("JARVIS online request analysis", () => {
  it.each([
    ["Wie viele neue Online-Anfragen gibt es?", "summary"],
    ["Zeig mir die offenen Online-Anfragen.", "list"],
    ["Welche Online-Anfrage ist am ältesten?", "list"],
    ["Welche Online-Anfragen warten auf Rückmeldung?", "list"],
    ["Fasse OKI-20260730-A1B2C3 zusammen.", "detail"],
    ["Ist OKI-20260730-A1B2C3 zur Übernahme bereit?", "detail"],
  ])("recognizes live request intent: %s", (question, presentation) => {
    expect(resolveJarvisOnlineRequestIntent(question)?.presentation).toBe(
      presentation
    );
  });

  it.each([
    "Wo finde ich neue Online-Anfragen?",
    "Wie wandle ich eine Online-Anfrage in ein Projekt um?",
    "Wie funktioniert das Online-Anfragen-Formular?",
    "Welche Anliegenarten hat das Online-Anfragen-Formular?",
    "Was passiert mit Fotos einer Online-Anfrage?",
    "Wie ist das Online-Anfragen-Portal gegen Spam geschützt?",
    "Welche Projektnummer bekommt eine Online-Anfrage und was gilt bei Sonstige?",
  ])("keeps pure how-to questions in deterministic guidance: %s", (question) => {
    expect(resolveJarvisOnlineRequestIntent(question)).toBeUndefined();
  });

  it("extracts the exact reference and never guesses a record", () => {
    expect(
      resolveJarvisOnlineRequestIntent(
        "Was ist der Status von oki-20260730-a1b2c3?"
      )
    ).toMatchObject({
      referenceNumber: "OKI-20260730-A1B2C3",
      presentation: "detail",
    });
  });

  it("recognizes an explicit conversion-readiness check for one exact reference", () => {
    expect(
      resolveJarvisOnlineRequestIntent(
        "Welche Voraussetzungen fehlen noch, um OKI-20260730-A1B2C3 zu übernehmen?"
      )
    ).toMatchObject({
      referenceNumber: "OKI-20260730-A1B2C3",
      presentation: "detail",
      readinessRequested: true,
    });
  });

  it("summarizes exact status counts and preserves the no-auto-link invariant", async () => {
    const response = await resolveJarvisOnlineRequestAnalysis({
      question: "Wie viele Online-Anfragen gibt es aktuell?",
      organizationId: "org-1",
      accessProfile: salesProfile,
      source: source(),
    });

    expect(response).toMatchObject({
      type: "answer",
      topicId: "online-requests.inventory",
      navigation: { tab: "onlineRequests" },
      deterministic: true,
    });
    expect(response?.message).toContain("Insgesamt gibt es 11");
    expect(response?.message).toContain("4 aktiv");
    expect(JSON.stringify(response)).toContain(
      "niemals automatisch einem bestehenden Projekt zugeordnet"
    );
    expect(JSON.stringify(response)).toContain(
      "OK immocare → Lead / Klärung"
    );
    expect(JSON.stringify(response)).toContain(
      "nächste globale Nummer mit dem Gewerk-Präfix"
    );
  });

  it("uses the selected status as an organization-bound source filter", async () => {
    const dataSource = source();
    await resolveJarvisOnlineRequestAnalysis({
      question: "Welche Online-Anfragen warten auf Rückmeldung?",
      organizationId: "org-1",
      accessProfile: salesProfile,
      source: dataSource,
    });

    expect(dataSource.load).toHaveBeenCalledWith({
      organizationId: "org-1",
      referenceNumber: null,
      statuses: ["waiting_customer"],
      oldestFirst: false,
    });
  });

  it("renders a safe detailed summary without loading network security evidence", async () => {
    const response = await resolveJarvisOnlineRequestAnalysis({
      question: "Fasse OKI-20260730-A1B2C3 zusammen.",
      organizationId: "org-1",
      accessProfile: salesProfile,
      source: source(),
    });
    const rendered = JSON.stringify(response);

    expect(response?.topicId).toBe("online-requests.detail");
    expect(rendered).toContain("Verena Vertrieb");
    expect(rendered).toContain("Bitte den Winterdienst");
    expect(rendered).toContain("2");
    expect(rendered).toContain("3 Audit-Ereignisse");
    expect(rendered).toContain(
      "niemals automatisch einem bestehenden Projekt zugeordnet"
    );
    expect(rendered).toContain("nicht als Projektnummer verwendet");
    expect(rendered).not.toContain("submissionIpHash");
    expect(rendered).not.toContain("securitySignals");
  });

  it("shows a complete ready-to-convert preview without writing", async () => {
    const dataSource = source();
    const response = await resolveJarvisOnlineRequestAnalysis({
      question: "Ist OKI-20260730-A1B2C3 zur Übernahme bereit?",
      organizationId: "org-1",
      accessProfile: salesProfile,
      source: dataSource,
    });
    const rendered = JSON.stringify(response);

    expect(response?.message).toContain("für die kontrollierte Übernahme bereit");
    expect(response?.structured?.title).toContain("Übernahmeprüfung");
    expect(rendered).toContain("Übernahmebereit");
    expect(rendered).toContain("7000049 · Muster GmbH");
    expect(rendered).toContain("Verantwortlich: Verena Vertrieb");
    expect(rendered).toContain("Wunschdatum prüfen");
    expect(rendered).toContain("niemals ein Bestandsprojekt verwendet");
    expect(dataSource.load).toHaveBeenCalledTimes(1);
  });

  it("lists every blocking prerequisite instead of guessing the customer path", async () => {
    const response = await resolveJarvisOnlineRequestAnalysis({
      question: "Was blockiert die Übernahme von OKI-20260730-A1B2C3?",
      organizationId: "org-1",
      accessProfile: salesProfile,
      source: source({
        requests: [
          {
            ...request,
            status: "closed",
            customerDecision: "unresolved",
            matchedContactId: null,
            assignedUserId: null,
          },
        ],
        assigneeNames: {},
        assigneeDetails: {},
        matchedContacts: {},
      }),
    });
    const rendered = JSON.stringify(response);

    expect(response?.message).toContain("2 Voraussetzungen fehlen");
    expect(rendered).toContain("abgeschlossen und muss vor einer Übernahme");
    expect(rendered).toContain("Kundenprüfung muss eindeutig");
    expect(rendered).toContain("Kunde: noch nicht eindeutig festgelegt");
  });

  it("uses the executing authorized actor as the documented responsibility fallback", async () => {
    const response = await resolveJarvisOnlineRequestAnalysis({
      question: "Ist OKI-20260730-A1B2C3 zur Übernahme bereit?",
      organizationId: "org-1",
      accessProfile: salesProfile,
      source: source({
        requests: [{ ...request, assignedUserId: null }],
        assigneeNames: {},
        assigneeDetails: {},
      }),
    });
    const rendered = JSON.stringify(response);

    expect(response?.message).toContain("für die kontrollierte Übernahme bereit");
    expect(rendered).toContain(
      "Ausführende berechtigte Person (automatischer Fallback)"
    );
  });

  it("shows the organization-bound standard project identity after conversion", async () => {
    const response = await resolveJarvisOnlineRequestAnalysis({
      question: "Fasse OKI-20260730-A1B2C3 zusammen.",
      organizationId: "org-1",
      accessProfile: salesProfile,
      source: source({
        requests: [
          {
            ...request,
            status: "converted",
            convertedProjectId: "project-1",
          },
        ],
        convertedProjects: {
          "project-1": {
            projectNumber: "GLR-449",
            title: "Projekt GLR-449 - Glasreinigung",
          },
        },
      }),
    });
    const rendered = JSON.stringify(response);

    expect(rendered).toContain("GLR-449");
    expect(rendered).toContain("Projekt GLR-449 - Glasreinigung");
    expect(rendered).toContain("OKI-Referenz bleibt");
  });

  it("does not fall back to another organization's request when a reference is absent", async () => {
    const response = await resolveJarvisOnlineRequestAnalysis({
      question: "Fasse OKI-20260730-FFFFFF zusammen.",
      organizationId: "org-1",
      accessProfile: salesProfile,
      source: source({ requests: [] }),
    });

    expect(response?.message).toContain(
      "wurde in deiner Organisation nicht gefunden"
    );
  });

  it("refuses employees before any online request is loaded", async () => {
    const dataSource = source();
    const response = await resolveJarvisOnlineRequestAnalysis({
      question: "Wie viele neue Online-Anfragen gibt es?",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "employee",
        role: Role.MITARBEITER,
      }),
      source: dataSource,
    });

    expect(response?.type).toBe("refusal");
    expect(dataSource.load).not.toHaveBeenCalled();
  });

  it("uses the narrower role while management impersonates an employee", async () => {
    const dataSource = source();
    const response = await resolveJarvisOnlineRequestAnalysis({
      question: "Zeig mir die offenen Online-Anfragen.",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile(
        { id: "admin", role: Role.ADMIN },
        { id: "employee", role: Role.MITARBEITER }
      ),
      source: dataSource,
    });

    expect(response?.type).toBe("refusal");
    expect(dataSource.load).not.toHaveBeenCalled();
  });
});
