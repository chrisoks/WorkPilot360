export type WinterServiceDeploymentKind = "spreading" | "spreadingAndPlowing" | "unclassified";

export type WinterServiceDeploymentSignal = {
  projectId: string;
  customerId: string;
  customerName: string;
  date: string;
  typeHints: string[];
};

export type WinterServiceFrequencyMetric = {
  deploymentCount: number;
  seasonCount: number;
  averageDeploymentsPerSeason: number;
  typedDeploymentCount: number;
  unclassifiedDeploymentCount: number;
  spreading: {
    count: number;
    sharePercent: number;
  };
  spreadingAndPlowing: {
    count: number;
    sharePercent: number;
  };
};

export type WinterServiceCustomerFrequencyMetric = WinterServiceFrequencyMetric & {
  customerId: string;
  customerName: string;
};

export type WinterServiceFrequencyAnalytics = {
  seasonDefinition: "Oktober bis April";
  overall: WinterServiceFrequencyMetric & {
    customerCount: number;
    customerSeasonCount: number;
    averageDeploymentsPerCustomerSeason: number;
  };
  customers: WinterServiceCustomerFrequencyMetric[];
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, " ")
    .trim();
}

export function getWinterServiceSeason(date: string) {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;
  if (month >= 10) return `${year}/${year + 1}`;
  if (month <= 4) return `${year - 1}/${year}`;
  return null;
}

export function classifyWinterServiceDeployment(typeHints: string[]): WinterServiceDeploymentKind {
  const hints = typeHints.map(normalizeText).filter(Boolean);
  if (
    hints.some((hint) =>
      /(?:oki\s*0?401|streuen\s*(?:und|&|\+)\s*schieben|streu(?:en)?\s*(?:und|&|\+)\s*raum|schiebeinsatz|raumeinsatz)/.test(
        hint
      )
    )
  ) {
    return "spreadingAndPlowing";
  }
  if (
    hints.some((hint) =>
      /(?:oki\s*0?402|streuservice|streueinsatz|nur\s*streuen|winterdienst\s*-\s*streuen)/.test(hint)
    )
  ) {
    return "spreading";
  }
  return "unclassified";
}

type AggregationRow = {
  customerId: string;
  customerName: string;
  season: string;
  kind: WinterServiceDeploymentKind;
};

function buildMetric(rows: AggregationRow[]): WinterServiceFrequencyMetric {
  const seasons = new Set(rows.map((row) => row.season));
  const spreadingCount = rows.filter((row) => row.kind === "spreading").length;
  const spreadingAndPlowingCount = rows.filter((row) => row.kind === "spreadingAndPlowing").length;
  const typedDeploymentCount = spreadingCount + spreadingAndPlowingCount;

  return {
    deploymentCount: rows.length,
    seasonCount: seasons.size,
    averageDeploymentsPerSeason: seasons.size ? round(rows.length / seasons.size) : 0,
    typedDeploymentCount,
    unclassifiedDeploymentCount: rows.length - typedDeploymentCount,
    spreading: {
      count: spreadingCount,
      sharePercent: typedDeploymentCount ? round((spreadingCount / typedDeploymentCount) * 100, 1) : 0,
    },
    spreadingAndPlowing: {
      count: spreadingAndPlowingCount,
      sharePercent: typedDeploymentCount
        ? round((spreadingAndPlowingCount / typedDeploymentCount) * 100, 1)
        : 0,
    },
  };
}

export function buildWinterServiceFrequencyAnalytics(
  signals: WinterServiceDeploymentSignal[]
): WinterServiceFrequencyAnalytics {
  const groupedDeployments = new Map<
    string,
    Omit<WinterServiceDeploymentSignal, "typeHints"> & { season: string; typeHints: string[] }
  >();

  for (const signal of signals) {
    const projectId = signal.projectId.trim();
    const customerId = signal.customerId.trim();
    const date = signal.date.trim();
    const season = getWinterServiceSeason(date);
    if (!projectId || !customerId || !season) continue;
    const key = `${projectId}:${date}`;
    const existing = groupedDeployments.get(key);
    if (existing) {
      existing.typeHints.push(...signal.typeHints);
      continue;
    }
    groupedDeployments.set(key, {
      projectId,
      customerId,
      customerName: signal.customerName.trim() || "Unbekannter Kunde",
      date,
      season,
      typeHints: [...signal.typeHints],
    });
  }

  const rows: AggregationRow[] = Array.from(groupedDeployments.values()).map((deployment) => ({
    customerId: deployment.customerId,
    customerName: deployment.customerName,
    season: deployment.season,
    kind: classifyWinterServiceDeployment(deployment.typeHints),
  }));

  const customerGroups = new Map<string, AggregationRow[]>();
  for (const row of rows) {
    const group = customerGroups.get(row.customerId) ?? [];
    group.push(row);
    customerGroups.set(row.customerId, group);
  }

  const customers = Array.from(customerGroups.entries())
    .map(([customerId, customerRows]) => ({
      customerId,
      customerName: customerRows[0]?.customerName || "Unbekannter Kunde",
      ...buildMetric(customerRows),
    }))
    .sort(
      (left, right) =>
        right.averageDeploymentsPerSeason - left.averageDeploymentsPerSeason ||
        left.customerName.localeCompare(right.customerName, "de")
    );

  const overallMetric = buildMetric(rows);
  const customerSeasonCount = new Set(rows.map((row) => `${row.customerId}:${row.season}`)).size;

  return {
    seasonDefinition: "Oktober bis April",
    overall: {
      ...overallMetric,
      customerCount: customerGroups.size,
      customerSeasonCount,
      averageDeploymentsPerCustomerSeason: customerSeasonCount
        ? round(rows.length / customerSeasonCount)
        : 0,
    },
    customers,
  };
}
