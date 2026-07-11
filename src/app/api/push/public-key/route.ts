import { NextResponse } from "next/server";
import { getPushStatus } from "@/lib/push/web-push";

export async function GET() {
  const status = getPushStatus();
  return NextResponse.json({ configured: status.configured, publicKey: status.publicKey });
}
