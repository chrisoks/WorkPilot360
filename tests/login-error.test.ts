import { describe, expect, it } from "vitest";
import { getLoginErrorMessage } from "../src/lib/auth/login-error";

describe("login error messages", () => {
  it("reports invalid credentials only for unauthorized responses", async () => {
    const response = Response.json(
      { error: "Interner Text darf die sichere Meldung nicht ersetzen." },
      { status: 401 }
    );

    await expect(getLoginErrorMessage(response)).resolves.toBe(
      "E-Mail oder Passwort ist nicht korrekt."
    );
  });

  it("reports a server-side login failure without exposing technical details", async () => {
    const response = Response.json(
      { error: "WORKPILOT_SESSION_SECRET fehlt" },
      { status: 500 }
    );

    await expect(getLoginErrorMessage(response)).resolves.toBe(
      "Die Anmeldung konnte serverseitig nicht abgeschlossen werden. Bitte versuche es erneut."
    );
  });

  it("keeps safe validation messages for other response statuses", async () => {
    const response = Response.json(
      { error: "Bitte überprüfe deine Eingaben." },
      { status: 400 }
    );

    await expect(getLoginErrorMessage(response)).resolves.toBe(
      "Bitte überprüfe deine Eingaben."
    );
  });

  it("uses a neutral fallback for unreadable responses", async () => {
    const response = new Response("kein JSON", { status: 400 });

    await expect(getLoginErrorMessage(response)).resolves.toBe(
      "Die Anmeldung konnte nicht abgeschlossen werden."
    );
  });
});
