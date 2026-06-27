import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import { getSystemMailStatus, sendSystemMail } from "@/lib/mail/system";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isSystemMailTester(role: Role) {
  return role === Role.ADMIN || role === Role.GESCHAEFTSFUEHRER;
}

export async function GET() {
  const status = getSystemMailStatus();
  return NextResponse.json({
    configured: status.configured,
    host: status.host,
    port: status.port,
    secure: status.secure,
    user: status.user,
    from: status.from,
    passwordConfigured: status.passwordConfigured,
    replyTo: status.replyTo,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }

  const actor = actorResult.actor;
  if (!isSystemMailTester(actor.role)) {
    return NextResponse.json(
      { error: "Nur Admins und Geschäftsführung dürfen Systemmail-Testmails versenden." },
      { status: 403 }
    );
  }

  const recipient = cleanText(body.to) || cleanText(actor.email);
  if (!recipient) {
    return NextResponse.json({ error: "Keine Empfängeradresse vorhanden." }, { status: 400 });
  }

  try {
    const result = await sendSystemMail({
      to: recipient,
      subject: "WorkPilot360 Systemmail-Test",
      text:
        "Das ist eine Testmail aus WorkPilot360. Wenn diese E-Mail angekommen ist, funktioniert der technische Systemmail-Versand.",
      html:
        "<p>Das ist eine Testmail aus <strong>WorkPilot360</strong>.</p><p>Wenn diese E-Mail angekommen ist, funktioniert der technische Systemmail-Versand.</p>",
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Systemmail-Test fehlgeschlagen." },
      { status: 502 }
    );
  }
}
