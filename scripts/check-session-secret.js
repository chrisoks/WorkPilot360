const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const secret = process.env.WORKPILOT_SESSION_SECRET || process.env.NEXTAUTH_SECRET || "";

if (secret.length < 32) {
  console.error(
    "Session-Secret fehlt oder ist kuerzer als 32 Zeichen. " +
      "Setze WORKPILOT_SESSION_SECRET oder NEXTAUTH_SECRET vor dem Produktionsstart."
  );
  process.exit(1);
}

console.log("Session-Secret ist gesetzt und ausreichend lang.");
