type GraphQlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export type HeroProject = {
  id: string;
  project_nr?: string | null;
  measure?: {
    short?: string | null;
    name?: string | null;
  } | null;
  customer?: {
    id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    company_name?: string | null;
    email?: string | null;
  } | null;
  contact?: {
    id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
  address?: {
    street?: string | null;
    city?: string | null;
    zipcode?: string | null;
  } | null;
  current_project_match_status?: {
    status_code?: string | null;
    name?: string | null;
  } | null;
};

const HERO_PROJECTS_QUERY = `
  query HeroProjects($offset: Int) {
    project_matches(offset: $offset) {
      id
      project_nr
      measure {
        short
        name
      }
      customer {
        id
        first_name
        last_name
        company_name
        email
      }
      contact {
        id
        first_name
        last_name
        email
      }
      address {
        street
        city
        zipcode
      }
      current_project_match_status {
        status_code
        name
      }
    }
  }
`;

const HERO_PROJECT_MAX_PAGES = 100;

function getHeroConfig() {
  const endpoint = process.env.HERO_GRAPHQL_ENDPOINT;
  const apiKey = process.env.HERO_API_KEY;

  if (!endpoint || !apiKey) {
    throw new Error("HERO API ist nicht konfiguriert.");
  }

  return { endpoint, apiKey };
}

export async function heroGraphQl<T>(query: string, variables?: Record<string, unknown>) {
  const { endpoint, apiKey } = getHeroConfig();

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HERO API antwortet mit Status ${response.status}.`);
  }

  const payload = (await response.json()) as GraphQlResponse<T>;

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join(" | "));
  }

  if (!payload.data) {
    throw new Error("HERO API hat keine Daten zurückgegeben.");
  }

  return payload.data;
}

export async function listHeroProjects() {
  const projects: HeroProject[] = [];
  const seenProjectIds = new Set<string>();
  let offset = 0;

  for (let page = 0; page < HERO_PROJECT_MAX_PAGES; page += 1) {
    const data = await heroGraphQl<{ project_matches: HeroProject[] }>(HERO_PROJECTS_QUERY, {
      offset,
    });
    const pageProjects = data.project_matches ?? [];

    if (pageProjects.length === 0) break;

    let newProjectsInPage = 0;

    for (const project of pageProjects) {
      if (seenProjectIds.has(project.id)) continue;

      seenProjectIds.add(project.id);
      projects.push(project);
      newProjectsInPage += 1;
    }

    if (newProjectsInPage === 0) break;

    offset += pageProjects.length;
  }

  return projects.filter(isHeroProjectActive);
}

function isHeroProjectActive(project: HeroProject) {
  const statusCode = project.current_project_match_status?.status_code;
  const statusName = project.current_project_match_status?.name?.trim().toLowerCase();

  return statusCode !== "2000" && statusName !== "abgeschlossen";
}

export function getHeroProjectTitle(project: HeroProject) {
  const projectNumber = project.project_nr ? `Projekt ${project.project_nr}` : `HERO ${project.id}`;
  const measure = project.measure?.name ?? project.measure?.short;

  return measure ? `${projectNumber} - ${measure}` : projectNumber;
}

export function getHeroCustomerName(project: HeroProject) {
  const customer = project.customer;
  if (!customer) return "";

  return (
    customer.company_name ||
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    customer.email ||
    ""
  );
}

export function getHeroProjectDescription(project: HeroProject) {
  const address = [project.address?.street, project.address?.zipcode, project.address?.city]
    .filter(Boolean)
    .join(", ");
  const status = project.current_project_match_status?.name;

  return [
    "Importiert aus HERO Software.",
    status ? `Projektstatus: ${status}` : null,
    address ? `Adresse: ${address}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
