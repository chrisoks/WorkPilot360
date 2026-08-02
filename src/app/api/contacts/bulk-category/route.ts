import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { canManageContacts, canManageUsers } from "@/lib/permissions";
import { getPublicAppOrigin } from "@/lib/http/public-app-origin";
import {
  ContactBulkCategoryServiceError,
  evaluateContactBulkCategory,
  executeContactBulkCategory,
  getContactBulkCategoryConfirmationText,
  type ContactBulkCategoryRequest,
} from "@/lib/contacts/contact-bulk-category-service";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof ContactBulkCategoryServiceError) {
    const status = error.code === "not_found" ? 404 : error.code === "invalid_input" ? 400 : 409;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  return NextResponse.json({ error: "Die Kontakt-Massenänderung konnte nicht sicher verarbeitet werden. Es wurde nichts geändert.", code: "execution_failed" }, { status: 500 });
}

async function binding(req: Request, body: Record<string, unknown>) {
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) return { response: sessionBoundActorResponse(actorResult) } as const;
  const sessionActor = users.find((user) => user.id === actorResult.sessionUserId && user.isActive !== false);
  if (!sessionActor || !canManageUsers(sessionActor) || !canManageContacts(sessionActor) || !canManageUsers(actorResult.actor) || !canManageContacts(actorResult.actor)) return { response: NextResponse.json({ error: "Diese Rollenkombination darf Kontakte nicht massenhaft ändern." }, { status: 403 }) } as const;
  return { organization, actor: actorResult.actor } as const;
}

function isSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const requestOrigin = new URL(req.url).origin;
    return origin === requestOrigin || origin === getPublicAppOrigin(req);
  } catch { return false; }
}

function requestFrom(body: Record<string, unknown>): ContactBulkCategoryRequest {
  return body.mode === "rollback"
    ? { mode: "rollback", sourceRequestId: String(body.sourceRequestId ?? "") }
    : { mode: "apply", customerNumbers: Array.isArray(body.customerNumbers) ? body.customerNumbers.map(String) : [], targetCategory: String(body.targetCategory ?? "") as never };
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Die Anfrage konnte nicht verifiziert werden." }, { status: 403 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const resolved = await binding(req, body);
  if ("response" in resolved) return resolved.response;
  try {
    const request = requestFrom(body);
    const evaluation = await evaluateContactBulkCategory({ organizationId: resolved.organization.id, request });
    return NextResponse.json({ evaluation, confirmationText: getContactBulkCategoryConfirmationText(evaluation) });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Die Anfrage konnte nicht verifiziert werden." }, { status: 403 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const resolved = await binding(req, body);
  if ("response" in resolved) return resolved.response;
  try {
    const request = requestFrom(body);
    const evaluation = await evaluateContactBulkCategory({ organizationId: resolved.organization.id, request });
    const requiredText = getContactBulkCategoryConfirmationText(evaluation);
    if (String(body.confirmationText ?? "").trim() !== requiredText) return NextResponse.json({ error: `Gib zur Bestätigung exakt „${requiredText}“ ein.`, code: "invalid_confirmation" }, { status: 400 });
    if (String(body.expectedFingerprint ?? "") !== evaluation.fingerprint) return NextResponse.json({ error: "Der Dry-Run ist nicht mehr aktuell. Bitte prüfe die Kontaktmenge erneut.", code: "stale_context" }, { status: 409 });
    const requestId = randomUUID();
    const result = await prisma.$transaction((tx) => executeContactBulkCategory({ tx, organizationId: resolved.organization.id, actorId: resolved.actor.id, requestId, request, expectedFingerprint: evaluation.fingerprint, source: "contact-bulk-ui" }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ success: true, requestId, result });
  } catch (error) { return errorResponse(error); }
}
