"use client";

import { useEffect, useState } from "react";

type FeedbackMeta = {
  customerName: string;
  invoiceNumber: string;
  status: string;
};

export function FeedbackForm({ token }: { token: string }) {
  const [meta, setMeta] = useState<FeedbackMeta | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [wantsContact, setWantsContact] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/public-feedback/${token}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error ?? "Bewertungslink nicht gefunden.");
        return;
      }
      setMeta(data);
    }

    void load();
  }, [token]);

  async function submitFeedback() {
    setIsSending(true);
    setError("");
    setMessage("");
    const response = await fetch(`/api/public-feedback/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment, wantsContact }),
    });
    const data = await response.json();
    setIsSending(false);
    if (!response.ok) {
      setError(data?.error ?? "Bewertung konnte nicht gespeichert werden.");
      return;
    }
    setMessage("Vielen Dank. Ihre Bewertung wurde gespeichert.");
  }

  if (error && !meta) {
    return (
      <main className="feedback-shell">
        <section>{error}</section>
      </main>
    );
  }

  return (
    <main className="feedback-shell">
      <section className="feedback-card">
        <p>WorkPilot360</p>
        <h1>Wie zufrieden sind Sie?</h1>
        <span>
          {meta?.customerName || "Ihre Bewertung"}
          {meta?.invoiceNumber ? ` · ${meta.invoiceNumber}` : ""}
        </span>

        <div className="stars" aria-label="Bewertung">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              aria-label={`${star} Sterne`}
              data-active={star <= rating}
              onClick={() => setRating(star)}
            >
              ★
            </button>
          ))}
        </div>

        <label>
          Kommentar
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} />
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={wantsContact}
            onChange={(event) => setWantsContact(event.target.checked)}
          />
          Ich wünsche eine Kontaktaufnahme.
        </label>

        {error ? <strong className="feedback-error">{error}</strong> : null}
        {message ? <strong className="feedback-success">{message}</strong> : null}

        <button type="button" disabled={isSending || Boolean(message)} onClick={submitFeedback}>
          Bewertung senden
        </button>
      </section>
    </main>
  );
}
