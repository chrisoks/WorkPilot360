const MAX_JARVIS_SPEECH_TRANSCRIPT_LENGTH = 4_000;
const MAX_JARVIS_SPEECH_OUTPUT_LENGTH = 5_000;

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
