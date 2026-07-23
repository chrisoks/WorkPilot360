"use client";

import { useState } from "react";
import {
  WinterServiceCalculator,
  type WinterServiceOfferTransfer,
} from "./winter-service-calculator";
import { VehicleModule } from "./vehicle-module";
import styles from "./calculator-workspace.module.css";

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

type CalculatorView = "overview" | "winter" | "trips" | "rental" | "vehicles";

const navigation: Array<{ id: CalculatorView; label: string }> = [
  { id: "overview", label: "Übersicht" },
  { id: "winter", label: "Winterdienst" },
  { id: "trips", label: "Fahrten" },
  { id: "rental", label: "Vermietung" },
  { id: "vehicles", label: "Fahrzeuge" },
];

export function CalculatorWorkspace({
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
  const [view, setView] = useState<CalculatorView>("overview");

  return (
    <section className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <p>Kalkulations-Rechner</p>
          <h1>Kalkulationen an einem Ort</h1>
          <span>
            Winterdienst, Fahrten und künftig Mietverträge mit nachvollziehbaren Grundlagen.
          </span>
        </div>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="2.5" width="16" height="19" rx="2.5" />
          <path d="M7.5 6.5h9M8 11h1M12 11h1M16 11h1M8 15h1M12 15h1M16 15h1M8 18.5h5M16 18.5h1" />
        </svg>
      </header>

      <nav className={styles.navigation} aria-label="Kalkulationsbereiche">
        {navigation.map((item) => (
          <button
            key={item.id}
            type="button"
            data-active={view === item.id}
            onClick={() => setView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {view === "overview" ? (
        <section className={styles.overview}>
          <button type="button" onClick={() => setView("winter")}>
            <span className={styles.icon}>❄</span>
            <small>Einsatzkalkulation</small>
            <strong>Winterdienst</strong>
            <p>Bereitschaft, Arbeitszeit und Streugut in drei Angebotsvarianten rechnen.</p>
            <b>Winterdienst öffnen →</b>
          </button>
          <button type="button" onClick={() => setView("trips")}>
            <span className={styles.icon}>↗</span>
            <small>Fahrzeugkosten</small>
            <strong>Fahrten kalkulieren</strong>
            <p>Strecke, Verbrauch, Kraftstoff und Kilometerkosten ohne Personalkosten.</p>
            <b>Fahrtenrechner öffnen →</b>
          </button>
          <button type="button" onClick={() => setView("vehicles")}>
            <span className={styles.icon}>▣</span>
            <small>Stammdaten</small>
            <strong>Fahrzeuge verwalten</strong>
            <p>Crafter, Bus und weitere Fahrzeuge mit Kosten- und Mietwerten pflegen.</p>
            <b>Fahrzeuge öffnen →</b>
          </button>
          <button type="button" onClick={() => setView("rental")}>
            <span className={styles.icon}>⌁</span>
            <small>Nächster Ausbau</small>
            <strong>Vermietung</strong>
            <p>Mietkalkulation, Vertrag, Übergabe und Rückgabe auf derselben Datenbasis.</p>
            <b>Vorbereitung ansehen →</b>
          </button>
        </section>
      ) : view === "winter" ? (
        <WinterServiceCalculator
          actorId={actorId}
          customers={customers}
          projects={projects}
          offers={offers}
          catalogMasters={catalogMasters}
          existingWinterPackages={existingWinterPackages}
          onPrepareOffer={onPrepareOffer}
          onTransferToOffer={onTransferToOffer}
          onCancelOfferPreparation={onCancelOfferPreparation}
        />
      ) : (
        <VehicleModule actorId={actorId} section={view} />
      )}
    </section>
  );
}
