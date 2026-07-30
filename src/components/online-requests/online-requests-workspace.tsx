"use client";

import {
  getOnlineRequestTimeWindowLabel,
  getOnlineRequestUrgencyLabel,
} from "@/lib/online-requests/form-config";
import styles from "./online-requests-workspace.module.css";

export type OnlineRequestStatus =
  | "new"
  | "in_review"
  | "waiting_customer"
  | "converted"
  | "closed";

export type OnlineRequestCustomerDecision =
  | "unreviewed"
  | "existing"
  | "new"
  | "unresolved";

export type OnlineRequestViewItem = {
  id: string;
  referenceNumber: string;
  status: OnlineRequestStatus;
  requestType: "offer" | "callback" | "execution" | "issue" | "general";
  tradeId: string | null;
  tradeName: string;
  recommendationTradeIds: string[];
  recommendationNames: string[];
  desiredDate: string | null;
  desiredTimeWindow: string | null;
  callbackTimeWindow: string | null;
  urgency: string | null;
  street: string;
  postalCode: string;
  city: string;
  objectHint: string | null;
  description: string;
  customerKind: "private" | "business";
  company: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  preferredContact: "email" | "phone" | "either";
  assignedUserId: string | null;
  matchedContactId: string | null;
  customerDecision: OnlineRequestCustomerDecision;
  convertedProjectId: string | null;
  handledAt: string;
  convertedAt: string;
  createdAt: string;
  updatedAt: string;
  photos: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    byteSize: number;
    width: number;
    height: number;
    sortOrder: number;
    url: string;
  }>;
  auditEvents: Array<{
    id: string;
    eventType: string;
    actorUserId: string;
    actorName: string;
    payload: unknown;
    createdAt: string;
  }>;
};

export type OnlineRequestViewSummary = {
  newCount: number;
  activeCount: number;
  oldestNewAt: string;
};

export type OnlineRequestWorkspaceUser = {
  id: string;
  name: string;
};

export type OnlineRequestWorkspaceContact = {
  id: string;
  label: string;
  detail: string;
};

export type OnlineRequestWorkspaceFilter =
  | "active"
  | "all"
  | OnlineRequestStatus;

const requestTypeLabels: Record<OnlineRequestViewItem["requestType"], string> = {
  offer: "Angebot",
  callback: "Rückruf & Beratung",
  execution: "Durchführung",
  issue: "Mangel oder Problem",
  general: "Allgemeine Anfrage",
};

const statusLabels: Record<OnlineRequestStatus, string> = {
  new: "Neu",
  in_review: "In Bearbeitung",
  waiting_customer: "Wartet auf Rückmeldung",
  converted: "In Projekt umgewandelt",
  closed: "Abgeschlossen",
};

const preferredContactLabels: Record<
  OnlineRequestViewItem["preferredContact"],
  string
> = {
  email: "E-Mail",
  phone: "Telefon",
  either: "E-Mail oder Telefon",
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "");
}

export function filterOnlineRequests(
  requests: OnlineRequestViewItem[],
  filter: OnlineRequestWorkspaceFilter,
  search: string
) {
  const needle = normalize(search.trim());
  return requests.filter((request) => {
    const matchesStatus =
      filter === "all" ||
      (filter === "active"
        ? ["new", "in_review", "waiting_customer"].includes(request.status)
        : request.status === filter);
    if (!matchesStatus) return false;
    if (!needle) return true;
    return normalize(
      [
        request.referenceNumber,
        request.company,
        request.firstName,
        request.lastName,
        request.email,
        request.phone,
        request.tradeName,
        request.description,
        request.street,
        request.postalCode,
        request.city,
      ]
        .filter(Boolean)
        .join(" ")
    ).includes(needle);
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "–";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "–";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(date);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "–";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return "–";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeZone: "Europe/Berlin",
  }).format(date);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function customerName(request: OnlineRequestViewItem) {
  return (
    request.company?.trim() ||
    [request.firstName, request.lastName].filter(Boolean).join(" ") ||
    "Kontakt nicht benannt"
  );
}

function requestAgeLabel(value: string) {
  const created = new Date(value).getTime();
  if (!Number.isFinite(created)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - created) / 60_000));
  if (minutes < 60) return `vor ${Math.max(1, minutes)} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} ${days === 1 ? "Tag" : "Tagen"}`;
}

export function OnlineRequestsWorkspace({
  actorId,
  requests,
  selectedId,
  statusFilter,
  search,
  users,
  contacts,
  error,
  loading,
  saving,
  converting,
  onSelectedIdChange,
  onStatusFilterChange,
  onSearchChange,
  onRefresh,
  onUpdate,
  onConvert,
  onOpenProject,
}: {
  actorId: string;
  requests: OnlineRequestViewItem[];
  selectedId: string;
  statusFilter: OnlineRequestWorkspaceFilter;
  search: string;
  users: OnlineRequestWorkspaceUser[];
  contacts: OnlineRequestWorkspaceContact[];
  error: string;
  loading: boolean;
  saving: boolean;
  converting: boolean;
  onSelectedIdChange: (id: string) => void;
  onStatusFilterChange: (filter: OnlineRequestWorkspaceFilter) => void;
  onSearchChange: (search: string) => void;
  onRefresh: () => void;
  onUpdate: (
    request: OnlineRequestViewItem,
    changes: {
      status?: OnlineRequestStatus;
      assignedUserId?: string;
      customerDecision?: OnlineRequestCustomerDecision;
      matchedContactId?: string;
    }
  ) => void;
  onConvert: (request: OnlineRequestViewItem) => void;
  onOpenProject: (projectId: string) => void;
}) {
  const filteredRequests = filterOnlineRequests(
    requests,
    statusFilter,
    search
  );
  const selected =
    filteredRequests.find((request) => request.id === selectedId) ??
    requests.find((request) => request.id === selectedId) ??
    filteredRequests[0];
  const canConvert =
    Boolean(selected) &&
    selected.status !== "converted" &&
    selected.status !== "closed" &&
    (selected.customerDecision === "new" ||
      (selected.customerDecision === "existing" &&
        Boolean(selected.matchedContactId)));

  return (
    <section className={styles.workspace}>
      <header className={styles.hero}>
        <div>
          <p>Lead & Klärung</p>
          <h1>Online-Anfragen</h1>
          <span>
            Neue Formularanfragen prüfen, persönlich zuordnen und kontrolliert
            in ein neues Projekt überführen.
          </span>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading}>
          {loading ? "Wird geladen …" : "Aktualisieren"}
        </button>
      </header>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <span className={styles.srOnly}>Online-Anfragen durchsuchen</span>
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Referenz, Kunde, Gewerk, Ort oder Text suchen"
          />
        </label>
        <label>
          <span className={styles.srOnly}>Status filtern</span>
          <select
            value={statusFilter}
            onChange={(event) =>
              onStatusFilterChange(
                event.target.value as OnlineRequestWorkspaceFilter
              )
            }
          >
            <option value="active">Aktive Anfragen</option>
            <option value="new">Nur neue</option>
            <option value="in_review">In Bearbeitung</option>
            <option value="waiting_customer">Wartet auf Rückmeldung</option>
            <option value="converted">Umgewandelt</option>
            <option value="closed">Abgeschlossen</option>
            <option value="all">Alle</option>
          </select>
        </label>
      </div>

      {error ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : null}

      <div className={styles.contentGrid}>
        <aside className={styles.list} aria-label="Online-Anfragen">
          <div className={styles.listHeader}>
            <strong>{filteredRequests.length} Anfragen</strong>
            <span>
              {requests.filter((request) => request.status === "new").length} neu
            </span>
          </div>
          {loading && requests.length === 0 ? (
            <div className={styles.empty}>Anfragen werden geladen …</div>
          ) : filteredRequests.length === 0 ? (
            <div className={styles.empty}>
              Keine Anfrage passt zu diesem Filter.
            </div>
          ) : (
            filteredRequests.map((request) => (
              <button
                type="button"
                key={request.id}
                className={styles.requestCard}
                data-active={selected?.id === request.id}
                data-status={request.status}
                onClick={() => onSelectedIdChange(request.id)}
              >
                <span className={styles.requestCardTop}>
                  <strong>{customerName(request)}</strong>
                  <em data-status={request.status}>
                    {statusLabels[request.status]}
                  </em>
                </span>
                <span className={styles.requestCardMeta}>
                  {request.referenceNumber} ·{" "}
                  {requestTypeLabels[request.requestType]}
                </span>
                <span className={styles.requestCardTrade}>
                  {request.tradeName || "Gewerk noch offen"}
                </span>
                <span className={styles.requestCardBottom}>
                  <small>
                    {[request.postalCode, request.city]
                      .filter(Boolean)
                      .join(" ") || "Ort nicht angegeben"}
                  </small>
                  <small>{requestAgeLabel(request.createdAt)}</small>
                </span>
              </button>
            ))
          )}
        </aside>

        <main className={styles.detail}>
          {!selected ? (
            <div className={styles.detailEmpty}>
              <strong>Keine Anfrage ausgewählt</strong>
              <span>Wähle links eine Anfrage zur Bearbeitung aus.</span>
            </div>
          ) : (
            <>
              <header className={styles.detailHeader}>
                <div>
                  <span>{selected.referenceNumber}</span>
                  <h2>{customerName(selected)}</h2>
                  <p>
                    {requestTypeLabels[selected.requestType]} ·{" "}
                    {selected.tradeName || "Gewerk noch offen"} · eingegangen{" "}
                    {formatDateTime(selected.createdAt)}
                  </p>
                </div>
                <span
                  className={styles.statusPill}
                  data-status={selected.status}
                >
                  {statusLabels[selected.status]}
                </span>
              </header>

              <section className={styles.actionBar}>
                <label>
                  <span>Verantwortlich</span>
                  <select
                    value={selected.assignedUserId ?? ""}
                    disabled={saving || selected.status === "converted"}
                    onChange={(event) =>
                      onUpdate(selected, {
                        assignedUserId: event.target.value,
                        status:
                          selected.status === "new"
                            ? "in_review"
                            : selected.status,
                      })
                    }
                  >
                    <option value="">Noch nicht zugewiesen</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Bearbeitungsstand</span>
                  <select
                    value={selected.status}
                    disabled={saving || selected.status === "converted"}
                    onChange={(event) =>
                      onUpdate(selected, {
                        status: event.target.value as OnlineRequestStatus,
                      })
                    }
                  >
                    <option value="new">Neu</option>
                    <option value="in_review">In Bearbeitung</option>
                    <option value="waiting_customer">
                      Wartet auf Rückmeldung
                    </option>
                    <option value="closed">Abgeschlossen</option>
                    {selected.status === "converted" ? (
                      <option value="converted">In Projekt umgewandelt</option>
                    ) : null}
                  </select>
                </label>
                {selected.status === "new" ? (
                  <button
                    type="button"
                    className={styles.claimButton}
                    disabled={saving}
                    onClick={() =>
                      onUpdate(selected, {
                        assignedUserId: actorId,
                        status: "in_review",
                      })
                    }
                  >
                    Bearbeitung übernehmen
                  </button>
                ) : null}
              </section>

              <div className={styles.detailColumns}>
                <div className={styles.primaryColumn}>
                  <section className={styles.infoCard}>
                    <header>
                      <div>
                        <span>Anliegen</span>
                        <h3>Originalbeschreibung</h3>
                      </div>
                      {selected.urgency ? (
                        <em>
                          {getOnlineRequestUrgencyLabel(selected.urgency)}
                        </em>
                      ) : null}
                    </header>
                    <p className={styles.description}>
                      {selected.description}
                    </p>
                  </section>

                  <section className={styles.infoCard}>
                    <header>
                      <div>
                        <span>Einsatzort</span>
                        <h3>Objekt und Adresse</h3>
                      </div>
                    </header>
                    <dl className={styles.factGrid}>
                      <div>
                        <dt>Straße</dt>
                        <dd>{selected.street || "–"}</dd>
                      </div>
                      <div>
                        <dt>Ort</dt>
                        <dd>
                          {[selected.postalCode, selected.city]
                            .filter(Boolean)
                            .join(" ") || "–"}
                        </dd>
                      </div>
                      <div className={styles.fullFact}>
                        <dt>Hinweis zum Objekt</dt>
                        <dd>{selected.objectHint || "–"}</dd>
                      </div>
                    </dl>
                  </section>

                  {(selected.desiredDate ||
                    selected.desiredTimeWindow ||
                    selected.callbackTimeWindow) && (
                    <section className={styles.infoCard}>
                      <header>
                        <div>
                          <span>Terminbezug</span>
                          <h3>Unverbindlicher Kundenwunsch</h3>
                        </div>
                      </header>
                      <dl className={styles.factGrid}>
                        <div>
                          <dt>Wunschdatum</dt>
                          <dd>{formatDate(selected.desiredDate)}</dd>
                        </div>
                        <div>
                          <dt>Zeitfenster</dt>
                          <dd>
                            {getOnlineRequestTimeWindowLabel(
                              selected.desiredTimeWindow
                            ) || "–"}
                          </dd>
                        </div>
                        <div className={styles.fullFact}>
                          <dt>Rückrufzeit</dt>
                          <dd>
                            {getOnlineRequestTimeWindowLabel(
                              selected.callbackTimeWindow
                            ) || "–"}
                          </dd>
                        </div>
                      </dl>
                      <p className={styles.hint}>
                        Der Wunsch ist noch keine Terminbestätigung. Bei der
                        Umwandlung kann daraus gezielt eine Rückruf- oder
                        Terminaufgabe entstehen.
                      </p>
                    </section>
                  )}

                  {selected.recommendationNames.length > 0 ? (
                    <section className={styles.infoCard}>
                      <header>
                        <div>
                          <span>Zusatzinteresse</span>
                          <h3>Das möchte der Kunde mitprüfen lassen</h3>
                        </div>
                      </header>
                      <div className={styles.tags}>
                        {selected.recommendationNames.map((name) => (
                          <span key={name}>{name}</span>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  <section className={styles.infoCard}>
                    <header>
                      <div>
                        <span>Anfragebilder</span>
                        <h3>{selected.photos.length} hochgeladene Fotos</h3>
                      </div>
                    </header>
                    {selected.photos.length ? (
                      <div className={styles.photoGrid}>
                        {selected.photos.map((photo) => (
                          <a
                            key={photo.id}
                            href={`${photo.url}?actorId=${encodeURIComponent(
                              actorId
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`${photo.url}?actorId=${encodeURIComponent(
                                actorId
                              )}`}
                              alt={`Anfragebild ${photo.sortOrder + 1}`}
                            />
                            <span>
                              {photo.fileName} · {formatBytes(photo.byteSize)}
                            </span>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.muted}>Keine Fotos hochgeladen.</p>
                    )}
                  </section>
                </div>

                <aside className={styles.secondaryColumn}>
                  <section className={styles.infoCard}>
                    <header>
                      <div>
                        <span>Kontakt</span>
                        <h3>Rückmeldung an</h3>
                      </div>
                    </header>
                    <dl className={styles.contactFacts}>
                      {selected.company ? (
                        <div>
                          <dt>Firma</dt>
                          <dd>{selected.company}</dd>
                        </div>
                      ) : null}
                      <div>
                        <dt>Name</dt>
                        <dd>
                          {[selected.firstName, selected.lastName]
                            .filter(Boolean)
                            .join(" ") || "–"}
                        </dd>
                      </div>
                      <div>
                        <dt>E-Mail</dt>
                        <dd>
                          {selected.email ? (
                            <a href={`mailto:${selected.email}`}>
                              {selected.email}
                            </a>
                          ) : (
                            "–"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Telefon</dt>
                        <dd>
                          {selected.phone ? (
                            <a href={`tel:${selected.phone}`}>
                              {selected.phone}
                            </a>
                          ) : (
                            "–"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Bevorzugt</dt>
                        <dd>
                          {preferredContactLabels[selected.preferredContact]}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section className={styles.decisionCard}>
                    <span>Kundenprüfung</span>
                    <h3>Wie soll die Anfrage zugeordnet werden?</h3>
                    <p>
                      WorkPilot verbindet die Anfrage nie automatisch mit
                      einem bestehenden Projekt.
                    </p>
                    <div className={styles.decisionButtons}>
                      <button
                        type="button"
                        data-active={selected.customerDecision === "existing"}
                        disabled={saving || selected.status === "converted"}
                        onClick={() =>
                          onUpdate(selected, {
                            customerDecision: "existing",
                            matchedContactId:
                              selected.matchedContactId || contacts[0]?.id || "",
                          })
                        }
                      >
                        Vorhandener Kunde
                      </button>
                      <button
                        type="button"
                        data-active={selected.customerDecision === "new"}
                        disabled={saving || selected.status === "converted"}
                        onClick={() =>
                          onUpdate(selected, {
                            customerDecision: "new",
                            matchedContactId: "",
                          })
                        }
                      >
                        Neuen Kunden anlegen
                      </button>
                      <button
                        type="button"
                        data-active={selected.customerDecision === "unresolved"}
                        disabled={saving || selected.status === "converted"}
                        onClick={() =>
                          onUpdate(selected, {
                            customerDecision: "unresolved",
                            matchedContactId: "",
                          })
                        }
                      >
                        Noch nicht eindeutig
                      </button>
                    </div>
                    {selected.customerDecision === "existing" ? (
                      <label className={styles.contactSelect}>
                        <span>Kunde auswählen</span>
                        <select
                          value={selected.matchedContactId ?? ""}
                          disabled={saving || selected.status === "converted"}
                          onChange={(event) =>
                            onUpdate(selected, {
                              customerDecision: "existing",
                              matchedContactId: event.target.value,
                            })
                          }
                        >
                          <option value="">Bitte eindeutig auswählen</option>
                          {contacts.map((contact) => (
                            <option key={contact.id} value={contact.id}>
                              {contact.label}
                              {contact.detail ? ` · ${contact.detail}` : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </section>

                  <section className={styles.convertCard}>
                    <span>Geführte Übernahme</span>
                    <h3>Neues Projekt erstellen</h3>
                    <p>
                      Erstellt immer ein separates Projekt unter{" "}
                      <strong>OK immocare → Lead / Klärung</strong>. Beschreibung
                      und Bilder bleiben als Originalnachweis erhalten.
                    </p>
                    {selected.status === "converted" &&
                    selected.convertedProjectId ? (
                      <button
                        type="button"
                        className={styles.convertButton}
                        onClick={() =>
                          onOpenProject(selected.convertedProjectId as string)
                        }
                      >
                        Angelegtes Projekt öffnen
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.convertButton}
                        disabled={!canConvert || saving || converting}
                        onClick={() => onConvert(selected)}
                      >
                        {converting
                          ? "Projekt wird sicher angelegt …"
                          : "Als Lead / Klärung übernehmen"}
                      </button>
                    )}
                    {!canConvert && selected.status !== "converted" ? (
                      <small>
                        Vorher muss eindeutig entschieden werden, ob ein
                        bestehender oder ein neuer Kunde verwendet wird.
                      </small>
                    ) : null}
                  </section>

                  <section className={styles.infoCard}>
                    <header>
                      <div>
                        <span>Verlauf</span>
                        <h3>Bearbeitungsnachweis</h3>
                      </div>
                    </header>
                    <ol className={styles.auditList}>
                      {selected.auditEvents.slice(0, 8).map((event) => (
                        <li key={event.id}>
                          <span />
                          <div>
                            <strong>
                              {event.eventType === "submitted"
                                ? "Online eingegangen"
                                : event.eventType === "review_updated"
                                  ? "Prüfung aktualisiert"
                                  : event.eventType === "converted"
                                    ? "In Projekt umgewandelt"
                                    : event.eventType}
                            </strong>
                            <small>
                              {event.actorName} ·{" "}
                              {formatDateTime(event.createdAt)}
                            </small>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                </aside>
              </div>
            </>
          )}
        </main>
      </div>
    </section>
  );
}
