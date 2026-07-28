import {
  buildCatalogPerformance,
  type CatalogPerformanceInvoice,
  type CatalogPerformanceRow,
} from "@/lib/analytics/catalog-performance";

export type ProjectMaterialIssue = {
  id: string;
  severity: "critical" | "warning";
  area: string;
  title: string;
  evidence: string;
  recommendation: string;
};

export type ProjectMaterialInventoryMovement = {
  catalogItemId: string;
  movementType: string;
  quantityDelta: number;
  invoiceId: string;
};

export type ProjectMaterialAnalysis = {
  finalInvoiceCount: number;
  materialPositionCount: number;
  packagePositionCount: number;
  materials: CatalogPerformanceRow[];
  inventoryMatchedMaterialCount: number;
  inventoryComparedMaterialCount: number;
  issues: ProjectMaterialIssue[];
  checkedRules: string[];
  basisNote: string;
};

type ProjectMaterialAnalysisInput = {
  invoices: CatalogPerformanceInvoiceWithStatus[];
  inventoryMovements: ProjectMaterialInventoryMovement[];
  includeCosts: boolean;
};

export type ProjectMaterialInvoice = CatalogPerformanceInvoice & {
  status: string;
};

type CatalogPerformanceInvoiceWithStatus = ProjectMaterialInvoice;

const INACTIVE_OR_UNFINISHED_STATUSES = [
  "entwurf",
  "storniert",
  "stornorechnung",
  "geloscht",
  "geloescht",
  "deleted",
];

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function finite(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundedQuantity(value: number) {
  return Math.round(value * 1000) / 1000;
}

function isFinishedInvoice(invoice: CatalogPerformanceInvoiceWithStatus) {
  const status = normalize(invoice.status);
  const compactStatus = status.replace(/[^a-z]/g, "");
  const deletedMarker = /^gel.*scht$/.test(compactStatus);
  return (
    !deletedMarker &&
    !INACTIVE_OR_UNFINISHED_STATUSES.includes(status)
  );
}

function materialPositionCount(invoices: CatalogPerformanceInvoice[]) {
  return invoices.reduce(
    (sum, invoice) =>
      sum +
      invoice.lines.filter((line) => line.catalogType === "article").length,
    0
  );
}

function packagePositionCount(invoices: CatalogPerformanceInvoice[]) {
  return invoices.reduce(
    (sum, invoice) =>
      sum +
      invoice.lines.filter((line) => line.catalogType === "package").length,
    0
  );
}

export function analyzeProjectMaterials(
  input: ProjectMaterialAnalysisInput
): ProjectMaterialAnalysis {
  const finalInvoices = input.invoices.filter(isFinishedInvoice);
  const performance = buildCatalogPerformance(finalInvoices, []);
  const materials = performance.materialRows;
  const stableMaterialRows = materials.filter(
    (row) =>
      row.id.trim() &&
      row.details.some((detail) => detail.catalogItemId === row.id)
  );
  const movementsByItem = new Map<string, number>();

  for (const movement of input.inventoryMovements) {
    if (!["sale", "reversal"].includes(normalize(movement.movementType))) {
      continue;
    }
    movementsByItem.set(
      movement.catalogItemId,
      finite(movementsByItem.get(movement.catalogItemId)) +
        finite(movement.quantityDelta)
    );
  }

  const mismatches = stableMaterialRows.flatMap((material) => {
    const bookedWithdrawal = Math.max(
      0,
      -finite(movementsByItem.get(material.id))
    );
    const difference = roundedQuantity(material.quantity - bookedWithdrawal);
    if (Math.abs(difference) < 0.001) return [];
    return [{
      material,
      billedQuantity: roundedQuantity(material.quantity),
      bookedWithdrawal: roundedQuantity(bookedWithdrawal),
      difference,
    }];
  });
  const packageLinesWithoutSnapshot = finalInvoices.reduce(
    (sum, invoice) =>
      sum +
      invoice.lines.filter(
        (line) =>
          line.catalogType === "package" &&
          (!Array.isArray(line.packageComponentsSnapshot) ||
            line.packageComponentsSnapshot.length === 0)
      ).length,
    0
  );
  const materialLinesWithoutCostSnapshot = input.includeCosts
    ? finalInvoices.reduce(
        (sum, invoice) =>
          sum +
          invoice.lines.filter(
            (line) =>
              ["article", "package"].includes(line.catalogType ?? "") &&
              !line.costSnapshotAt
          ).length,
        0
      )
    : 0;
  const issues: ProjectMaterialIssue[] = [];

  if (mismatches.length > 0) {
    const examples = mismatches
      .slice(0, 3)
      .map(
        ({ material, billedQuantity, bookedWithdrawal }) =>
          `${material.title}: ${billedQuantity} ${material.unit || "Einheiten"} abgerechnet, ${bookedWithdrawal} ${material.unit || "Einheiten"} als Lagerentnahme gebucht`
      )
      .join("; ");
    issues.push({
      id: "project-material-inventory-mismatch",
      severity: "warning",
      area: "Material & Lager",
      title: "Abgerechnete Materialmenge und Lagerbuchung stimmen nicht überein",
      evidence:
        `${mismatches.length} Material/Materialien weichen zwischen den fertigen Rechnungspositionen und den zugehörigen Lagerbewegungen ab. ${examples}.`,
      recommendation:
        "Öffne die betroffenen fertigen Rechnungen und anschließend die Lagerbewegungshistorie der genannten Artikel. Prüfe, ob alte Rechnungen vor Einführung der Lagerautomatik liegen oder ob eine Materialentnahme beziehungsweise Gegenbuchung fehlt. Ändere Lager oder Rechnung nicht ungeprüft.",
    });
  }

  if (packageLinesWithoutSnapshot > 0) {
    issues.push({
      id: "project-package-material-snapshot-missing",
      severity: "warning",
      area: "Material & Pakete",
      title: "Historische Paketbestandteile sind nicht vollständig gespeichert",
      evidence:
        `Bei ${packageLinesWithoutSnapshot} abgerechneter Paketposition/abgerechneten Paketpositionen fehlt die gespeicherte Zusammensetzung zum Rechnungszeitpunkt. JARVIS kann die damaligen Materialmengen deshalb nicht zuverlässig aus der heutigen Paketzusammensetzung ableiten.`,
      recommendation:
        "Bewerte die alte Paketposition anhand der ursprünglichen Rechnung und vorhandener Leistungsnachweise. Übernimm die heutige Paketzusammensetzung nicht ungeprüft als historischen Verbrauch.",
    });
  }

  if (materialLinesWithoutCostSnapshot > 0) {
    issues.push({
      id: "project-material-cost-snapshot-missing",
      severity: "warning",
      area: "Materialkosten",
      title: "Historische Materialkosten sind nicht vollständig belegbar",
      evidence:
        `Bei ${materialLinesWithoutCostSnapshot} Material- oder Paketposition/Material- oder Paketpositionen fehlt ein gespeicherter Kostenstand zum Rechnungszeitpunkt. Eine heutige Einkaufspreisangabe wäre kein verlässlicher Ersatz für die damaligen Kosten.`,
      recommendation:
        "Verwende für eine wirtschaftliche Bewertung nur gespeicherte historische Kosten oder anderweitig belegte damalige Einkaufspreise. Überschreibe alte Rechnungen nicht mit heutigen Stammdatenpreisen.",
    });
  }

  return {
    finalInvoiceCount: finalInvoices.length,
    materialPositionCount: materialPositionCount(finalInvoices),
    packagePositionCount: packagePositionCount(finalInvoices),
    materials,
    inventoryMatchedMaterialCount:
      stableMaterialRows.length - mismatches.length,
    inventoryComparedMaterialCount: stableMaterialRows.length,
    issues,
    checkedRules: [
      "Jede Rechnungsposition wird einzeln ausgewertet; gleiche Positionen werden nicht anhand ihres Namens entfernt.",
      "Materialbestandteile aus Paketen zählen nur aus der zum Rechnungszeitpunkt gespeicherten Paketzusammensetzung.",
      "Abgerechnete Materialmengen werden getrennt mit den automatischen Lagerentnahmen verglichen.",
      ...(input.includeCosts
        ? ["Historische Materialkosten werden nur aus gespeicherten Kostenständen bewertet."]
        : []),
    ],
    basisNote:
      "Die Auswertung zeigt abgerechnete Materialmengen und systemseitige Lagerentnahmen. Sie beweist keinen tatsächlichen physischen Verbrauch auf der Baustelle, solange dieser nicht separat erfasst wurde.",
  };
}
