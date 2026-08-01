import { NextResponse } from "next/server";

import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/client";
import { getDemoContext } from "@/lib/demo/context";
import { canReadOnlineRequests } from "@/lib/permissions";
import {
  createStorageProvider,
  loadStorageConfig,
  storageChecksumsMatch,
  type GetStorageObjectResult,
} from "@/lib/storage";

export const dynamic = "force-dynamic";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeInlineName(value: string) {
  const fallback = value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "datei";
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(value)}`;
}

function toReadableStream(body: GetStorageObjectResult["body"]): ReadableStream<Uint8Array> {
  if (body instanceof ReadableStream) return body;
  if (body instanceof Uint8Array) {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(body);
        controller.close();
      },
    });
  }
  const iterator = body[Symbol.asyncIterator]();
  return new ReadableStream({
    async pull(controller) {
      const next = await iterator.next();
      if (next.done) controller.close();
      else controller.enqueue(next.value);
    },
    async cancel() {
      await iterator.return?.();
    },
  });
}

async function canReadStoredFile(
  organizationId: string,
  actor: Parameters<typeof canReadOnlineRequests>[0],
  file: { ownerType: string; ownerId: string }
) {
  if (file.ownerType === "project") {
    const project = await prisma.workPilotProject.findFirst({
      where: { id: file.ownerId, organizationId },
      select: { id: true },
    });
    return Boolean(project);
  }
  if (file.ownerType === "online-request") {
    const request = await prisma.onlineRequest.findFirst({
      where: { id: file.ownerId, organizationId },
      select: { convertedProjectId: true },
    });
    return Boolean(request && (request.convertedProjectId || canReadOnlineRequests(actor)));
  }
  return false;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await context.params;
  if (!cleanString(fileId)) {
    return NextResponse.json({ error: "Datei fehlt." }, { status: 400 });
  }

  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(request, users, undefined);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);

  const file = await prisma.storedFile.findFirst({
    where: {
      id: fileId,
      organizationId: organization.id,
      status: "available",
      deletedAt: null,
    },
  });
  if (!file) {
    return NextResponse.json({ error: "Datei wurde nicht gefunden." }, { status: 404 });
  }
  if (!(await canReadStoredFile(organization.id, actorResult.actor, file))) {
    return NextResponse.json({ error: "Dateizugriff nicht erlaubt." }, { status: 403 });
  }

  const requestEtag = cleanString(request.headers.get("if-none-match")).replace(/^W\//, "");
  const storedEtag = file.etag ? `"${file.etag.replace(/^"|"$/g, "")}"` : "";
  if (storedEtag && requestEtag === storedEtag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: storedEtag, "Cache-Control": "private, max-age=300" },
    });
  }

  try {
    const config = loadStorageConfig();
    const provider = createStorageProvider(config);
    if (!provider || config.provider !== "s3" || config.bucket !== file.storageBucket) {
      throw new Error("storage_not_active");
    }
    const object = await provider.get(file.objectKey);
    if (!object || object.sizeBytes !== file.sizeBytes) {
      return NextResponse.json(
        { error: "Datei ist im Objektspeicher nicht konsistent vorhanden." },
        { status: 502 }
      );
    }
    if (
      object.checksum &&
      !storageChecksumsMatch(`sha256:${file.sha256}`, object.checksum)
    ) {
      return NextResponse.json(
        { error: "Die Datei-Pruefsumme ist ungueltig." },
        { status: 502 }
      );
    }

    return new Response(toReadableStream(object.body), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(file.sizeBytes),
        "Content-Disposition": safeInlineName(file.originalName),
        "Cache-Control": "private, max-age=300, stale-while-revalidate=60",
        ...(storedEtag ? { ETag: storedEtag } : {}),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Protected stored file delivery failed", {
      fileId: file.id,
      error: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "Der Dateispeicher ist voruebergehend nicht erreichbar." },
      { status: 503, headers: { "Retry-After": "30" } }
    );
  }
}
