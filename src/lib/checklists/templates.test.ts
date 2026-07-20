import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({ prisma: {} }));

import {
  defaultChecklistTemplateCatalog,
  normalizeChecklistTemplateUpdate,
} from "@/lib/checklists/templates";

describe("Checklisten-Vorlagen", () => {
  it("liefert den unveränderten Startkatalog mit 31 fachlichen Vorlagen", () => {
    expect(defaultChecklistTemplateCatalog).toHaveLength(31);
    expect(defaultChecklistTemplateCatalog.filter((template) => template.status === "active"))
      .toEqual([
        expect.objectContaining({
          id: "brandschutz-rauchmelder-installation",
          handlerKey: "smoke-detector-installation-v1",
        }),
      ]);
  });

  it("verhindert die Aktivierung einer Vorlage ohne ausführbares Formular", () => {
    const planned = defaultChecklistTemplateCatalog.find((template) => !template.handlerKey)!;
    expect(() => normalizeChecklistTemplateUpdate({ status: "active" }, planned))
      .toThrow("Formular und PDF-Ausgabe");
  });

  it("erlaubt die Pflege von Metadaten, ohne den technischen Handler zu verändern", () => {
    const smoke = defaultChecklistTemplateCatalog.find((template) => Boolean(template.handlerKey))!;
    const result = normalizeChecklistTemplateUpdate({
      name: "  Rauchmelder-Nachweis  ",
      description: "  Freigegebene Vorlage  ",
      area: "Brandschutz",
      scope: "OK immocare",
      status: "active",
    }, smoke);

    expect(result).toEqual(expect.objectContaining({
      name: "Rauchmelder-Nachweis",
      description: "Freigegebene Vorlage",
      status: "active",
    }));
    expect(smoke.handlerKey).toBe("smoke-detector-installation-v1");
  });
});
