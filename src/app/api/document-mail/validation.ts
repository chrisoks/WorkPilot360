export function isDraftDocument(kind: string, status: unknown) {
  return (kind === "offer" || kind === "invoice") && typeof status === "string" && status.trim() === "Entwurf";
}
