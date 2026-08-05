"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./sales-journal-workspace.module.css";

type SalesJournalContact = {
  id: string;
  label: string;
};

type SalesJournalUser = {
  id: string;
  name: string;
};

type SalesJournalEntry = {
  id: string;
  activityType: string;
  activityLabel: string;
  customerId: string;
  customerName: string;
  note: string;
  actorUserId: string;
  actorName: string;
  occurredAt: string;
  source: "manual" | "phone" | "offer" | "potential";
  isSystemGenerated: boolean;
  countsAsActivity: boolean;
  referenceId?: string;
};

type SalesJournalResponse = {
  entries: SalesJournalEntry[];
  scope: "all" | "own";
  canReadAll: boolean;
};

type ActivityDraft = {
  customerId: string;
  activityType: string;
  note: string;
};

const activityOptions = [
  { value: "call", label: "Telefonat" },
  { value: "email", label: "E-Mail" },
  { value: "customer_meeting", label: "Kundentermin" },
  { value: "offer", label: "Angebot" },
  { value: "offer_follow_up", label: "Angebot nachgefasst" },
  { value: "other", label: "Sonstige Vertriebsaktivität" },
];

const emptyDraft: ActivityDraft = { customerId: "", activityType: "call", note: "" };

function formatDay(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const key = date.toLocaleDateString("de-DE");
  if (key === today.toLocaleDateString("de-DE")) return "Heute";
  if (key === yesterday.toLocaleDateString("de-DE")) return "Gestern";
  return new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(date);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function dateKey(value: string) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date(value));
}

function sourceLabel(source: SalesJournalEntry["source"]) {
  if (source === "phone") return "OKS Phone";
  if (source === "offer") return "Angebot";
  if (source === "potential") return "Zusatzverkauf";
  return "Manuell";
}

export function SalesJournalWorkspace({
  actorId,
  actorRole,
  contacts,
  users,
}: {
  actorId: string;
  actorRole: string;
  contacts: SalesJournalContact[];
  users: SalesJournalUser[];
}) {
  const [entries, setEntries] = useState<SalesJournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState("30");
  const [employeeId, setEmployeeId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [activityType, setActivityType] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<ActivityDraft>(emptyDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const canReadAll = actorRole === "GESCHAEFTSFUEHRER";

  async function loadEntries() {
    if (!actorId) return;
    setIsLoading(true);
    setError("");
    const params = new URLSearchParams({ actorId, days });
    if (canReadAll && employeeId) params.set("employeeId", employeeId);
    if (customerId) params.set("customerId", customerId);
    if (activityType) params.set("activityType", activityType);
    try {
      const response = await fetch(`/api/sales-journal?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Sales-Journal konnte nicht geladen werden.");
      setEntries((payload as SalesJournalResponse).entries || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Sales-Journal konnte nicht geladen werden.");
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadEntries();
    // Filters deliberately trigger one fresh, server-scoped journal query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId, days, employeeId, customerId, activityType]);

  const groupedEntries = useMemo(() => {
    const groups = new Map<string, SalesJournalEntry[]>();
    for (const entry of entries) {
      const key = dateKey(entry.occurredAt);
      groups.set(key, [...(groups.get(key) || []), entry]);
    }
    return [...groups.entries()];
  }, [entries]);

  const todayKey = dateKey(new Date().toISOString());
  const countedEntries = entries.filter((entry) => entry.countsAsActivity);
  const todayEntries = countedEntries.filter((entry) => dateKey(entry.occurredAt) === todayKey);
  const customerCount = new Set(countedEntries.map((entry) => entry.customerId || entry.customerName).filter(Boolean)).size;
  const manualCount = entries.filter((entry) => !entry.isSystemGenerated).length;

  async function saveActivity() {
    if (!draft.customerId || !draft.activityType || !draft.note.trim() || isSaving) return;
    setIsSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/api/sales-journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId, ...draft, note: draft.note.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Aktivität konnte nicht gespeichert werden.");
      setDraft(emptyDraft);
      setIsModalOpen(false);
      await loadEntries();
    } catch (saveActivityError) {
      setSaveError(saveActivityError instanceof Error ? saveActivityError.message : "Aktivität konnte nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className={styles.workspace}>
      <header className={styles.hero}>
        <div>
          <p>VERTRIEB</p>
          <h1>Sales-Journal</h1>
          <span>{canReadAll ? "Vertriebsaktivitäten des gesamten Teams nachvollziehen." : "Deine eigenen Vertriebsaktivitäten im Blick behalten."}</span>
        </div>
        <button type="button" className={styles.primaryButton} onClick={() => { setSaveError(""); setIsModalOpen(true); }}>
          <b>+</b> Aktivität
        </button>
      </header>

      <div className={styles.metrics}>
        <article><span>Aktivitäten heute</span><strong>{todayEntries.length}</strong></article>
        <article><span>Im gewählten Zeitraum</span><strong>{countedEntries.length}</strong></article>
        <article><span>Bearbeitete Kunden</span><strong>{customerCount}</strong></article>
        <article><span>Persönlich dokumentiert</span><strong>{manualCount}</strong></article>
      </div>

      <section className={styles.filters}>
        <label><span>Zeitraum</span><select value={days} onChange={(event) => setDays(event.target.value)}><option value="7">Letzte 7 Tage</option><option value="30">Letzte 30 Tage</option><option value="90">Letzte 90 Tage</option><option value="365">Letzte 12 Monate</option></select></label>
        {canReadAll ? <label><span>Mitarbeiter</span><select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="">Alle Mitarbeiter</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label> : null}
        <label><span>Kunde</span><select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Alle Kunden</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.label}</option>)}</select></label>
        <label><span>Aktivitätsart</span><select value={activityType} onChange={(event) => setActivityType(event.target.value)}><option value="">Alle Aktivitäten</option>{activityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}<option value="opportunity">Zusatzverkauf erkannt</option></select></label>
      </section>

      <section className={styles.journal}>
        <div className={styles.journalHeader}>
          <div><p>CHRONOLOGISCH</p><h2>Vertriebsaktivitäten</h2></div>
          <span>{canReadAll ? "Geschäftsführung · Teamansicht" : "Persönliche Ansicht"}</span>
        </div>
        {isLoading ? <div className={styles.emptyState}>Aktivitäten werden geladen …</div> : error ? <div className={styles.errorState}>{error}</div> : groupedEntries.length === 0 ? <div className={styles.emptyState}><strong>Noch keine Vertriebsaktivitäten in dieser Auswahl.</strong><span>Neue Aktivitäten können mit wenigen Angaben dokumentiert werden.</span></div> : groupedEntries.map(([key, dayEntries]) => (
          <div className={styles.dayGroup} key={key}>
            <h3>{formatDay(dayEntries[0].occurredAt)}</h3>
            <div className={styles.timeline}>
              {dayEntries.map((entry) => (
                <article className={styles.entry} key={entry.id} data-source={entry.source}>
                  <time>{formatTime(entry.occurredAt)}</time>
                  <div className={styles.marker} aria-hidden="true" />
                  <div className={styles.entryBody}>
                    <div className={styles.entryTopline}>
                      <strong>{entry.actorName}</strong>
                      <span className={styles.activityPill}>{entry.activityLabel}</span>
                      {entry.isSystemGenerated ? <span className={styles.sourcePill}>{sourceLabel(entry.source)}</span> : null}
                      {!entry.countsAsActivity ? <span className={styles.infoPill}>Nur Information</span> : null}
                    </div>
                    <h4>{entry.customerName}</h4>
                    <p>{entry.note}</p>
                    {entry.referenceId ? <small>{entry.referenceId}</small> : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>

      {isModalOpen ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !isSaving) setIsModalOpen(false); }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="sales-journal-dialog-title">
            <header><div><p>SALES-JOURNAL</p><h2 id="sales-journal-dialog-title">Vertriebsaktivität eintragen</h2><span>Nur das festhalten, was tatsächlich im Vertrieb getan wurde.</span></div><button type="button" aria-label="Schließen" onClick={() => setIsModalOpen(false)} disabled={isSaving}>×</button></header>
            <div className={styles.formGrid}>
              <label><span>Kunde</span><select value={draft.customerId} onChange={(event) => setDraft((current) => ({ ...current, customerId: event.target.value }))}><option value="">Bitte auswählen</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.label}</option>)}</select></label>
              <label><span>Aktivitätsart</span><select value={draft.activityType} onChange={(event) => setDraft((current) => ({ ...current, activityType: event.target.value }))}>{activityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label className={styles.noteField}><span>Kurze Notiz / Ergebnis</span><textarea rows={5} value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Was wurde besprochen oder erreicht?" maxLength={2000} /></label>
            </div>
            {saveError ? <p className={styles.formError}>{saveError}</p> : null}
            <footer><button type="button" className={styles.secondaryButton} onClick={() => setIsModalOpen(false)} disabled={isSaving}>Abbrechen</button><button type="button" className={styles.primaryButton} onClick={() => void saveActivity()} disabled={isSaving || !draft.customerId || !draft.note.trim()}>{isSaving ? "Wird gespeichert …" : "Aktivität speichern"}</button></footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}
