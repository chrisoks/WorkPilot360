export function getNextWinterServiceCatalogNumber(existingNumbers: string[]) {
  const usedNumbers = existingNumbers
    .map((number) => /^OKI(\d{4})$/.exec(number)?.[1])
    .filter((value): value is string => Boolean(value))
    .map(Number)
    .filter((value) => (value >= 461 && value <= 499) || value >= 1401);
  const current = usedNumbers.length > 0 ? Math.max(...usedNumbers) : 460;
  const next = current < 499 ? current + 1 : current === 499 ? 1401 : current + 1;
  return `OKI${String(next).padStart(4, "0")}`;
}
