"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  calculateVehicleTrip,
  type VehicleTripCalculationResult,
} from "@/lib/vehicle-calculation";
import styles from "./vehicle-module.module.css";

type Vehicle = {
  id: string;
  vehicleNumber: string;
  name: string;
  licensePlate: string;
  fuelType: "DIESEL" | "E5" | "E10" | "ELECTRIC" | "HYBRID";
  consumptionLitersPer100Km: number;
  selfCostPerKm: number;
  salesPricePerKm: number;
  hourlyRentalRate: number | null;
  dailyRentalRate: number | null;
  includedKilometersPerDay: number | null;
  extraKilometerPrice: number | null;
  depositAmount: number | null;
  fuelPolicy: string;
  note: string;
  isActive: boolean;
};

type FuelPrices = {
  configured: boolean;
  status: "live" | "unavailable" | "not_configured";
  source: string;
  station: { id: string; name: string; address: string; isOpen: boolean | null };
  prices: { diesel: number | null; e5: number | null; e10: number | null };
  fetchedAt: string | null;
  message: string;
};

type VehicleCalculation = {
  id: string;
  vehicleName: string;
  vehicleNumber: string;
  inputSnapshot: unknown;
  resultSnapshot: unknown;
  fuelPriceSource: string;
  createdAt: string;
};

type VehicleDraft = Omit<Vehicle, "id">;
type FuelPriceKey = "diesel" | "e5" | "e10";

const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const number = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });

const emptyVehicle: VehicleDraft = {
  vehicleNumber: "",
  name: "",
  licensePlate: "",
  fuelType: "DIESEL",
  consumptionLitersPer100Km: 8,
  selfCostPerKm: 0.24,
  salesPricePerKm: 0.3,
  hourlyRentalRate: null,
  dailyRentalRate: null,
  includedKilometersPerDay: null,
  extraKilometerPrice: null,
  depositAmount: null,
  fuelPolicy: "Voll/Voll",
  note: "",
  isActive: true,
};

function getErrorMessage(value: unknown, fallback: string) {
  if (value && typeof value === "object" && "error" in value && typeof value.error === "string") {
    return value.error;
  }
  return fallback;
}

function nullableNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function fuelPriceForVehicle(vehicle: Vehicle | undefined, prices: FuelPrices | null) {
  if (!vehicle || !prices) return null;
  if (vehicle.fuelType === "DIESEL") return prices.prices.diesel;
  if (vehicle.fuelType === "E5") return prices.prices.e5;
  if (vehicle.fuelType === "E10" || vehicle.fuelType === "HYBRID") return prices.prices.e10;
  return 0;
}

function fuelPriceKeyForVehicle(vehicle: Vehicle | undefined): FuelPriceKey | "" {
  if (!vehicle) return "";
  if (vehicle.fuelType === "DIESEL") return "diesel";
  if (vehicle.fuelType === "E5") return "e5";
  if (vehicle.fuelType === "E10" || vehicle.fuelType === "HYBRID") return "e10";
  return "";
}

export function VehicleModule({
  actorId,
  section,
}: {
  actorId: string;
  section: "trips" | "rental" | "vehicles";
}) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fuelPrices, setFuelPrices] = useState<FuelPrices | null>(null);
  const [calculations, setCalculations] = useState<VehicleCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [distanceKm, setDistanceKm] = useState(100);
  const [fuelPrice, setFuelPrice] = useState(1.8);
  const [selectedFuelPriceKey, setSelectedFuelPriceKey] = useState<FuelPriceKey | "">("");
  const [result, setResult] = useState<VehicleTripCalculationResult | null>(null);
  const [note, setNote] = useState("");
  const [savingCalculation, setSavingCalculation] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<VehicleDraft>(emptyVehicle);
  const [savingVehicle, setSavingVehicle] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [vehicleResponse, fuelResponse, calculationResponse] = await Promise.all([
        fetch(`/api/vehicles?actorId=${encodeURIComponent(actorId)}`, { cache: "no-store" }),
        fetch(`/api/fuel-prices?actorId=${encodeURIComponent(actorId)}`, { cache: "no-store" }),
        fetch(`/api/vehicle-calculations?actorId=${encodeURIComponent(actorId)}`, {
          cache: "no-store",
        }),
      ]);
      const [vehicleData, fuelData, calculationData] = await Promise.all([
        vehicleResponse.json().catch(() => null),
        fuelResponse.json().catch(() => null),
        calculationResponse.json().catch(() => null),
      ]);
      if (!vehicleResponse.ok) throw new Error(getErrorMessage(vehicleData, "Fahrzeuge konnten nicht geladen werden."));
      if (!fuelResponse.ok) throw new Error(getErrorMessage(fuelData, "Kraftstoffpreise konnten nicht geladen werden."));
      if (!calculationResponse.ok) {
        throw new Error(getErrorMessage(calculationData, "Kalkulationshistorie konnte nicht geladen werden."));
      }
      const nextVehicles = Array.isArray(vehicleData) ? vehicleData : [];
      setVehicles(nextVehicles);
      setFuelPrices(fuelData as FuelPrices);
      setCalculations(Array.isArray(calculationData) ? calculationData : []);
      setSelectedVehicleId((current) => {
        if (nextVehicles.some((vehicle: Vehicle) => vehicle.id === current && vehicle.isActive)) {
          return current;
        }
        return nextVehicles.find((vehicle: Vehicle) => vehicle.isActive)?.id ?? "";
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Die Fahrzeugdaten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // actorId binds all reads to the current session user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId]);

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedVehicleId),
    [selectedVehicleId, vehicles]
  );

  useEffect(() => {
    const currentPrice = fuelPriceForVehicle(selectedVehicle, fuelPrices);
    if (typeof currentPrice === "number") {
      setFuelPrice(currentPrice);
      setSelectedFuelPriceKey(fuelPriceKeyForVehicle(selectedVehicle));
    } else {
      setSelectedFuelPriceKey("");
    }
    setResult(null);
  }, [fuelPrices, selectedVehicle]);

  function calculate() {
    if (!selectedVehicle) {
      setError("Bitte zuerst ein aktives Fahrzeug auswählen.");
      return;
    }
    setError("");
    try {
      setResult(
        calculateVehicleTrip({
          distanceKm,
          consumptionLitersPer100Km: selectedVehicle.consumptionLitersPer100Km,
          fuelPricePerLiter: selectedVehicle.fuelType === "ELECTRIC" ? 0 : fuelPrice,
          selfCostPerKm: selectedVehicle.selfCostPerKm,
          salesPricePerKm: selectedVehicle.salesPricePerKm,
        })
      );
    } catch (calculationError) {
      setError(
        calculationError instanceof Error
          ? calculationError.message
          : "Die Fahrt konnte nicht berechnet werden."
      );
    }
  }

  async function saveCalculation() {
    if (!selectedVehicle || !result) return;
    setSavingCalculation(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/vehicle-calculations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId,
          action: "save",
          vehicleId: selectedVehicle.id,
          input: {
            distanceKm,
            consumptionLitersPer100Km: selectedVehicle.consumptionLitersPer100Km,
            fuelPricePerLiter: selectedVehicle.fuelType === "ELECTRIC" ? 0 : fuelPrice,
            selfCostPerKm: selectedVehicle.selfCostPerKm,
            salesPricePerKm: selectedVehicle.salesPricePerKm,
          },
          fuelPriceSource: fuelPrices?.status === "live" ? fuelPrices.source : "Manuelle Eingabe",
          fuelPriceFetchedAt: fuelPrices?.status === "live" ? fuelPrices.fetchedAt : "",
          note,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getErrorMessage(data, "Kalkulation konnte nicht gespeichert werden."));
      setCalculations((current) => [data, ...current].slice(0, 20));
      setMessage("Die Fahrtenkalkulation wurde mit den verwendeten Fahrzeug- und Preiswerten gespeichert.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Kalkulation konnte nicht gespeichert werden.");
    } finally {
      setSavingCalculation(false);
    }
  }

  function startNewVehicle(useCrafterDefaults = false) {
    setEditingId("");
    setDraft(
      useCrafterDefaults
        ? {
            ...emptyVehicle,
            vehicleNumber: "FZG-001",
            name: "VW Crafter",
            fuelType: "DIESEL",
            consumptionLitersPer100Km: 8,
            selfCostPerKm: 0.24,
            salesPricePerKm: 0.3,
          }
        : { ...emptyVehicle }
    );
    setMessage("");
    setError("");
  }

  function editVehicle(vehicle: Vehicle) {
    const { id, ...values } = vehicle;
    setEditingId(id);
    setDraft(values);
    setMessage("");
    setError("");
  }

  async function saveVehicle(event: FormEvent) {
    event.preventDefault();
    setSavingVehicle(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/vehicles", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId, id: editingId, ...draft }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getErrorMessage(data, "Fahrzeug konnte nicht gespeichert werden."));
      setVehicles((current) => {
        const next = editingId
          ? current.map((vehicle) => (vehicle.id === editingId ? data : vehicle))
          : [...current, data];
        return next.sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name, "de"));
      });
      setSelectedVehicleId((current) => current || data.id);
      setEditingId(data.id);
      const { id: _savedId, ...nextDraft } = data as Vehicle;
      setDraft(nextDraft);
      setMessage(`Fahrzeug „${data.name}“ wurde gespeichert.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Fahrzeug konnte nicht gespeichert werden.");
    } finally {
      setSavingVehicle(false);
    }
  }

  if (loading) return <div className={styles.loading}>Fahrzeugmodul wird geladen …</div>;

  if (section === "rental") {
    return (
      <section className={styles.page}>
        <header className={styles.sectionHeader}>
          <p>Fahrzeugmodul</p>
          <h2>Vermietung</h2>
          <span>Die Fahrzeugstammdaten sind bereits auf Mietkalkulation und Verträge vorbereitet.</span>
        </header>
        <article className={styles.rentalRoadmap}>
          <div>
            <span>1</span>
            <strong>Mietkalkulation</strong>
            <p>Stunden, Tage, Freikilometer, Mehrkilometer und Kaution.</p>
          </div>
          <div>
            <span>2</span>
            <strong>Mietvertrag</strong>
            <p>Kunde, Fahrer, Zeitraum, Bedingungen und unterschriftsfähiges PDF.</p>
          </div>
          <div>
            <span>3</span>
            <strong>Übergabe & Rückgabe</strong>
            <p>Kilometerstand, Tankstand, Schäden, Bilder und nachvollziehbares Protokoll.</p>
          </div>
        </article>
        <p className={styles.info}>
          Dieser Bereich wird im nächsten Schritt aktiviert. Fahrzeug- und Mietpreise können bereits
          unter „Fahrzeuge“ gepflegt werden.
        </p>
      </section>
    );
  }

  if (section === "vehicles") {
    return (
      <section className={styles.page}>
        <header className={styles.sectionHeader}>
          <div>
            <p>Fahrzeugmodul</p>
            <h2>Fahrzeuge verwalten</h2>
            <span>Eine gemeinsame Datenbasis für Fahrten, Vermietung und spätere Verträge.</span>
          </div>
          <button type="button" onClick={() => startNewVehicle(vehicles.length === 0)}>
            + Fahrzeug
          </button>
        </header>
        {error ? <p className={styles.error}>{error}</p> : null}
        {message ? <p className={styles.success}>{message}</p> : null}

        <div className={styles.vehicleLayout}>
          <section className={styles.vehicleList}>
            {vehicles.length === 0 ? (
              <article className={styles.empty}>
                <strong>Noch kein Fahrzeug angelegt</strong>
                <p>Die Werte aus der Crafter-Excel stehen als sicherer Startpunkt bereit.</p>
                <button type="button" onClick={() => startNewVehicle(true)}>
                  VW Crafter vorbereiten
                </button>
              </article>
            ) : (
              vehicles.map((vehicle) => (
                <button
                  type="button"
                  key={vehicle.id}
                  data-active={editingId === vehicle.id}
                  onClick={() => editVehicle(vehicle)}
                >
                  <span>{vehicle.vehicleNumber}</span>
                  <strong>{vehicle.name}</strong>
                  <small>{vehicle.licensePlate || "Kein Kennzeichen"} · {vehicle.fuelType}</small>
                  <b data-enabled={vehicle.isActive}>{vehicle.isActive ? "Aktiv" : "Inaktiv"}</b>
                </button>
              ))
            )}
          </section>

          <form className={styles.vehicleForm} onSubmit={saveVehicle}>
            <div className={styles.formIntro}>
              <strong>{editingId ? "Fahrzeug bearbeiten" : "Neues Fahrzeug"}</strong>
              <span>Pflichtfelder sind mit * gekennzeichnet.</span>
            </div>
            <div className={styles.formGrid}>
              <label>
                Interne Fahrzeugnummer *
                <input
                  required
                  value={draft.vehicleNumber}
                  onChange={(event) => setDraft({ ...draft, vehicleNumber: event.target.value })}
                />
              </label>
              <label>
                Bezeichnung *
                <input
                  required
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </label>
              <label>
                Kennzeichen
                <input
                  value={draft.licensePlate}
                  onChange={(event) => setDraft({ ...draft, licensePlate: event.target.value })}
                />
              </label>
              <label>
                Kraftstoffart *
                <select
                  value={draft.fuelType}
                  onChange={(event) =>
                    setDraft({ ...draft, fuelType: event.target.value as Vehicle["fuelType"] })
                  }
                >
                  <option value="DIESEL">Diesel</option>
                  <option value="E5">Super E5</option>
                  <option value="E10">Super E10</option>
                  <option value="HYBRID">Hybrid</option>
                  <option value="ELECTRIC">Elektrisch</option>
                </select>
              </label>
              <label>
                Verbrauch l/100 km *
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={draft.consumptionLitersPer100Km}
                  onChange={(event) =>
                    setDraft({ ...draft, consumptionLitersPer100Km: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Selbstkosten je km *
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={draft.selfCostPerKm}
                  onChange={(event) => setDraft({ ...draft, selfCostPerKm: Number(event.target.value) })}
                />
              </label>
              <label>
                Verkaufspreis je km *
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={draft.salesPricePerKm}
                  onChange={(event) => setDraft({ ...draft, salesPricePerKm: Number(event.target.value) })}
                />
              </label>
              <label>
                Mietpreis je Stunde
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.hourlyRentalRate ?? ""}
                  onChange={(event) => setDraft({ ...draft, hourlyRentalRate: nullableNumber(event.target.value) })}
                />
              </label>
              <label>
                Mietpreis je Tag
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.dailyRentalRate ?? ""}
                  onChange={(event) => setDraft({ ...draft, dailyRentalRate: nullableNumber(event.target.value) })}
                />
              </label>
              <label>
                Freikilometer je Tag
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={draft.includedKilometersPerDay ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, includedKilometersPerDay: nullableNumber(event.target.value) })
                  }
                />
              </label>
              <label>
                Preis je Mehrkilometer
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.extraKilometerPrice ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, extraKilometerPrice: nullableNumber(event.target.value) })
                  }
                />
              </label>
              <label>
                Kaution
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.depositAmount ?? ""}
                  onChange={(event) => setDraft({ ...draft, depositAmount: nullableNumber(event.target.value) })}
                />
              </label>
              <label>
                Tankregelung
                <input
                  value={draft.fuelPolicy}
                  onChange={(event) => setDraft({ ...draft, fuelPolicy: event.target.value })}
                />
              </label>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })}
                />
                Fahrzeug aktiv
              </label>
              <label className={styles.full}>
                Notiz
                <textarea
                  value={draft.note}
                  onChange={(event) => setDraft({ ...draft, note: event.target.value })}
                />
              </label>
            </div>
            <footer>
              <button type="button" className={styles.secondary} onClick={() => startNewVehicle(false)}>
                Eingaben leeren
              </button>
              <button type="submit" disabled={savingVehicle}>
                {savingVehicle ? "Wird gespeichert …" : "Fahrzeug speichern"}
              </button>
            </footer>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <header className={styles.sectionHeader}>
        <p>Fahrzeugkosten</p>
        <h2>Fahrten kalkulieren</h2>
        <span>Nur Fahrzeug- und Kraftstoffkosten – bewusst ohne Personalkosten.</span>
      </header>
      {error ? <p className={styles.error}>{error}</p> : null}
      {message ? <p className={styles.success}>{message}</p> : null}

      <section className={styles.fuelPanel}>
        <div className={styles.fuelHeading}>
          <div>
            <strong>Aktuelle Kraftstoffpreise</strong>
            <span>{fuelPrices?.station.address || "HERM in Buchen"}</span>
          </div>
          <small data-status={fuelPrices?.status}>
            {fuelPrices?.status === "live"
              ? `Aktualisiert ${new Date(fuelPrices.fetchedAt || "").toLocaleString("de-DE")}`
              : fuelPrices?.message}
          </small>
        </div>
        <div className={styles.fuelCards}>
          {([
            ["diesel", "Diesel", fuelPrices?.prices.diesel],
            ["e5", "Super E5", fuelPrices?.prices.e5],
            ["e10", "Super E10", fuelPrices?.prices.e10],
          ] satisfies Array<[FuelPriceKey, string, number | null | undefined]>).map(([key, label, price]) => (
            <button
              type="button"
              key={key}
              disabled={typeof price !== "number"}
              data-selected={selectedFuelPriceKey === key}
              aria-pressed={selectedFuelPriceKey === key}
              onClick={() => {
                if (typeof price !== "number") return;
                setFuelPrice(price);
                setSelectedFuelPriceKey(key);
                setResult(null);
              }}
            >
              <span>{label}</span>
              <strong>{typeof price === "number" ? `${price.toFixed(3)} €` : "–"}</strong>
              <small>
                {selectedFuelPriceKey === key
                  ? "✓ Ausgewählt · in der Kalkulation verwendet"
                  : "pro Liter · in Kalkulation übernehmen"}
              </small>
            </button>
          ))}
        </div>
        <p>
          Quelle: Tankerkönig / MTS-K. Live-Preise dienen als Kalkulationshilfe und können
          jederzeit manuell überschrieben werden.
        </p>
      </section>

      <section className={styles.tripPanel}>
        <div className={styles.tripInputs}>
          <div className={styles.stepTitle}>
            <span>1</span>
            <div>
              <strong>Fahrt eingeben</strong>
              <p>Fahrzeug und gesamte Strecke für Hin- und Rückfahrt auswählen.</p>
            </div>
          </div>
          {vehicles.filter((vehicle) => vehicle.isActive).length === 0 ? (
            <p className={styles.warning}>
              Es ist noch kein aktives Fahrzeug angelegt. Bitte zuerst unter „Fahrzeuge“ einen
              Crafter, Bus oder ein anderes Fahrzeug erfassen.
            </p>
          ) : (
            <div className={styles.tripGrid}>
              <label>
                Fahrzeug
                <select
                  value={selectedVehicleId}
                  onChange={(event) => setSelectedVehicleId(event.target.value)}
                >
                  {vehicles
                    .filter((vehicle) => vehicle.isActive)
                    .map((vehicle) => (
                      <option value={vehicle.id} key={vehicle.id}>
                        {vehicle.vehicleNumber} · {vehicle.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Gesamtstrecke in km
                <input
                  type="number"
                  min="0.01"
                  step="0.1"
                  value={distanceKm}
                  onChange={(event) => {
                    setDistanceKm(Number(event.target.value));
                    setResult(null);
                  }}
                />
              </label>
              <label>
                Kraftstoffpreis je Liter
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={fuelPrice}
                  disabled={selectedVehicle?.fuelType === "ELECTRIC"}
                  onChange={(event) => {
                    setFuelPrice(Number(event.target.value));
                    setSelectedFuelPriceKey("");
                    setResult(null);
                  }}
                />
                <small>Automatisch vorbelegt, aber frei änderbar.</small>
              </label>
              <label>
                Verbrauch
                <input readOnly value={`${number.format(selectedVehicle?.consumptionLitersPer100Km ?? 0)} l/100 km`} />
                <small>Aus dem Fahrzeugstamm.</small>
              </label>
              <label>
                Selbstkosten je km
                <input readOnly value={currency.format(selectedVehicle?.selfCostPerKm ?? 0)} />
              </label>
              <label>
                Verkaufspreis je km
                <input readOnly value={currency.format(selectedVehicle?.salesPricePerKm ?? 0)} />
              </label>
            </div>
          )}
          <button
            type="button"
            className={styles.calculate}
            disabled={!selectedVehicle}
            onClick={calculate}
          >
            Fahrt berechnen
          </button>
        </div>

        <div className={styles.tripResults}>
          <div className={styles.stepTitle}>
            <span>2</span>
            <div>
              <strong>Ergebnis</strong>
              <p>Aufschlag und echte Marge werden bewusst getrennt ausgewiesen.</p>
            </div>
          </div>
          {!result ? (
            <div className={styles.resultEmpty}>Nach der Berechnung erscheinen hier alle Kosten und Preise.</div>
          ) : (
            <>
              <div className={styles.resultCards}>
                <article>
                  <span>Kraftstoff</span>
                  <strong>{currency.format(result.fuelCost)}</strong>
                  <small>{number.format(result.fuelLiters)} Liter</small>
                </article>
                <article>
                  <span>Gesamte Selbstkosten</span>
                  <strong>{currency.format(result.totalSelfCost)}</strong>
                  <small>inklusive Kraftstoff</small>
                </article>
                <article data-primary>
                  <span>Verkaufspreis Fahrt</span>
                  <strong>{currency.format(result.totalSales)}</strong>
                  <small>Kraftstoff + Kilometer-VK</small>
                </article>
                <article>
                  <span>Gewinn</span>
                  <strong>{currency.format(result.profit)}</strong>
                  <small>{number.format(result.markupPercent)} % Aufschlag</small>
                </article>
              </div>
              <dl className={styles.resultDetails}>
                <div><dt>Fahrzeug-Selbstkosten</dt><dd>{currency.format(result.vehicleSelfCost)}</dd></div>
                <div><dt>Fahrzeug-Verkauf</dt><dd>{currency.format(result.vehicleSales)}</dd></div>
                <div><dt>Aufschlag auf Selbstkosten</dt><dd>{number.format(result.markupPercent)} %</dd></div>
                <div><dt>Echte Marge vom Verkauf</dt><dd>{number.format(result.marginPercent)} %</dd></div>
              </dl>
              <label className={styles.note}>
                Notiz zur Kalkulation
                <textarea value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
              <button
                type="button"
                className={styles.calculate}
                disabled={savingCalculation}
                onClick={saveCalculation}
              >
                {savingCalculation ? "Wird gespeichert …" : "Kalkulation speichern"}
              </button>
            </>
          )}
        </div>
      </section>

      {calculations.length > 0 ? (
        <section className={styles.history}>
          <h3>Zuletzt gespeicherte Fahrtenkalkulationen</h3>
          <div>
            {calculations.slice(0, 8).map((calculation) => {
              const input = calculation.inputSnapshot as { distanceKm?: number };
              const savedResult = calculation.resultSnapshot as { totalSales?: number };
              return (
                <article key={calculation.id}>
                  <strong>{calculation.vehicleNumber} · {calculation.vehicleName}</strong>
                  <span>{number.format(input.distanceKm ?? 0)} km</span>
                  <b>{currency.format(savedResult.totalSales ?? 0)}</b>
                  <small>{new Date(calculation.createdAt).toLocaleString("de-DE")}</small>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </section>
  );
}
