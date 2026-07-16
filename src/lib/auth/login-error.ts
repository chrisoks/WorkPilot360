const INVALID_CREDENTIALS_MESSAGE = "E-Mail oder Passwort ist nicht korrekt.";
const SERVER_LOGIN_ERROR_MESSAGE =
  "Die Anmeldung konnte serverseitig nicht abgeschlossen werden. Bitte versuche es erneut.";
const GENERIC_LOGIN_ERROR_MESSAGE = "Die Anmeldung konnte nicht abgeschlossen werden.";

export async function getLoginErrorMessage(response: Response) {
  if (response.status === 401) return INVALID_CREDENTIALS_MESSAGE;
  if (response.status >= 500) return SERVER_LOGIN_ERROR_MESSAGE;

  const data = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof data?.error === "string" && data.error.trim()
    ? data.error
    : GENERIC_LOGIN_ERROR_MESSAGE;
}
