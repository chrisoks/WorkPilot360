import { NextResponse } from "next/server";
import {
  getSessionCookieOptions,
  revokeSessionFromRequest,
  WORKPILOT_SESSION_COOKIE,
} from "@/lib/auth/session";

export async function POST(req: Request) {
  await revokeSessionFromRequest(req);
  const response = NextResponse.json({ success: true });
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(WORKPILOT_SESSION_COOKIE, "", getSessionCookieOptions(0));
  return response;
}
