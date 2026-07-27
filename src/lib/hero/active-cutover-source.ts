import { heroGraphQl } from "./client";

export type HeroActiveContact = {
  id: string;
  nr?: string | null;
  category?: string | null;
  type?: string | null;
  is_deleted?: boolean | null;
  parent_customer_id?: string | number | null;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone_home?: string | null;
  phone_mobile?: string | null;
  created?: string | null;
  modified?: string | null;
  address?: {
    street?: string | null;
    zipcode?: string | null;
    city?: string | null;
  } | null;
};

export type HeroActiveProject = {
  id: string;
  project_nr?: string | null;
  display_id?: string | null;
  name?: string | null;
  project_title?: string | null;
  customer_id?: string | number | null;
  contact_id?: string | number | null;
  is_deleted?: boolean | null;
  created?: string | null;
  modified?: string | null;
  volume?: number | null;
  company_branch?: {
    id?: string | number | null;
    name?: string | null;
  } | null;
  type?: { id?: string | number | null; name?: string | null } | null;
  measure?: { short?: string | null; name?: string | null } | null;
  address?: {
    street?: string | null;
    zipcode?: string | null;
    city?: string | null;
  } | null;
  current_project_match_status?: {
    status_code?: string | number | null;
    name?: string | null;
  } | null;
  customer?: {
    id?: string | number | null;
    nr?: string | null;
    company_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
  contact?: {
    id?: string | number | null;
    nr?: string | null;
    company_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
};

const PAGE_SIZE = 100;
const MAX_ROWS = 100_000;

async function loadAllHeroRows<T extends { id: string | number }>(
  field: string,
  query: string
) {
  const rows: T[] = [];
  const seenIds = new Set<string>();

  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const data = await heroGraphQl<Record<string, T[]>>(query, {
      first: PAGE_SIZE,
      offset,
    });
    const page = data[field] ?? [];
    let added = 0;

    for (const row of page) {
      const id = String(row.id);
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      rows.push({ ...row, id: String(row.id) });
      added += 1;
    }

    if (page.length < PAGE_SIZE || added === 0) return rows;
  }

  throw new Error(
    `HERO-Pagination für ${field} hat das Sicherheitslimit erreicht.`
  );
}

const CONTACTS_QUERY = `
  query HeroActiveContacts($first: Int, $offset: Int) {
    contacts(first: $first, offset: $offset, show_deleted: true) {
      id nr category type is_deleted parent_customer_id
      company_name first_name last_name email phone_home phone_mobile
      created modified
      address { street zipcode city }
    }
  }
`;

const PROJECTS_QUERY = `
  query HeroActiveProjects($first: Int, $offset: Int) {
    project_matches(first: $first, offset: $offset) {
      id project_nr display_id name project_title
      customer_id contact_id is_deleted created modified volume
      company_branch { id name }
      type { id name }
      measure { short name }
      address { street zipcode city }
      current_project_match_status { status_code name }
      customer { id nr company_name first_name last_name email }
      contact { id nr company_name first_name last_name email }
    }
  }
`;

export async function loadHeroActiveCutoverSnapshot() {
  const [contacts, projects] = await Promise.all([
    loadAllHeroRows<HeroActiveContact>("contacts", CONTACTS_QUERY),
    loadAllHeroRows<HeroActiveProject>("project_matches", PROJECTS_QUERY),
  ]);

  return {
    capturedAt: new Date().toISOString(),
    contacts,
    projects,
  };
}
