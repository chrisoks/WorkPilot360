import { NextResponse } from "next/server";
import { OksPhoneAuthError } from "./auth";

export function oksPhoneErrorResponse(error: unknown) {
  if (error instanceof OksPhoneAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("OKS Phone integration request failed", {
    name: error instanceof Error ? error.name : "UnknownError",
  });
  return NextResponse.json(
    { error: "Die Integrationsanfrage konnte serverseitig nicht abgeschlossen werden." },
    { status: 500 }
  );
}
