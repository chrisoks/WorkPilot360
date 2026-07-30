import {
  createHash,
  createHmac,
  randomUUID,
} from "node:crypto";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const allowProduction = process.argv.includes("--allow-production");
const baseUrl = new URL(
  process.env.ONLINE_REQUEST_QA_BASE_URL || "http://localhost:3002"
);
const portalSlug =
  process.env.ONLINE_REQUEST_PORTAL_SLUG?.trim() || "ok-immocare";
const securitySecret =
  process.env.ONLINE_REQUEST_SIGNING_SECRET?.trim() ||
  process.env.WORKPILOT_SESSION_SECRET?.trim() ||
  process.env.SESSION_SECRET?.trim() ||
  "";
const sessionSecret =
  process.env.WORKPILOT_SESSION_SECRET?.trim() ||
  process.env.NEXTAUTH_SECRET?.trim() ||
  "";

function assert(condition, message) {
  if (!condition) throw new Error(`QA fehlgeschlagen: ${message}`);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function sessionToken(sessionId) {
  const value = `v2.${sessionId}.1`;
  const signature = createHmac("sha256", sessionSecret)
    .update(value)
    .digest("base64url");
  return `${value}.${signature}`;
}

function networkHash(value) {
  return createHmac("sha256", securitySecret)
    .update(`network:${value}`, "utf8")
    .digest("hex");
}

function solveProof(challenge, difficulty) {
  for (let proof = 0; proof <= 999_999_999_999; proof += 1) {
    const digest = createHash("sha256")
      .update(`${challenge}:${proof}`, "utf8")
      .digest();
    let remainingBits = difficulty;
    let valid = true;
    for (const byte of digest) {
      if (remainingBits <= 0) break;
      if (remainingBits >= 8) {
        if (byte !== 0) {
          valid = false;
          break;
        }
        remainingBits -= 8;
      } else {
        valid = (byte >> (8 - remainingBits)) === 0;
        remainingBits = 0;
      }
    }
    if (valid && remainingBits <= 0) return String(proof);
  }
  throw new Error("Proof-of-work konnte nicht gelöst werden.");
}

async function parseResponse(responseOrPromise) {
  const response = await responseOrPromise;
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { response, body };
}

async function createAuthSession(userId, createdSessionIds) {
  const now = new Date();
  const id = randomUUID();
  await prisma.authSession.create({
    data: {
      id,
      userId,
      tokenVersion: 1,
      createdAt: now,
      lastSeenAt: now,
      lastRotatedAt: now,
      idleExpiresAt: new Date(now.getTime() + 60 * 60 * 1_000),
      absoluteExpiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1_000),
    },
  });
  createdSessionIds.push(id);
  return `workpilot_session=${encodeURIComponent(sessionToken(id))}`;
}

async function createPortalSession(ipAddress) {
  const result = await parseResponse(
    await fetch(
      new URL(
        `/api/public/online-requests/session?portal=${encodeURIComponent(
          portalSlug
        )}`,
        baseUrl
      ),
      {
        headers: {
          "cf-connecting-ip": ipAddress,
          "user-agent": "WorkPilot360 controlled online-request QA",
        },
      }
    )
  );
  assert(
    result.response.status === 200,
    `Formularsitzung liefert ${result.response.status}`
  );
  return result.body;
}

async function submitRequest({
  portalSession,
  ipAddress,
  metadata,
  photo,
}) {
  const proof = solveProof(
    portalSession.security.challenge,
    portalSession.security.difficulty
  );
  const payload = new FormData();
  payload.set(
    "metadata",
    JSON.stringify({
      ...metadata,
      sessionToken: portalSession.security.sessionToken,
      proof,
      website: "",
      consent: true,
    })
  );
  payload.append(
    "photos",
    new Blob([photo], { type: "image/png" }),
    "qa-original-with-metadata.png"
  );
  return parseResponse(
    await fetch(
      new URL(
        `/api/public/online-requests/submit?portal=${encodeURIComponent(
          portalSlug
        )}`,
        baseUrl
      ),
      {
        method: "POST",
        headers: {
          origin: baseUrl.origin,
          "cf-connecting-ip": ipAddress,
          "user-agent": "WorkPilot360 controlled online-request QA",
        },
        body: payload,
      }
    )
  );
}

async function main() {
  if (!apply) {
    console.log(
      "Kontrollierter Online-Anfragen-QA-Lauf: Mit --apply werden isolierte QA-Daten erzeugt, geprüft und im finally-Block wieder entfernt."
    );
    return;
  }
  if (
    !allowProduction &&
    !["localhost", "127.0.0.1", "::1"].includes(baseUrl.hostname)
  ) {
    throw new Error(
      "Nicht-lokale QA benötigt zusätzlich --allow-production."
    );
  }
  assert(
    securitySecret.length >= 32,
    "Online-Anfragen-Signaturschlüssel fehlt oder ist zu kurz"
  );
  assert(
    sessionSecret.length >= 32,
    "WorkPilot-Sitzungsschlüssel fehlt oder ist zu kurz"
  );

  const cleanup = {
    authSessionIds: [],
    requestId: "",
    requestIpHash: "",
    projectId: "",
    taskIds: [],
    contactId: "",
    objectAddressId: "",
    foreignOrganizationId: "",
    foreignContactId: "",
    rateLimitIpHashes: [],
  };
  const qaSuffix = randomUUID().slice(0, 8);

  try {
    const portal = await prisma.onlineRequestPortal.findUnique({
      where: { slug: portalSlug },
      select: {
        id: true,
        organizationId: true,
        allowedTradeIds: true,
      },
    });
    assert(portal, "Portal wurde nicht gefunden");
    const allowedTradeIds = Array.isArray(portal.allowedTradeIds)
      ? portal.allowedTradeIds.filter((value) => typeof value === "string")
      : [];
    const trade = await prisma.category.findFirst({
      where: {
        id: { in: allowedTradeIds },
        organizationId: portal.organizationId,
        name: "Glasreinigung",
      },
      select: { id: true, name: true, projectPrefix: true },
    });
    const recommendation = await prisma.category.findFirst({
      where: {
        id: { in: allowedTradeIds },
        organizationId: portal.organizationId,
        name: "Fassadenreinigung",
      },
      select: { id: true, name: true },
    });
    assert(trade && recommendation, "QA-Gewerke fehlen");

    const users = await prisma.user.findMany({
      where: { organizationId: portal.organizationId, isActive: true },
      select: {
        id: true,
        role: true,
        salesRoleEnabled: true,
      },
    });
    const admin = users.find((user) =>
      ["ADMIN", "GESCHAEFTSFUEHRER"].includes(user.role)
    );
    const deniedUser = users.find(
      (user) =>
        ["MITARBEITER", "BUCHHALTUNG", "GAST"].includes(user.role) &&
        user.salesRoleEnabled !== true
    );
    assert(admin && deniedUser, "Benutzer für Rollenprüfung fehlen");
    const adminCookie = await createAuthSession(
      admin.id,
      cleanup.authSessionIds
    );
    const deniedCookie = await createAuthSession(
      deniedUser.id,
      cleanup.authSessionIds
    );

    const requestIp = `198.51.100.${50 + Math.floor(Math.random() * 120)}`;
    cleanup.requestIpHash = networkHash(requestIp);
    const publicSession = await createPortalSession(requestIp);
    assert(
      publicSession.portal.trades.length >= 10,
      "Öffentliches Portal liefert zu wenige Gewerke"
    );
    const desiredDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000)
      .toISOString()
      .slice(0, 10);
    const clientSubmissionId = randomUUID();
    const metadata = {
      clientSubmissionId,
      requestType: "execution",
      tradeId: trade.id,
      recommendationTradeIds: [recommendation.id],
      desiredDate,
      desiredTimeWindow: "morning",
      street: "QA Testweg 360",
      postalCode: "74722",
      city: "Buchen",
      objectHint: `Kontrollierter Test ${qaSuffix}`,
      description:
        "Kontrollierte Ende-zu-Ende-Anfrage für Fensterreinigung mit sicherem Testbild.",
      customerKind: "business",
      company: `QA Online-Anfrage ${qaSuffix}`,
      firstName: "Qualität",
      lastName: "Sicherung",
      email: `qa-${qaSuffix}@example.test`,
      phone: "+49 6281 000000",
      preferredContact: "either",
    };
    const photo = await sharp({
      create: {
        width: 96,
        height: 72,
        channels: 4,
        background: { r: 30, g: 110, b: 75, alpha: 0.7 },
      },
    })
      .png()
      .withMetadata({ comment: "must be removed" })
      .toBuffer();
    await sleep(2_700);
    const submitted = await submitRequest({
      portalSession: publicSession,
      ipAddress: requestIp,
      metadata,
      photo,
    });
    assert(
      submitted.response.status === 201 && !submitted.body.duplicate,
      `Erstübertragung liefert ${submitted.response.status}`
    );
    const onlineRequest = await prisma.onlineRequest.findUnique({
      where: {
        portalId_clientSubmissionId: {
          portalId: portal.id,
          clientSubmissionId,
        },
      },
      include: { photos: true, auditEvents: true },
    });
    assert(onlineRequest, "Anfrage wurde nicht gespeichert");
    cleanup.requestId = onlineRequest.id;
    assert(
      onlineRequest.submissionIpHash === cleanup.requestIpHash &&
        !onlineRequest.submissionIpHash.includes(requestIp),
      "Netzwerkkennung ist nicht ausschließlich gehasht"
    );
    assert(
      onlineRequest.photos.length === 1 &&
        onlineRequest.photos[0].mimeType === "image/jpeg" &&
        onlineRequest.photos[0].byteSize <= 3 * 1024 * 1024,
      "Bild wurde nicht sicher als JPEG normalisiert"
    );
    assert(
      onlineRequest.auditEvents.some((event) => event.eventType === "submitted"),
      "Übermittlungs-Audit fehlt"
    );

    const unauthenticated = await fetch(
      new URL("/api/online-requests?summary=1", baseUrl)
    );
    assert(
      unauthenticated.status === 401,
      "Interne API ist ohne Sitzung nicht geschlossen"
    );
    const denied = await fetch(
      new URL(`/api/online-requests?actorId=${deniedUser.id}`, baseUrl),
      { headers: { cookie: deniedCookie } }
    );
    assert(denied.status === 403, "Unberechtigte Rolle wurde nicht abgewiesen");

    const internal = await parseResponse(
      await fetch(
        new URL(`/api/online-requests?id=${onlineRequest.id}`, baseUrl),
        { headers: { cookie: adminCookie } }
      )
    );
    assert(
      internal.response.status === 200 && internal.body.length === 1,
      "Interner Posteingang findet die Anfrage nicht"
    );
    const internalItem = internal.body[0];
    assert(
      !("submissionIpHash" in internalItem) &&
        !("userAgentHash" in internalItem) &&
        !("securitySignals" in internalItem),
      "Interne API gibt technische Sicherheitsmerkmale aus"
    );
    const photoResponse = await fetch(
      new URL(`${internalItem.photos[0].url}?actorId=${admin.id}`, baseUrl),
      { headers: { cookie: adminCookie } }
    );
    assert(
      photoResponse.status === 200 &&
        photoResponse.headers.get("content-type") === "image/jpeg" &&
        (await photoResponse.arrayBuffer()).byteLength ===
          onlineRequest.photos[0].byteSize,
      "Geschützter Bildabruf ist inkonsistent"
    );

    cleanup.foreignOrganizationId = randomUUID();
    cleanup.foreignContactId = randomUUID();
    await prisma.organization.create({
      data: {
        id: cleanup.foreignOrganizationId,
        name: `QA Fremdmandant ${qaSuffix}`,
        slug: `qa-online-${qaSuffix}`,
      },
    });
    await prisma.contact.create({
      data: {
        id: cleanup.foreignContactId,
        organizationId: cleanup.foreignOrganizationId,
        customerNumber: `QA-${qaSuffix}`,
        firstName: "Fremd",
        lastName: "Mandant",
      },
    });
    const foreignDecision = await parseResponse(
      await fetch(new URL("/api/online-requests", baseUrl), {
        method: "PATCH",
        headers: {
          cookie: adminCookie,
          "content-type": "application/json",
          origin: baseUrl.origin,
        },
        body: JSON.stringify({
          actorId: admin.id,
          id: onlineRequest.id,
          status: "in_review",
          customerDecision: "existing",
          matchedContactId: cleanup.foreignContactId,
        }),
      })
    );
    assert(
      foreignDecision.response.status === 400,
      "Mandantenfremder Kunde wurde nicht abgewiesen"
    );

    const reviewed = await parseResponse(
      await fetch(new URL("/api/online-requests", baseUrl), {
        method: "PATCH",
        headers: {
          cookie: adminCookie,
          "content-type": "application/json",
          origin: baseUrl.origin,
        },
        body: JSON.stringify({
          actorId: admin.id,
          id: onlineRequest.id,
          status: "in_review",
          assignedUserId: admin.id,
          customerDecision: "new",
        }),
      })
    );
    assert(
      reviewed.response.status === 200 &&
        reviewed.body.auditEvents.some(
          (event) => event.eventType === "review_updated"
        ),
      "Geprüfte Kundenentscheidung wurde nicht auditiert"
    );

    const convert = () =>
      parseResponse(
        fetch(
          new URL(
            `/api/online-requests/${onlineRequest.id}/convert`,
            baseUrl
          ),
          {
            method: "POST",
            headers: {
              cookie: adminCookie,
              "content-type": "application/json",
              origin: baseUrl.origin,
              "x-online-request-action": "online-request-convert-v1",
            },
            body: JSON.stringify({ actorId: admin.id }),
          }
        )
      );
    const converted = await convert();
    assert(
      converted.response.status === 201 && !converted.body.duplicate,
      `Projektumwandlung liefert ${converted.response.status}`
    );
    cleanup.projectId = converted.body.projectId;
    cleanup.contactId = converted.body.contactId;
    cleanup.taskIds = converted.body.taskIds;
    const project = await prisma.workPilotProject.findFirst({
      where: {
        id: cleanup.projectId,
        organizationId: portal.organizationId,
      },
    });
    assert(project, "Erzeugtes Projekt fehlt");
    cleanup.objectAddressId = project.objectAddressId || "";
    assert(
      project.status === "Lead / Klärung" &&
        project.projectType === "Projekt OK immocare" &&
        project.branch === "OK immocare GmbH" &&
        project.trade === trade.name &&
        project.contactId === cleanup.contactId &&
        new RegExp(`^${trade.projectPrefix}-\\d+$`).test(
          project.projectNumber
        ) &&
        project.title ===
          `Projekt ${project.projectNumber} - ${trade.name}`,
      `Projektklassifizierung ist unvollständig: ${JSON.stringify({
        projectNumber: project.projectNumber,
        projectTitle: project.title,
        projectStatus: project.status,
        projectType: project.projectType,
        projectBranch: project.branch,
        projectTrade: project.trade,
        expectedPrefix: trade.projectPrefix,
        expectedContactId: cleanup.contactId,
        actualContactId: project.contactId,
      })}`
    );
    const [logbooks, tasks, convertedRequest, unresolvedNotifications] =
      await Promise.all([
        prisma.projectLogbookEntry.findMany({
          where: { projectId: cleanup.projectId },
        }),
        prisma.task.findMany({
          where: { projectId: cleanup.projectId },
        }),
        prisma.onlineRequest.findUnique({
          where: { id: onlineRequest.id },
          include: { auditEvents: true },
        }),
        prisma.notification.count({
          where: {
            linkTarget: "online-requests",
            linkTargetId: onlineRequest.id,
            resolvedAt: null,
          },
        }),
      ]);
    assert(
      logbooks.some(
        (entry) =>
          entry.title === "Online-Anfrage" &&
          entry.body.includes(metadata.description)
      ),
      "Originalbeschreibung fehlt im Projektlogbuch"
    );
    const imageLogbook = logbooks.find(
      (entry) => entry.title === "Bilder: Anfragebilder"
    );
    assert(
      imageLogbook &&
        Array.isArray(imageLogbook.attachments) &&
        imageLogbook.attachments.length === 1,
      "Projektbildkategorie Anfragebilder fehlt"
    );
    assert(
      tasks.length === 1 &&
        tasks[0].title.includes("Wunschdatum prüfen") &&
        tasks[0].description.includes("noch kein bestätigter Termin"),
      "Terminwunsch-Aufgabe ist nicht sicher angelegt"
    );
    assert(
      convertedRequest?.status === "converted" &&
        convertedRequest.convertedProjectId === cleanup.projectId &&
        convertedRequest.auditEvents.some(
          (event) => event.eventType === "converted"
        ) &&
        unresolvedNotifications === 0,
      "Anfrageabschluss, Audit oder Benachrichtigungsauflösung fehlt"
    );
    const countsBeforeReplay = {
      projects: await prisma.workPilotProject.count({
        where: { id: cleanup.projectId },
      }),
      tasks: await prisma.task.count({
        where: { projectId: cleanup.projectId },
      }),
      logbooks: await prisma.projectLogbookEntry.count({
        where: { projectId: cleanup.projectId },
      }),
    };
    const conversionReplay = await convert();
    assert(
      conversionReplay.response.status === 200 &&
        conversionReplay.body.duplicate &&
        (await prisma.workPilotProject.count({
          where: { id: cleanup.projectId },
        })) === countsBeforeReplay.projects &&
        (await prisma.task.count({
          where: { projectId: cleanup.projectId },
        })) === countsBeforeReplay.tasks &&
        (await prisma.projectLogbookEntry.count({
          where: { projectId: cleanup.projectId },
        })) === countsBeforeReplay.logbooks,
      "Projektumwandlung ist bei Replay nicht idempotent"
    );

    const duplicateSession = await createPortalSession(requestIp);
    await sleep(2_700);
    const duplicate = await submitRequest({
      portalSession: duplicateSession,
      ipAddress: requestIp,
      metadata,
      photo,
    });
    assert(
      duplicate.response.status === 200 && duplicate.body.duplicate,
      "Identische Formularwiederholung ist nicht idempotent"
    );
    const reusedSession = await submitRequest({
      portalSession: duplicateSession,
      ipAddress: requestIp,
      metadata: { ...metadata, clientSubmissionId: randomUUID() },
      photo,
    });
    assert(
      reusedSession.response.status === 409,
      "Für Replay ausgestellte Sitzung blieb für neue Daten wiederverwendbar"
    );

    const rateIp = `203.0.113.${50 + Math.floor(Math.random() * 120)}`;
    cleanup.rateLimitIpHashes.push(networkHash(rateIp));
    let lastRateStatus = 0;
    for (let index = 0; index < 6; index += 1) {
      const malformed = new FormData();
      malformed.set("metadata", "{}");
      lastRateStatus = (
        await fetch(
          new URL(
            `/api/public/online-requests/submit?portal=${portalSlug}`,
            baseUrl
          ),
          {
            method: "POST",
            headers: {
              origin: baseUrl.origin,
              "cf-connecting-ip": rateIp,
            },
            body: malformed,
          }
        )
      ).status;
    }
    assert(lastRateStatus === 429, "Persistentes Übertragungslimit greift nicht");

    const sessionRateIp = `192.0.2.${50 + Math.floor(Math.random() * 120)}`;
    cleanup.rateLimitIpHashes.push(networkHash(sessionRateIp));
    let lastSessionStatus = 0;
    for (let index = 0; index < 13; index += 1) {
      lastSessionStatus = (
        await fetch(
          new URL(
            `/api/public/online-requests/session?portal=${portalSlug}`,
            baseUrl
          ),
          { headers: { "cf-connecting-ip": sessionRateIp } }
        )
      ).status;
    }
    assert(lastSessionStatus === 429, "Persistentes Sitzungslimit greift nicht");

    console.log(
      JSON.stringify(
        {
          result: "PASS",
          checks: [
            "public-session-and-trades",
            "signed-session-and-proof-of-work",
            "safe-photo-reencoding",
            "hashed-network-identifiers",
            "role-protection",
            "tenant-isolation",
            "inbox-and-audit",
            "new-customer-and-new-lead-project",
            "logbook-and-anfragebilder",
            "desired-date-task",
            "notification-resolution",
            "submission-and-conversion-replay",
            "persistent-rate-limits",
          ],
        },
        null,
        2
      )
    );
  } finally {
    const project = cleanup.projectId
      ? await prisma.workPilotProject.findUnique({
          where: { id: cleanup.projectId },
          select: { contactId: true, objectAddressId: true },
        })
      : null;
    const taskIds = cleanup.taskIds;
    if (cleanup.requestId || cleanup.projectId || taskIds.length) {
      await prisma.notification.deleteMany({
        where: {
          OR: [
            ...(cleanup.requestId
              ? [{ linkTargetId: cleanup.requestId }]
              : []),
            ...(taskIds.length ? [{ taskId: { in: taskIds } }] : []),
          ],
        },
      });
    }
    if (cleanup.projectId || taskIds.length) {
      await prisma.statusTimelineEntry.deleteMany({
        where: {
          entityId: {
            in: [cleanup.projectId, ...taskIds].filter(Boolean),
          },
        },
      });
    }
    if (cleanup.projectId) {
      await prisma.task.deleteMany({
        where: { projectId: cleanup.projectId },
      });
      await prisma.projectLogbookEntry.deleteMany({
        where: { projectId: cleanup.projectId },
      });
      await prisma.workPilotProject.deleteMany({
        where: { id: cleanup.projectId },
      });
    }
    const objectAddressId =
      cleanup.objectAddressId || project?.objectAddressId || "";
    if (objectAddressId) {
      await prisma.objectAddress.deleteMany({
        where: { id: objectAddressId },
      });
    }
    const contactId = cleanup.contactId || project?.contactId || "";
    if (contactId) {
      await prisma.contactIntegrationEvent.deleteMany({
        where: { contactId },
      });
      await prisma.contact.deleteMany({ where: { id: contactId } });
    }
    if (cleanup.requestId) {
      await prisma.onlineRequest.deleteMany({
        where: { id: cleanup.requestId },
      });
    }
    const securityHashes = [
      cleanup.requestIpHash,
      ...cleanup.rateLimitIpHashes,
    ].filter(Boolean);
    if (securityHashes.length) {
      await prisma.onlineRequestPublicSession.deleteMany({
        where: { ipHash: { in: securityHashes } },
      });
      await prisma.onlineRequestRateLimitBucket.deleteMany({
        where: { ipHash: { in: securityHashes } },
      });
    }
    if (cleanup.foreignContactId) {
      await prisma.contact.deleteMany({
        where: { id: cleanup.foreignContactId },
      });
    }
    if (cleanup.foreignOrganizationId) {
      await prisma.organization.deleteMany({
        where: { id: cleanup.foreignOrganizationId },
      });
    }
    if (cleanup.authSessionIds.length) {
      await prisma.authSession.deleteMany({
        where: { id: { in: cleanup.authSessionIds } },
      });
    }

    const residue = {
      request: cleanup.requestId
        ? await prisma.onlineRequest.count({
            where: { id: cleanup.requestId },
          })
        : 0,
      project: cleanup.projectId
        ? await prisma.workPilotProject.count({
            where: { id: cleanup.projectId },
          })
        : 0,
      contact: cleanup.contactId
        ? await prisma.contact.count({ where: { id: cleanup.contactId } })
        : 0,
      sessions: cleanup.authSessionIds.length
        ? await prisma.authSession.count({
            where: { id: { in: cleanup.authSessionIds } },
          })
        : 0,
    };
    assert(
      Object.values(residue).every((count) => count === 0),
      `QA-Bereinigung unvollständig: ${JSON.stringify(residue)}`
    );
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "QA fehlgeschlagen.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
