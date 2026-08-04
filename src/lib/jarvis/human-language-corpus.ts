import type { JarvisEnterpriseInsightIntent } from "@/lib/jarvis/enterprise-insights";
import type { JarvisManagementCompositeTopic } from "@/lib/jarvis/management-composite";

export type JarvisHumanLanguageCase =
  | { id: string; family: "broad_entry"; question: string }
  | { id: string; family: "team_slot"; question: string; employeeCount: number; durationMinutes: number }
  | { id: string; family: "enterprise"; question: string; intent: JarvisEnterpriseInsightIntent }
  | { id: string; family: "management_composite"; question: string; topics: JarvisManagementCompositeTopic[] };

function variants(question: string) {
  const clean = question.trim();
  return [
    clean,
    `Hey Jarvis, ${clean[0].toLocaleLowerCase("de-DE")}${clean.slice(1)}`,
    `  ${clean.replace(/\s+/g, "  ")}  `,
  ];
}

const broadEntries = [
  "Wie siehts aus?",
  "Wie schaut's aus?",
  "Wie läufts?",
  "Was gibts Neues?",
  "Wo klemmts?",
  "Was ist heute wichtig?",
  "Gibt es Auffälligkeiten?",
  "Was soll ich zuerst tun?",
  "Was muss ich wissen?",
  "Was steht an?",
];

const teamSlots: Array<[string, number, number]> = [
  ["Wann haben 2 von unseren Jungs 4h Zeit?", 2, 240],
  ["Wann ist der nächstmögliche Termin für zwei Mitarbeiter mit vier Stunden Dauer?", 2, 240],
  ["Wie siehts aus, wann sind 2 Leute für 4 Std frei?", 2, 240],
  ["Wann können drei Kollegen 2 Stunden gemeinsam arbeiten?", 3, 120],
  ["Nächster freier Termin für 3 Mitarbeiter, Dauer 2h", 3, 120],
  ["Wann haben 3 von den Jungs Zeit für 2 Stunden Grünpflege?", 3, 120],
  ["Wann ist ein Mitarbeiter für 8 Stunden verfügbar?", 1, 480],
  ["Wann hat einer von den Jungs 8h Zeit?", 1, 480],
  ["Finde einen freien Termin für eine Person und acht Stunden", 1, 480],
  ["Wann sind 2 Mitarbeiter für 4h Rasenmähen frei?", 2, 240],
  ["Wann können zwei von unseren Leuten vier Stunden Rasen mähen?", 2, 240],
  ["Wann ist der früheste Termin für 2 Kollegen und 4 Std Rasenmähen?", 2, 240],
];

const enterprise: Array<[string, JarvisEnterpriseInsightIntent]> = [
  ["Wie läufts bei uns?", "overview"],
  ["Analysiere unser Unternehmen", "overview"],
  ["Gib mir eine BWA ähnliche Übersicht", "overview"],
  ["Was sind unsere wichtigsten Zahlen?", "overview"],
  ["Wie hat sich der Umsatz entwickelt?", "revenue_trend"],
  ["Wie siehts mitm Umsatz aus?", "revenue_trend"],
  ["Umsatztrend gegenüber Vorjahr", "revenue_trend"],
  ["Vergleiche den Umsatz mit dem Vorjahr", "revenue_trend"],
  ["Wie hat sich unsere Marge entwickelt?", "margin_trend"],
  ["Wie schauts bei der Marge aus?", "margin_trend"],
  ["Zeig ma den Deckungsbeitragstrend", "margin_trend"],
  ["Analysiere die Margenentwicklung", "margin_trend"],
  ["Wie siehts bei den Angeboten aus?", "sales_pipeline"],
  ["Wie läufts im Vertrieb?", "sales_pipeline"],
  ["Analysiere die Vertriebspipeline", "sales_pipeline"],
  ["Welchen Wert hat unsere Pipeline?", "sales_pipeline"],
  ["Welche Kunden solln wir heute angehen?", "proactive_sales"],
  ["Was muss der Vertrieb heute tun?", "proactive_sales"],
  ["Gib mir proaktive Vertriebsimpulse", "proactive_sales"],
  ["Wen sollen wir als Nächstes anrufen?", "proactive_sales"],
];

const composites: Array<[string, JarvisManagementCompositeTopic[]]> = [
  ["Analysiere Umsatz, Marge und Auslastung", ["revenue", "margin", "utilization"]],
  ["Wie siehts bei Umsatz und Vertrieb aus?", ["revenue", "sales_pipeline"]],
  ["Vergleiche Umsatz und Kundenkonzentration", ["revenue", "customer_concentration"]],
  ["Analysiere Marge und Kapazität", ["margin", "utilization"]],
  ["Bewerte Vertriebspipeline und Umsatzziel", ["revenue", "sales_pipeline", "target_gap"]],
  ["Wie entwickeln sich Umsatz und Marge?", ["revenue", "margin"]],
  ["Gib einen Überblick über Auslastung und Vertrieb", ["utilization", "sales_pipeline"]],
  ["Wo stehen wir bei Umsatz, Marge und Ziel?", ["revenue", "margin", "target_gap"]],
  ["Analysiere Kundenkonzentration und Vertrieb", ["sales_pipeline", "customer_concentration"]],
  ["Vergleiche Kapazität, Umsatz und Marge", ["revenue", "margin", "utilization"]],
];

export const JARVIS_HUMAN_LANGUAGE_CORPUS: JarvisHumanLanguageCase[] = [
  ...broadEntries.flatMap((question, index) => variants(question).map((variant, variantIndex) => ({ id: `broad-${index + 1}-${variantIndex + 1}`, family: "broad_entry" as const, question: variant }))),
  ...teamSlots.flatMap(([question, employeeCount, durationMinutes], index) => variants(question).map((variant, variantIndex) => ({ id: `slot-${index + 1}-${variantIndex + 1}`, family: "team_slot" as const, question: variant, employeeCount, durationMinutes }))),
  ...enterprise.flatMap(([question, intent], index) => variants(question).map((variant, variantIndex) => ({ id: `enterprise-${index + 1}-${variantIndex + 1}`, family: "enterprise" as const, question: variant, intent }))),
  ...composites.flatMap(([question, topics], index) => variants(question).map((variant, variantIndex) => ({ id: `composite-${index + 1}-${variantIndex + 1}`, family: "management_composite" as const, question: variant, topics }))),
];
