"use client";

import { useState } from "react";

export function FeedbackPreviewForm() {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [wantsContact, setWantsContact] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <main className="feedback-shell">
      <section className="feedback-card">
        <p>WorkPilot360 Testansicht</p>
        <h1>Wie zufrieden sind Sie?</h1>
        <span>Vorschau f&uuml;r Rechnungsmail &middot; keine Speicherung</span>

        <div className="stars" aria-label="Bewertung">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              aria-label={`${star} Sterne`}
              data-active={star <= rating}
              onClick={() => {
                setRating(star);
                setMessage("");
              }}
            >
              {"\u2605"}
            </button>
          ))}
        </div>

        <label>
          Kommentar
          <textarea
            value={comment}
            onChange={(event) => {
              setComment(event.target.value);
              setMessage("");
            }}
          />
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={wantsContact}
            onChange={(event) => {
              setWantsContact(event.target.checked);
              setMessage("");
            }}
          />
          {"Ich w\u00fcnsche eine Kontaktaufnahme."}
        </label>

        {message ? <strong className="feedback-success">{message}</strong> : null}

        <button
          type="button"
          onClick={() =>
            setMessage(
              `Test erfolgreich: ${rating} Sterne${wantsContact ? ", Kontaktwunsch" : ""}${
                comment.trim() ? ", Kommentar erfasst" : ""
              }.`
            )
          }
        >
          Bewertung testen
        </button>
      </section>
    </main>
  );
}
