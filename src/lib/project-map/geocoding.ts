export type ProjectGeocodeResult = {
  latitude: number;
  longitude: number;
  confidence: number;
  formattedAddress: string;
};

type OpenCageResponse = {
  results?: Array<{
    confidence?: unknown;
    formatted?: unknown;
    geometry?: { lat?: unknown; lng?: unknown };
    components?: { country_code?: unknown };
  }>;
};

export function normalizeProjectMapAddress(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .toLocaleLowerCase("de-DE");
}

export function isValidProjectCoordinate(latitude: unknown, longitude: unknown) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function parseOpenCageProjectGeocodeResponse(payload: unknown): ProjectGeocodeResult | null {
  const response = payload && typeof payload === "object" ? payload as OpenCageResponse : null;
  const candidates = Array.isArray(response?.results) ? response.results : [];
  const candidate = candidates.find((result) => {
    const countryCode = String(result.components?.country_code ?? "").toLowerCase();
    return countryCode === "de" && isValidProjectCoordinate(result.geometry?.lat, result.geometry?.lng);
  });
  if (!candidate) return null;

  return {
    latitude: Number(candidate.geometry?.lat),
    longitude: Number(candidate.geometry?.lng),
    confidence: Math.max(0, Math.min(10, Number(candidate.confidence) || 0)),
    formattedAddress: String(candidate.formatted ?? "").trim(),
  };
}
