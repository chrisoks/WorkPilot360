import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import {
  jarvisEnterpriseInsightLiveSource,
  resolveJarvisEnterpriseInsightRequest,
  type JarvisEnterpriseInsightSource,
} from "@/lib/jarvis/enterprise-insights";
import { resolveJarvisOrganizationOperationsRequest } from "@/lib/jarvis/organization-operations-analysis";
import type { JarvisReadResponse, JarvisRecordResult } from "@/lib/jarvis/read-model";
import type { JarvisAccessProfile } from "@/lib/jarvis/security";

export type JarvisManagementCompositeTopic =
  | "revenue"
  | "margin"
  | "utilization"
  | "sales_pipeline"
  | "customer_concentration"
  | "target_gap";

type ResolverInput = {
  question: string;
  organizationId: string;
  accessProfile: JarvisAccessProfile;
  now?: Date;
};

export type JarvisManagementCompositeDependencies = {
  enterprise?: (input: ResolverInput & { source?: JarvisEnterpriseInsightSource }) => Promise<JarvisReadResponse | undefined>;
  operations?: (input: ResolverInput) => Promise<JarvisReadResponse | undefined>;
  enterpriseSource?: JarvisEnterpriseInsightSource;
};

function normalize(value: string) {
  return normalizeJarvisIntentText(value).replace(/\s+/g, " ").trim();
}

export function resolveJarvisManagementCompositeTopics(question: string): JarvisManagementCompositeTopic[] {
  const value = normalize(question);
  const analytic = /\b(?:analys\w*|vergleich\w*|entwick\w*|uberblick\w*|bewert\w*|wie (?:sieht|schaut) es|wie lauft es|wo stehen wir)\b/.test(value);
  if (!analytic) return [];
  const topics: JarvisManagementCompositeTopic[] = [];
  if (/\bumsatz\w*\b/.test(value)) topics.push("revenue");
  if (/\b(?:marge\w*|deckungsbeitrag\w*|rentabilitat\w*)\b/.test(value)) topics.push("margin");
  if (/\b(?:auslastung\w*|kapazitat\w*)\b/.test(value)) topics.push("utilization");
  if (/\b(?:vertrieb\w*|pipeline\w*|angebot\w*)\b/.test(value)) topics.push("sales_pipeline");
  if (/\b(?:kundenkonzentration\w*|kundenabhangigkeit\w*|topkunden\w*)\b/.test(value)) topics.push("customer_concentration");
  if (/\b(?:umsatzziel\w*|vertriebsziel\w*|ziellucke\w*|ziel)\b/.test(value)) topics.push("target_gap");
  return topics.length >= 2 ? topics : [];
}

function canonicalQuestion(topic: JarvisManagementCompositeTopic, original: string) {
  const prefix: Record<JarvisManagementCompositeTopic, string> = {
    revenue: "Zeige den Umsatztrend",
    margin: "Zeige den Margentrend",
    utilization: "Zeige die Auslastung",
    sales_pipeline: "Analysiere die Vertriebspipeline",
    customer_concentration: "Analysiere die Kundenkonzentration",
    target_gap: "Zeige die Lücke bis zum Umsatzziel",
  };
  return `${prefix[topic]}. Berücksichtige den Zeitraum aus dieser ursprünglichen Frage: ${original}`;
}

function uniqueRecords(responses: JarvisReadResponse[]) {
  const records = new Map<string, JarvisRecordResult>();
  responses.flatMap((response) => response.records ?? []).forEach((record) => {
    const key = `${record.kind}:${record.target.id}`;
    if (!records.has(key)) records.set(key, record);
  });
  return [...records.values()].slice(0, 12);
}

export async function resolveJarvisManagementCompositeRequest(input: ResolverInput & {
  dependencies?: JarvisManagementCompositeDependencies;
}): Promise<JarvisReadResponse | undefined> {
  const topics = resolveJarvisManagementCompositeTopics(input.question);
  if (!topics.length) return undefined;
  const enterprise = input.dependencies?.enterprise ?? resolveJarvisEnterpriseInsightRequest;
  const operations = input.dependencies?.operations ?? resolveJarvisOrganizationOperationsRequest;
  let sharedSnapshot: ReturnType<JarvisEnterpriseInsightSource["load"]> | undefined;
  const baseSource = input.dependencies?.enterpriseSource ?? jarvisEnterpriseInsightLiveSource;
  const sharedEnterpriseSource: JarvisEnterpriseInsightSource = {
    load(sourceInput) {
      sharedSnapshot ??= baseSource.load(sourceInput);
      return sharedSnapshot;
    },
  };
  const responses = await Promise.all(topics.map((topic) => {
    const common = { question: canonicalQuestion(topic, input.question), organizationId: input.organizationId, accessProfile: input.accessProfile, now: input.now };
    return topic === "utilization"
      ? operations(common)
      : enterprise({ ...common, source: sharedEnterpriseSource });
  }));
  const resolved = responses.filter((response): response is JarvisReadResponse => Boolean(response));
  const refusal = resolved.find((response) => response.type === "refusal");
  if (refusal) return refusal;
  const clarification = resolved.find((response) => response.type === "clarification");
  if (clarification) return clarification;
  const answers = resolved.filter((response) => response.type === "answer");
  if (answers.length !== topics.length) return undefined;
  return {
    type: "answer",
    topicId: "management.composite-analysis",
    message: `Ich habe ${answers.length} angefragte Unternehmensperspektiven gemeinsam ausgewertet. ${answers.map((answer) => answer.message).join(" ")}`,
    structured: {
      title: "Kombinierte Unternehmensanalyse",
      subtitle: "Mehrere sichere WorkPilot-Fachadapter, gemeinsam eingeordnet",
      sections: answers.map((answer) => ({
        title: answer.structured?.title ?? answer.topicId,
        items: answer.structured?.facts?.map((fact) => `${fact.label}: ${fact.value}`) ?? [answer.message],
      })),
    },
    records: uniqueRecords(answers),
    deterministic: true,
  };
}
