export const ONLINE_REQUEST_TYPES = [
  {
    id: "offer",
    label: "Angebot erhalten",
    description: "Leistung unverbindlich anfragen",
    icon: "document",
  },
  {
    id: "callback",
    label: "Rückruf & Beratung",
    description: "Wir melden uns persönlich",
    icon: "phone",
  },
  {
    id: "execution",
    label: "Durchführung anfragen",
    description: "Mit unverbindlichem Wunschdatum",
    icon: "calendar",
  },
  {
    id: "issue",
    label: "Mangel oder Problem",
    description: "Situation schnell und genau melden",
    icon: "alert",
  },
  {
    id: "general",
    label: "Allgemeine Anfrage",
    description: "Für alles Weitere",
    icon: "message",
  },
] as const;

export type OnlineRequestType = (typeof ONLINE_REQUEST_TYPES)[number]["id"];

export const ONLINE_REQUEST_TIME_WINDOW_LABELS: Record<string, string> = {
  flexible: "Zeitlich flexibel",
  morning: "Vormittags",
  afternoon: "Nachmittags",
};

export const ONLINE_REQUEST_URGENCY_LABELS: Record<string, string> = {
  normal: "Normal",
  soon: "Bitte zeitnah prüfen",
  urgent: "Akut oder sicherheitsrelevant",
};

export function getOnlineRequestTimeWindowLabel(
  value: string | null | undefined
) {
  const normalized = value?.trim() ?? "";
  return ONLINE_REQUEST_TIME_WINDOW_LABELS[normalized] || normalized;
}

export function getOnlineRequestUrgencyLabel(
  value: string | null | undefined
) {
  const normalized = value?.trim() ?? "";
  return ONLINE_REQUEST_URGENCY_LABELS[normalized] || normalized;
}

export const ONLINE_REQUEST_SERVICES = [
  {
    id: "object-care",
    label: "Objektbetreuung",
    shortDescription: "Regelmäßige Betreuung rund um Ihre Immobilie",
    icon: "building",
  },
  {
    id: "caretaker",
    label: "Hausmeisterservice",
    shortDescription: "Kontrollen, Pflege und kleine Handgriffe",
    icon: "tool",
  },
  {
    id: "green-care",
    label: "Grünpflege",
    shortDescription: "Rasen, Hecken, Flächen und Außenanlagen",
    icon: "leaf",
  },
  {
    id: "winter-service",
    label: "Winterdienst",
    shortDescription: "Räumen und Streuen für sichere Wege",
    icon: "snow",
  },
  {
    id: "pv-cleaning",
    label: "PV-Reinigung",
    shortDescription: "Schonende Reinigung von Photovoltaikanlagen",
    icon: "sun",
  },
  {
    id: "glass-cleaning",
    label: "Glasreinigung",
    shortDescription: "Fenster, Glasflächen und Rahmen",
    icon: "sparkle",
  },
  {
    id: "maintenance-cleaning",
    label: "Unterhaltsreinigung",
    shortDescription: "Planbare Reinigung von Innenbereichen",
    icon: "clean",
  },
  {
    id: "facade-cleaning",
    label: "Fassadenreinigung",
    shortDescription: "Werterhalt und gepflegter erster Eindruck",
    icon: "facade",
  },
  {
    id: "roof-cleaning",
    label: "Dachreinigung",
    shortDescription: "Dachflächen fachgerecht prüfen und reinigen",
    icon: "home",
  },
  {
    id: "repair",
    label: "Reparatur",
    shortDescription: "Kleinere Schäden und Defekte beheben",
    icon: "wrench",
  },
  {
    id: "other",
    label: "Sonstige / Andere Leistung",
    shortDescription: "Nicht dabei? Wir ordnen Ihr Anliegen gemeinsam ein",
    icon: "help",
  },
] as const;

export type OnlineRequestServiceId = (typeof ONLINE_REQUEST_SERVICES)[number]["id"];

export type OnlineRequestServiceOption = {
  id: string;
  configId: OnlineRequestServiceId | "generic";
  label: string;
  shortDescription: string;
  icon: string;
};

export const ONLINE_REQUEST_OTHER_SERVICE_ID = "other";

export const ONLINE_REQUEST_FEATURED_SERVICE_IDS = [
  "green-care",
  "object-care",
  "caretaker",
] as const;

const workPilotTradeNames: Record<OnlineRequestServiceId, string[]> = {
  "object-care": ["Objektbetreuung"],
  caretaker: ["Hausmeisterservice"],
  "green-care": [
    "Grünflächen- und Gartenpflege",
    "Gruenflaechen- und Gartenpflege",
  ],
  "winter-service": ["Winterdienst"],
  "pv-cleaning": ["Photovoltaikanlagenreinigung", "PV-Reinigung"],
  "glass-cleaning": ["Glasreinigung"],
  "maintenance-cleaning": ["Unterhaltsreinigung"],
  "facade-cleaning": ["Fassadenreinigung"],
  "roof-cleaning": ["Dachreinigung"],
  repair: ["Reparaturarbeiten", "Reparatur"],
  other: [],
};

function normalizeTradeName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("de-DE")
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss");
}

export function buildOnlineRequestServiceOptions(
  trades: readonly { id: string; name: string }[]
): OnlineRequestServiceOption[] {
  const mappedTrades: OnlineRequestServiceOption[] = trades.map((trade) => {
    const normalizedName = normalizeTradeName(trade.name);
    const presentation = ONLINE_REQUEST_SERVICES.find((service) =>
      workPilotTradeNames[service.id].some(
        (name) => normalizeTradeName(name) === normalizedName
      )
    );
    return {
      id: trade.id,
      configId: presentation?.id ?? "generic",
      label: presentation?.label ?? trade.name,
      shortDescription:
        presentation?.shortDescription ??
        "Schildern Sie uns, was wir für Sie übernehmen dürfen",
      icon: presentation?.icon ?? "building",
    };
  });
  const other = ONLINE_REQUEST_SERVICES.find(
    (service) => service.id === ONLINE_REQUEST_OTHER_SERVICE_ID
  );
  const otherOption: OnlineRequestServiceOption = {
    id: ONLINE_REQUEST_OTHER_SERVICE_ID,
    configId: ONLINE_REQUEST_OTHER_SERVICE_ID,
    label: other?.label ?? "Sonstige / Andere Leistung",
    shortDescription:
      other?.shortDescription ?? "Wir ordnen Ihr Anliegen gemeinsam ein",
    icon: other?.icon ?? "help",
  };
  return [...mappedTrades, otherOption];
}

export function partitionOnlineRequestServiceOptions(
  services: readonly OnlineRequestServiceOption[]
) {
  const featured = ONLINE_REQUEST_FEATURED_SERVICE_IDS.flatMap((configId) => {
    const service = services.find((candidate) => candidate.configId === configId);
    return service ? [service] : [];
  });
  const featuredIds = new Set(featured.map((service) => service.id));
  return {
    featured,
    additional: services.filter((service) => !featuredIds.has(service.id)),
  };
}

const recommendations: Partial<
  Record<OnlineRequestServiceId, OnlineRequestServiceId[]>
> = {
  "glass-cleaning": ["facade-cleaning", "roof-cleaning", "pv-cleaning"],
  "facade-cleaning": ["glass-cleaning", "roof-cleaning", "pv-cleaning"],
  "roof-cleaning": ["facade-cleaning", "pv-cleaning", "glass-cleaning"],
  "pv-cleaning": ["roof-cleaning", "facade-cleaning", "glass-cleaning"],
  "green-care": ["winter-service", "object-care", "caretaker"],
  "winter-service": ["green-care", "object-care", "caretaker"],
  "object-care": ["caretaker", "green-care", "winter-service"],
  caretaker: ["object-care", "green-care", "winter-service"],
  "maintenance-cleaning": ["glass-cleaning", "caretaker", "object-care"],
  repair: ["caretaker", "object-care"],
};

export function getOnlineRequestRecommendations(
  serviceId: OnlineRequestServiceId | ""
) {
  const ids = recommendations[serviceId as OnlineRequestServiceId] ?? [];
  return ids
    .map((id) => ONLINE_REQUEST_SERVICES.find((service) => service.id === id))
    .filter(
      (service): service is (typeof ONLINE_REQUEST_SERVICES)[number] =>
        Boolean(service)
    );
}

export function getOnlineRequestOptionRecommendations(
  serviceId: string,
  services: readonly OnlineRequestServiceOption[]
) {
  const selectedService = services.find((service) => service.id === serviceId);
  if (!selectedService || selectedService.configId === "generic") return [];
  const recommendationConfigIds =
    recommendations[selectedService.configId] ?? [];
  return recommendationConfigIds
    .map((configId) =>
      services.find((service) => service.configId === configId)
    )
    .filter(
      (service): service is OnlineRequestServiceOption => Boolean(service)
    );
}
