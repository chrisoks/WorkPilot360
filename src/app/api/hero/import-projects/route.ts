import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Der HERO-Bulk-Import ist deaktiviert. HERO-Projekte dienen nur als Bezug in Aufgaben.",
    },
    { status: 405 }
  );
}
