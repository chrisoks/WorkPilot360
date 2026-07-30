export type VehicleFuelPricePayload = {
  configured: boolean;
  status: "live" | "unavailable" | "not_configured";
  source: string;
  station: {
    id: string;
    name: string;
    address: string;
    isOpen: boolean | null;
  };
  prices: {
    diesel: number | null;
    e5: number | null;
    e10: number | null;
  };
  fetchedAt: string | null;
  message: string;
};

type FuelStation = {
  id: string;
  name: string;
  brand: string;
  street: string;
  houseNumber: string;
  postCode: number | string;
  place: string;
  diesel: number | null;
  e5: number | null;
  e10: number | null;
  isOpen: boolean;
};

let cache: { expiresAt: number; value: VehicleFuelPricePayload } | null =
  null;

const TARGET_STREET = "in der vorderen wanne";
const TARGET_HOUSE_NUMBER = "11";
const TARGET_POST_CODE = "74722";
const CACHE_MS = 10 * 60 * 1000;

function normalized(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("de")
    .replace(/[.\s-]+/g, " ");
}

function unavailablePayload(
  configured: boolean,
  message: string
): VehicleFuelPricePayload {
  return {
    configured,
    status: configured ? "unavailable" : "not_configured",
    source:
      "Tankerkönig / Markttransparenzstelle für Kraftstoffe (MTS-K)",
    station: {
      id: "",
      name: "HERM in Buchen",
      address: "In der vorderen Wanne 11, 74722 Buchen",
      isOpen: null,
    },
    prices: { diesel: null, e5: null, e10: null },
    fetchedAt: null,
    message,
  };
}

export function fuelPriceForVehicleType(
  fuelType: string,
  payload: VehicleFuelPricePayload
) {
  if (fuelType === "DIESEL") return payload.prices.diesel;
  if (fuelType === "E5") return payload.prices.e5;
  if (fuelType === "E10" || fuelType === "HYBRID") {
    return payload.prices.e10;
  }
  if (fuelType === "ELECTRIC") return 0;
  return null;
}

export async function loadVehicleFuelPrices(): Promise<VehicleFuelPricePayload> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  const apiKey = process.env.TANKERKOENIG_API_KEY?.trim() ?? "";
  if (!apiKey) {
    return unavailablePayload(
      false,
      "Live-Preise sind noch nicht konfiguriert. Der Preis kann im Rechner manuell eingetragen werden."
    );
  }

  const stationId = process.env.TANKERKOENIG_STATION_ID?.trim() ?? "";
  const lat = process.env.TANKERKOENIG_STATION_LAT?.trim() || "49.526326";
  const lng = process.env.TANKERKOENIG_STATION_LNG?.trim() || "9.334996";
  const endpoint = stationId
    ? `https://creativecommons.tankerkoenig.de/json/detail.php?id=${encodeURIComponent(
        stationId
      )}&apikey=${encodeURIComponent(apiKey)}`
    : `https://creativecommons.tankerkoenig.de/json/list.php?lat=${encodeURIComponent(
        lat
      )}&lng=${encodeURIComponent(lng)}&rad=1.5&sort=dist&type=all&apikey=${encodeURIComponent(
        apiKey
      )}`;

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as {
      ok?: boolean;
      message?: string;
      station?: FuelStation;
      stations?: FuelStation[];
    };
    if (!data.ok) {
      throw new Error(data.message || "API-Antwort war nicht erfolgreich.");
    }
    const stations = data.station
      ? [data.station]
      : Array.isArray(data.stations)
        ? data.stations
        : [];
    const station =
      stations.find(
        (candidate) =>
          normalized(candidate.street) === TARGET_STREET &&
          normalized(candidate.houseNumber) === TARGET_HOUSE_NUMBER &&
          normalized(candidate.postCode) === TARGET_POST_CODE
      ) ?? null;
    if (!station) {
      throw new Error(
        "Die konfigurierte HERM-Tankstelle wurde nicht gefunden."
      );
    }

    const value: VehicleFuelPricePayload = {
      configured: true,
      status: "live",
      source:
        "Tankerkönig / Markttransparenzstelle für Kraftstoffe (MTS-K)",
      station: {
        id: station.id,
        name: station.name || station.brand || "HERM in Buchen",
        address: `${station.street} ${station.houseNumber}, ${station.postCode} ${station.place}`,
        isOpen: station.isOpen,
      },
      prices: {
        diesel:
          typeof station.diesel === "number" && station.diesel > 0
            ? station.diesel
            : null,
        e5:
          typeof station.e5 === "number" && station.e5 > 0
            ? station.e5
            : null,
        e10:
          typeof station.e10 === "number" && station.e10 > 0
            ? station.e10
            : null,
      },
      fetchedAt: new Date().toISOString(),
      message: "Aktuelle Preise der ausgewählten Tankstelle.",
    };
    cache = { value, expiresAt: Date.now() + CACHE_MS };
    return value;
  } catch {
    if (cache?.value.status === "live") {
      return {
        ...cache.value,
        status: "unavailable",
        message:
          "Die Preisquelle ist vorübergehend nicht erreichbar. Der zuletzt geladene Preis wird angezeigt.",
      };
    }
    return unavailablePayload(
      true,
      "Die Preisquelle ist vorübergehend nicht erreichbar. Der Preis kann manuell eingetragen werden."
    );
  }
}
