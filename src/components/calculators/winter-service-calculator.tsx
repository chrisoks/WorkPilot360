"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  WinterServiceCalculationInput,
  WinterServiceCalculationResult,
  WinterServiceVariantResult,
} from "@/lib/winter-service/calculation";
import type {
  WinterServiceCustomerFrequencyMetric,
  WinterServiceFrequencyAnalytics,
} from "@/lib/winter-service/analytics";
import { isWinterServicePackageForSelection } from "@/lib/winter-service/package-identity";
import styles from "./winter-service-calculator.module.css";

type CustomerOption = { id: string; label: string };
type ProjectOption = {
  id: string;
  contactId: string;
  label: string;
  projectNumber: string;
  title: string;
  customerLabel: string;
};
type OfferOption = { id: string; projectId: string; offerNumber: string; status: string };
type CatalogMasterOption = {
  id: string;
  number: string;
  name: string;
  type: "article" | "service" | "package";
  unit: string;
  purchasePrice: number;
  salesPrice: number;
  vatRate: number;
};
type ExistingWinterPackageOption = {
  id: string;
  number: string;
  name: string;
  description: string;
  matchcode: string;
  unit: string;
  salesPrice: number;
  vatRate: number;
  componentNumbers: string[];
};
type VariantKey = "mixed" | "spreading" | "spreadingAndPlowing";
const variantServiceNumbers: Record<VariantKey, string> = {
  mixed: "OKI0400",
  spreading: "OKI0402",
  spreadingAndPlowing: "OKI0401",
};
const variantNames: Record<VariantKey, string> = {
  mixed: "Pauschalpreis pro Einsatz",
  spreading: "Winterdienst - Streuen",
  spreadingAndPlowing: "Winterdienst - Streuen und Schieben",
};
type InventoryAnalytics = {
  item: { id: string; number: string; name: string; unit: string; stockQuantity: number | null };
  season: { label: string };
  summary: { purchasedKg: number; soldKg: number; differenceKg: number; stockQuantity: number };
  customers: Array<{ customerId: string; customerName: string; soldKg: number }>;
  movements: Array<{
    id: string;
    movementType: string;
    quantityDelta: number;
    occurredAt: string;
    supplierName: string;
    referenceNumber: string;
    note: string;
  }>;
};
export type WinterServiceOfferTransfer = {
  projectId: string;
  offerId: string;
  packageItems: Array<{
    id: string;
    name: string;
    description: string;
    unit: string;
    salesPrice: number;
    vatRate: number;
  }>;
};

const initialInput: WinterServiceCalculationInput = {
  areaSqm: 500,
  readinessPricePerSqmPerMonth: 0.085,
  seasonMonths: 7,
  expectedDeployments: 20,
  baseServiceMinutes: 45,
  laborSalesRatePerHour: 120,
  saltGramsPerSqm: 45,
  saltSalesPricePerKg: 0.65,
  plowTimeIncreasePercent: 25,
  plowSaltIncreasePercent: 50,
  mixedSpreadingPercent: 65,
  mixedPlowingPercent: 35,
};

const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const number = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });

export function WinterServiceCalculator({
  actorId,
  customers,
  projects,
  offers,
  catalogMasters,
  existingWinterPackages,
  onPrepareOffer,
  onTransferToOffer,
  onCancelOfferPreparation,
}: {
  actorId: string;
  customers: CustomerOption[];
  projects: ProjectOption[];
  offers: OfferOption[];
  catalogMasters: CatalogMasterOption[];
  existingWinterPackages: ExistingWinterPackageOption[];
  onPrepareOffer: (selection: { projectId: string; offerId: string }) => boolean;
  onTransferToOffer: (transfer: WinterServiceOfferTransfer) => void;
  onCancelOfferPreparation: () => void;
}) {
  const [input, setInput] = useState(initialInput);
  const [customerId, setCustomerId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<WinterServiceCalculationResult | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [isProjectSearchOpen, setIsProjectSearchOpen] = useState(false);
  const [offerId, setOfferId] = useState("new");
  const [selectedVariants, setSelectedVariants] = useState<VariantKey[]>(["mixed"]);
  const [creationStage, setCreationStage] = useState("");
  const [completionNotice, setCompletionNotice] = useState("");
  const [lastTransferSignature, setLastTransferSignature] = useState("");
  const [packageNamingDraft, setPackageNamingDraft] = useState<Partial<Record<VariantKey, string>> | null>(null);
  const [packageNamingError, setPackageNamingError] = useState("");
  const offerCreationLock = useRef(false);
  const [inventory, setInventory] = useState<InventoryAnalytics | null>(null);
  const [receipt, setReceipt] = useState({
    quantity: 0,
    unitCost: 0,
    occurredAt: new Date().toISOString().slice(0, 10),
    supplierName: "",
    referenceNumber: "",
    note: "",
  });
  const [analytics, setAnalytics] = useState<WinterServiceFrequencyAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState("");
  const selectedProject = useMemo(() => projects.find((project) => project.id === projectId) ?? null, [projectId, projects]);
  const matchingExistingPackages = useMemo(() => {
    if (!selectedProject) return [];
    return existingWinterPackages.filter((item) =>
      isWinterServicePackageForSelection({
        packageName: item.name,
        packageDescription: item.description,
        packageMatchcode: item.matchcode,
        projectNumber: selectedProject.projectNumber,
        customerId: selectedProject.contactId,
        customerDisplayName: selectedProject.customerLabel,
      })
    );
  }, [existingWinterPackages, selectedProject]);
  const existingPackageByVariant = useMemo(() => {
    const result = new Map<VariantKey, ExistingWinterPackageOption>();
    for (const variant of Object.keys(variantServiceNumbers) as VariantKey[]) {
      const match = matchingExistingPackages.find((item) =>
        item.componentNumbers.includes(variantServiceNumbers[variant])
      );
      if (match) result.set(variant, match);
    }
    return result;
  }, [matchingExistingPackages]);
  const matchingProjects = useMemo(() => {
    const term = projectSearch.trim().toLocaleLowerCase("de");
    if (!term) return projects.slice(0, 8);
    return projects
      .filter((project) =>
        [project.label, project.customerLabel, project.projectNumber, project.title]
          .join(" ")
          .toLocaleLowerCase("de")
          .includes(term)
      )
      .slice(0, 12);
  }, [projectSearch, projects]);
  const projectOffers = useMemo(
    () => offers.filter((offer) => offer.projectId === projectId),
    [offers, projectId]
  );
  const transferSignature = useMemo(
    () =>
      [
        projectId,
        offerId,
        [...selectedVariants].sort().join(","),
        result ? JSON.stringify(result.variants) : "",
      ].join("|"),
    [offerId, projectId, result, selectedVariants]
  );
  const transferAlreadyCompleted =
    Boolean(lastTransferSignature) && lastTransferSignature === transferSignature;
  const customerMetric = useMemo(
    () => analytics?.customers.find((customer) => customer.customerId === customerId) ?? null,
    [analytics, customerId]
  );

  useEffect(() => {
    const controller = new AbortController();
    async function loadAnalytics() {
      try {
        const response = await fetch(
          `/api/winter-service-analytics?actorId=${encodeURIComponent(actorId)}`,
          { cache: "no-store", signal: controller.signal }
        );
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Erfahrungswerte konnten nicht geladen werden.");
        setAnalytics(payload);
        setAnalyticsError("");
      } catch (reason) {
        if (controller.signal.aborted) return;
        setAnalyticsError(
          reason instanceof Error ? reason.message : "Erfahrungswerte konnten nicht geladen werden."
        );
      }
    }
    void loadAnalytics();
    return () => controller.abort();
  }, [actorId]);

  async function loadInventory() {
    try {
      const response = await fetch(`/api/catalog-inventory?actorId=${encodeURIComponent(actorId)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Lagerkennzahlen konnten nicht geladen werden.");
      setInventory(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Lagerkennzahlen konnten nicht geladen werden.");
    }
  }

  useEffect(() => {
    async function synchronizeAndLoadInventory() {
      await fetch("/api/catalog-inventory/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId }),
      }).catch(() => null);
      await loadInventory();
    }
    void synchronizeAndLoadInventory();
  }, [actorId]);

  function updateNumber(key: keyof WinterServiceCalculationInput, value: string) {
    setInput((current) => ({ ...current, [key]: value === "" ? 0 : Number(value) }));
  }

  async function submit(action: "calculate" | "save") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/winter-service-calculations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId, action, input, customerId, projectId, note }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Kalkulation konnte nicht verarbeitet werden.");
      if (action === "calculate") {
        setResult(payload.result);
        setMessage("Alle drei Varianten wurden neu berechnet.");
      } else {
        setResult(payload.resultSnapshot);
        setMessage(`Kalkulation als Version ${payload.version} dauerhaft gespeichert.`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unbekannter Fehler.");
    } finally {
      setBusy(false);
    }
  }

  function selectProject(project: ProjectOption) {
    setProjectId(project.id);
    setCustomerId(project.contactId);
    setProjectSearch(project.label);
    setIsProjectSearchOpen(false);
    setOfferId("new");
  }

  function toggleVariant(variant: VariantKey) {
    setSelectedVariants((current) => {
      if (variant === "mixed") return ["mixed"];
      const withoutMixed = current.filter((entry) => entry !== "mixed");
      if (withoutMixed.includes(variant)) {
        return withoutMixed.length > 1
          ? withoutMixed.filter((entry) => entry !== variant)
          : withoutMixed;
      }
      return [...withoutMixed, variant];
    });
  }

  async function bookReceipt() {
    if (!inventory?.item.id || receipt.quantity <= 0) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/catalog-inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId,
          catalogItemId: inventory.item.id,
          ...receipt,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Zubuchung konnte nicht gespeichert werden.");
      setMessage(`${number.format(receipt.quantity)} kg Streugut wurden zugebucht.`);
      setReceipt((current) => ({ ...current, quantity: 0, referenceNumber: "", note: "" }));
      await loadInventory();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Zubuchung konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  function requestVariantTransfer() {
    if (!selectedProject || transferAlreadyCompleted || offerCreationLock.current) return;
    const variantsToCreate = selectedVariants.filter((variant) => !existingPackageByVariant.has(variant));
    if (matchingExistingPackages.length > 0 && variantsToCreate.length > 0) {
      setPackageNamingDraft(
        Object.fromEntries(
          variantsToCreate.map((variant) => [
            variant,
            `${variantNames[variant]} | ${selectedProject.customerLabel} | ${selectedProject.projectNumber}`,
          ])
        ) as Partial<Record<VariantKey, string>>
      );
      setPackageNamingError("");
      return;
    }
    void transferVariantToOffer();
  }

  function confirmPackageNames() {
    if (!packageNamingDraft) return;
    const names = Object.values(packageNamingDraft).map((name) => (name || "").trim());
    const normalizedNames = names.map((name) => name.toLocaleLowerCase("de"));
    const existingNames = new Set(
      matchingExistingPackages.map((item) => item.name.trim().toLocaleLowerCase("de"))
    );
    if (names.some((name) => !name)) {
      setPackageNamingError("Bitte für jedes neue Paket eine eindeutige Bezeichnung angeben.");
      return;
    }
    if (new Set(normalizedNames).size !== normalizedNames.length) {
      setPackageNamingError("Die neuen Paketbezeichnungen müssen sich voneinander unterscheiden.");
      return;
    }
    if (normalizedNames.some((name) => existingNames.has(name))) {
      setPackageNamingError("Diese Paketbezeichnung existiert bereits. Bitte eindeutig anders benennen.");
      return;
    }
    const confirmedNames = packageNamingDraft;
    setPackageNamingDraft(null);
    setPackageNamingError("");
    void transferVariantToOffer(confirmedNames);
  }

  async function transferVariantToOffer(
    packageNameOverrides: Partial<Record<VariantKey, string>> = {}
  ) {
    if (offerCreationLock.current) return;
    if (!result || !selectedProject || !customerId) return;
    const readiness = catalogMasters.find((item) => item.number === "OKI0455");
    const salt = catalogMasters.find((item) => item.number === "OKI0448");
    const selectedServices = selectedVariants.map((variant) =>
      catalogMasters.find((item) => item.number === variantServiceNumbers[variant])
    );
    if (!readiness || !salt || selectedServices.some((service) => !service)) {
      setError("Die Winterdienst-Stammdaten OKI0455, OKI0448 und die passende Leistung sind nicht vollständig vorhanden.");
      return;
    }
    offerCreationLock.current = true;
    if (!onPrepareOffer({ projectId, offerId })) {
      offerCreationLock.current = false;
      return;
    }

    setBusy(true);
    setCreationStage("Kalkulation wird gespeichert …");
    setError("");
    setMessage("");
    try {
      const calculationResponse = await fetch("/api/winter-service-calculations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId, action: "save", input, customerId, projectId, note }),
      });
      const calculation = await calculationResponse.json();
      if (!calculationResponse.ok) throw new Error(calculation.error || "Kalkulation konnte nicht gespeichert werden.");

      const createdPackages: Array<{
        packageItem: {
          id: string;
          name: string;
          description?: string;
          unit?: string;
          salesPrice?: number;
          vatRate?: number;
          reused?: boolean;
        };
        variant: WinterServiceVariantResult;
        reused: boolean;
      }> = [];
      for (const [index, variantKey] of selectedVariants.entries()) {
          const existingPackage = existingPackageByVariant.get(variantKey);
          const variant = result.variants[variantKey];
          if (existingPackage) {
            createdPackages.push({
              packageItem: existingPackage,
              variant,
              reused: true,
            });
            continue;
          }
          setCreationStage(
            selectedVariants.length === 2
              ? `Kundenpaket ${index + 1} von 2 wird erstellt …`
              : "Das Kundenpaket wird erstellt …"
          );
          const service = selectedServices[index]!;
          const packageResponse = await fetch("/api/catalog-items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              actorId,
              type: "package",
              numberSeries: "winter-service",
              winterServiceCustomerId: customerId,
              winterServiceProjectNumber: selectedProject.projectNumber,
              winterServiceCustomerLabel: selectedProject.customerLabel,
              winterServiceServiceNumber: variantServiceNumbers[variantKey],
              name:
                packageNameOverrides[variantKey]?.trim() ||
                `${variantNames[variantKey]} | ${selectedProject.customerLabel}`,
              category: "Winterdienst",
              trade: "Winterdienst",
              unit: "Einsatz",
              description: `Projekt ${selectedProject.projectNumber}. Kunde ${selectedProject.customerLabel}. Aus Winterdienst-Kalkulation Version ${calculation.version}.`,
              salesPrice: variant.pricePerDeployment,
              purchasePrice: 0,
              vatRate: 19,
              isActive: true,
              packageItems: [
                {
                  componentItemId: readiness.id,
                  quantity: 1,
                  position: 1,
                  priceOverride: variant.readinessAmountPerDeployment,
                  descriptionOverride: "Anteilige Bereitschaftspauschale je Einsatz",
                },
                {
                  componentItemId: salt.id,
                  quantity: variant.saltKg,
                  position: 2,
                  priceOverride: input.saltSalesPricePerKg,
                  descriptionOverride: `${number.format(variant.saltKg)} kg Streugut je Einsatz`,
                },
                {
                  componentItemId: service.id,
                  quantity: 1,
                  position: 3,
                  priceOverride: input.laborSalesRatePerHour,
                  planningMinutesOverride: Math.round(variant.serviceMinutes),
                  descriptionOverride: `${number.format(variant.serviceMinutes)} Minuten Einsatzzeit`,
                },
              ],
            }),
          });
          const packageItem = await packageResponse.json();
          if (!packageResponse.ok) {
            throw new Error(packageItem.error || `${variantNames[variantKey]} konnte nicht als Paket angelegt werden.`);
          }
          createdPackages.push({ packageItem, variant, reused: Boolean(packageItem.reused) });
      }
      setCreationStage("Pakete werden mit Kalkulation und Angebot verknüpft …");
      await Promise.all(
        createdPackages.map(({ packageItem }) =>
          fetch("/api/winter-service-calculations", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ actorId, calculationId: calculation.id, packageId: packageItem.id }),
          })
        )
      );
      onTransferToOffer({
        projectId,
        offerId,
        packageItems: createdPackages.map(({ packageItem, variant, reused }) => ({
          id: packageItem.id,
          name: packageItem.name,
          description: packageItem.description || "",
          unit: packageItem.unit || "Einsatz",
          salesPrice: reused ? packageItem.salesPrice ?? variant.pricePerDeployment : variant.pricePerDeployment,
          vatRate: packageItem.vatRate || 19,
        })),
      });
      const createdCount = createdPackages.filter((entry) => !entry.reused).length;
      const reusedCount = createdPackages.length - createdCount;
      const successText =
        createdCount > 0 && reusedCount > 0
          ? `${createdCount} Paket wurde neu angelegt und ${reusedCount} vorhandenes Paket wiederverwendet. Beide Positionen wurden in das Angebot übernommen.`
          : createdCount > 0
            ? `${createdCount === 2 ? "Beide Pakete wurden" : "Das Paket wurde"} angelegt und in das Angebot übernommen.`
            : `${reusedCount === 2 ? "Beide vorhandenen Pakete wurden" : "Das vorhandene Paket wurde"} wiederverwendet und in das Angebot übernommen.`;
      setLastTransferSignature(transferSignature);
      setMessage(successText);
      setCompletionNotice(successText);
    } catch (reason) {
      onCancelOfferPreparation();
      setError(reason instanceof Error ? reason.message : "Übernahme ins Angebot ist fehlgeschlagen.");
    } finally {
      offerCreationLock.current = false;
      setCreationStage("");
      setBusy(false);
    }
  }

  return (
    <section className={styles.page}>
      {creationStage && (
        <div className={styles.creationOverlay} role="dialog" aria-modal="true" aria-live="polite">
          <article>
            <span className={styles.creationSpinner} aria-hidden="true" />
            <p>Achtung, ich erstelle gerade das Angebot für dich.</p>
            <h2>Einen Moment bitte …</h2>
            <small>{creationStage}</small>
          </article>
        </div>
      )}
      {packageNamingDraft && (
        <div className={styles.namingOverlay} role="dialog" aria-modal="true" aria-labelledby="winter-package-naming-title">
          <article className={styles.namingModal}>
            <header>
              <div>
                <span>Dublettenschutz</span>
                <h2 id="winter-package-naming-title">Neues Paket eindeutig benennen</h2>
                <p>
                  Für diesen Kunden existieren bereits Winterdienstpakete. Benennen Sie nur die noch
                  fehlende Variante eindeutig anders.
                </p>
              </div>
              <button type="button" aria-label="Schließen" onClick={() => setPackageNamingDraft(null)}>×</button>
            </header>
            <section>
              <div className={styles.namingExisting}>
                <strong>Bereits vorhanden</strong>
                {matchingExistingPackages.map((item) => (
                  <span key={item.id}><b>{item.number}</b>{item.name}</span>
                ))}
              </div>
              {(Object.keys(packageNamingDraft) as VariantKey[]).map((variant) => (
                <label className={styles.field} key={variant}>
                  Neue Bezeichnung für „{variantNames[variant]}“
                  <input
                    value={packageNamingDraft[variant] || ""}
                    onChange={(event) =>
                      setPackageNamingDraft((current) =>
                        current ? { ...current, [variant]: event.target.value } : current
                      )
                    }
                  />
                  <em>Die Bezeichnung muss sich klar von allen vorhandenen Paketen unterscheiden.</em>
                </label>
              ))}
              {packageNamingError && <p className={`${styles.message} ${styles.error}`}>{packageNamingError}</p>}
            </section>
            <footer>
              <button type="button" className={styles.secondary} onClick={() => setPackageNamingDraft(null)}>
                Abbrechen
              </button>
              <button type="button" className={styles.primary} onClick={confirmPackageNames}>
                Eindeutig benennen und übernehmen
              </button>
            </footer>
          </article>
        </div>
      )}
      {completionNotice && (
        <div className={styles.completionToast} role="status" aria-live="polite">
          <div>
            <strong>Winterdienstpaket erfolgreich übernommen</strong>
            <span>{completionNotice}</span>
          </div>
          <button type="button" onClick={() => setCompletionNotice("")}>OK</button>
        </div>
      )}
      <header className={styles.header}>
        <p className={styles.eyebrow}>Kalkulations-Rechner</p>
        <h1>Winterdienst</h1>
        <p>Mit wenigen Angaben zu einem nachvollziehbaren Preis pro Einsatz.</p>
        <div className={styles.steps} aria-label="Ablauf">
          <span><b>1</b> Objekt angeben</span>
          <span><b>2</b> Einsatz kalkulieren</span>
          <span><b>3</b> Varianten vergleichen</span>
        </div>
      </header>

      <section className={`${styles.panel} ${styles.experiencePanel}`}>
        <div className={styles.sectionHeading}>
          <span className={styles.insightIcon} aria-hidden="true">Ø</span>
          <div>
            <h2>Erfahrungswert aus bisherigen Wintern</h2>
            <p>Gemessen wird jeder Einsatztag je Projekt in der Wintersaison Oktober bis April.</p>
          </div>
        </div>
        <label className={`${styles.field} ${styles.customerPicker}`}>
          Kunde für den Vergleich
          <select value={customerId} onChange={(event) => { setCustomerId(event.target.value); setProjectId(""); }}>
            <option value="">Gesamtdurchschnitt anzeigen</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.label}</option>)}
          </select>
          <em>Optional zum Rechnen, erforderlich zum späteren Speichern.</em>
        </label>
        {analytics && analytics.overall.deploymentCount > 0 ? (
          customerId && !customerMetric ? (
            <p className={styles.emptyMetric}>Für den ausgewählten Kunden liegen noch keine messbaren Winterdiensteinsätze vor.</p>
          ) : (
            <FrequencyKpi
              metric={customerMetric}
              overall={analytics}
              onUseAverage={(value) =>
                setInput((current) => ({ ...current, expectedDeployments: Math.max(1, Math.round(value)) }))
              }
            />
          )
        ) : analytics ? (
          <p className={styles.emptyMetric}>Für diese Kennzahl liegen noch keine messbaren Winterdiensteinsätze vor.</p>
        ) : (
          <p className={analyticsError ? styles.metricError : styles.emptyMetric}>
            {analyticsError || "Erfahrungswerte werden geladen …"}
          </p>
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <span className={styles.stepNumber}>1</span>
          <div>
            <h2>Objekt und Saison</h2>
            <p>Diese Angaben bestimmen, welcher Anteil der Saisonbereitschaft auf einen Einsatz entfällt.</p>
          </div>
        </div>
        <div className={styles.grid}>
          <NumberField label="Zu betreuende Fläche" unit="m²" help="Die gesamte zu räumende oder zu streuende Fläche." value={input.areaSqm} onChange={(v) => updateNumber("areaSqm", v)} />
          <NumberField label="Bereitschaftspreis" unit="€ / m² / Monat" help="Monatlicher Preis für Vorhaltung, Organisation und Einsatzbereitschaft." value={input.readinessPricePerSqmPerMonth} step="0.001" onChange={(v) => updateNumber("readinessPricePerSqmPerMonth", v)} />
          <NumberField label="Dauer der Saison" unit="Monate" help="In der Excel-Vorlage sind sieben Wintermonate vorgesehen." value={input.seasonMonths} onChange={(v) => updateNumber("seasonMonths", v)} />
          <NumberField label="Erwartete Einsätze" unit="Einsätze" help="Mit wie vielen Einsätzen wird in einer normalen Saison kalkuliert?" value={input.expectedDeployments} onChange={(v) => updateNumber("expectedDeployments", v)} />
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <span className={styles.stepNumber}>2</span>
          <div>
            <h2>Normalen Streueinsatz beschreiben</h2>
            <p>Geben Sie an, was ein gewöhnlicher Einsatz ohne Schneeschieben benötigt.</p>
          </div>
        </div>
        <div className={styles.grid}>
          <NumberField label="Zeit pro Einsatz" unit="Minuten" help="Gesamte Arbeits- und Maschinenzeit für einen normalen Streueinsatz." value={input.baseServiceMinutes} onChange={(v) => updateNumber("baseServiceMinutes", v)} />
          <NumberField label="Verrechnungssatz" unit="€ / Stunde" help="Verkaufspreis je eingesetzter Arbeits- beziehungsweise Maschinenstunde." value={input.laborSalesRatePerHour} step="0.01" onChange={(v) => updateNumber("laborSalesRatePerHour", v)} />
          <NumberField label="Streugut je Fläche" unit="g / m²" help="Salz- beziehungsweise Streugutmenge eines normalen Streueinsatzes." value={input.saltGramsPerSqm} step="0.1" onChange={(v) => updateNumber("saltGramsPerSqm", v)} />
          <NumberField label="Preis des Streuguts" unit="€ / kg" help="Verkaufspreis des verwendeten Streuguts pro Kilogramm." value={input.saltSalesPricePerKg} step="0.01" onChange={(v) => updateNumber("saltSalesPricePerKg", v)} />
        </div>
      </section>

      <details className={styles.advanced}>
        <summary>
          <span>
            <b>Varianten fein einstellen</b>
            <small>Optional – die empfohlenen Standardwerte sind bereits eingetragen.</small>
          </span>
          <span className={styles.expandLabel}>Einstellungen anzeigen</span>
        </summary>
        <div className={styles.advancedBody}>
          <div className={styles.explanationGrid}>
            <article>
              <b>Streuen und Schieben</b>
              <p>Benötigt standardmäßig 25 % mehr Zeit und 50 % mehr Streugut als ein reiner Streueinsatz.</p>
            </article>
            <article>
              <b>Pauschalpreis pro Einsatz</b>
              <p>Mischt beide Einsatzarten zu einem einheitlichen Kundenpreis. Standard: 65 % Streuen und 35 % Streuen mit Schieben.</p>
            </article>
          </div>
          <div className={styles.grid}>
            <NumberField label="Zusätzliche Zeit beim Schieben" unit="%" value={input.plowTimeIncreasePercent} onChange={(v) => updateNumber("plowTimeIncreasePercent", v)} />
            <NumberField label="Zusätzliches Streugut beim Schieben" unit="%" value={input.plowSaltIncreasePercent} onChange={(v) => updateNumber("plowSaltIncreasePercent", v)} />
            <NumberField label="Anteil reine Streueinsätze" unit="%" value={input.mixedSpreadingPercent} onChange={(v) => updateNumber("mixedSpreadingPercent", v)} />
            <NumberField label="Anteil Streuen und Schieben" unit="%" value={input.mixedPlowingPercent} onChange={(v) => updateNumber("mixedPlowingPercent", v)} />
          </div>
        </div>
      </details>

      <section className={styles.calculateBar}>
        <div>
          <b>Bereit für den Vergleich?</b>
          <span>Wir berechnen automatisch alle drei Winterdienst-Varianten.</span>
        </div>
        <button className={styles.primary} disabled={busy} onClick={() => submit("calculate")}>
          {busy ? "Wird berechnet …" : "Preise berechnen"}
        </button>
      </section>
      {message && <p className={styles.message}>{message}</p>}
      {error && <p className={`${styles.message} ${styles.error}`}>{error}</p>}

      {result && (
        <section className={styles.results}>
          <ResultCard title="Pauschalpreis pro Einsatz" hint="Mischkalkulation 65/35 beziehungsweise nach Ihrer Einstellung. Nur einzeln auswählbar." variant={result.variants.mixed} primary selected={selectedVariants.includes("mixed")} onSelect={() => toggleVariant("mixed")} />
          <ResultCard title="Winterdienst – Streuen" hint="Kann einzeln oder gemeinsam mit „Streuen und Schieben“ angeboten werden." variant={result.variants.spreading} selected={selectedVariants.includes("spreading")} onSelect={() => toggleVariant("spreading")} />
          <ResultCard title="Streuen und Schieben" hint="Kann einzeln oder gemeinsam mit dem reinen Streueinsatz angeboten werden." variant={result.variants.spreadingAndPlowing} selected={selectedVariants.includes("spreadingAndPlowing")} onSelect={() => toggleVariant("spreadingAndPlowing")} />
        </section>
      )}

      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <span className={styles.stepNumber}>3</span>
          <div>
            <h2>Projekt und Angebot zuordnen</h2>
            <p>Suchen Sie ein Projekt. Der Kunde wird automatisch aus dem Projekt übernommen.</p>
          </div>
        </div>
        <div className={styles.grid}>
          <label className={`${styles.field} ${styles.wide} ${styles.projectSearchField}`}>Projekt suchen
            <input
              value={projectSearch}
              onFocus={() => setIsProjectSearchOpen(true)}
              onBlur={() => setIsProjectSearchOpen(false)}
              onChange={(event) => {
                setProjectSearch(event.target.value);
                setProjectId("");
                setCustomerId("");
                setIsProjectSearchOpen(true);
              }}
              placeholder="Projekt-Nr., Projektname oder Kunde …"
            />
            {isProjectSearchOpen && !projectId && projectSearch.trim() && (
              <span className={styles.searchResults}>
                {matchingProjects.map((project) => (
                  <button
                    type="button"
                    key={project.id}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectProject(project)}
                  >
                    <b>{project.projectNumber} · {project.title}</b>
                    <small>{project.customerLabel}</small>
                  </button>
                ))}
              </span>
            )}
          </label>
          <label className={`${styles.field} ${styles.wide} ${styles.offerField}`}>Angebot
            <select value={offerId} disabled={!projectId} onChange={(event) => setOfferId(event.target.value)}>
              <option value="new">Neuen Angebotsentwurf anlegen</option>
              {projectOffers.filter((offer) => offer.status === "Entwurf").map((offer) => (
                <option key={offer.id} value={offer.id}>{offer.offerNumber} · Entwurf</option>
              ))}
            </select>
            {projectOffers.some((offer) => offer.status !== "Entwurf") && <em>Bereits versendete oder entschiedene Angebote bleiben unverändert.</em>}
          </label>
          <label className={`${styles.field} ${styles.wide}`}>Notiz
            <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optionaler Hinweis zur Kalkulation" />
          </label>
        </div>
        {selectedProject && matchingExistingPackages.length > 0 && (
          <aside className={styles.existingPackageNotice} role="alert">
            <span className={styles.existingPackageIcon} aria-hidden="true">!</span>
            <div>
              <strong>Winterdienstpakete für diesen Kunden bereits vorhanden</strong>
              <p>Die passenden Pakete werden wiederverwendet. Es werden keine doppelten Pakete angelegt.</p>
              <ul>
                {matchingExistingPackages.map((item) => (
                  <li key={item.id}>
                    <b>{item.number}</b>
                    <span>{item.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
        <div className={styles.actions}>
          <button className={styles.secondary} disabled={busy || !result || !customerId || !projectId} onClick={() => submit("save")}>Als neue Version speichern</button>
          <button className={styles.primary} disabled={busy || !result || !projectId || selectedVariants.length === 0 || transferAlreadyCompleted} onClick={requestVariantTransfer}>
            {transferAlreadyCompleted
              ? "Bereits in das Angebot übernommen"
              : selectedVariants.every((variant) => existingPackageByVariant.has(variant))
                ? selectedVariants.length === 2
                  ? "Vorhandene Pakete ins Angebot übernehmen"
                  : "Vorhandenes Paket ins Angebot übernehmen"
              : selectedVariants.length === 2
                ? "Beide Varianten als Pakete übernehmen"
                : "Variante als Paket ins Angebot übernehmen"}
          </button>
        </div>
      </section>

      {inventory && (
        <section className={styles.panel}>
          <div className={styles.sectionHeading}>
            <span className={styles.insightIcon} aria-hidden="true">kg</span>
            <div>
              <h2>Streugut in Saison {inventory.season.label}</h2>
              <p>Verkauf enthält direkte Rechnungspositionen und Materialanteile aus Paketen.</p>
            </div>
          </div>
          <div className={styles.inventoryKpis}>
            <article><span>Eingekauft</span><strong>{number.format(inventory.summary.purchasedKg)} kg</strong></article>
            <article><span>Verkauft / verbraucht</span><strong>{number.format(inventory.summary.soldKg)} kg</strong></article>
            <article data-warning={inventory.summary.differenceKg < 0}><span>Differenz</span><strong>{number.format(inventory.summary.differenceKg)} kg</strong><small>Einkauf minus Verkauf</small></article>
            <article><span>Aktueller Lagerbestand</span><strong>{number.format(inventory.summary.stockQuantity)} kg</strong></article>
          </div>
          {customerId && (
            <p className={styles.customerSalt}>Für {selectedProject?.customerLabel || "den gewählten Kunden"} verkauft:
              <b> {number.format(inventory.customers.find((entry) => entry.customerId === customerId)?.soldKg ?? 0)} kg</b>
            </p>
          )}
          <details className={styles.advanced}>
            <summary><span><b>Streugut-Zugang buchen</b><small>Einkauf mit Datum und Beleg nachvollziehbar erfassen.</small></span><span className={styles.expandLabel}>Zubuchung öffnen</span></summary>
            <div className={styles.advancedBody}>
              <div className={styles.grid}>
                <NumberField label="Menge" unit="kg" value={receipt.quantity} step="0.01" onChange={(value) => setReceipt((current) => ({ ...current, quantity: Number(value) }))} />
                <NumberField label="Einkaufspreis" unit="€ / kg" value={receipt.unitCost} step="0.01" onChange={(value) => setReceipt((current) => ({ ...current, unitCost: Number(value) }))} />
                <label className={styles.field}>Buchungsdatum<input type="date" value={receipt.occurredAt} onChange={(event) => setReceipt((current) => ({ ...current, occurredAt: event.target.value }))} /></label>
                <label className={styles.field}>Lieferant<input value={receipt.supplierName} onChange={(event) => setReceipt((current) => ({ ...current, supplierName: event.target.value }))} /></label>
                <label className={styles.field}>Lieferschein / Beleg<input value={receipt.referenceNumber} onChange={(event) => setReceipt((current) => ({ ...current, referenceNumber: event.target.value }))} /></label>
                <label className={styles.field}>Notiz<input value={receipt.note} onChange={(event) => setReceipt((current) => ({ ...current, note: event.target.value }))} /></label>
              </div>
              <div className={styles.actions}><button className={styles.primary} type="button" disabled={busy || receipt.quantity <= 0} onClick={bookReceipt}>Menge zubuchen</button></div>
            </div>
          </details>
          <details className={styles.advanced}>
            <summary><span><b>Lagerbewegungen</b><small>Die letzten {inventory.movements.length} Buchungen.</small></span><span className={styles.expandLabel}>Historie anzeigen</span></summary>
            <div className={styles.movementList}>
              {inventory.movements.map((movement) => (
                <div key={movement.id}><time>{new Date(movement.occurredAt).toLocaleDateString("de-DE")}</time><b>{movement.quantityDelta > 0 ? "+" : ""}{number.format(movement.quantityDelta)} kg</b><span>{movement.movementType === "purchase" ? "Einkauf" : movement.movementType === "sale" ? "Rechnungsverbrauch" : "Gegenbuchung"}</span><small>{movement.referenceNumber || movement.supplierName || movement.note || "Ohne Zusatz"}</small></div>
              ))}
            </div>
          </details>
        </section>
      )}
    </section>
  );
}

function FrequencyKpi({
  metric,
  overall,
  onUseAverage,
}: {
  metric: WinterServiceCustomerFrequencyMetric | null;
  overall: WinterServiceFrequencyAnalytics;
  onUseAverage: (value: number) => void;
}) {
  const active = metric ?? overall.overall;
  const average = metric
    ? metric.averageDeploymentsPerSeason
    : overall.overall.averageDeploymentsPerCustomerSeason;
  const title = metric ? metric.customerName : "Alle Kunden";
  const basis = metric
    ? `${metric.deploymentCount} Einsätze in ${metric.seasonCount} Saison${metric.seasonCount === 1 ? "" : "s"}`
    : `${overall.overall.deploymentCount} Einsätze · ${overall.overall.customerSeasonCount} Kunden-Saisons`;

  return (
    <div className={styles.kpiArea}>
      <article className={styles.averageKpi}>
        <span>{title}</span>
        <strong>{number.format(average)}</strong>
        <b>Ø Einsätze je Saison</b>
        <small>{basis}</small>
        <button type="button" onClick={() => onUseAverage(average)}>Als Planwert übernehmen</button>
      </article>
      <div className={styles.typeKpis}>
        <article>
          <span>Nur Streuen</span>
          <strong>{active.spreading.count}</strong>
          <small>{number.format(active.spreading.sharePercent)} % der eindeutig erkannten Einsätze</small>
        </article>
        <article>
          <span>Streuen &amp; Schieben</span>
          <strong>{active.spreadingAndPlowing.count}</strong>
          <small>{number.format(active.spreadingAndPlowing.sharePercent)} % der eindeutig erkannten Einsätze</small>
        </article>
      </div>
      <p className={styles.dataBasis}>
        Einsatzart erkannt: <b>{active.typedDeploymentCount}</b> von {active.deploymentCount}.
        {active.unclassifiedDeploymentCount > 0
          ? ` ${active.unclassifiedDeploymentCount} ältere oder pauschal erfasste Einsätze bleiben nur in der Gesamthäufigkeit enthalten.`
          : " Alle Einsätze sind einer Einsatzart zugeordnet."}
      </p>
    </div>
  );
}

function NumberField({ label, unit, help, value, step = "1", onChange }: { label: string; unit: string; help?: string; value: number; step?: string; onChange: (value: string) => void }) {
  return <label className={styles.field}><span className={styles.fieldLabel}>{label}{help ? <span className={styles.help} tabIndex={0} aria-label={help}>?</span> : null}</span><span className={styles.inputWrap}><input type="number" min="0" step={step} value={value} onChange={(event) => onChange(event.target.value)} /><small>{unit}</small></span>{help ? <em>{help}</em> : null}</label>;
}

function ResultCard({ title, hint, variant, primary = false, selected, onSelect }: { title: string; hint: string; variant: WinterServiceVariantResult; primary?: boolean; selected: boolean; onSelect: () => void }) {
  return <article className={styles.card} data-primary={primary} data-selected={selected}><h3>{title}</h3><p>{hint}</p><div className={styles.price}>{currency.format(variant.pricePerDeployment)}</div><dl className={styles.facts}><div><dt>Bereitschaft</dt><dd>{currency.format(variant.readinessAmountPerDeployment)}</dd></div><div><dt>Arbeitszeit</dt><dd>{number.format(variant.serviceMinutes)} Min. · {currency.format(variant.laborAmount)}</dd></div><div><dt>Streugut</dt><dd>{number.format(variant.saltKg)} kg · {currency.format(variant.saltAmount)}</dd></div><div><dt>Saison geplant</dt><dd>{currency.format(variant.plannedSeasonRevenue)}</dd></div></dl><div className={styles.comparison}>Vergleich „monatliche Bereitschaft + Aufwand“: {currency.format(variant.monthlyReadinessModel.plannedSeasonRevenue)} geplant.</div><button type="button" className={selected ? styles.variantSelected : styles.variantSelect} onClick={onSelect}>{selected ? "Ausgewählt" : "Diese Variante verwenden"}</button></article>;
}
