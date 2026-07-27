import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Der frühere HERO-Massenimport ist deaktiviert. Projekte dürfen nur über die geprüfte, protokollierte und rücknehmbare Importfreigabe übernommen werden.",
    },
    { status: 410 }
  );
}
