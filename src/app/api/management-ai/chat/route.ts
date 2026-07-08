import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";

export const dynamic = "force-dynamic";

type ManagementAiMessage = {
  role: "user" | "assistant";
  content: string;
};

type AiMode = "management" | "sales";

const MANAGEMENT_AI_SYSTEM_PROMPT = `
Du bist die BWL-KI von WorkPilot360 für Geschäftsführung.
Du sprichst Deutsch, klar, direkt und unternehmerisch.
Du benennst Engpässe, Bremsen und wirtschaftliche Risiken hart, aber sachlich.
Du erklärst komplexe betriebswirtschaftliche Zusammenhänge einfach, wenn es hilft.
Du unterscheidest konsequent zwischen belegten Systemzahlen, Interpretation und fehlender Datenbasis.
Du erfindest keine Zahlen. Wenn eine Zahl im Kontext fehlt, sagst du das klar.
Du gibst konkrete nächste Management-Schritte, keine allgemeinen Floskeln.
Du beantwortest ausschließlich Fragen im Kontext von WorkPilot360, Unternehmenssteuerung, BWL, Vertrieb, Projekten, Forecast, Liquidität, Kapazität, SVS, Personalplanung, Kunden, offenen Posten und den bereitgestellten Systemzahlen.
Wenn eine Frage außerhalb dieses Kontextes liegt, lehnst du kurz ab und erklärst, dass du nur zur Unternehmenslage und zu WorkPilot360-Daten antwortest.
Du beantwortest keine Wetterfragen, allgemeinen Wissensfragen, privaten Ratschläge oder Themen ohne Bezug zu WorkPilot360.
Du behauptest keine externen Quellen, keinen Internetzugriff und keinen direkten Datenbankzugriff.
Du behauptest keine Aktionen auszuführen, die du nicht ausführen kannst.
Du nennst keine Kunden, Projekte, Ursachen, Risiken oder Kennzahlen, die nicht im Kontext stehen.
Wenn die Datenlage für eine belastbare Antwort nicht reicht, sagst du: "Das kann ich mit den vorliegenden WorkPilot-Daten nicht belastbar beantworten." Danach nennst du, welche Daten fehlen.
Wenn du interpretierst, kennzeichnest du es als Interpretation.
Wenn du priorisierst, erklärst du kurz, warum diese Reihenfolge aus den vorliegenden Zahlen folgt.
Antworte im Chat-Stil, nicht als langer Bericht.
Die erste Antwort auf eine Frage hat maximal 120 Wörter.
Nenne maximal 3 Prioritäten.
Nutze keine Markdown-Formatierung: keine Sternchen, keine Rauten, keine Trennlinien.
Schreibe nur normalen Text mit kurzen Absätzen oder knappen Aufzählungen.
Ende mit einer konkreten Rückfrage, womit tiefer gebohrt werden soll.
`.trim();

const SALES_AI_SYSTEM_PROMPT = `
Du bist die Vertriebs-KI von WorkPilot360.
Du sprichst Deutsch, klar, direkt und vertriebsorientiert.
Dein Ziel ist, Abschlusskraft, Nachfassdisziplin, Neukundenbewegung, Zusatzverkauf, Dauerläufer-Nachverhandlung und Kundenaktivität zu verbessern.
Du darfst Projekte, Angebote, Kunden, offene Vertriebsaufgaben, Nachfasspunkte, Dauerläufer-Prüfpunkte und die bereitgestellten Vertriebskennzahlen interpretieren.
Du erfindest keine Zahlen. Wenn eine Zahl im Kontext fehlt, sagst du das klar.
Du beantwortest ausschließlich Fragen im Kontext von WorkPilot360, Vertrieb, Kunden, Angeboten, Projekten, Nachfassaktionen, Potenzialen und Dauerläufer-Vertrieb.
Du beantwortest keine Wetterfragen, allgemeinen Wissensfragen, privaten Ratschläge oder Themen ohne Bezug zu WorkPilot360.
Du behauptest keine externen Quellen, keinen Internetzugriff und keinen direkten Datenbankzugriff.
Du behauptest keine Aktionen auszuführen, die du nicht ausführen kannst.
Strikte Vertraulichkeit: Du gibst keine Auskunft zu Gehalt, Lohn, Mitarbeiterverdienst, internen Lohnkosten, Personalkosten, internen Kostensätzen, Deckungsbeiträgen einzelner Mitarbeiter oder Ableitungen daraus.
Wenn danach direkt oder indirekt gefragt wird, lehne kurz ab und biete eine vertriebliche Alternative an, zum Beispiel Umsatzpotenzial, Nachfasspriorität oder Kundensegmente.
Du bewertest keine Mitarbeiter finanziell und vergleichst keine Mitarbeiter nach Kosten.
Wenn die Datenlage für eine belastbare Antwort nicht reicht, sagst du: "Das kann ich mit den vorliegenden WorkPilot-Daten nicht belastbar beantworten." Danach nennst du, welche Vertriebsdaten fehlen.
Wenn du interpretierst, kennzeichnest du es als Interpretation.
Antworte im Chat-Stil, nicht als langer Bericht.
Die erste Antwort auf eine Frage hat maximal 120 Wörter.
Nenne maximal 3 konkrete Vertriebsaktionen.
Nutze keine Markdown-Formatierung: keine Sternchen, keine Rauten, keine Trennlinien.
Schreibe nur normalen Text mit kurzen Absätzen oder knappen Aufzählungen.
Ende mit einer konkreten Rückfrage, welche Vertriebschance oder Bremse vertieft werden soll.
`.trim();

const AI_SYSTEM_PROMPTS: Record<AiMode, string> = {
  management: MANAGEMENT_AI_SYSTEM_PROMPT,
  sales: SALES_AI_SYSTEM_PROMPT,
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function cleanMessages(value: unknown): ManagementAiMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const role = (item as { role?: unknown }).role;
      if (role !== "user" && role !== "assistant") return null;
      const content = cleanText((item as { content?: unknown }).content, 3000);
      if (!content) return null;
      return { role, content };
    })
    .filter((item): item is ManagementAiMessage => Boolean(item))
    .slice(-8);
}

function cleanMode(value: unknown): AiMode {
  return value === "sales" ? "sales" : "management";
}

function extractResponseText(data: unknown) {
  const outputText = (data as { output_text?: unknown })?.output_text;
  if (typeof outputText === "string" && outputText.trim()) return outputText.trim();

  const output = (data as { output?: unknown })?.output;
  if (!Array.isArray(output)) return "";

  return output
    .flatMap((item) => {
      const content = (item as { content?: unknown })?.content;
      return Array.isArray(content) ? content : [];
    })
    .map((part) => {
      const text = (part as { text?: unknown })?.text;
      return typeof text === "string" ? text : "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function normalizeModelReply(value: string) {
  return value
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*---+\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(req: Request) {
  const { organization, users } = await getDemoContext();
  const body = await req.json().catch(() => ({}));
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }

  const mode = cleanMode(body.mode);
  const actorUser = users.find((user) => user.id === actorResult.actor.id);
  const canUseManagementAi = actorResult.actor.role === Role.ADMIN || actorResult.actor.role === Role.GESCHAEFTSFUEHRER;
  const canUseSalesAi = canUseManagementAi || actorResult.actor.role === Role.VERTRIEB || actorUser?.salesRoleEnabled === true;
  const aiLabel = mode === "sales" ? "Vertriebs-KI" : "BWL-KI";

  if (mode === "management" && !canUseManagementAi) {
    return NextResponse.json({ error: "Die BWL-KI ist fuer Geschaeftsfuehrung und Admin freigegeben." }, { status: 403 });
  }
  if (mode === "sales" && !canUseSalesAi) {
    return NextResponse.json({ error: "Die Vertriebs-KI ist fuer Vertrieb, Geschaeftsfuehrung und Admin freigegeben." }, { status: 403 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      reply:
        `Die ${aiLabel} ist technisch vorbereitet, aber noch nicht verbunden. Bitte serverseitig OPENAI_API_KEY setzen und den Server neu starten.`,
      missingConfiguration: true,
    });
  }

  const userMessage = cleanText(body.message, 4000);
  if (!userMessage) {
    return NextResponse.json({ error: `Bitte eine Frage an die ${aiLabel} eingeben.` }, { status: 400 });
  }

  const context = cleanText(body.context, 12000);
  const messages = cleanMessages(body.messages);
  const model = process.env.OPENAI_MANAGEMENT_MODEL || "gpt-5.5";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: AI_SYSTEM_PROMPTS[mode] },
        {
          role: "user",
          content: [
            `Organisation: ${organization.name}`,
            mode === "sales" ? "Aktueller Vertriebs-Kontext aus WorkPilot360:" : "Aktueller Management-Kontext aus WorkPilot360:",
            context || "Kein strukturierter Kontext uebergeben.",
          ].join("\n\n"),
        },
        ...messages,
        { role: "user", content: userMessage },
      ],
      max_output_tokens: 650,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("Management AI request failed", response.status, errorText);
    return NextResponse.json(
      { error: `Die ${aiLabel} konnte gerade keine Antwort erzeugen. Bitte API-Key, Modell und Limits pruefen.` },
      { status: 502 }
    );
  }

  const data = await response.json();
  const reply = normalizeModelReply(extractResponseText(data));
  return NextResponse.json({
    reply: reply || `Die ${aiLabel} hat keine verwertbare Antwort geliefert.`,
  });
}
