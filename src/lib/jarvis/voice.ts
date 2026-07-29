const MAX_JARVIS_SPEECH_TRANSCRIPT_LENGTH = 4_000;
const MAX_JARVIS_SPEECH_OUTPUT_LENGTH = 5_000;

export const JARVIS_SPEECH_LISTENING_MESSAGE =
  "Ich höre zu … Loslassen übernimmt das Transkript.";

function normalizeSpeechText(value: string, maxLength: number) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeJarvisSpeechTranscript(value: string) {
  return normalizeSpeechText(value, MAX_JARVIS_SPEECH_TRANSCRIPT_LENGTH);
}

export function mergeJarvisSpeechTranscript(currentDraft: string, transcript: string) {
  const current = sanitizeJarvisSpeechTranscript(currentDraft);
  const spoken = sanitizeJarvisSpeechTranscript(transcript);

  if (!spoken) return current;
  if (!current) return spoken;

  return sanitizeJarvisSpeechTranscript(`${current} ${spoken}`);
}

export function sanitizeJarvisSpeechOutput(value: string) {
  return normalizeSpeechText(value, MAX_JARVIS_SPEECH_OUTPUT_LENGTH);
}

export function getJarvisSpeechRecognitionErrorMessage(error?: string) {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "Mikrofonzugriff wurde nicht erlaubt.";
  }
  if (error === "audio-capture") {
    return "Es wurde kein verfügbares Mikrofon gefunden.";
  }
  if (error === "no-speech") {
    return "Ich habe keine Sprache erkannt. Bitte versuche es erneut.";
  }
  if (error === "aborted") {
    return "Die Spracheingabe wurde abgebrochen.";
  }
  if (error === "network") {
    return "Die Spracheingabe ist wegen eines Netzwerkfehlers nicht verfügbar.";
  }
  if (error === "language-not-supported") {
    return "Die deutsche Spracheingabe wird von diesem Browser nicht unterstützt.";
  }
  return "Die Spracheingabe ist gerade nicht verfügbar.";
}

export function getJarvisSpeechRecognitionEndMessage(hasTranscript: boolean) {
  return hasTranscript
    ? "Transkript prüfen und anschließend bewusst senden."
    : "Ich habe keine Sprache erkannt. Bitte versuche es erneut.";
}
