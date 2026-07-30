export function hasLeadingZeroBits(bytes: Uint8Array, difficulty: number) {
  let remainingBits = difficulty;
  for (const byte of bytes) {
    if (remainingBits <= 0) return true;
    if (remainingBits >= 8) {
      if (byte !== 0) return false;
      remainingBits -= 8;
      continue;
    }
    return (byte >> (8 - remainingBits)) === 0;
  }
  return remainingBits <= 0;
}

export async function solveOnlineRequestProof(input: {
  challenge: string;
  difficulty: number;
  signal?: AbortSignal;
}) {
  if (
    !input.challenge ||
    input.difficulty < 10 ||
    input.difficulty > 22
  ) {
    throw new Error("Ungültige Sicherheitsaufgabe.");
  }
  const encoder = new TextEncoder();
  for (let proof = 0; proof <= 999_999_999_999; proof += 1) {
    if (input.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const digest = new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(`${input.challenge}:${proof}`)
      )
    );
    if (hasLeadingZeroBits(digest, input.difficulty)) return String(proof);
    if (proof > 0 && proof % 1_024 === 0) {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 0);
      });
    }
  }
  throw new Error("Sicherheitsaufgabe konnte nicht gelöst werden.");
}
