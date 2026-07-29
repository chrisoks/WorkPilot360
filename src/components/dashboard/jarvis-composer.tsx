"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  mergeJarvisSpeechTranscript,
  sanitizeJarvisSpeechOutput,
} from "@/lib/jarvis/voice";
import styles from "./dashboard.module.css";

type BrowserSpeechRecognitionResult = {
  isFinal: boolean;
  0?: { transcript?: string };
};

type BrowserSpeechRecognitionEvent = {
  results: ArrayLike<BrowserSpeechRecognitionResult>;
};

type BrowserSpeechRecognitionErrorEvent = {
  error?: string;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onstart: (() => void) | null;
  abort: () => void;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type BrowserVoiceWindow = Window & {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
};

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return undefined;
  const voiceWindow = window as BrowserVoiceWindow;
  return voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition;
}

function getSpeechRecognitionError(error?: string) {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "Mikrofonzugriff wurde nicht erlaubt.";
  }
  if (error === "audio-capture") {
    return "Es wurde kein verfügbares Mikrofon gefunden.";
  }
  if (error === "no-speech") {
    return "Ich habe keine Sprache erkannt. Bitte versuche es erneut.";
  }
  return "Die Spracheingabe ist gerade nicht verfügbar.";
}

function MicrophoneIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 15.25a3.75 3.75 0 0 0 3.75-3.75V6.25a3.75 3.75 0 0 0-7.5 0v5.25A3.75 3.75 0 0 0 12 15.25Z" />
      <path d="M5.75 10.75v.75a6.25 6.25 0 0 0 12.5 0v-.75M12 17.75v3M8.75 20.75h6.5" />
    </svg>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 9.25v5.5h4l5 4V5.25l-5 4H4Z" />
      {muted ? (
        <path d="m17 9 4 4m0-4-4 4" />
      ) : (
        <path d="M16.25 9a4.25 4.25 0 0 1 0 6M18.5 6.75a7.5 7.5 0 0 1 0 10.5" />
      )}
    </svg>
  );
}

export function JarvisComposer({
  prefill,
  placeholder,
  isSending,
  latestAnswer,
  onSend,
}: {
  prefill: { value: string; revision: number };
  placeholder: string;
  isSending: boolean;
  latestAnswer?: string;
  onSend: (question: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechStatus, setSpeechStatus] = useState("");
  const [isReadAloudEnabled, setIsReadAloudEnabled] = useState(false);
  const [hasSpeechRecognition, setHasSpeechRecognition] = useState(false);
  const [hasSpeechSynthesis, setHasSpeechSynthesis] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const isListeningRef = useRef(false);
  const speechBaseDraftRef = useRef("");
  const lastSpokenAnswerRef = useRef("");

  useEffect(() => {
    setDraft(prefill.value);
  }, [prefill]);

  useEffect(() => {
    const Recognition = getSpeechRecognitionConstructor();
    setHasSpeechRecognition(Boolean(Recognition));
    setHasSpeechSynthesis(
      typeof window !== "undefined" &&
        "speechSynthesis" in window &&
        typeof SpeechSynthesisUtterance !== "undefined"
    );

    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = "de-DE";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onstart = () => {
      isListeningRef.current = true;
      setIsListening(true);
      setSpeechStatus("Ich höre zu … Loslassen übernimmt das Transkript.");
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ");
      setDraft(
        mergeJarvisSpeechTranscript(speechBaseDraftRef.current, transcript)
      );
    };
    recognition.onerror = (event) => {
      isListeningRef.current = false;
      setIsListening(false);
      setSpeechStatus(getSpeechRecognitionError(event.error));
    };
    recognition.onend = () => {
      isListeningRef.current = false;
      setIsListening(false);
      setSpeechStatus((current) =>
        current.startsWith("Ich höre zu")
          ? "Transkript prüfen und anschließend bewusst senden."
          : current
      );
    };
    recognitionRef.current = recognition;

    return () => {
      isListeningRef.current = false;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const answer = sanitizeJarvisSpeechOutput(latestAnswer ?? "");
    if (
      !isReadAloudEnabled ||
      !hasSpeechSynthesis ||
      !answer ||
      answer === lastSpokenAnswerRef.current
    ) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(answer);
    utterance.lang = "de-DE";
    utterance.rate = 1;
    lastSpokenAnswerRef.current = answer;
    window.speechSynthesis.speak(utterance);
  }, [hasSpeechSynthesis, isReadAloudEnabled, latestAnswer]);

  useEffect(
    () => () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    },
    []
  );

  function submitDraft() {
    const question = draft.trim();
    if (!question || isSending || isListening) return;
    setDraft("");
    setSpeechStatus("");
    onSend(question);
  }

  function startListening() {
    if (isSending || isListeningRef.current || !recognitionRef.current) return;
    speechBaseDraftRef.current = draft;
    setSpeechStatus("");
    try {
      isListeningRef.current = true;
      setIsListening(true);
      recognitionRef.current.start();
    } catch {
      isListeningRef.current = false;
      setIsListening(false);
      setSpeechStatus("Die Spracheingabe konnte nicht gestartet werden.");
    }
  }

  function stopListening() {
    if (!isListeningRef.current || !recognitionRef.current) return;
    recognitionRef.current.stop();
  }

  function handleMicrophoneKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if ((event.key === " " || event.key === "Enter") && !event.repeat) {
      event.preventDefault();
      startListening();
    }
  }

  function handleMicrophoneKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      stopListening();
    }
  }

  function handleMicrophonePointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    startListening();
  }

  function handleMicrophonePointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    stopListening();
  }

  function toggleReadAloud() {
    if (!hasSpeechSynthesis) return;
    if (isReadAloudEnabled) {
      window.speechSynthesis.cancel();
      setIsReadAloudEnabled(false);
      return;
    }
    lastSpokenAnswerRef.current = "";
    setIsReadAloudEnabled(true);
  }

  return (
    <form
      className={styles.managementAiComposer}
      onSubmit={(event) => {
        event.preventDefault();
        submitDraft();
      }}
    >
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        rows={3}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submitDraft();
          }
        }}
      />
      {speechStatus ? (
        <p
          className={styles.jarvisVoiceStatus}
          data-state={isListening ? "listening" : "idle"}
          role="status"
        >
          {speechStatus}
        </p>
      ) : null}
      <div className={styles.jarvisComposerActions}>
        <div className={styles.jarvisVoiceControls}>
          <button
            type="button"
            className={styles.jarvisVoiceButton}
            data-state={isListening ? "listening" : "idle"}
            disabled={!hasSpeechRecognition || isSending}
            aria-label={
              hasSpeechRecognition
                ? "Zum Sprechen gedrückt halten"
                : "Spracheingabe wird von diesem Browser nicht unterstützt"
            }
            aria-pressed={isListening}
            title={
              hasSpeechRecognition
                ? "Zum Sprechen gedrückt halten"
                : "Spracheingabe wird von diesem Browser nicht unterstützt"
            }
            onPointerDown={handleMicrophonePointerDown}
            onPointerUp={handleMicrophonePointerUp}
            onPointerCancel={stopListening}
            onKeyDown={handleMicrophoneKeyDown}
            onKeyUp={handleMicrophoneKeyUp}
          >
            <MicrophoneIcon />
          </button>
          <button
            type="button"
            className={styles.jarvisVoiceButton}
            data-state={isReadAloudEnabled ? "active" : "idle"}
            disabled={!hasSpeechSynthesis}
            aria-label={
              isReadAloudEnabled
                ? "Vorlesen ausschalten und Wiedergabe stoppen"
                : "Neue JARVIS-Antworten vorlesen"
            }
            aria-pressed={isReadAloudEnabled}
            title={
              isReadAloudEnabled
                ? "Vorlesen ausschalten"
                : "Neue Antworten vorlesen"
            }
            onClick={toggleReadAloud}
          >
            <SpeakerIcon muted={!isReadAloudEnabled} />
          </button>
          <span>Audio wird nicht in WorkPilot360 gespeichert.</span>
        </div>
        <button
          type="submit"
          className={styles.primaryButton}
          disabled={!draft.trim() || isSending || isListening}
        >
          {isSending ? "Denkt..." : "Senden"}
        </button>
      </div>
    </form>
  );
}
