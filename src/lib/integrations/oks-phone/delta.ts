export type OksPhoneDeltaCursor = { occurredAt: string; id: string };

export function encodeDeltaCursor(cursor: OksPhoneDeltaCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeDeltaCursor(value: string): OksPhoneDeltaCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<OksPhoneDeltaCursor>;
    if (
      typeof parsed.id !== "string" || !parsed.id.trim() ||
      typeof parsed.occurredAt !== "string" || Number.isNaN(Date.parse(parsed.occurredAt))
    ) return null;
    return { id: parsed.id, occurredAt: new Date(parsed.occurredAt).toISOString() };
  } catch {
    return null;
  }
}
