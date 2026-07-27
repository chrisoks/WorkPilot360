import { describe, expect, it } from "vitest";
import type {
  HeroActiveContact,
  HeroActiveProject,
} from "@/lib/hero/active-cutover-source";
import {
  buildHeroActiveCutoverPlan,
  HERO_ACTIVE_TARGET_STATUS,
  isHeroProjectActive,
  normalizeHeroProjectNumber,
} from "./hero-active-cutover";

const existingContact = {
  id: "contact-existing",
  customerNumber: "7000001",
  companyName: "Bestandskunde GmbH",
  firstName: null,
  lastName: null,
  email: "bestand@example.test",
  phone: null,
  mobile: null,
  postalCode: "74722",
  city: "Buchen",
};

function heroContact(
  id: string,
  number: string,
  companyName: string
): HeroActiveContact {
  return {
    id,
    nr: number,
    category: "customer",
    type: "company",
    company_name: companyName,
    address: {
      street: "Musterstraße 1",
      zipcode: "74722",
      city: "Buchen",
    },
  };
}

function heroProject(
  id: string,
  number: string,
  customerId: string,
  statusCode = 1000,
  statusName = "In Umsetzung"
): HeroActiveProject {
  return {
    id,
    project_nr: number,
    name: `Projekt ${number}`,
    customer_id: customerId,
    current_project_match_status: {
      status_code: statusCode,
      name: statusName,
    },
    company_branch: { id: "1", name: "OK immocare" },
    address: {
      street: "Musterstraße 1",
      zipcode: "74722",
      city: "Buchen",
    },
  };
}

describe("HERO active cutover", () => {
  it("normalisiert Projektnummern unabhängig von Schreibtrennzeichen", () => {
    expect(normalizeHeroProjectNumber(" ass - 123 ")).toBe("ASS123");
  });

  it("schließt abgeschlossene, archivierte und gelöschte Projekte aus", () => {
    expect(isHeroProjectActive(heroProject("1", "A-1", "c1"))).toBe(true);
    expect(
      isHeroProjectActive(heroProject("2", "A-2", "c1", 2000, "Abgeschlossen"))
    ).toBe(false);
    expect(
      isHeroProjectActive(heroProject("3", "A-3", "c1", 2100, "Archiviert"))
    ).toBe(false);
    expect(
      isHeroProjectActive({ ...heroProject("4", "A-4", "c1"), is_deleted: true })
    ).toBe(false);
  });

  it("matcht Projekte nur über die Projektnummer und plant fehlende Kunden", () => {
    const plan = buildHeroActiveCutoverPlan({
      heroProjects: [
        heroProject("p1", "ASS-100", "c1"),
        heroProject("p2", "GLR-200", "c2"),
      ],
      heroContacts: [
        heroContact("c1", "7000001", "Bestandskunde GmbH"),
        heroContact("c2", "7000002", "Neukunde GmbH"),
      ],
      workPilotContacts: [existingContact],
      workPilotProjects: [
        {
          id: "project-existing",
          projectNumber: "ASS 100",
          title: "Abweichender Titel",
          status: "Abgeschlossen",
          contactId: "contact-existing",
          projectType: null,
          projectKind: null,
          recurringBillingMode: null,
          branch: null,
        },
      ],
    });

    expect(plan.ready).toBe(true);
    expect(plan.existing).toEqual([
      {
        externalId: "p1",
        projectNumber: "ASS-100",
        localEntityId: "project-existing",
      },
    ]);
    expect(plan.projects).toHaveLength(1);
    expect(plan.projects[0]).toMatchObject({
      projectNumber: "GLR-200",
      targetProjectType: "Projekt OK immocare",
      targetBranch: "OK immocare GmbH",
    });
    expect(plan.contacts).toHaveLength(1);
    expect(plan.contacts[0].resolution.action).toBe("create");
    expect(HERO_ACTIVE_TARGET_STATUS).toBe("Lead / Klärung");
  });

  it("blockiert doppelte aktive HERO-Projektnummern", () => {
    const plan = buildHeroActiveCutoverPlan({
      heroProjects: [
        heroProject("p1", "DUP-1", "c1"),
        heroProject("p2", "DUP 1", "c1"),
      ],
      heroContacts: [heroContact("c1", "7000001", "Bestandskunde GmbH")],
      workPilotContacts: [existingContact],
      workPilotProjects: [],
    });

    expect(plan.ready).toBe(false);
    expect(
      plan.blockers.filter((blocker) =>
        blocker.message.includes("mehrfach")
      )
    ).toHaveLength(2);
  });

  it("setzt den Kundenstamm nicht zusätzlich als Ansprechpartner", () => {
    const plan = buildHeroActiveCutoverPlan({
      heroProjects: [
        {
          ...heroProject("p1", "ASS-101", "c1"),
          contact_id: "c1",
        },
      ],
      heroContacts: [heroContact("c1", "7000001", "Bestandskunde GmbH")],
      workPilotContacts: [existingContact],
      workPilotProjects: [],
    });

    expect(plan.projects[0].customerExternalId).toBe("c1");
    expect(plan.projects[0].contactPersonExternalId).toBe("");
    expect(plan.projects[0].contactPersonResolution).toBeNull();
    expect(plan.contacts).toHaveLength(1);
  });
});
