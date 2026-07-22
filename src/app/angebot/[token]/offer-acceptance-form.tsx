"use client";

import { useEffect, useState } from "react";

type Data = {
  offerNumber: string; customerName: string; projectNumber: string; projectTitle: string;
  netTotal: number; vatRate: number; grossTotal: number; recipientEmail: string; senderName: string;
  status: string; expiresAt: string; acceptedAt: string | null; acceptedByName: string; acceptedByRole: string;
  consentText: string; offerPdfDataUrl: string; acceptancePdfDataUrl: string | null;
  consumerFlow: boolean; withdrawalNoticeText: string; earlyPerformanceRequestText: string;
  earlyPerformanceLossText: string; earlyPerformanceRequested: boolean; withdrawalDeadline: string | null;
  withdrawnAt: string | null; withdrawnByName: string; withdrawalNoticePdfDataUrl: string | null;
  withdrawalReceiptPdfDataUrl: string | null;
};

const money = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export default function OfferAcceptanceForm({ token }: { token: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [withdrawalAcknowledged, setWithdrawalAcknowledged] = useState(false);
  const [earlyPerformanceRequested, setEarlyPerformanceRequested] = useState(false);
  const [earlyPerformanceLossAcknowledged, setEarlyPerformanceLossAcknowledged] = useState(false);
  const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);
  const [withdrawalName, setWithdrawalName] = useState("");
  const [withdrawalConfirmed, setWithdrawalConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  async function load() {
    const response = await fetch(`/api/public-offer-acceptance/${token}`, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return setError(payload?.error || "Freigabe konnte nicht geladen werden.");
    setData(payload);
    setWithdrawalName((current) => current || payload.acceptedByName || "");
  }

  useEffect(() => { void load(); }, [token]);
  useEffect(() => {
    if (!data || data.status === "accepted" || data.status === "withdrawn") return;
    const timer = window.setTimeout(() => void fetch(`/api/public-offer-acceptance/${token}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "viewed" }),
    }), 3000);
    return () => window.clearTimeout(timer);
  }, [data, token]);

  async function submit() {
    setSaving(true); setError("");
    const response = await fetch(`/api/public-offer-acceptance/${token}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        role,
        authorized,
        accepted,
        withdrawalAcknowledged,
        earlyPerformanceRequested,
        earlyPerformanceLossAcknowledged,
      }),
    });
    const payload = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) return setError(payload?.error || "Annahme konnte nicht gespeichert werden.");
    await load();
  }

  async function withdraw() {
    if (!data) return;
    setWithdrawing(true); setError("");
    const response = await fetch(`/api/public-offer-acceptance/${token}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: withdrawalName, email: data.recipientEmail, confirmed: withdrawalConfirmed }),
    });
    const payload = await response.json().catch(() => null);
    setWithdrawing(false);
    if (!response.ok) return setError(payload?.error || "Widerruf konnte nicht übermittelt werden.");
    setShowWithdrawalForm(false);
    await load();
  }

  if (error && !data) return <main className="acceptance-shell"><section className="acceptance-card"><h1>Freigabe nicht verfügbar</h1><p>{error}</p></section></main>;
  if (!data) return <main className="acceptance-shell"><section className="acceptance-card"><p>Angebot wird geladen …</p></section></main>;
  const done = data.status === "accepted";
  const withdrawn = data.status === "withdrawn";
  const unavailable = data.status === "expired" || data.status === "revoked";
  const canWithdraw = data.consumerFlow && done && data.withdrawalDeadline
    ? new Date(data.withdrawalDeadline).getTime() >= Date.now()
    : false;
  return (
    <main className="acceptance-shell">
      <header className="acceptance-brand"><strong>WorkPilot360</strong><span>Digitale Angebotsfreigabe</span></header>
      <section className="acceptance-card acceptance-heading">
        <div><span className="acceptance-eyebrow">Angebot {data.offerNumber}</span><h1>{withdrawn ? "Widerruf bestätigt" : done ? "Vielen Dank für Ihren Auftrag" : "Angebot prüfen und annehmen"}</h1><p>{data.customerName} · Projekt {data.projectNumber}</p></div>
        <span className={`acceptance-status ${done ? "done" : ""} ${withdrawn ? "withdrawn" : ""}`}>{withdrawn ? "Widerrufen" : done ? "Verbindlich angenommen" : unavailable ? "Nicht mehr verfügbar" : "Zur Prüfung"}</span>
      </section>
      <section className="acceptance-grid">
        <div className="acceptance-card acceptance-document">
          <div className="acceptance-section-title"><div><h2>Ihr Angebot</h2><p>{data.projectTitle}</p></div><a href={data.offerPdfDataUrl} download={`${data.offerNumber}.pdf`}>PDF herunterladen</a></div>
          <iframe title={`Angebot ${data.offerNumber}`} src={data.offerPdfDataUrl} />
        </div>
        <aside className="acceptance-card acceptance-summary">
          <h2>Zusammenfassung</h2>
          <dl><div><dt>Netto</dt><dd>{money.format(data.netTotal)}</dd></div><div><dt>Umsatzsteuer</dt><dd>{data.vatRate.toLocaleString("de-DE")} %</dd></div><div className="total"><dt>Auftragswert brutto</dt><dd>{money.format(data.grossTotal)}</dd></div></dl>
          {withdrawn ? <div className="acceptance-confirmed withdrawal-done"><strong>Ihr Widerruf ist eingegangen</strong><span>{data.withdrawnAt ? new Date(data.withdrawnAt).toLocaleString("de-DE") : ""}</span>{data.withdrawalReceiptPdfDataUrl ? <a href={data.withdrawalReceiptPdfDataUrl} download={`Widerruf-${data.offerNumber}.pdf`}>Widerrufsbestätigung herunterladen</a> : null}</div> : done ? <><div className="acceptance-confirmed"><strong>Angenommen von {data.acceptedByName}</strong><span>{data.acceptedAt ? new Date(data.acceptedAt).toLocaleString("de-DE") : ""}</span>{data.acceptancePdfDataUrl ? <a href={data.acceptancePdfDataUrl} download={`Freigabe-${data.offerNumber}.pdf`}>Freigabeprotokoll herunterladen</a> : null}{data.consumerFlow && data.withdrawalDeadline ? <span>Widerrufsfrist bis {new Date(data.withdrawalDeadline).toLocaleString("de-DE")}</span> : null}</div>{canWithdraw ? <div className="acceptance-withdrawal"><button type="button" className="withdrawal-trigger" onClick={() => setShowWithdrawalForm((current) => !current)}>Vertrag widerrufen</button>{showWithdrawalForm ? <form onSubmit={(event) => { event.preventDefault(); void withdraw(); }}><label>Vor- und Nachname<input value={withdrawalName} onChange={(event) => setWithdrawalName(event.target.value)} required /></label><span className="withdrawal-email">Bestätigung an {data.recipientEmail}</span><label className="acceptance-check"><input type="checkbox" checked={withdrawalConfirmed} onChange={(event) => setWithdrawalConfirmed(event.target.checked)} /><span>Ich widerrufe die Annahme des Angebots {data.offerNumber}.</span></label>{error ? <p className="acceptance-error">{error}</p> : null}<button disabled={withdrawing || withdrawalName.trim().length < 3 || !withdrawalConfirmed}>{withdrawing ? "Widerruf wird übermittelt …" : "Widerruf verbindlich absenden"}</button></form> : null}</div> : null}</> : unavailable ? <p>Dieser Link ist abgelaufen oder wurde durch eine neue Angebotsversion ersetzt.</p> : <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            <label>Vor- und Nachname<input value={name} onFocus={() => void fetch(`/api/public-offer-acceptance/${token}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "started" }) })} onChange={(event) => setName(event.target.value)} required /></label>
            <label>Funktion im Unternehmen (optional)<input value={role} onChange={(event) => setRole(event.target.value)} placeholder="z. B. Geschäftsführung" /></label>
            {data.consumerFlow ? <div className="consumer-withdrawal-info"><div><strong>14 Tage Widerrufsrecht</strong><a href={data.withdrawalNoticePdfDataUrl || "#"} download={`Widerrufsbelehrung-${data.offerNumber}.pdf`}>Belehrung & Musterformular</a></div><label className="acceptance-check"><input type="checkbox" checked={withdrawalAcknowledged} onChange={(event) => setWithdrawalAcknowledged(event.target.checked)} /><span>{data.withdrawalNoticeText}</span></label><label className="acceptance-check optional"><input type="checkbox" checked={earlyPerformanceRequested} onChange={(event) => { setEarlyPerformanceRequested(event.target.checked); if (!event.target.checked) setEarlyPerformanceLossAcknowledged(false); }} /><span>{data.earlyPerformanceRequestText} <em>Optional</em></span></label>{earlyPerformanceRequested ? <label className="acceptance-check"><input type="checkbox" checked={earlyPerformanceLossAcknowledged} onChange={(event) => setEarlyPerformanceLossAcknowledged(event.target.checked)} /><span>{data.earlyPerformanceLossText}</span></label> : null}</div> : null}
            <label className="acceptance-check"><input type="checkbox" checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} /><span>Ich bin zur Erteilung dieses Auftrags berechtigt.</span></label>
            <label className="acceptance-check"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>{data.consentText}</span></label>
            {error ? <p className="acceptance-error">{error}</p> : null}
            <button disabled={saving || !authorized || !accepted || name.trim().length < 3 || (data.consumerFlow && !withdrawalAcknowledged) || (earlyPerformanceRequested && !earlyPerformanceLossAcknowledged)}>{saving ? "Annahme wird dokumentiert …" : "Zahlungspflichtig beauftragen"}</button>
            <small>Die Annahme wird mit Zeitpunkt, Angebotsversion und Freigabedokument protokolliert.</small>
          </form>}
        </aside>
      </section>
    </main>
  );
}
