"use client";

import Image from "next/image";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ONLINE_REQUEST_TYPES,
  buildOnlineRequestServiceOptions,
  getOnlineRequestOptionRecommendations,
  getOnlineRequestTimeWindowLabel,
  getOnlineRequestUrgencyLabel,
  type OnlineRequestServiceOption,
  type OnlineRequestType,
} from "@/lib/online-requests/form-config";
import { solveOnlineRequestProof } from "@/lib/online-requests/client-security";
import styles from "./public-request-form.module.css";

type PhotoPreview = {
  file: File;
  url: string;
};

type FormState = {
  requestType: OnlineRequestType;
  serviceId: string;
  recommendationIds: string[];
  desiredDate: string;
  desiredTimeWindow: string;
  callbackTimeWindow: string;
  urgency: string;
  street: string;
  postalCode: string;
  city: string;
  objectHint: string;
  description: string;
  customerKind: "private" | "business";
  company: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  preferredContact: "email" | "phone" | "either";
  privacyAccepted: boolean;
};

type PortalSession = {
  sessionToken: string;
  challenge: string;
  difficulty: number;
  expiresAt: string;
  turnstileSiteKey: string | null;
};

type PortalResponse = {
  portal: {
    slug: string;
    displayName: string;
    trades: Array<{ id: string; name: string }>;
  };
  security: PortalSession;
};

type SubmissionResult = {
  referenceNumber: string;
  submittedAt: string;
  duplicate: boolean;
};

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      theme: "light";
      size: "flexible";
    }
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT_ID = "ok-immocare-turnstile";

const initialFormState: FormState = {
  requestType: "offer",
  serviceId: "",
  recommendationIds: [],
  desiredDate: "",
  desiredTimeWindow: "flexible",
  callbackTimeWindow: "flexible",
  urgency: "normal",
  street: "",
  postalCode: "",
  city: "",
  objectHint: "",
  description: "",
  customerKind: "private",
  company: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  preferredContact: "either",
  privacyAccepted: false,
};

function Icon({
  name,
  size = 20,
}: {
  name: string;
  size?: number;
}) {
  let content: ReactNode;
  switch (name) {
    case "document":
      content = (
        <>
          <path d="M6 2.75h7l5 5V21.25H6z" />
          <path d="M13 2.75v5h5M9 12h6M9 16h6" />
        </>
      );
      break;
    case "phone":
      content = (
        <path d="M7.3 3.5 4.8 5.2c-.8.5-.8 1.4-.5 2.3 1.7 5.5 6 9.8 11.5 11.5.9.3 1.8.3 2.3-.5l1.7-2.5-4-2.5-1.6 1.6c-2.5-1-4.6-3.1-5.6-5.6l1.6-1.6z" />
      );
      break;
    case "calendar":
      content = (
        <>
          <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
          <path d="M7.5 3v5M16.5 3v5M3.5 10h17M8 15l2.2 2.2L16 12.5" />
        </>
      );
      break;
    case "alert":
      content = (
        <>
          <path d="m12 3 9 17H3z" />
          <path d="M12 9v5M12 17.5v.1" />
        </>
      );
      break;
    case "message":
      content = (
        <>
          <path d="M4 4.5h16v12H9l-5 4z" />
          <path d="M8 9h8M8 12.5h5" />
        </>
      );
      break;
    case "building":
      content = (
        <>
          <path d="M4 21V4h11v17M15 9h5v12M8 8h3M8 12h3M8 16h3M18 13h.1M18 17h.1" />
        </>
      );
      break;
    case "tool":
    case "wrench":
      content = (
        <path d="M14.5 5.2a5 5 0 0 0-6.7 6.7L3.5 16.2a2.8 2.8 0 0 0 4 4l4.3-4.3a5 5 0 0 0 6.7-6.7l-3.1 3.1-3.7-3.7z" />
      );
      break;
    case "leaf":
      content = (
        <>
          <path d="M20.5 3.5C12 3.5 5 7.2 5 13.4A5.6 5.6 0 0 0 10.6 19c6.1 0 9.9-7 9.9-15.5Z" />
          <path d="M4 21c2.6-5.4 6.7-9.1 12.5-11.5" />
        </>
      );
      break;
    case "snow":
      content = (
        <>
          <path d="M12 2v20M4 7l16 10M4 17 20 7M8.5 4 12 7.5 15.5 4M8.5 20l3.5-3.5 3.5 3.5" />
        </>
      );
      break;
    case "sun":
      content = (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </>
      );
      break;
    case "sparkle":
      content = (
        <>
          <path d="m12 2 1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5zM19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z" />
        </>
      );
      break;
    case "clean":
      content = (
        <>
          <path d="m5 3 5 4-4 13M10 7l7-2 2 4-9 3" />
          <path d="M10 16h10M12 20h8" />
        </>
      );
      break;
    case "facade":
      content = (
        <>
          <path d="M4 21V5l8-3 8 3v16M8 8h2M14 8h2M8 12h2M14 12h2M8 16h2M14 16h2" />
        </>
      );
      break;
    case "home":
      content = (
        <>
          <path d="m3 11 9-8 9 8M5.5 9v12h13V9M9.5 21v-6h5v6" />
        </>
      );
      break;
    case "help":
      content = (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.8 9a2.4 2.4 0 1 1 3.8 2c-1.1.8-1.6 1.2-1.6 2.5M12 17.5v.1" />
        </>
      );
      break;
    case "camera":
      content = (
        <>
          <path d="M4 7h4l1.4-2h5.2L16 7h4v13H4z" />
          <circle cx="12" cy="13.5" r="3.5" />
        </>
      );
      break;
    case "shield":
      content = (
        <>
          <path d="M12 2.5 20 6v6c0 5-3.2 8.2-8 9.5C7.2 20.2 4 17 4 12V6z" />
          <path d="m8.5 12 2.2 2.2 4.8-5" />
        </>
      );
      break;
    case "clock":
      content = (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      );
      break;
    case "check":
      content = <path d="m5 12.5 4.2 4.2L19 7" />;
      break;
    case "plus":
      content = <path d="M12 5v14M5 12h14" />;
      break;
    case "arrow":
      content = <path d="M5 12h14M14 7l5 5-5 5" />;
      break;
    case "back":
      content = <path d="m14 6-6 6 6 6" />;
      break;
    case "trash":
      content = (
        <>
          <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />
        </>
      );
      break;
    default:
      content = <circle cx="12" cy="12" r="8" />;
  }
  return (
    <svg
      aria-hidden="true"
      className={styles.icon}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      >
        {content}
      </g>
    </svg>
  );
}

function SectionHeading({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description?: string;
}) {
  return (
    <div className={styles.sectionHeading}>
      <span className={styles.stepNumber}>{step}</span>
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
    </div>
  );
}

function formatRequestDate(value: string) {
  const date = new Date(`${value}T12:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "long",
    timeZone: "Europe/Berlin",
  }).format(date);
}

function TurnstileChallenge({
  siteKey,
  onTokenChange,
}: {
  siteKey: string;
  onTokenChange: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  useEffect(() => {
    let disposed = false;
    let script = document.getElementById(
      TURNSTILE_SCRIPT_ID
    ) as HTMLScriptElement | null;

    function renderWidget() {
      if (
        disposed ||
        widgetIdRef.current ||
        !window.turnstile ||
        !containerRef.current
      ) {
        return;
      }
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action: "online_request",
          callback: (token) => {
            if (disposed) return;
            setStatus("ready");
            onTokenChange(token);
          },
          "expired-callback": () => {
            if (disposed) return;
            setStatus("loading");
            onTokenChange("");
          },
          "error-callback": () => {
            if (disposed) return;
            setStatus("error");
            onTokenChange("");
          },
          theme: "light",
          size: "flexible",
        });
      } catch {
        setStatus("error");
      }
    }

    onTokenChange("");
    if (window.turnstile) {
      renderWidget();
    } else {
      if (!script) {
        script = document.createElement("script");
        script.id = TURNSTILE_SCRIPT_ID;
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", renderWidget);
      script.addEventListener("error", () => {
        if (!disposed) setStatus("error");
      });
    }

    return () => {
      disposed = true;
      script?.removeEventListener("load", renderWidget);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
      onTokenChange("");
    };
  }, [onTokenChange, siteKey]);

  return (
    <div className={styles.turnstilePanel}>
      <div ref={containerRef} />
      {status === "loading" ? (
        <small>Sicherheitsprüfung wird vorbereitet …</small>
      ) : null}
      {status === "error" ? (
        <small className={styles.turnstileError}>
          Die Sicherheitsprüfung konnte nicht geladen werden. Bitte prüfen Sie
          Ihre Internetverbindung und laden Sie die Seite neu.
        </small>
      ) : null}
    </div>
  );
}

export function PublicRequestForm() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const photosRef = useRef<PhotoPreview[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [contactError, setContactError] = useState("");
  const [reviewMode, setReviewMode] = useState(false);
  const [services, setServices] = useState<OnlineRequestServiceOption[]>([]);
  const [portalSession, setPortalSession] = useState<PortalSession | null>(null);
  const [portalStatus, setPortalStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [portalError, setPortalError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [isLocalPreview, setIsLocalPreview] = useState(false);
  const [website, setWebsite] = useState("");
  const [submissionStatus, setSubmissionStatus] = useState<
    "idle" | "securing" | "submitting"
  >("idle");
  const [submissionError, setSubmissionError] = useState("");
  const [submissionResult, setSubmissionResult] =
    useState<SubmissionResult | null>(null);
  const clientSubmissionIdRef = useRef("");

  const selectedService = services.find(
    (service) => service.id === form.serviceId
  );
  const recommendations = useMemo(
    () => getOnlineRequestOptionRecommendations(form.serviceId, services),
    [form.serviceId, services]
  );
  const selectedRecommendations = recommendations.filter((service) =>
    form.recommendationIds.includes(service.id)
  );
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    setIsLocalPreview(
      window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
    );
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadPortalSession() {
      setPortalStatus("loading");
      setPortalError("");
      try {
        const response = await fetch(
          "/api/public/online-requests/session?portal=ok-immocare",
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );
        const result = (await response.json()) as
          | PortalResponse
          | { error?: string };
        if (!response.ok || !("portal" in result)) {
          throw new Error(
            ("error" in result && result.error) ||
              "Das Anfrageportal konnte nicht geladen werden."
          );
        }
        const nextServices = buildOnlineRequestServiceOptions(
          result.portal.trades
        );
        if (!nextServices.length) {
          throw new Error(
            "Für dieses Anfrageportal sind keine Leistungen verfügbar."
          );
        }
        setServices(nextServices);
        setPortalSession(result.security);
        setForm((current) => ({
          ...current,
          serviceId: nextServices.some(
            (service) => service.id === current.serviceId
          )
            ? current.serviceId
            : "",
          recommendationIds: [],
        }));
        setPortalStatus("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        setPortalStatus("error");
        setPortalError(
          error instanceof Error
            ? error.message
            : "Das Anfrageportal konnte nicht geladen werden."
        );
      }
    }
    void loadPortalSession();
    return () => controller.abort();
  }, []);

  useEffect(
    () => () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    },
    []
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectService(serviceId: string) {
    setForm((current) => ({
      ...current,
      serviceId,
      recommendationIds: [],
    }));
  }

  function selectRequestType(requestType: OnlineRequestType) {
    setForm((current) => ({
      ...current,
      requestType,
      recommendationIds:
        requestType === "offer" ? current.recommendationIds : [],
    }));
  }

  function toggleRecommendation(serviceId: string) {
    setForm((current) => ({
      ...current,
      recommendationIds: current.recommendationIds.includes(serviceId)
        ? current.recommendationIds.filter((id) => id !== serviceId)
        : [...current.recommendationIds, serviceId],
    }));
  }

  function handlePhotoSelection(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    setPhotoError("");
    if (photos.length + incoming.length > 6) {
      setPhotoError("Es können maximal 6 Fotos hochgeladen werden.");
      event.target.value = "";
      return;
    }
    const invalid = incoming.find(
      (file) =>
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 8 * 1024 * 1024
    );
    if (invalid) {
      setPhotoError(
        "Bitte nur JPG-, PNG- oder WebP-Bilder bis jeweils 8 MB auswählen."
      );
      event.target.value = "";
      return;
    }
    setPhotos((current) => [
      ...current,
      ...incoming.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    ]);
    event.target.value = "";
  }

  function removePhoto(index: number) {
    setPhotos((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((_, photoIndex) => photoIndex !== index);
    });
  }

  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setContactError("");
    if (!form.email.trim() && !form.phone.trim()) {
      setContactError(
        "Bitte geben Sie eine E-Mail-Adresse oder Telefonnummer an."
      );
      document
        .getElementById("online-contact")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setReviewMode(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmitRequest() {
    if (!portalSession || !selectedService || submissionStatus !== "idle") {
      return;
    }
    setSubmissionError("");
    try {
      setSubmissionStatus("securing");
      const proof = await solveOnlineRequestProof({
        challenge: portalSession.challenge,
        difficulty: portalSession.difficulty,
      });
      setSubmissionStatus("submitting");
      if (!clientSubmissionIdRef.current) {
        clientSubmissionIdRef.current = crypto.randomUUID();
      }
      const metadata = {
        sessionToken: portalSession.sessionToken,
        proof,
        turnstileToken: turnstileToken || undefined,
        website,
        clientSubmissionId: clientSubmissionIdRef.current,
        requestType: form.requestType,
        tradeId: form.serviceId,
        recommendationTradeIds: form.recommendationIds,
        desiredDate: form.desiredDate || undefined,
        desiredTimeWindow:
          form.requestType === "execution"
            ? form.desiredTimeWindow
            : undefined,
        callbackTimeWindow:
          form.requestType === "callback"
            ? form.callbackTimeWindow
            : undefined,
        urgency: form.requestType === "issue" ? form.urgency : undefined,
        street: form.street,
        postalCode: form.postalCode,
        city: form.city,
        objectHint: form.objectHint || undefined,
        description: form.description,
        customerKind: form.customerKind,
        company:
          form.customerKind === "business" ? form.company : undefined,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email || undefined,
        phone: form.phone || undefined,
        preferredContact: form.preferredContact,
        consent: form.privacyAccepted,
      };
      const payload = new FormData();
      payload.set("metadata", JSON.stringify(metadata));
      photos.forEach((photo) => payload.append("photos", photo.file));
      const response = await fetch(
        "/api/public/online-requests/submit?portal=ok-immocare",
        {
          method: "POST",
          body: payload,
        }
      );
      const result = (await response.json()) as
        | SubmissionResult
        | { error?: string };
      if (!response.ok || !("referenceNumber" in result)) {
        throw new Error(
          ("error" in result && result.error) ||
            "Die Anfrage konnte nicht übertragen werden."
        );
      }
      setSubmissionResult(result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "Die Anfrage konnte nicht übertragen werden."
      );
    } finally {
      setSubmissionStatus("idle");
    }
  }

  const requestTypeLabel =
    ONLINE_REQUEST_TYPES.find((type) => type.id === form.requestType)?.label ??
    "";

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroInner}>
          <div className={styles.brandRow}>
            <Image
              alt="OK immocare"
              className={styles.logo}
              height={88}
              priority
              src="/ok-immocare-logo.png"
              width={112}
            />
            {isLocalPreview ? (
              <span className={styles.previewBadge}>Formular-Vorschau</span>
            ) : null}
          </div>
          <div className={styles.heroContent}>
            <span className={styles.eyebrow}>Direkt. Einfach. Persönlich.</span>
            <h1>Wie können wir Ihnen helfen?</h1>
            <p>
              Teilen Sie uns Ihr Anliegen in wenigen Schritten mit. Wir prüfen
              Ihre Anfrage persönlich und melden uns schnellstmöglich zurück.
            </p>
          </div>
          <div className={styles.trustRow}>
            <span>
              <Icon name="clock" size={18} />
              In 2–3 Minuten erledigt
            </span>
            <span>
              <Icon name="shield" size={18} />
              Sicher übertragen
            </span>
            <span>
              <Icon name="message" size={18} />
              Persönliche Rückmeldung
            </span>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        {isLocalPreview ? (
          <div className={styles.previewNotice}>
            <Icon name="shield" size={18} />
            <span>
              Entwicklungsvorschau: Erfolgreich abgesendete Testanfragen werden
              ausschließlich im lokalen WorkPilot gespeichert.
            </span>
          </div>
        ) : null}

        {submissionResult ? (
          <section className={styles.successCard}>
            <span className={styles.successIcon}>
              <Icon name="check" size={32} />
            </span>
            <span className={styles.eyebrowDark}>Sicher übermittelt</span>
            <h1>Vielen Dank für Ihre Anfrage.</h1>
            <p>
              Wir haben Ihr Anliegen erhalten und melden uns so schnell wie
              möglich persönlich bei Ihnen.
            </p>
            <div className={styles.referenceNumber}>
              <span>Ihre Referenznummer</span>
              <strong>{submissionResult.referenceNumber}</strong>
            </div>
            <p className={styles.successHint}>
              Bitte geben Sie diese Nummer bei Rückfragen an. Aus Ihrer Anfrage
              ist noch kein Auftrag entstanden.
            </p>
          </section>
        ) : reviewMode ? (
          <section className={styles.reviewCard}>
            <button
              className={styles.backButton}
              onClick={() => setReviewMode(false)}
              type="button"
            >
              <Icon name="back" size={18} />
              Angaben bearbeiten
            </button>
            <div className={styles.reviewHeader}>
              <span className={styles.reviewIcon}>
                <Icon name="check" size={28} />
              </span>
              <div>
                <span className={styles.eyebrowDark}>Fast geschafft</span>
                <h1>Ihre Anfrage im Überblick</h1>
                <p>
                  Bitte prüfen Sie Ihre Angaben. Erst mit dem nächsten Klick
                  wird die Anfrage sicher an OK immocare übertragen.
                </p>
              </div>
            </div>
            <div className={styles.reviewGrid}>
              <div>
                <span>Anliegen</span>
                <strong>{requestTypeLabel}</strong>
              </div>
              <div>
                <span>Hauptleistung</span>
                <strong>{selectedService?.label}</strong>
              </div>
              <div className={styles.reviewWide}>
                <span>Adresse</span>
                <strong>
                  {form.street}, {form.postalCode} {form.city}
                </strong>
              </div>
              {selectedRecommendations.length ? (
                <div className={styles.reviewWide}>
                  <span>Zusätzlich unverbindlich mitprüfen</span>
                  <strong>
                    {selectedRecommendations
                      .map((service) => service.label)
                      .join(", ")}
                  </strong>
                </div>
              ) : null}
              {form.requestType === "execution" ? (
                <div className={styles.reviewWide}>
                  <span>Unverbindlicher Terminwunsch</span>
                  <strong>
                    {form.desiredDate
                      ? `${formatRequestDate(
                          form.desiredDate
                        )} · ${getOnlineRequestTimeWindowLabel(
                          form.desiredTimeWindow
                        )}`
                      : "Kein Datum angegeben · zeitlich flexibel"}
                  </strong>
                </div>
              ) : null}
              {form.requestType === "callback" ? (
                <div className={styles.reviewWide}>
                  <span>Gewünschte Rückrufzeit</span>
                  <strong>
                    {getOnlineRequestTimeWindowLabel(form.callbackTimeWindow)}
                  </strong>
                </div>
              ) : null}
              {form.requestType === "issue" ? (
                <div className={styles.reviewWide}>
                  <span>Dringlichkeit</span>
                  <strong>
                    {getOnlineRequestUrgencyLabel(form.urgency)}
                  </strong>
                </div>
              ) : null}
              <div className={styles.reviewWide}>
                <span>Beschreibung</span>
                <strong>{form.description}</strong>
              </div>
              <div>
                <span>Kontakt</span>
                <strong>
                  {form.firstName} {form.lastName}
                </strong>
              </div>
              <div>
                <span>Erreichbarkeit</span>
                <strong>{form.email || form.phone}</strong>
              </div>
              <div>
                <span>Fotos</span>
                <strong>
                  {photos.length
                    ? `${photos.length} Foto${photos.length === 1 ? "" : "s"}`
                    : "Keine Fotos"}
                </strong>
              </div>
            </div>
            {submissionError ? (
              <p className={styles.submitError} role="alert">
                {submissionError}
              </p>
            ) : null}
            {portalSession?.turnstileSiteKey ? (
              <TurnstileChallenge
                onTokenChange={setTurnstileToken}
                siteKey={portalSession.turnstileSiteKey}
              />
            ) : null}
            <button
              className={styles.finalSubmit}
              disabled={
                submissionStatus !== "idle" ||
                portalStatus !== "ready" ||
                Boolean(
                  portalSession?.turnstileSiteKey && !turnstileToken
                )
              }
              onClick={() => void handleSubmitRequest()}
              type="button"
            >
              <Icon name="shield" size={19} />
              {submissionStatus === "securing"
                ? "Sicherheitsprüfung läuft …"
                : submissionStatus === "submitting"
                  ? "Anfrage wird übertragen …"
                  : "Anfrage sicher absenden"}
            </button>
          </section>
        ) : (
          <form className={styles.form} onSubmit={handleReview}>
            <section className={styles.formSection}>
              <SectionHeading
                description="Wählen Sie den Grund Ihrer Anfrage."
                step="1"
                title="Was können wir für Sie tun?"
              />
              <div className={styles.requestTypeGrid}>
                {ONLINE_REQUEST_TYPES.map((type) => (
                  <label
                    className={`${styles.requestTypeCard} ${
                      form.requestType === type.id ? styles.selectedCard : ""
                    }`}
                    key={type.id}
                  >
                    <input
                      checked={form.requestType === type.id}
                      name="requestType"
                      onChange={() => selectRequestType(type.id)}
                      type="radio"
                      value={type.id}
                    />
                    <span className={styles.cardIcon}>
                      <Icon name={type.icon} size={23} />
                    </span>
                    <span className={styles.cardCopy}>
                      <strong>{type.label}</strong>
                      <small>{type.description}</small>
                    </span>
                    <span className={styles.selectionMark}>
                      <Icon name="check" size={16} />
                    </span>
                  </label>
                ))}
              </div>

              {form.requestType === "execution" ? (
                <div className={styles.dynamicPanel}>
                  <div className={styles.dynamicTitle}>
                    <Icon name="calendar" size={20} />
                    Ihr unverbindlicher Terminwunsch
                  </div>
                  <div className={styles.twoColumnGrid}>
                    <label>
                      <span>Wunschdatum</span>
                      <input
                        min={today}
                        onChange={(event) =>
                          update("desiredDate", event.target.value)
                        }
                        type="date"
                        value={form.desiredDate}
                      />
                    </label>
                    <label>
                      <span>Bevorzugte Zeit</span>
                      <select
                        onChange={(event) =>
                          update("desiredTimeWindow", event.target.value)
                        }
                        value={form.desiredTimeWindow}
                      >
                        <option value="flexible">Zeitlich flexibel</option>
                        <option value="morning">Vormittags</option>
                        <option value="afternoon">Nachmittags</option>
                      </select>
                    </label>
                  </div>
                  <p>
                    Das Datum ist noch keine Terminbestätigung. Wir prüfen die
                    Verfügbarkeit und stimmen den Termin persönlich mit Ihnen
                    ab.
                  </p>
                </div>
              ) : null}

              {form.requestType === "callback" ? (
                <div className={styles.dynamicPanel}>
                  <label>
                    <span>Wann erreichen wir Sie am besten?</span>
                    <select
                      onChange={(event) =>
                        update("callbackTimeWindow", event.target.value)
                      }
                      value={form.callbackTimeWindow}
                    >
                      <option value="flexible">Zeitlich flexibel</option>
                      <option value="morning">Vormittags</option>
                      <option value="afternoon">Nachmittags</option>
                    </select>
                  </label>
                </div>
              ) : null}

              {form.requestType === "issue" ? (
                <div className={styles.dynamicPanel}>
                  <label>
                    <span>Wie dringend ist Ihr Anliegen?</span>
                    <select
                      onChange={(event) =>
                        update("urgency", event.target.value)
                      }
                      value={form.urgency}
                    >
                      <option value="normal">Normal</option>
                      <option value="soon">Bitte zeitnah prüfen</option>
                      <option value="urgent">
                        Akut oder sicherheitsrelevant
                      </option>
                    </select>
                  </label>
                </div>
              ) : null}
            </section>

            <section className={styles.formSection}>
              <SectionHeading
                description="Wählen Sie den Bereich, der am besten zu Ihrem Anliegen passt."
                step="2"
                title="Um welche Leistung geht es?"
              />
              <div className={styles.serviceGrid}>
                {portalStatus === "loading" ? (
                  <div className={styles.portalState}>
                    <Icon name="shield" size={22} />
                    Leistungen werden sicher geladen …
                  </div>
                ) : portalStatus === "error" ? (
                  <div className={styles.portalError} role="alert">
                    <strong>Anfrageportal derzeit nicht verfügbar</strong>
                    <span>{portalError}</span>
                  </div>
                ) : null}
                {services.map((service) => (
                  <label
                    className={`${styles.serviceCard} ${
                      form.serviceId === service.id ? styles.selectedCard : ""
                    }`}
                    key={service.id}
                  >
                    <input
                      checked={form.serviceId === service.id}
                      name="service"
                      onChange={() => selectService(service.id)}
                      required
                      type="radio"
                      value={service.id}
                    />
                    <span className={styles.serviceIcon}>
                      <Icon name={service.icon} size={22} />
                    </span>
                    <span>
                      <strong>{service.label}</strong>
                      <small>{service.shortDescription}</small>
                    </span>
                  </label>
                ))}
              </div>

              {form.requestType === "offer" && recommendations.length ? (
                <div className={styles.crossSell}>
                  <div className={styles.crossSellHeading}>
                    <div>
                      <span className={styles.recommendationEyebrow}>
                        Das könnte ebenfalls interessant sein
                      </span>
                      <h3>Passt häufig dazu</h3>
                      <p>
                        Auf Wunsch sehen wir uns diese Bereiche unverbindlich
                        mit an. Es entsteht daraus kein automatischer Auftrag.
                      </p>
                    </div>
                    <span className={styles.optionalBadge}>Optional</span>
                  </div>
                  <div className={styles.recommendationGrid}>
                    {recommendations.map((service) => {
                      const selected = form.recommendationIds.includes(
                        service.id
                      );
                      return (
                        <button
                          aria-pressed={selected}
                          className={`${styles.recommendationCard} ${
                            selected ? styles.selectedRecommendation : ""
                          }`}
                          key={service.id}
                          onClick={() => toggleRecommendation(service.id)}
                          type="button"
                        >
                          <span className={styles.recommendationIcon}>
                            <Icon name={service.icon} size={21} />
                          </span>
                          <span>
                            <strong>{service.label}</strong>
                            <small>Unverbindlich mitprüfen</small>
                          </span>
                          <span className={styles.addMark}>
                            <Icon name={selected ? "check" : "plus"} size={16} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    className={styles.noThanks}
                    onClick={() => update("recommendationIds", [])}
                    type="button"
                  >
                    Nein danke, nur {selectedService?.label}
                  </button>
                </div>
              ) : null}
            </section>

            <section className={styles.formSection}>
              <SectionHeading
                description="Je genauer Ihre Angaben sind, desto schneller können wir Ihr Anliegen einordnen."
                step="3"
                title="Wo und was ist zu tun?"
              />
              <div className={styles.fieldGrid}>
                <label className={styles.fieldWide}>
                  <span>
                    Straße und Hausnummer <b>*</b>
                  </span>
                  <input
                    autoComplete="street-address"
                    onChange={(event) => update("street", event.target.value)}
                    placeholder="z. B. Musterstraße 12"
                    required
                    value={form.street}
                  />
                </label>
                <label>
                  <span>
                    Postleitzahl <b>*</b>
                  </span>
                  <input
                    autoComplete="postal-code"
                    inputMode="numeric"
                    maxLength={10}
                    onChange={(event) =>
                      update("postalCode", event.target.value)
                    }
                    placeholder="74722"
                    required
                    value={form.postalCode}
                  />
                </label>
                <label>
                  <span>
                    Ort <b>*</b>
                  </span>
                  <input
                    autoComplete="address-level2"
                    onChange={(event) => update("city", event.target.value)}
                    placeholder="Buchen"
                    required
                    value={form.city}
                  />
                </label>
                <label className={styles.fieldWide}>
                  <span>Objekt, Bereich oder Zugangshinweis</span>
                  <input
                    onChange={(event) =>
                      update("objectHint", event.target.value)
                    }
                    placeholder="z. B. Gebäude B, Hinterhof, 2. Obergeschoss"
                    value={form.objectHint}
                  />
                </label>
                <label className={styles.fieldWide}>
                  <span>
                    Beschreibung <b>*</b>
                  </span>
                  <textarea
                    maxLength={3000}
                    onChange={(event) =>
                      update("description", event.target.value)
                    }
                    placeholder="Beschreiben Sie kurz, worum es geht und was wir besonders beachten sollen."
                    required
                    rows={6}
                    value={form.description}
                  />
                  <small className={styles.counter}>
                    {form.description.length.toLocaleString("de-DE")} / 3.000
                    Zeichen
                  </small>
                </label>
              </div>

              <div className={styles.photoArea}>
                <div className={styles.photoHeading}>
                  <div className={styles.photoTitle}>
                    <span className={styles.photoTitleIcon}>
                      <Icon name="camera" size={21} />
                    </span>
                    <div>
                      <strong>Fotos hinzufügen</strong>
                      <small>
                        Optional · maximal 6 Bilder · JPG, PNG oder WebP
                      </small>
                    </div>
                  </div>
                  <span>{photos.length}/6</span>
                </div>
                <label className={styles.photoPicker}>
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    multiple
                    onChange={handlePhotoSelection}
                    type="file"
                  />
                  <Icon name="camera" size={26} />
                  <strong>Fotos aufnehmen oder auswählen</strong>
                  <small>
                    Bilder helfen uns, Aufwand und Dringlichkeit schneller
                    einzuschätzen.
                  </small>
                </label>
                {photoError ? (
                  <p className={styles.errorMessage}>{photoError}</p>
                ) : null}
                {photos.length ? (
                  <div className={styles.photoPreviewGrid}>
                    {photos.map((photo, index) => (
                      <div className={styles.photoPreview} key={photo.url}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt={`Vorschau ${index + 1}`} src={photo.url} />
                        <button
                          aria-label={`Foto ${index + 1} entfernen`}
                          onClick={() => removePhoto(index)}
                          type="button"
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>

            <section className={styles.formSection} id="online-contact">
              <SectionHeading
                description="Damit wir Rückfragen klären und Ihnen antworten können."
                step="4"
                title="Wie erreichen wir Sie?"
              />
              <div className={styles.segmentedControl}>
                <label
                  className={
                    form.customerKind === "private"
                      ? styles.activeSegment
                      : ""
                  }
                >
                  <input
                    checked={form.customerKind === "private"}
                    name="customerKind"
                    onChange={() => update("customerKind", "private")}
                    type="radio"
                  />
                  Privatperson
                </label>
                <label
                  className={
                    form.customerKind === "business"
                      ? styles.activeSegment
                      : ""
                  }
                >
                  <input
                    checked={form.customerKind === "business"}
                    name="customerKind"
                    onChange={() => update("customerKind", "business")}
                    type="radio"
                  />
                  Unternehmen
                </label>
              </div>
              <div className={styles.fieldGrid}>
                {form.customerKind === "business" ? (
                  <label className={styles.fieldWide}>
                    <span>
                      Unternehmen <b>*</b>
                    </span>
                    <input
                      autoComplete="organization"
                      onChange={(event) =>
                        update("company", event.target.value)
                      }
                      placeholder="Firmenname"
                      required
                      value={form.company}
                    />
                  </label>
                ) : null}
                <label>
                  <span>
                    Vorname <b>*</b>
                  </span>
                  <input
                    autoComplete="given-name"
                    onChange={(event) =>
                      update("firstName", event.target.value)
                    }
                    required
                    value={form.firstName}
                  />
                </label>
                <label>
                  <span>
                    Nachname <b>*</b>
                  </span>
                  <input
                    autoComplete="family-name"
                    onChange={(event) =>
                      update("lastName", event.target.value)
                    }
                    required
                    value={form.lastName}
                  />
                </label>
                <label>
                  <span>E-Mail-Adresse</span>
                  <input
                    autoComplete="email"
                    onChange={(event) => update("email", event.target.value)}
                    placeholder="name@beispiel.de"
                    type="email"
                    value={form.email}
                  />
                </label>
                <label>
                  <span>Telefonnummer</span>
                  <input
                    autoComplete="tel"
                    onChange={(event) => update("phone", event.target.value)}
                    placeholder="+49 ..."
                    type="tel"
                    value={form.phone}
                  />
                </label>
              </div>
              <p className={styles.fieldHint}>
                Mindestens E-Mail-Adresse oder Telefonnummer ist erforderlich.
              </p>
              {contactError ? (
                <p className={styles.errorMessage}>{contactError}</p>
              ) : null}

              <fieldset className={styles.contactPreference}>
                <legend>Bevorzugte Rückmeldung</legend>
                <div>
                  {[
                    ["either", "E-Mail oder Telefon"],
                    ["email", "Bevorzugt per E-Mail"],
                    ["phone", "Bevorzugt telefonisch"],
                  ].map(([id, label]) => (
                    <label key={id}>
                      <input
                        checked={form.preferredContact === id}
                        name="preferredContact"
                        onChange={() =>
                          update(
                            "preferredContact",
                            id as FormState["preferredContact"]
                          )
                        }
                        type="radio"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className={styles.consent}>
                <input
                  checked={form.privacyAccepted}
                  onChange={(event) =>
                    update("privacyAccepted", event.target.checked)
                  }
                  required
                  type="checkbox"
                />
                <span>
                  Ich habe die{" "}
                  <a
                    href="https://www.ok-immocare.com/kontakt/datenschutz.html"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Datenschutzhinweise
                  </a>{" "}
                  gelesen und bin mit der Verarbeitung meiner Angaben zur
                  Bearbeitung dieser Anfrage einverstanden. <b>*</b>
                </span>
              </label>
            </section>

            <div className={styles.formFooter}>
              <div className={styles.honeypot} aria-hidden="true">
                <label>
                  Webseite
                  <input
                    autoComplete="off"
                    onChange={(event) => setWebsite(event.target.value)}
                    tabIndex={-1}
                    value={website}
                  />
                </label>
              </div>
              <div className={styles.securityNote}>
                <Icon name="shield" size={21} />
                <span>
                  <strong>Ihre Angaben sind geschützt.</strong>
                  <small>
                    Signierte Sitzung, mehrstufiger Bot-Schutz, Rate-Limits und
                    sichere Bildprüfung.
                  </small>
                </span>
              </div>
              <button
                className={styles.reviewButton}
                disabled={portalStatus !== "ready"}
                type="submit"
              >
                Anfrage prüfen
                <Icon name="arrow" size={19} />
              </button>
              <p>
                Mit dem Prüfen wird noch nichts an OK immocare übertragen.
              </p>
            </div>
          </form>
        )}
      </div>

      <footer className={styles.footer}>
        <div>
          <strong>OK immocare</strong>
          <span>Eine Marke der OK solutions GmbH</span>
        </div>
        <div className={styles.footerLinks}>
          <a
            href="https://www.ok-immocare.com/kontakt/impressum.html"
            rel="noreferrer"
            target="_blank"
          >
            Impressum
          </a>
          <a
            href="https://www.ok-immocare.com/kontakt/datenschutz.html"
            rel="noreferrer"
            target="_blank"
          >
            Datenschutz
          </a>
          <a
            href="https://www.ok-immocare.com/kontakt/agb.html"
            rel="noreferrer"
            target="_blank"
          >
            AGB
          </a>
        </div>
      </footer>
    </main>
  );
}
