"use client";

import { useEffect, useState } from "react";

type Data = {
  offerNumber: string; customerName: string; projectNumber: string; projectTitle: string;
  netTotal: number; vatRate: number; grossTotal: number; recipientEmail: string; senderName: string;
  status: string; expiresAt: string; acceptedAt: string | null; acceptedByName: string; acceptedByRole: string;
  consentText: string; offerPdfDataUrl: string; acceptancePdfDataUrl: string | null;
};

const money = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export default function OfferAcceptanceForm({ token }: { token: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const response = await fetch(`/api/public-offer-acceptance/${token}`, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return setError(payload?.error || "Freigabe konnte nicht geladen werden.");
    setData(payload);
  }

  useEffect(() => { void load(); }, [token]);
  useEffect(() => {
    if (!data || data.status === "accepted") return;
    const timer = window.setTimeout(() => void fetch(`/api/public-offer-acceptance/${token}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "viewed" }),
    }), 3000);
    return () => window.clearTimeout(timer);
  }, [data, token]);

  async function submit() {
    setSaving(true); setError("");
    const response = await fetch(`/api/public-offer-acceptance/${token}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role, authorized, accepted }),
    });
    const payload = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) return setError(payload?.error || "Annahme konnte nicht gespeichert werden.");
    await load();
  }

  if (error && !data) return <main className="acceptance-shell"><section className="acceptance-card"><h1>Freigabe nicht verfügbar</h1><p>{error}</p></section></main>;
  if (!data) return <main className="acceptance-shell"><section className="acceptance-card"><p>Angebot wird geladen …</p></section></main>;
  const done = data.status === "accepted";
  const unavailable = data.status === "expired" || data.status === "revoked";
  return (
    <main className="acceptance-shell">
      <header className="acceptance-brand"><strong>WorkPilot360</strong><span>Digitale Angebotsfreigabe</span></header>
      <section className="acceptance-card acceptance-heading">
        <div><span className="acceptance-eyebrow">Angebot {data.offerNumber}</span><h1>{done ? "Vielen Dank für Ihren Auftrag" : "Angebot prüfen und annehmen"}</h1><p>{data.customerName} · Projekt {data.projectNumber}</p></div>
        <span className={`acceptance-status ${done ? "done" : ""}`}>{done ? "Verbindlich angenommen" : unavailable ? "Nicht mehr verfügbar" : "Zur Prüfung"}</span>
      </section>
      <section className="acceptance-grid">
        <div className="acceptance-card acceptance-document">
          <div className="acceptance-section-title"><div><h2>Ihr Angebot</h2><p>{data.projectTitle}</p></div><a href={data.offerPdfDataUrl} download={`${data.offerNumber}.pdf`}>PDF herunterladen</a></div>
          <iframe title={`Angebot ${data.offerNumber}`} src={data.offerPdfDataUrl} />
        </div>
        <aside className="acceptance-card acceptance-summary">
          <h2>Zusammenfassung</h2>
          <dl><div><dt>Netto</dt><dd>{money.format(data.netTotal)}</dd></div><div><dt>Umsatzsteuer</dt><dd>{data.vatRate.toLocaleString("de-DE")} %</dd></div><div className="total"><dt>Auftragswert brutto</dt><dd>{money.format(data.grossTotal)}</dd></div></dl>
          {done ? <div className="acceptance-confirmed"><strong>Angenommen von {data.acceptedByName}</strong><span>{data.acceptedAt ? new Date(data.acceptedAt).toLocaleString("de-DE") : ""}</span>{data.acceptancePdfDataUrl ? <a href={data.acceptancePdfDataUrl} download={`Freigabe-${data.offerNumber}.pdf`}>Freigabeprotokoll herunterladen</a> : null}</div> : unavailable ? <p>Dieser Link ist abgelaufen oder wurde durch eine neue Angebotsversion ersetzt.</p> : <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            <label>Vor- und Nachname<input value={name} onFocus={() => void fetch(`/api/public-offer-acceptance/${token}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "started" }) })} onChange={(event) => setName(event.target.value)} required /></label>
            <label>Funktion im Unternehmen (optional)<input value={role} onChange={(event) => setRole(event.target.value)} placeholder="z. B. Geschäftsführung" /></label>
            <label className="acceptance-check"><input type="checkbox" checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} /><span>Ich bin zur Erteilung dieses Auftrags berechtigt.</span></label>
            <label className="acceptance-check"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>{data.consentText}</span></label>
            {error ? <p className="acceptance-error">{error}</p> : null}
            <button disabled={saving || !authorized || !accepted || name.trim().length < 3}>{saving ? "Annahme wird dokumentiert …" : "Zahlungspflichtig beauftragen"}</button>
            <small>Die Annahme wird mit Zeitpunkt, Angebotsversion und Freigabedokument protokolliert.</small>
          </form>}
        </aside>
      </section>
    </main>
  );
}
