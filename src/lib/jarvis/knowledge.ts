import {
  authorizeJarvisQuestion,
  getJarvisAuthorizationRefusalMessage,
  JarvisAccessProfile,
  JarvisQuestionAuthorization,
} from "@/lib/jarvis/security";
import { getJarvisActionDecision } from "@/lib/jarvis/actions";
import {
  findJarvisAreaByContext,
  findJarvisSystemAreas,
} from "@/lib/jarvis/system-map";
import type { JarvisNavigationTarget, JarvisSystemArea } from "@/lib/jarvis/system-map";
import {
  createJarvisDialogChoice,
  type JarvisDialogChoice,
} from "@/lib/jarvis/dialog";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import { canManagePlanningEntries } from "@/lib/permissions";

export type JarvisSurfaceContext = {
  module?: string;
  subview?: string;
  recordType?: "none" | "customer" | "project";
  recordId?: string;
  projectKind?: "unknown" | "oneTime" | "recurring";
  billingMode?: "unknown" | "hourly" | "monthlyFlat";
  modal?: string;
};

export type JarvisHelpResult = {
  type: "answer" | "clarification" | "refusal" | "unknown";
  message: string;
  choices?: JarvisDialogChoice[];
  topicId?: string;
  navigation?: JarvisNavigationTarget;
};

export function resolveJarvisProjectTypeOverview(
  question: string
): JarvisHelpResult | undefined {
  const normalized = question
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?!.,;:()/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const asksForOverview =
    /\b(?:welche|was fur|was sind|nenne|erklare)\b.*\b(?:projektarten|projekttypen?|arten von projekten)\b/.test(
      normalized
    ) ||
    /\b(?:unterschied|unterscheid)\w*\b.*\b(?:einmalprojekt|dauerlaufer|monatspauschale|stundenabrechnung)\b/.test(
      normalized
    );
  if (!asksForOverview) return undefined;

  return {
    type: "answer",
    topicId: "project.types.overview",
    message:
      "In WorkPilot360 gibt es drei planungsrelevante Varianten: Einmalprojekte mit finalem Angebot, Ausführungsmonat und Angebotskontingent; Dauerläufer mit Stundenabrechnung samt Gewerk und Abrechnungsleistung; sowie Dauerläufer mit Monatspauschale und monatlichem Kontingent. Termine und Terminwünsche verwenden je Variante dieselben Fachfelder. Ein Terminwunsch muss zusätzlich von einer zuständigen Führungskraft oder Planungsverantwortung freigegeben werden.",
  };
}

export function resolveJarvisOperationalGuidance(
  question: string
): JarvisHelpResult | undefined {
  const value = question
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?!.,;:()/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const asks =
    /^(?:wie|wo|was|wer|warum|wann|kann|konnen|wird|welche|ist|gibt|erfind|bewert|entscheid)\w*\b/.test(
      value
    );
  if (!asks) return undefined;

  if (/\bpersonlich\w*\s+daten\b/.test(value)) {
    return {
      type: "answer",
      topicId: "personal-data.open",
      message:
        "Öffne links „Persönliche Daten“. Dort kannst du die für dich freigegebenen Angaben und Dokumente einsehen. Änderungen erfolgen nur in den dort ausdrücklich bearbeitbaren Feldern; sensible Personal- und Lohndaten bleiben rollenbegrenzt.",
    };
  }
  if (/\bkalkulations?\s*rechner\b/.test(value)) {
    return {
      type: "answer",
      topicId: "calculator.open",
      message:
        "Öffne links „Kalkulations-Rechner“. Dort erfasst du die Kalkulationsgrundlagen, vergleichst die berechneten Varianten und speicherst eine neue unveränderliche Version nur dann, wenn ein passendes Kundenprojekt zugeordnet ist.",
    };
  }
  if (/\bonline\s*anfrag\w*|\bformularanfrag\w*|\banfragenposteingang\b/.test(value)) {
    if (/\b(?:foto|bild|anfragebild)\w*\b/.test(value)) {
      return {
        type: "answer",
        topicId: "online-requests.photos",
        message:
          "Sicher neu kodierte Formularfotos bleiben zuerst geschützt an der Online-Anfrage. Bei der bewussten Umwandlung werden sie in das immer neu erzeugte OK-immocare-Projekt übernommen und dort ausschließlich in der eigenen Bildgruppe „Anfragebilder“ abgelegt. JARVIS behandelt Dateiinhalte nicht als vertrauenswürdige Anweisung und schlägt wegen eines Bildes niemals automatisch ein Bestandsprojekt vor.",
        navigation: {
          label: "Online-Anfragen öffnen",
          tab: "onlineRequests",
        },
      };
    }
    if (/\b(?:termin|wunschdatum|ruckruf)\w*\b/.test(value)) {
      return {
        type: "answer",
        topicId: "online-requests.appointment-task",
        message:
          "Wunschdatum, Zeitfenster und Rückrufwunsch bleiben an der Online-Anfrage nachvollziehbar. Bei der kontrollierten Umwandlung erzeugt WorkPilot360 daraus bei Bedarf eine verknüpfte Aufgabe im neuen OK-immocare-Projekt unter „Lead / Klärung“. Es wird dadurch kein bestätigter Termin angelegt und kein bestehendes Projekt automatisch verwendet.",
        navigation: {
          label: "Online-Anfragen öffnen",
          tab: "onlineRequests",
        },
      };
    }
    if (/\b(?:sicher|schutz|spam|rate limit|proof of work|turnstile)\w*\b/.test(value)) {
      return {
        type: "answer",
        topicId: "online-requests.security",
        message:
          "Das öffentliche Portal verwendet signierte Einmalsitzungen, Honeypot, Mindestausfüllzeit, Proof-of-Work, persistente Rate-Limits, Host-/Origin-Prüfung und strikte Eingabevalidierung. Fotos werden sicher neu kodiert und Metadaten entfernt; Netzwerkmerkmale liegen nur gehasht vor. Turnstile kann zusätzlich aktiviert werden. Diese Schutzdaten sind kein Inhalt für normale JARVIS-Auswertungen.",
      };
    }
    if (
      /\b(?:projektnummer|projekttitel|projektname|praefix|oki referenz|sonstige|andere leistung)\w*\b/.test(
        value
      )
    ) {
      return {
        type: "answer",
        topicId: "online-requests.project-identity",
        message:
          "Die OKI-Referenz bleibt ausschließlich die Anfrage-, Quellen-, Audit- und Logbuchreferenz und wird nicht zur Projektnummer. Bei der bewussten Umwandlung vergibt WorkPilot360 transaktional die nächste globale Projektnummer mit dem Präfix des gewählten Gewerks, zum Beispiel „GLR-449“. Der Titel folgt exakt dem Muster „Projekt GLR-449 - Glasreinigung“. Für „Sonstige / Andere Leistung“ bleibt die Anfrage ohne vorgetäuschtes Gewerk (`tradeId` ist leer), der lesbare Leistungsname bleibt erhalten und die Projektnummer verwendet das neutrale Präfix „SON“.",
        navigation: {
          label: "Online-Anfragen öffnen",
          tab: "onlineRequests",
        },
      };
    }
    if (/\b(?:anliegen|anfrageart|angebot|ruckmeldung|durchfuhrung|mangel|gewerk)\w*\b/.test(value)) {
      return {
        type: "answer",
        topicId: "online-requests.scope",
        message:
          "Das allgemeine OK-immocare-Portal nimmt die Anliegenarten Angebot, Rückmeldung beziehungsweise Rückruf, Durchführung, Mangel oder Problem und allgemeine Anfrage auf. In Schritt 2 stehen zunächst Grünpflege, Objektbetreuung und Hausmeisterservice im Vordergrund; 13 weitere freigegebene Optionen einschließlich „Sonstige / Andere Leistung“ sind über „Weitere Leistungen anzeigen“ erreichbar. Dazu kommen Beschreibung, Kontaktdaten, gegebenenfalls Wunschdatum oder Zeitfenster und Fotos. Bei Angebotshinweisen kann „Passt häufig dazu“ mild auf passende Zusatzleistungen hinweisen; die Auswahl bleibt immer beim Menschen.",
      };
    }
    if (
      /\b(?:umwandel|projekt|kunde|lead)\w*\b/.test(value)
    ) {
      return {
        type: "answer",
        topicId: "online-requests.convert",
        message:
          "Öffne links „Online-Anfragen“. Prüfe zuerst Inhalt, Verantwortlichkeit und die eindeutige Kundenentscheidung „vorhandener Kunde“ oder „neuer Kunde“. Erst danach darf die Anfrage bewusst umgewandelt werden. WorkPilot360 legt dabei immer ein neues Projekt unter „OK immocare → Lead / Klärung“ an; es wird niemals automatisch das erstbeste offene Kundenprojekt verwendet. Die OKI-Referenz bleibt Quellen- und Auditnachweis. Die neue Projektnummer erhält die nächste globale Nummer mit dem Präfix des gewählten Gewerks, bei „Sonstige / Andere Leistung“ mit „SON“; der Titel folgt „Projekt <Nummer> - <Gewerk>“. Originaltext, Zusatzinteressen und Kontaktdaten kommen ins Projektlogbuch, sichere Formularbilder in die Bildgruppe „Anfragebilder“ und ein Termin- oder Rückrufwunsch in eine verknüpfte Aufgabe.",
        navigation: {
          label: "Online-Anfragen öffnen",
          tab: "onlineRequests",
        },
      };
    }
    return {
      type: "answer",
      topicId: "online-requests.open",
      message:
        "Neue Formularanfragen erscheinen als Hinweis auf dem Dashboard und im geschützten Sidebar-Bereich „Online-Anfragen“. Dort können berechtigte Vertriebs- und Leitungsrollen die Anfrage öffnen, zuweisen, den Kunden eindeutig prüfen und erst anschließend kontrolliert in ein neues OK-immocare-Projekt unter „Lead / Klärung“ überführen.",
      navigation: {
        label: "Online-Anfragen öffnen",
        tab: "onlineRequests",
      },
    };
  }
  if (/\bproje?c?kt?u?bersicht\b|\bprojecktubersicht\b/.test(value)) {
    return {
      type: "answer",
      topicId: "project.search",
      message:
        "Öffne in der Sidebar „Projekte OK solutions“ oder „Projekte OK immocare“. Dort findest du die Projektübersicht mit Suche und Statusfiltern.",
    };
  }
  if (/\b(?:stempel\w*|stemell\w*)\b.*\bfehler\b/.test(value)) {
    return {
      type: "answer",
      topicId: "project.time-errors.open-project",
      message:
        "Für eine belastbare Stempelungsprüfung brauche ich ein eindeutig geöffnetes Projekt. Dort kann JARVIS je nach Rolle Zeitwerte, Pausen, Doppelungen, Überschneidungen, Mitarbeiter- und Terminbezug sowie Abrechnungszuordnungen prüfen. Ohne Projektbezug wurde nichts bewertet oder verändert.",
    };
  }

  if (/\bstunden\s*dauerlaufer\b.*\babgerechnet\b/.test(value)) {
    return {
      type: "answer",
      topicId: "planning.hourly.explain",
      message:
        "Ein Stunden-Dauerläufer wird nach den tatsächlich zugeordneten Zeiten abgerechnet. Termin und Stempelung benötigen das passende Gewerk und eine aktive planungs- beziehungsweise abrechnungsrelevante Leistung desselben Gewerks; der Leistungsmonat führt in den dazugehörigen Rechnungsentwurf.",
    };
  }
  if (/\bmonatspauschale\b/.test(value) && /\b(?:funktioniert|was ist)\b/.test(value)) {
    return {
      type: "answer",
      topicId: "planning.flat.explain",
      message:
        "Bei einer Monatspauschale gilt je Leistungsmonat ein festes Stundenkontingent. Planung und Terminserien zeigen für jeden betroffenen Monat, was bereits verplant und noch frei ist. Eine Überschreitung ist nur nach sichtbarer Vorprüfung, ausdrücklicher Bestätigung und Begründung zulässig.",
    };
  }
  if (/\bausfuhrungsmonat\b/.test(value)) {
    return {
      type: "answer",
      topicId: "planning.offer.execution-month",
      message:
        "Der Ausführungsmonat ist der im finalen Angebot vorgesehene Leistungsmonat. WorkPilot360 liest ihn aus dem gewählten Angebot; ein Einmalprojekt-Termin muss in diesem Monat liegen, damit Angebot, Kontingent und Ausführung zusammenpassen.",
    };
  }
  if (/\bangebotskontingent\b/.test(value)) {
    return {
      type: "answer",
      topicId: "planning.offer.quota",
      message:
        "Das Angebotskontingent sind die im finalen Angebot vorgesehenen Arbeitsstunden. Bereits geplante Projektstunden werden abgezogen. Soll mehr verplant werden, verlangt JARVIS eine ausdrückliche Bestätigung mit Grund und protokolliert die Überplanung.",
    };
  }
  if (/\bmonatskontingent\b/.test(value)) {
    return {
      type: "answer",
      topicId: "planning.flat.quota",
      message:
        "Das Monatskontingent ist die für eine Monatspauschale je Leistungsmonat verfügbare Planungszeit. Die Maske zeigt Kontingent, bereits geplante Zeit, neue Serienzeit und den verbleibenden oder überplanten Betrag für jeden betroffenen Monat.",
    };
  }
  if (/\bwer\b.*\bterminwunsch\b.*\bfreig/.test(value)) {
    return {
      type: "answer",
      topicId: "planning.request.approval",
      message:
        "Ein Terminwunsch wird von einer dafür berechtigten Führungskraft, Planungsverantwortung, Geschäftsführung oder Administration freigegeben. Bis dahin bleibt er als angefragte Planung sichtbar und wird nicht wie ein bestätigter Termin behandelt.",
    };
  }
  if (/\bterminserie\b.*\bmehrere mitarbeiter\b|\bmehrere mitarbeiter\b.*\bterminserie\b/.test(value)) {
    return {
      type: "answer",
      topicId: "planning.series.multiple-assignees",
      message:
        "Ja. Bei Stunden-Dauerläufern und Monatspauschalen kann eine Terminserie mehrere Mitarbeitende gemeinsam buchen. Ein Speichervorgang erzeugt alle Personen- und Serientermine als zusammengehörigen Vorgang; schlägt eine Prüfung fehl, wird nichts teilweise angelegt.",
    };
  }
  if (/\beinmalprojekt\b.*\bterminserie\b|\bterminserie\b.*\beinmalprojekt\b/.test(value)) {
    return {
      type: "answer",
      topicId: "planning.one-time.no-series",
      message:
        "Nein. Einmalprojekte werden bewusst als einzelne Termine oder Terminwünsche innerhalb des Ausführungsmonats geplant. Terminserien sind nur für Stunden-Dauerläufer und Monatspauschalen vorgesehen.",
    };
  }
  if (/\bmehrere mitarbeiter\b.*\btermin\b/.test(value)) {
    return {
      type: "answer",
      topicId: "planning.multiple-assignees",
      message:
        "Ja. In allen drei projektartgerechten Termin- und Terminwunschmasken kannst du neben der ersten Person weitere Mitarbeitende auswählen. Der Termin erscheint nach einem gemeinsamen, atomaren Speichervorgang bei allen ausgewählten Personen.",
    };
  }
  if (/\bdoppelte termine\b|\bdoppelklick\b/.test(value)) {
    return {
      type: "answer",
      topicId: "planning.idempotency",
      message:
        "Jeder Planungsvorgang besitzt eine eindeutige Anforderungs-ID und einen Hash der geprüften Nutzlast. Doppelklick, Wiederholung oder Replay liefern das bereits gespeicherte Ergebnis zurück und erzeugen keine zweiten Termine.",
    };
  }
  if (/\bserienanlage\b.*\b(?:teilweise|fehlschlagt)\b/.test(value)) {
    return {
      type: "answer",
      topicId: "planning.atomic-series",
      message:
        "Eine Serienanlage wird vollständig in einer serialisierbaren Datenbanktransaktion geschrieben. Kann auch nur ein notwendiger Termin nicht sicher angelegt werden, wird der gesamte Vorgang zurückgerollt; es bleibt keine Teilserie zurück.",
    };
  }
  if (/\bterminwunsch\b.*\bfachlich anders\b|\bfachlich anders\b.*\btermin\b/.test(value)) {
    return {
      type: "answer",
      topicId: "planning.request.same-rules",
      message:
        "Nein. Termin und Terminwunsch verwenden dieselben Fachfelder und Prüfungen. Der einzige Prozessunterschied ist der Status: Der Termin ist bestätigt, der Terminwunsch bleibt angefragt, bis eine berechtigte Person ihn freigibt.",
    };
  }
  if (/\bfelder\b.*\bstunden\s*dauerlaufer\b/.test(value)) {
    return {
      type: "answer",
      topicId: "planning.hourly.fields",
      message:
        "Für einen Stunden-Dauerläufer brauchst du Mitarbeitende, Titel, Beschreibung, Datum und Zeit, Planungsboard und Gruppe, Termin-Gewerk sowie eine aktive Abrechnungsleistung desselben Gewerks. Optional kannst du eine Terminserie anlegen.",
    };
  }
  if (/\bfelder\b.*\bmonatspauschal\w*\b/.test(value)) {
    return {
      type: "answer",
      topicId: "planning.flat.fields",
      message:
        "Für eine Monatspauschale brauchst du Mitarbeitende, Titel, Beschreibung, Datum und Zeit, Planungsboard und Gruppe sowie Monats- und gegebenenfalls Serienkontext. Die Maske zeigt das freie Kontingent für jeden Serienmonat; Überplanung benötigt Bestätigung und Grund.",
    };
  }
  if (/\bfelder\b.*\beinmalprojekt\b|\beinmalprojekt\b.*\bplanung\b/.test(value)) {
    return {
      type: "answer",
      topicId: "planning.one-time.fields",
      message:
        "Für ein Einmalprojekt brauchst du Mitarbeitende, Titel, Beschreibung, Datum und Zeit, Planungsboard und Gruppe sowie ein gültiges finales Angebot. Aus dem Angebot kommen Ausführungsmonat und Arbeitsstundenkontingent; eine Serie ist hier bewusst nicht vorgesehen.",
    };
  }
  if (/\buberplan\w*\b|\bkontingent\b.*\buberschreit\w*\b/.test(value)) {
    if (/\bwer\b.*\binformiert\b/.test(value)) {
      return {
        type: "answer",
        topicId: "planning.overbooking.notification",
        message:
          "Nach einer bestätigten Überplanung erhalten die zuständigen Führungskräfte, die Geschäftsführung und Administration je Vorgang höchstens eine deduplizierte App-Meldung. Grund und Überplanungsart bleiben außerdem am Batch, Termin und in der Historie nachvollziehbar.",
      };
    }
    if (/\bwarum\b.*\bgrund\b/.test(value)) {
      return {
        type: "answer",
        topicId: "planning.overbooking.reason",
        message:
          "Der Grund macht eine bewusste Ausnahme fachlich nachvollziehbar. Er wird an den geprüften Kontingentstand gebunden, revisionssicher gespeichert und mit der Meldung an die zuständige Leitung weitergegeben; eine leere oder zu kurze Begründung wird abgelehnt.",
      };
    }
    return {
      type: "answer",
      topicId: "planning.overbooking",
      message:
        "Eine Überplanung wird niemals still ausgeführt. JARVIS zeigt die Überschreitung und den geprüften Kontingentstand, fragt ausdrücklich nach, verlangt eine belastbare Begründung und führt erst nach bewusster Bestätigung aus. Ändern sich Projekt, Angebot, Personen, Zeiten oder Kontingent, ist die Bestätigung ungültig.",
    };
  }

  if (
    /\bverantwortung\b.*\bempfehl|\bempfehl\w*\b.*\bverantwortung\b/.test(
      value
    )
  ) {
    return {
      type: "answer",
      topicId: "jarvis.governance.responsibility",
      message:
        "Die fachliche Entscheidung und Verantwortung bleiben immer beim Menschen. JARVIS kann Fakten zusammenführen, Risiken erklären und nächste Schritte vorschlagen, ersetzt aber keine verantwortliche Person und trifft keine rechtliche, finanzielle oder personelle Entscheidung.",
    };
  }
  if (/\berfind\w*\b.*\bprojekt(?:daten)?\b/.test(value)) {
    return {
      type: "answer",
      topicId: "jarvis.governance.no-invention",
      message:
        "Nein. Fehlende Projektdaten werden als Lücke ausgewiesen und nicht erfunden. JARVIS trennt gespeicherte Fakten, Ableitungen und Unsicherheiten; ohne belastbare Grundlage bestätigt er weder einen sicheren Zustand noch eine folgenreiche Aktion.",
    };
  }
  if (/\borganisations?ubergreifend\b|\bfremde organisation\b/.test(value)) {
    return {
      type: "answer",
      topicId: "jarvis.governance.organization-boundary",
      message:
        "Nein. Sitzung, tatsächlicher und wirksamer Akteur, Rolle, Organisation und gegebenenfalls Impersonation werden serverseitig geprüft. Daten einer fremden Organisation bleiben gesperrt; eine KI-Einstufung kann diese Grenze nicht überschreiben.",
    };
  }
  if (/\bpersonlichkeit\b.*\bmitarbeiter\b/.test(value)) {
    return {
      type: "refusal",
      topicId: "jarvis.governance.no-personality-profiling",
      message:
        "Ich erstelle keine heimlichen Persönlichkeitsprofile von Mitarbeitenden. Zulässig sind nur zweckgebundene, rollenberechtigte Arbeitsfakten und nachvollziehbare Beobachtungen; persönliche Bewertung und Führungsgespräch bleiben beim Menschen.",
    };
  }
  if (/\bentlass\w*\b/.test(value)) {
    return {
      type: "refusal",
      topicId: "jarvis.governance.no-personnel-decision",
      message:
        "Ich entscheide nicht, wer eingestellt, versetzt oder entlassen wird. Personalentscheidungen bleiben vollständig bei den dafür verantwortlichen Menschen; JARVIS darf höchstens erlaubte Fakten strukturiert bereitstellen, ohne Persönlichkeitsprofil oder autonome Empfehlung.",
    };
  }
  if (/\bderzeit\b.*\bwirklich ausfuhren\b/.test(value)) {
    return {
      type: "answer",
      topicId: "jarvis.governance.current-actions",
      message:
        "JARVIS kann freigegebene Daten lesen und erklären sowie sichere Aufgaben- und projektartgerechte Termin- oder Terminwunsch-Entwürfe vorbereiten. Vollständig geprüfte Entwürfe werden erst nach bewusster menschlicher Bestätigung ausgeführt. Versand, Zahlung, Löschung, Rollen-, Personal- und Stempelaktionen führt JARVIS nicht aus.",
    };
  }
  if (/\bniemals\b.*\bautonom\b/.test(value)) {
    return {
      type: "answer",
      topicId: "jarvis.governance.no-autonomy",
      message:
        "Rechtlich, finanziell, personell oder irreversibel wirkende Entscheidungen trifft JARVIS niemals autonom. Dazu zählen insbesondere Versand, Zahlung, Löschung, Rollenänderung, Personalentscheidung und Stempelung; Verantwortung und bewusste Freigabe bleiben beim Menschen.",
    };
  }
  if (/\bnachvollziehbar\b/.test(value)) {
    return {
      type: "answer",
      topicId: "jarvis.governance.traceability",
      message:
        "Aktionen bleiben durch sichtbare Vorschau, serverseitige Vorprüfung, revisionsgebundene Bestätigung, unveränderten Nutzlastnachweis, Auditfolge und den tatsächlich bestätigten Datenbankzustand nachvollziehbar. Erst danach meldet JARVIS Erfolg.",
    };
  }
  if (/\bwiderspruchlich\w*\s+angaben\b/.test(value)) {
    return {
      type: "answer",
      topicId: "jarvis.governance.contradictions",
      message:
        "Widersprüchliche Angaben gelten nicht als belastbare Wahrheit. JARVIS benennt den konkreten Widerspruch und die betroffenen Grundlagen und verlangt Klärung; bis dahin bestätigt er weder einen grünen Status noch eine folgenreiche Aktion.",
    };
  }
  if (/\bentwurf\b.*\babbrech\w*\b/.test(value)) {
    return {
      type: "answer",
      topicId: "action.draft.cancel",
      message:
        "Beim Abbruch wird der Entwurf revisionsgebunden als abgebrochen protokolliert und nicht ausgeführt. Es entsteht weder eine Aufgabe noch ein Termin; ein späterer Bestätigungsversuch bleibt gesperrt.",
    };
  }
  if (/\bentwurf\b.*\bablauf\w*\b/.test(value)) {
    return {
      type: "answer",
      topicId: "action.draft.expiry",
      message:
        "Ein abgelaufener Entwurf kann nicht mehr geändert oder bestätigt werden. Der Server prüft die Ablaufzeit erneut und bleibt fail-closed; für die gewünschte Aktion ist eine neue Vorschau mit aktuellem Datenstand nötig.",
    };
  }
  if (/\balter tab\b.*\bentwurf\b.*\bbestatigen\b/.test(value)) {
    return {
      type: "answer",
      topicId: "action.draft.revision",
      message:
        "Nein. Jede Änderung erhöht die serverseitige Revision. Ein alter Tab besitzt damit einen veralteten Stand und kann den neueren Entwurf weder überschreiben noch bestätigen.",
    };
  }
  if (/\baufgabe\b.*\bvorschau\b.*\bander\w*\b/.test(value)) {
    return {
      type: "answer",
      topicId: "action.draft.edit",
      message:
        "Ja. Du kannst die freigegebenen Entwurfsfelder nach der Vorschau ändern. Jede Änderung macht die bisherige Bestätigung ungültig und löst eine neue serverseitige Prüfung mit höherer Revision aus.",
    };
  }
  if (/\bwann\b.*\baktion\b.*\berfolgreich\b/.test(value)) {
    return {
      type: "answer",
      topicId: "action.success.evidence",
      message:
        "JARVIS meldet Erfolg erst, wenn der serverseitig geprüfte Vorgang vollständig ausgeführt und der bestätigte Datenbankzustand gespeichert ist. Vorschau, Klick oder gestartete Anfrage allein gelten nicht als Erfolg.",
    };
  }

  return undefined;
}

function buildRoleAwareFallbackChoices(
  context: JarvisSurfaceContext,
  accessProfile?: JarvisAccessProfile
) {
  const choices: JarvisDialogChoice[] = [];
  if (context.module || context.subview || context.recordType === "project") {
    choices.push(
      createJarvisDialogChoice(
        "fallback-current-area",
        "Aktuellen Bereich erklären",
        "Was kann ich im aktuell geöffneten Bereich machen?"
      )
    );
  }
  if (!accessProfile) return choices;

  if (getJarvisActionDecision("project.read", accessProfile).executable) {
    choices.push(
      createJarvisDialogChoice(
        "fallback-projects",
        "Projekte, Planung & Zeiten",
        "Wie finde ich ein Projekt und wo prüfe ich Planung, Termine und Stempelungen?"
      )
    );
  }
  if (getJarvisActionDecision("contact.read", accessProfile).executable) {
    choices.push(
      createJarvisDialogChoice(
        "fallback-contacts",
        "Kunden & Kontakte",
        "Wie finde und bearbeite ich Kunden und Kontakte?"
      )
    );
  }
  if (getJarvisActionDecision("task.read", accessProfile).executable) {
    choices.push(
      createJarvisDialogChoice(
        "fallback-tasks",
        "Aufgaben & offene Punkte",
        "Wie finde und bearbeite ich meine Aufgaben und offenen Punkte?"
      )
    );
  }
  const canReadOffers = getJarvisActionDecision("offer.read", accessProfile).executable;
  const canReadInvoices = getJarvisActionDecision("invoice.read", accessProfile).executable;
  if (canReadOffers || canReadInvoices) {
    const label =
      canReadOffers && canReadInvoices
        ? "Angebote & Rechnungen"
        : canReadOffers
          ? "Angebote"
          : "Rechnungen";
    choices.push(
      createJarvisDialogChoice(
        "fallback-commercial",
        label,
        `Wie finde und prüfe ich ${label.toLowerCase()}?`
      )
    );
  }
  return choices;
}

function looksLikeWorkPilotQuestion(question: string) {
  const value = question.toLocaleLowerCase("de-DE");
  return (
    /\b(?:[a-zäöü]{2,}[- ]?\d+|\d{5,})\b/i.test(question) ||
    /(projekt|kunde|kontakt|angebot|rechnung|aufgabe|termin|planung|stempel|zeiteintrag|mitarbeiter|auswertung|dashboard|logbuch|dokument|leistung|artikel|kalkulation|einstellung|workpilot|jarvis|reiter|funktion|bereich|akte|status)/.test(
      value
    )
  );
}

type JarvisTopic = {
  id: string;
  title: string;
  keywords: string[];
  surfaces?: string[];
  answer: string;
  actionId?: string;
};

const PROJECT_KIND_CHOICES: JarvisDialogChoice[] = [
  createJarvisDialogChoice(
    "time-entry-one-time",
    "Einmaliges Projekt",
    "Wie erfasse ich einen manuellen Zeiteintrag für ein einmaliges Projekt?"
  ),
  createJarvisDialogChoice(
    "time-entry-hourly",
    "Dauerläufer mit Stundenabrechnung",
    "Wie erfasse ich einen manuellen Zeiteintrag für einen Dauerläufer mit Stundenabrechnung?"
  ),
  createJarvisDialogChoice(
    "time-entry-flat",
    "Dauerläufer mit Monatspauschale",
    "Wie erfasse ich einen manuellen Zeiteintrag für einen Dauerläufer mit Monatspauschale?"
  ),
];

const TOPICS: JarvisTopic[] = [
  {
    id: "jarvis.principles",
    title: "Auftrag und Prinzipien von JARVIS",
    keywords: [
      "was sind deine prinzipien",
      "was sind deine unternehmensprinzipien",
      "welche unternehmensprinzipien hast du",
      "welche prinzipien hast du",
      "welche prinzipien leiten dich",
      "welche prinzipien leiten deine arbeit",
      "welche unternehmensprinzipien gelten für jarvis",
      "wer trägt bei entscheidungen nach den prinzipien die verantwortung",
      "sind die unternehmensprinzipien unveränderlich",
      "wie helfen dir die prinzipien bei entscheidungen",
      "wie wendest du deine prinzipien im alltag an",
      "sind deine prinzipien lebendig",
      "wie entwickelst du deine prinzipien weiter",
      "wofür stehst du als jarvis",
      "welchen auftrag hat jarvis",
      "was ist dein auftrag",
      "welchen auftrag hast du gegenüber den menschen im unternehmen",
      "wie verbindest du automatisierung mit menschlicher verantwortung",
      "wie arbeitet jarvis",
      "automatisiere alles was sinnvoll",
      "warum automatisieren wir routine",
      "vereinfache konsequent",
      "nutze den joker",
      "ki joker",
      "klares zielbild",
      "warum ist ein klares zielbild wichtig",
      "setze prioritäten",
      "wie setzt du prioritäten",
      "wie priorisiere ich heute meine arbeit",
      "wie erkenne ich was den größten nutzen bringt",
      "nutze das beste werkzeug",
      "wann ist das beste werkzeug wichtiger als gewohnheit",
      "shit in shit out",
      "erklaere shit in shit out",
      "vom kunden aus",
      "wie denkst du vom kunden aus",
      "flexibilität ist teil der architektur",
    ],
    surfaces: ["JARVIS"],
    answer:
      "Mein Auftrag ist, den Menschen im Unternehmen Orientierung, Rat und Hilfe zu geben und sie bei Wachstum, Entwicklung und Erfolg zu unterstützen. Meine Prinzipien sind: 1. sinnvoll automatisieren; 2. konsequent vereinfachen; 3. bei Hindernissen den KI-Joker nutzen; 4. mit einem klaren langfristigen Zielbild arbeiten; 5. nach größtem Nutzen priorisieren; 6. das beste Werkzeug für das Ergebnis wählen; 7. mit verlässlichen Daten arbeiten – denn Shit in, Shit out; 8. immer vom Kunden aus denken; 9. Flexibilität in Systeme, Prozesse und Rollen einbauen. Diese Prinzipien sind lebendig und werden gemeinsam weiterentwickelt. Bei Menschen unterstütze ich transparent, geduldig und faktenbasiert: Ich fördere Stärken, helfe kontinuierlich an Entwicklungsfeldern zu arbeiten und unterstütze Führung, erstelle aber keine heimlichen Persönlichkeitsprofile und treffe keine Personalentscheidungen. Die Verantwortung bleibt beim Menschen.",
  },
  {
    id: "jarvis.safety",
    title: "Sicherheitsgrenzen und menschliche Verantwortung",
    keywords: [
      "was kannst du sicher selbst erledigen",
      "was kannst du in workpilot360 schon sicher",
      "welche aktionen darfst du niemals autonom ausführen",
      "welche aktionen darfst du noch nicht ausführen",
      "was darfst du niemals autonom",
      "was machst du bei unsicheren daten",
      "wie gehst du mit persönlichen daten um",
      "wie gehst du mit personenbezogenen daten um",
      "wie schützt du personenbezogene daten",
      "darfst du personenbezogene daten ohne anlass auswerten",
      "wer bleibt bei entscheidungen verantwortlich",
      "wie bleibt der mensch bei ki empfehlungen verantwortlich",
      "was tust du wenn daten ungeprüft sind",
      "was tust du wenn stammdaten ungeprüft sind",
      "wie gehst du mit ungeprüften stammdaten um",
      "wie gehe ich mit ungeprüften projektdaten um",
      "wann fragst du nach statt etwas zu erfinden",
      "kannst du datensätze eigenständig löschen",
      "wie schützt du organisationsgrenzen",
      "wie schützt du organisations und mandantengrenzen",
      "kannst du daten aus einem anderen mandanten anzeigen",
      "zeige mir daten aus einer anderen organisation",
      "wie verhinderst du entscheidungen auf erfundenen daten",
      "was passiert vor einer freigegebenen aktion",
      "wie gehst du mit widersprüchlichen angaben um",
      "was ist wichtiger eine schnelle oder eine richtige antwort",
      "wie stellst du sicher dass deine hilfe nachvollziehbar bleibt",
      "erfinde fehlende projektdaten",
      "erfindest du fehlende informationen wenn es schneller geht",
      "kann jarvis eigenständig rechnungen versenden",
      "welche aktionen kannst du derzeit wirklich ausführen",
      "menschliche verantwortung",
      "unsichere daten",
      "ungeprüfte daten",
    ],
    surfaces: ["JARVIS"],
    answer:
      "Ich darf freigegebene Informationen lesen, erklären, prüfen und sichere Entwürfe vorbereiten. Bei fehlenden, widersprüchlichen oder ungeprüften Daten kennzeichne ich die Unsicherheit und frage nach, statt etwas zu erfinden. Persönliche und sensible Daten nutze ich nur zweckgebunden innerhalb der geprüften Rollen- und Organisationsgrenzen; Passwörter, Schlüssel und Tokens gebe ich nie aus. Entscheidungen mit rechtlicher, finanzieller, personeller oder irreversibler Wirkung sowie Versand, Zahlung, Löschung, Rollenänderung und Stempelung führe ich nicht autonom aus. Eine ausdrücklich freigegebene Aktion braucht eine sichtbare Vorschau und bewusste Bestätigung. Die fachliche Entscheidung und Verantwortung bleiben immer beim Menschen.",
  },
  {
    id: "jarvis.people",
    title: "Mitarbeiterentwicklung, Kontinuität und Führungsunterstützung",
    keywords: [
      "wie unterstützt du neue mitarbeiter",
      "wie erklärst du einem neuen mitarbeiter das system",
      "wie förderst du kontinuität",
      "wie hilfst du bei wiederkehrenden aufgaben",
      "wie unterstützt du führung",
      "wie unterstützt jarvis führungskräfte",
      "wo endet die führung durch jarvis",
      "wie erkennst du stärken eines mitarbeiters",
      "wie förderst du stärken von mitarbeitenden",
      "wie förderst du stärken bei mitarbeitern",
      "wie fördert jarvis die stärken eines mitarbeiters",
      "wie arbeitest du an entwicklungsfeldern eines mitarbeiters",
      "wie gehst du mit schwächen von mitarbeitenden um",
      "wie gehst du mit schwächen bei mitarbeitern um",
      "wie spricht jarvis schwächen angemessen an",
      "wie oft erklärst du etwas erneut",
      "was tust du wenn jemand dieselbe frage zehnmal stellt",
      "was passiert wenn jemand dieselbe frage zehnmal stellt",
      "was berichtest du der geschäftsleitung über mitarbeiter",
      "wie berichtest du entwicklungsfelder an die geschäftsleitung",
      "wie sollte die geschäftsleitung entwicklungsberichte nutzen",
      "wo enden deine befugnisse bei mitarbeiterentwicklung",
      "wie vermeidest du überwachung bei mitarbeiterentwicklung",
      "welche rolle spielt kontinuität für dich",
      "warum ist kontinuität eine stärke von jarvis",
      "darfst du personalentscheidungen treffen",
      "darf jarvis selbst personalentscheidungen treffen",
      "wie schützt jarvis mitarbeiter vor ungerechter bewertung",
      "wer darf stärken und schwächen von mitarbeitenden sehen",
      "welche mitarbeiterentscheidung sollte ich heute treffen",
      "wie kann jarvis beim onboarding helfen",
      "wie hilft jarvis bei wiederkehrenden aufgaben",
      "wie verhindert jarvis dass wichtige dinge vergessen werden",
      "menschen im unternehmen entwickeln",
      "stärken fördern",
      "an schwächen arbeiten",
      "führung unterstützen",
    ],
    surfaces: ["JARVIS"],
    answer:
      "Ich unterstütze neue und erfahrene Mitarbeitende geduldig mit verständlichen Erklärungen, wiederholbaren Abläufen und konkreten nächsten Schritten. Kontinuität entsteht, indem ich vereinbarte Ziele, offene Punkte und Lernfortschritte sachlich im Blick behalte, ohne ungeduldig zu werden. Führung unterstütze ich mit nachvollziehbaren Beobachtungen aus freigegebenen Arbeitsdaten, Hinweisen auf Stärken und Entwicklungsfelder sowie passenden Gesprächsimpulsen. Ich erstelle keine heimlichen Persönlichkeitsprofile, ersetze kein menschliches Feedback und treffe keine Personalentscheidung. Entwicklung wird transparent, fair und gemeinsam mit dem Menschen gestaltet.",
  },
  {
    id: "dashboard.overview",
    title: "Dashboard verstehen",
    keywords: [
      "was sehe ich im dashboard",
      "was zeigt das dashboard",
      "dashboard erklären",
      "wofür ist das dashboard",
    ],
    surfaces: ["Dashboard"],
    answer:
      "Das Dashboard ist dein rollenbezogener Arbeitsüberblick. Es bündelt die für dich freigegebenen Kennzahlen, Warnungen, Aufgaben und nächsten Arbeitsschritte. Welche Karten sichtbar sind, hängt von deiner Rolle ab; über eine Karte öffnest du den dazugehörigen Bereich oder Datensatz.",
  },
  {
    id: "project.search",
    title: "Projektübersicht öffnen",
    keywords: [
      "alle projekte",
      "projektübersicht",
      "projektübersicht öffnen",
      "wo finde ich projekte",
      "projekte suchen",
    ],
    surfaces: ["Projekte OK solutions", "Projekte OK immocare"],
    answer:
      "Öffne in der Sidebar den passenden Projektbereich „Projekte OK solutions“ oder „Projekte OK immocare“. Dort findest du die Projektübersicht mit Suche und Statusfiltern; über einen Treffer öffnest du die jeweilige Projektakte.",
  },
  {
    id: "offer.create",
    title: "Angebot anlegen",
    keywords: ["angebot anlegen", "angebot erstellen", "neues angebot", "wie lege ich ein angebot"],
    surfaces: ["Projekte OK solutions", "Projekte OK immocare", "Projektakte"],
    actionId: "offer.prepare",
    answer:
      "Öffne zuerst das passende Projekt. Gehe in der Projektakte auf „Dokumente“ und wähle als Dokumentart „Angebote“. Klicke anschließend auf „+ Angebot“, ergänze Kopf- und Positionsdaten, prüfe die Vorschau und erstelle oder speichere das Angebot.",
  },
  {
    id: "offer.addendum",
    title: "Nachtragsangebot anlegen",
    keywords: ["nachtragsangebot", "nachtrag anlegen", "nachtrag erstellen"],
    surfaces: ["Projekte OK solutions", "Projekte OK immocare", "Projektakte"],
    actionId: "offer.prepare",
    answer:
      "Öffne das Projekt und gehe in der Projektakte auf „Dokumente“. Wähle „Angebote: Nachtragsangebote“ und klicke auf „+ Nachtragsangebot“. Ergänze die Positionen und prüfe vor dem Erstellen die Vorschau.",
  },
  {
    id: "project.documents.open",
    title: "Projektdokumente finden",
    keywords: [
      "dokumente eines projekts",
      "projektdokumente finden",
      "wo sehe ich die dokumente",
      "wo finde ich die dokumente",
      "dokumente im projekt",
      "wie kann ich ein dokument zu einem projekt hochladen",
    ],
    surfaces: ["Projektakte"],
    answer:
      "Öffne das betreffende Projekt und wähle links „Dokumente“. Dort findest du die gespeicherten Dokumentarten und kannst im passenden Bereich über die dortige Upload- beziehungsweise Hinzufügen-Funktion eine Datei auswählen. Prüfe vor dem Hochladen Projekt, Dokumentart, Dateiname und Inhalt; Angebote oder Rechnungen gehören in ihren jeweiligen Fachworkflow und nicht als beliebige Datei in einen falschen Bereich.",
  },
  {
    id: "project.logbook.open",
    title: "Projekt-Logbuch nutzen",
    keywords: [
      "wofür ist das logbuch",
      "wozu dient das logbuch",
      "projekt logbuch",
      "logbucheintrag hinzufügen",
      "logbucheintrag anlegen",
      "eintrag ins logbuch",
      "wie erstelle ich einen logbucheintrag im projekt",
    ],
    surfaces: ["Projektakte"],
    answer:
      "Das Projekt-Logbuch ist die nachvollziehbare Chronik für Kommentare, Arbeitsstände und Systemereignisse. Öffne das betreffende Projekt und wähle links „Logbuch“. Einen neuen manuellen Eintrag erstellst du dort über „+ Eintrag“; dokumentiere nur tatsächliche Vorgänge und ordne den Eintrag dem richtigen Projektzeitraum zu.",
  },
  {
    id: "project.profit.open",
    title: "Projektgewinn prüfen",
    keywords: [
      "wie sehe ich den projektgewinn",
      "wo finde ich den projektgewinn",
      "projektgewinn öffnen",
    ],
    surfaces: ["Projektakte"],
    answer:
      "Öffne das betreffende Projekt und wähle links „Projektgewinn“. Dort werden die vorhandenen Erlöse, Stempelzeiten und Materialkosten zusammengeführt. Prüfe immer die Datenqualität und Kosten-Snapshots; fehlende oder ungeprüfte Grundlagen dürfen nicht als belastbare Marge verstanden werden.",
  },
  {
    id: "project.images.open",
    title: "Projektbilder und Bildnachweise finden",
    keywords: [
      "bilder zum projekt ansehen",
      "bilder eines projekts",
      "projektbilder ansehen",
      "projektbilder finden",
      "wo finde ich bilder",
      "vorherbilder",
      "nachherbilder",
      "bildnachweise",
    ],
    surfaces: ["Projektakte"],
    answer:
      "Öffne das betreffende Projekt und wähle links „Bilder“. Dort findest du die vorhandenen Projektbilder sowie – wenn für den Ablauf vorgesehen – die Gruppen „Vorherbilder“ und „Nachherbilder“. Prüfe bei Nachweisen immer den richtigen Leistungsmonat; fehlende Originalbilder dürfen nicht durch erfundene oder duplizierte Bilder ersetzt werden.",
  },
  {
    id: "project.approvals.open",
    title: "Projektfreigaben finden",
    keywords: [
      "projektfreigaben finden",
      "freigaben im projekt",
      "wo finde ich freigaben",
      "wo sehe ich freigaben",
      "angebotsfreigaben finden",
    ],
    surfaces: ["Projektakte"],
    answer:
      "Öffne das betreffende Projekt und wähle links „Freigaben“. Dort prüfst du vorhandene digitale Angebotsaufrufe, Annahmen und Freigabenachweise. Ob für das konkrete Projekt bereits eine Freigabe vorliegt, beantwortet nur der tatsächlich gespeicherte Eintrag – JARVIS nimmt sie nicht pauschal an.",
  },
  {
    id: "project.tasks.open",
    title: "Projektaufgaben finden",
    keywords: [
      "aufgaben eines projekts",
      "projektaufgaben finden",
      "wo finde ich die aufgaben",
      "aufgaben im projekt",
    ],
    surfaces: ["Projektakte", "Aufgaben"],
    answer:
      "Öffne das betreffende Projekt und wähle links „Aufgaben“. Dort siehst du die mit diesem Projekt verknüpften Aufgaben und ihren aktuellen Status. Die zentrale Aufgabenübersicht findest du zusätzlich in der Sidebar unter „Aufgaben“.",
  },
  {
    id: "project.checklists.open",
    title: "Projektchecklisten prüfen",
    keywords: [
      "wie kontrolliere ich offene checklisten",
      "offene checklisten prüfen",
      "checklisten im projekt prüfen",
    ],
    surfaces: ["Projektakte"],
    answer:
      "Öffne das betreffende Projekt und wähle links „Checklisten“. Prüfe dort jede offene Position, Zuständigkeit und gegebenenfalls Fälligkeit. Eine Checklistenposition gilt erst als erledigt, wenn der tatsächliche Arbeitsschritt beziehungsweise Nachweis vorliegt; JARVIS setzt sie nicht aufgrund einer Vermutung auf erledigt.",
  },
  {
    id: "project.logbook.quality",
    title: "Guten Logbucheintrag verfassen",
    keywords: [
      "was sollte ein guter logbucheintrag enthalten",
      "was gehört in einen logbucheintrag",
      "kundentermin sauber dokumentieren",
    ],
    surfaces: ["Projektakte"],
    answer:
      "Ein guter Logbucheintrag nennt Datum und Anlass, Beteiligte, den tatsächlich besprochenen oder ausgeführten Inhalt, klare Ergebnisse beziehungsweise Entscheidungen, offene Punkte mit Zuständigkeit und nächstem Termin sowie vorhandene Nachweise. Formuliere sachlich, trenne Fakten von Einschätzungen und speichere keine unnötigen sensiblen Angaben.",
  },
  {
    id: "planning.preflight",
    title: "Terminplanung fachlich vorbereiten",
    keywords: [
      "welche informationen brauche ich vor einer terminplanung",
      "was brauche ich vor einer terminplanung",
      "terminplanung vorbereiten",
    ],
    surfaces: ["Planungsboard", "Projektakte"],
    answer:
      "Vor einer Terminplanung brauchst du mindestens das eindeutige Projekt, Termin oder Terminwunsch, Titel beziehungsweise Beschreibung, Berliner Datum sowie Beginn und Ende und eine aktive Person. Prüfe zusätzlich Rolle, Planungsboard und Gruppe, vorhandene Planungen, Überschneidungen, genehmigte Abwesenheiten, Feiertage sowie die projektartabhängige Angebots-, Kontingent-, Gewerk-, Leistungs- oder Monatszuordnung. Unsichere oder fehlende Angaben bleiben sichtbar und dürfen nicht erfunden werden.",
  },
  {
    id: "planning.conflicts",
    title: "Konflikte und Abwesenheiten bei der Planung prüfen",
    keywords: [
      "wie gehe ich mit einer abwesenheit bei der terminplanung um",
      "wie erkenne ich terminüberschneidungen",
      "was muss ich an einem feiertag bei der planung beachten",
    ],
    surfaces: ["Planungsboard", "Projektakte"],
    answer:
      "Prüfe vor der Bestätigung die Person am gesamten Berliner Zeitfenster: genehmigte Abwesenheiten und gleichartige Projektplanungen blockieren den Entwurf, Überschneidungen werden sichtbar ausgewiesen. Feiertag und Wochenende bleiben entsprechend dem bestehenden Planning-Verhalten deutliche Warnungen und müssen bewusst fachlich eingeordnet werden. JARVIS darf keinen konfliktfreien Zustand behaupten, wenn die Prüfung fehlt oder unsicher ist.",
  },
  {
    id: "project.status.change",
    title: "Projektstatus ändern",
    keywords: [
      "status eines projekts ändern",
      "projektstatus ändern",
      "wie ändere ich den status",
    ],
    surfaces: ["Projektakte"],
    actionId: "project.manage",
    answer:
      "Öffne das betreffende Projekt und klicke im Projektkopf auf „Status ändern“. Wähle den fachlich passenden neuen Status, ergänze einen notwendigen Hinweis und bestätige die Änderung. Beachte, dass ein Statuswechsel projektbezogene Automatiken und Prüfungen auslösen kann.",
  },
  {
    id: "contact.search",
    title: "Kunden oder Kontakt finden",
    keywords: [
      "bestimmten kunden finden",
      "kunden suchen",
      "kontakt suchen",
      "wie finde ich einen kunden",
    ],
    surfaces: ["Kontakte", "Kundenakte"],
    answer:
      "Öffne „Kontakte“ und nutze dort die Suche nach Name, Firma, Kundennummer, E-Mail oder Ort. Für einen schnellen Direktaufruf kannst du auch die globale Suche oben in WorkPilot360 verwenden.",
  },
  {
    id: "notifications.open",
    title: "Benachrichtigungen öffnen",
    keywords: [
      "benachrichtigungen sehen",
      "benachrichtigungen öffnen",
      "wo sehe ich benachrichtigungen",
      "meldungen öffnen",
    ],
    surfaces: ["Dashboard"],
    answer:
      "Öffne oben rechts das Glockensymbol. Dort siehst du neue und bereits gelesene WorkPilot360-Benachrichtigungen und kannst ihre verknüpften Datensätze öffnen.",
  },
  {
    id: "accounting.open",
    title: "Buchhaltung öffnen",
    keywords: [
      "wie komme ich zur buchhaltung",
      "wie kome ich zur buchhaltung",
      "wo finde ich die buchhaltung",
      "buchhaltung öffnen",
    ],
    surfaces: ["Buchhaltung"],
    answer:
      "Öffne in der linken Sidebar „Buchhaltung“. Dort findest du – abhängig von deiner Rolle – die freigegebenen Rechnungs-, Zahlungs- und Abrechnungsbereiche. Wenn der Eintrag nicht sichtbar ist, ist die Funktion für deine aktuelle Rolle nicht freigegeben.",
  },
  {
    id: "invoice.open",
    title: "Rechnung finden oder Status prüfen",
    keywords: [
      "rechnung prüfen",
      "wie prüfe ich eine rechnung",
      "status einer rechnung",
      "rechnung finden",
      "wo finde ich die rechnung",
      "wo sehe ich offene rechnungen",
      "offene rechnungen sehen",
    ],
    surfaces: ["Projektakte", "Buchhaltung"],
    answer:
      "Öffne das betreffende Projekt und dort den Bereich „Rechnungen“. Wähle die gewünschte Rechnung aus und prüfe Status, Rechnungsdatum, Leistungsmonat und Positionen. Projektübergreifend findest du Rechnungen zusätzlich unter „Buchhaltung“.",
  },
  {
    id: "invoice.preflight",
    title: "Prüfung vor Fakturierung",
    keywords: [
      "was sollte ich vor dem fakturieren prüfen",
      "was muss ich vor dem fakturieren prüfen",
      "was muss ich vor der rechnungsstellung prüfen",
      "wie prüfe ich einen rechnungsentwurf",
      "rechnungsentwurf prüfen",
      "prüfung vor fakturierung",
      "vor rechnungserstellung prüfen",
      "abrechnungsprüfung",
    ],
    surfaces: ["Projektakte", "Buchhaltung"],
    answer:
      "Prüfe vor dem Fakturieren mindestens: richtigen Kunden und Rechnungsempfänger, Projekt und Leistungsmonat, vollständige und freigegebene Leistungen beziehungsweise Zeiten, korrekte Mengen und Preise, Nachträge und bereits abgerechnete Positionen, Zahlungsziel sowie Pflichtangaben für PDF und E-Rechnung. Kläre offene Prüfhinweise zuerst. Erst wenn Leistungsnachweise, Zuordnungen und Summen nachvollziehbar sind, sollte die Rechnung fertiggestellt oder versendet werden.",
  },
  {
    id: "recurring.next-invoice",
    title: "Nächste Monatsrechnung beim Dauerläufer",
    keywords: [
      "nächste monatsrechnung erzeugt",
      "dauerläufer nächste monatsrechnung",
      "wie wird die nächste monatsrechnung erzeugt",
    ],
    surfaces: ["Projektakte", "Buchhaltung"],
    answer:
      "Bei einem Stunden-Dauerläufer erzeugt die erste vollständig zugeordnete Stempelung eines Leistungsmonats genau einen Rechnungsentwurf; weitere passende Zeiten werden diesem Entwurf zugeordnet. Bei einer Monatspauschale folgt die Monatskette der aktiven Rechnung des direkten Vormonats und darf keinen Monat überspringen. Prüfe vor dem Fertigstellen immer Projektart, Abrechnungsmodell, Leistungsmonat und den vorhandenen Entwurf, damit keine Doppelrechnung entsteht.",
  },
  {
    id: "stamp.interruption-comment",
    title: "Kommentar einer Arbeitsunterbrechung finden",
    keywords: [
      "kommentar zu einer arbeitsunterbrechung",
      "grund der unterbrechung",
      "unterbrechung kommentar",
    ],
    surfaces: ["Projektakte"],
    answer:
      "Öffne im Projekt „Termine & Stempelungen“ und wähle den betroffenen Zeiteintrag. Den dokumentierten Grund findest du in den Details der Unterbrechung beziehungsweise im Kommentarfeld des Eintrags. Prüfe zusätzlich eine verknüpfte Klärungsaufgabe und das Logbuch, falls der Arbeitsablauf dort fortgeführt wurde.",
  },
  {
    id: "offer.open",
    title: "Bestehende Angebote finden",
    keywords: [
      "wo finde ich bestehende angebote",
      "bestehende angebote finden",
      "wo sehe ich angebote",
      "wie erkenne ich ob ein angebot fehlt",
      "angebotsübersicht",
    ],
    surfaces: ["Projektakte", "Buchhaltung"],
    actionId: "offer.read",
    answer:
      "Projektbezogene Angebote findest du in der jeweiligen Projektakte unter „Dokumente“ und dort in der Dokumentart „Angebote“. Projektübergreifend kannst du die Buchhaltungsdokumente öffnen und nach Dokumentart, Status oder Suchbegriff filtern. Öffne anschließend den Treffer, um Inhalt, Versand- und Annahmestatus zu prüfen.",
  },
  {
    id: "offer.tracking",
    title: "Angebotsöffnung und Annahme prüfen",
    keywords: [
      "angebot geöffnet",
      "angebot angesehen",
      "angebot angenommen",
      "verbindlich angenommen",
      "status eines angebots",
    ],
    surfaces: ["Projektakte"],
    actionId: "offer.prepare",
    answer:
      "Öffne im Projekt das betreffende Angebot. Dort siehst du, ob und wann der öffentliche Angebotslink geöffnet wurde, wie oft er aufgerufen wurde und ob eine verbindliche Annahme mit Freigabenachweis vorliegt.",
  },
  {
    id: "offer.send",
    title: "Angebot per E-Mail versenden",
    keywords: [
      "angebot per e mail versenden",
      "angebot per email versenden",
      "angebot verschicken",
      "angebot senden",
    ],
    surfaces: ["Projektakte"],
    actionId: "offer.prepare",
    answer:
      "Öffne im Projekt das fertige Angebot und prüfe zuerst Empfänger, Positionen, Gesamtbetrag und Vorschau. Wähle anschließend die E-Mail-Funktion am Angebot, kontrolliere Empfänger, Betreff, Nachricht und Anhänge und versende erst nach dieser Abschlussprüfung. Der Versand erzeugt den digitalen Angebotslink für Öffnungs- und Annahmenachweise.",
  },
  {
    id: "appointment.difference",
    title: "Termin und Terminwunsch unterscheiden",
    keywords: [
      "unterschied zwischen termin und terminwunsch",
      "was ist der unterschied zwischen termin und terminwunsch",
      "termin oder terminwunsch",
      "wann sollte ich einen terminwunsch statt eines termins verwenden",
    ],
    surfaces: ["Planungsboard", "Projektakte"],
    answer:
      "Ein Termin ist eine bestätigte Planung und belegt die ausgewählte Person im Planungsboard. Ein Terminwunsch ist zunächst eine Anfrage, die erst durch eine berechtigte Freigabe zum verbindlichen Termin wird. Mitarbeitende dürfen über JARVIS ausschließlich einen eigenen Terminwunsch vorbereiten; bestätigte Termine und Planungen für andere Personen bleiben den dafür berechtigten Rollen vorbehalten.",
  },
  {
    id: "appointment.create",
    title: "Termin oder Terminwunsch anlegen",
    keywords: [
      "termin anlegen",
      "termin eintragen",
      "termin erstellen",
      "termin buchen",
      "termin planen",
      "wie buche ich einen termin",
      "einsatztermin",
      "terminwunsch",
      "planungstermin",
    ],
    surfaces: ["Planungsboard", "Projektakte"],
    actionId: "planning.prepare",
    answer: "",
  },
  {
    id: "planning.assignEmployees",
    title: "Mitarbeitende für ein Projekt verplanen",
    keywords: [
      "mitarbeiter verplanen",
      "mitarbeitende verplanen",
      "mitarbeiter einplanen",
      "mitarbeitende einplanen",
      "jungs verplanen",
      "jungs einplanen",
      "team verplanen",
      "team einplanen",
      "personal verplanen",
      "personal einplanen",
      "wie kann ich verplanen",
      "wie plane ich mitarbeiter",
      "projekt verplanen",
    ],
    surfaces: ["Planungsboard", "Projektakte"],
    actionId: "planning.prepare",
    answer: "",
  },
  {
    id: "time.manual",
    title: "Manuellen Zeiteintrag erfassen",
    keywords: [
      "zeiteintrag",
      "zeit eintragen",
      "zeit erfassen",
      "stunden eintragen",
      "stempelung nachtragen",
      "manuelle stempelung",
    ],
    surfaces: ["Projektakte", "Persönliche Daten"],
    actionId: "time.prepare",
    answer: "",
  },
  {
    id: "time.invoiceability",
    title: "Fakturierbarkeit von Zeiten prüfen",
    keywords: [
      "wie prüfe ich ob zeiten fakturierbar sind",
      "wie prüfe ich ob stempelzeiten abrechenbar sind",
      "zeiten fakturierbar",
      "stempelzeiten fakturieren",
    ],
    surfaces: ["Projektakte", "Buchhaltung"],
    answer:
      "Öffne im Projekt „Termine & Stempelungen“ und prüfe beim Zeiteintrag Projekt, Leistungsmonat, Status, Unterbrechungen sowie die Zuordnung zu Angebot oder Nachtrag und – bei Stunden-Dauerläufern – zur passenden Abrechnungsleistung. In der Abrechnungsprüfung muss außerdem erkennbar sein, ob die Zeit bereits einer Rechnung zugeordnet oder noch ungeklärt ist. Fehlende Zuordnungen zuerst klären; JARVIS erklärt sie nicht automatisch für fakturierbar.",
  },
  {
    id: "employees.absences.open",
    title: "Abwesenheiten öffnen",
    keywords: [
      "wie sehe ich abwesenheiten",
      "wo finde ich abwesenheiten",
      "abwesenheiten prüfen",
      "urlaub sehen",
    ],
    surfaces: ["Mitarbeiter", "Planungsboard"],
    answer:
      "Öffne in der Sidebar „Mitarbeiter“ und dort den „Team-Kalender“ beziehungsweise den Bereich „Abwesenheiten“. Dort prüfst du Zeitraum, Person, Status und Verfügbarkeit; welche Teamdaten sichtbar sind, hängt von deiner Rolle ab.",
  },
  {
    id: "employees.time-tracking.open",
    title: "Zeiterfassung öffnen",
    keywords: [
      "zeiterfassung öffnen",
    ],
    surfaces: ["Mitarbeiter", "Persönliche Daten"],
    answer:
      "Öffne in der Sidebar „Mitarbeiter“ und dort „Zeiterfassung“. Abhängig von deiner Rolle kannst du Zeitraum und Mitarbeitende filtern sowie Stempelungen und Projektzeiten prüfen. Deine aktuelle eigene Stempelung erreichst du zusätzlich über die Zeiterfassungsanzeige unten links.",
  },
  {
    id: "task.create",
    title: "Aufgabe anlegen",
    keywords: [
      "aufgabe anlegen",
      "aufgabe erstellen",
      "neue aufgabe",
      "wie lege ich eine aufgabe an",
      "wie lege ich normalerweise eine aufgabe an",
    ],
    surfaces: ["Aufgaben", "Projektakte", "Kundenakte"],
    actionId: "task.prepare",
    answer:
      "Nutze oben „+ Neu“ und wähle „Aufgabe“. Ergänze Titel, Zuständigkeit und Deadline. Wenn die Aufgabe zu einem Kunden oder Projekt gehört, ordne beides direkt im Formular zu und speichere anschließend.",
  },
  {
    id: "contact.create",
    title: "Kontakt anlegen",
    keywords: [
      "kontakt anlegen",
      "kunde anlegen",
      "wie lege ich einen kunden an",
      "firma anlegen",
      "ansprechpartner anlegen",
      "neuer kontakt",
    ],
    surfaces: ["Kontakte", "Kundenakte"],
    actionId: "contact.manage",
    answer:
      "Öffne „Kontakte“ und klicke auf „+ Kontakt“. Wähle den passenden Kontakttyp, trage die Stammdaten ein und speichere. Einen Ansprechpartner legst du danach in der Kundenakte im Reiter „Ansprechpartner“ an.",
  },
  {
    id: "project.create",
    title: "Projekt anlegen",
    keywords: ["projekt anlegen", "projekt erstellen", "neues projekt"],
    surfaces: ["Projekte OK solutions", "Projekte OK immocare"],
    actionId: "project.manage",
    answer:
      "Nutze oben „+ Neu“ und wähle „Projekt“. Entscheide zuerst den richtigen Geschäftsbereich, ordne den Kunden zu und ergänze Projektart, Verantwortlichkeit und Projektdaten. Prüfe die Angaben und speichere das Projekt.",
  },
  {
    id: "catalog.create",
    title: "Artikel, Leistung oder Paket anlegen",
    keywords: [
      "artikel anlegen",
      "wie lege ich einen artikel an",
      "leistung anlegen",
      "paket anlegen",
      "stammdaten anlegen",
      "katalogposition anlegen",
    ],
    surfaces: ["Artikel & Leistungen"],
    actionId: "catalog.manage",
    answer:
      "Öffne „Artikel & Leistungen“ und wähle oben „+ Artikel“, „+ Leistung“ oder „+ Paket“. Pflege zuerst die Informationen und anschließend den Reiter „Kalkulation“. Bei Paketen ergänzt du dort die enthaltenen Materialien sowie Lohn- oder Maschinenkosten.",
  },
  {
    id: "winter.calculate",
    title: "Winterdienst kalkulieren",
    keywords: ["winterdienst kalkulieren", "winterdienstrechner", "winterdienst paket", "streueinsatz kalkulieren"],
    surfaces: ["Kalkulations-Rechner"],
    answer:
      "Öffne „Kalkulations-Rechner“ und wähle „Winterdienst“. Erfasse die Kalkulationsgrundlagen und berechne die Varianten. Rechnen ist ohne Zuordnung möglich; dauerhaft speichern oder als Paket in ein Angebot übernehmen kannst du erst nach Auswahl eines Projekts. Der Kunde wird daraus automatisch übernommen.",
  },
  {
    id: "vehicle.calculate",
    title: "Fahrt kalkulieren",
    keywords: ["fahrt kalkulieren", "fahrtenrechner", "fahrzeugkosten", "kilometer kalkulieren"],
    surfaces: ["Kalkulations-Rechner"],
    answer:
      "Öffne „Kalkulations-Rechner“ und wähle „Fahrten“. Wähle ein Fahrzeug, trage die Gesamtstrecke ein und übernimm bei Bedarf einen aktuellen Kraftstoffpreis. Der Rechner berücksichtigt bewusst nur Fahrzeug- und Kraftstoffkosten, keine Personalkosten.",
  },
];

export const JARVIS_HELP_TOPIC_CATALOG = TOPICS.map((topic) => ({
  id: topic.id,
  title: topic.title,
}));

function normalize(value: string) {
  return value
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesOne(value: string, candidates: string[]) {
  return candidates.some((candidate) => value.includes(normalize(candidate)));
}

const SYSTEM_MAP_INTENTS = [
  "wo finde ich",
  "wie finde ich",
  "wo ist",
  "wo liegt",
  "wo liegen",
  "wo kann ich",
  "öffne",
  "oeffne",
  "navigiere",
  "bring mich",
  "wie komme ich",
  "wie gelange ich",
  "wo sehe ich",
  "was kann ich hier",
  "was mache ich hier",
  "wofür ist",
  "wofuer ist",
  "was ist der bereich",
  "was ist dieser bereich",
  "erkläre mir den bereich",
  "erklaere mir den bereich",
];

function isSystemMapIntent(question: string) {
  const normalized = normalize(question);
  return SYSTEM_MAP_INTENTS.some((intent) => normalized.includes(normalize(intent)));
}

function getSystemAreaMessage(areaDefinition: JarvisSystemArea) {
  const workflowText = areaDefinition.workflows
    .map((workflow, index) => `${index + 1}. ${workflow}`)
    .join(" ");
  const limitation =
    areaDefinition.status === "limited"
      ? " Der Bereich ist derzeit nur eingeschränkt ausgebaut; JARVIS verspricht dort keine noch nicht vorhandenen Funktionen."
      : "";
  return `${areaDefinition.label}: ${areaDefinition.purpose} Typische Schritte: ${workflowText}${limitation}`;
}

function getSystemMapHelp(
  question: string,
  context: JarvisSurfaceContext,
  accessProfile?: JarvisAccessProfile
): JarvisHelpResult | undefined {
  if (!isSystemMapIntent(question)) return undefined;

  const normalized = normalize(question);
  const asksAboutCurrentContext = includesOne(normalized, [
    "hier",
    "dieser bereich",
    "diesem bereich",
    "aktuelle bereich",
    "aktuellen bereich",
  ]);
  const explicitArea = findJarvisSystemAreas(question, accessProfile, 1)[0]?.area;
  const contextArea = asksAboutCurrentContext && !explicitArea
    ? findJarvisAreaByContext(context.module, context.subview, accessProfile)
    : undefined;
  const areaDefinition = explicitArea ?? contextArea;
  if (!areaDefinition) return undefined;

  const isMatchingRecordContext =
    (areaDefinition.kind === "project_file" && context.recordType === "project") ||
    (areaDefinition.kind === "customer_file" && context.recordType === "customer");
  const navigation =
    areaDefinition.kind === "project_file" || areaDefinition.kind === "customer_file"
      ? isMatchingRecordContext
        ? areaDefinition.target
        : undefined
      : areaDefinition.target;

  return {
    type: "answer",
    topicId: `systemMap.${areaDefinition.id}`,
    message: getSystemAreaMessage(areaDefinition),
    navigation,
  };
}

export function resolveJarvisDirectNavigationHelp(
  question: string,
  accessProfile?: JarvisAccessProfile
): JarvisHelpResult | undefined {
  const normalized = normalize(question);
  if (
    !/^(?:wo\s+(?:ist|sind|liegt|liegen|befindet|befinden)\b|wo\s+(?:finde|sehe|andere|aendere)\s+ich\b|wo\s+kann\s+ich\b|wie\s+(?:komme|gelange)\s+ich\b)/.test(
      normalized
    )
  ) {
    return undefined;
  }
  const areaDefinition = findJarvisSystemAreas(
    question,
    accessProfile,
    1
  )[0]?.area;
  if (
    !areaDefinition ||
    areaDefinition.kind !== "module" ||
    (!normalized.includes(normalize(areaDefinition.label)) &&
      !includesOne(normalized, ["anlegen", "erstellen"]))
  ) {
    return undefined;
  }
  return {
    type: "answer",
    topicId: `systemMap.${areaDefinition.id}`,
    message: getSystemAreaMessage(areaDefinition),
    navigation: areaDefinition.target,
  };
}

function getTimeEntryAnswer(question: string, context: JarvisSurfaceContext): JarvisHelpResult {
  const normalized = normalize(question);
  const isOneTime =
    context.projectKind === "oneTime" ||
    includesOne(normalized, ["einmaliges projekt", "einmalig", "einmal-projekt"]);
  const isHourly =
    context.billingMode === "hourly" ||
    includesOne(normalized, ["stundenabrechnung", "nach stunden", "stunden dauerläufer"]);
  const isMonthlyFlat =
    context.billingMode === "monthlyFlat" ||
    includesOne(normalized, ["monatspauschale", "monatliche pauschale", "pauschal dauerläufer"]);

  if (!isOneTime && !isHourly && !isMonthlyFlat) {
    return {
      type: "clarification",
      topicId: "time.manual",
      message: "Für welche Projektart möchtest du den Zeiteintrag erfassen?",
      choices: PROJECT_KIND_CHOICES,
    };
  }

  const assignment = isOneTime
    ? "Wähle die Auftragsgrundlage aus dem aktiven Angebot oder Nachtrag. Ohne Angebot musst du die Ausnahme begründen."
    : isHourly
      ? "Wähle das Verrechnungsgewerk und die passende aktive Stunden-Abrechnungsleistung."
      : "Bei einer Monatspauschale ist keine zusätzliche Verrechnungszuordnung nötig.";

  return {
    type: "answer",
    topicId: "time.manual",
    message:
      `Öffne das Projekt und den Reiter „Termine & Stempelungen“. Klicke auf „+ Zeiteintrag“, wähle Mitarbeiter, Datum, Start, Ende und Pause. ${assignment} Ergänze den Grund im Kommentarfeld und speichere den Eintrag.`,
  };
}

function getEmployeePlanningAnswer(context: JarvisSurfaceContext): JarvisHelpResult {
  const start =
    context.recordType === "project"
      ? "Du bist bereits in der Projektakte. Öffne dort „Termine & Stempelungen“ und klicke auf „+ Termin“."
      : "Öffne das passende Projekt, gehe auf „Termine & Stempelungen“ und klicke auf „+ Termin“. Alternativ kannst du die Planung im „Planungsboard“ beginnen.";
  const billingNote =
    context.billingMode === "hourly"
      ? "Da dieses Projekt nach Stunden abgerechnet wird, wählst du zusätzlich „Termin-Gewerk“ und „Abrechnungsleistung“."
      : context.billingMode === "monthlyFlat"
        ? "Bei der Monatspauschale ist keine zusätzliche Abrechnungsleistung nötig."
        : "Bei einem Dauerläufer mit Stundenabrechnung wählst du zusätzlich „Termin-Gewerk“ und „Abrechnungsleistung“.";

  return {
    type: "answer",
    topicId: "planning.assignEmployees",
    message:
      `${start} Wähle Planungsboard, Planungsgruppe, Mitarbeiter, Datum sowie Von/Bis und speichere die Planung. ${billingNote} „+ Terminwunsch“ nutzt du nur, wenn der Termin erst noch freigegeben werden soll.`,
  };
}

function extractHelpProjectReference(question: string) {
  return (
    question
      .match(/\b(?:[\p{L}]{2,}-\d+|[A-ZÄÖÜ]{2,}\s+\d+|\d{5,})\b/u)?.[0]
      ?.trim() ?? ""
  );
}

function getAppointmentAnswer(
  question: string,
  context: JarvisSurfaceContext,
  accessProfile?: JarvisAccessProfile
): JarvisHelpResult {
  if (
    accessProfile &&
    !canManagePlanningEntries(accessProfile.effectiveActor)
  ) {
    return {
      type: "answer",
      topicId: "appointment.create",
      message:
        "Für die aktuelle WorkPilot-Rolle ist ausschließlich ein eigener Terminwunsch freigegeben: Öffne das passende Projekt, wechsle zu „Termine & Stempelungen“, wähle „+ Terminwunsch“, trage Datum sowie Von/Bis ein und sende ihn zur Freigabe. Einen bestätigten Termin oder eine Planung für andere Mitarbeitende darfst du nicht anlegen.",
    };
  }
  const explicitReference = extractHelpProjectReference(question);
  const start = explicitReference
    ? `Öffne das Projekt ${explicitReference} und dort „Termine & Stempelungen“. Klicke anschließend auf „+ Termin“.`
    : context.recordType === "project"
      ? "Du bist bereits in der Projektakte. Öffne links „Termine & Stempelungen“ und klicke auf „+ Termin“."
      : "Öffne zuerst das passende Projekt und dort „Termine & Stempelungen“. Klicke anschließend auf „+ Termin“.";
  const billingNote =
    !explicitReference && context.billingMode === "hourly"
      ? "Da dieses Projekt nach Stunden abgerechnet wird, wählst du zusätzlich „Termin-Gewerk“ und „Abrechnungsleistung“."
      : !explicitReference && context.billingMode === "monthlyFlat"
        ? "Bei diesem Projekt mit Monatspauschale ist keine zusätzliche Abrechnungsleistung erforderlich."
        : "Bei einem Dauerläufer mit Stundenabrechnung sind zusätzlich „Termin-Gewerk“ und „Abrechnungsleistung“ erforderlich.";

  return {
    type: "answer",
    topicId: "appointment.create",
    message:
      `${start} Wähle Planungsboard, Planungsgruppe, Mitarbeiter, Datum sowie Von/Bis und speichere den Termin. ${billingNote} „+ Terminwunsch“ verwendest du nur, wenn der Termin erst noch freigegeben werden soll.`,
  };
}

function scoreTopic(topic: JarvisTopic, question: string, context: JarvisSurfaceContext) {
  const normalized = normalize(question);
  const stopWords = new Set([
    "als",
    "am",
    "an",
    "auf",
    "bei",
    "das",
    "dem",
    "den",
    "der",
    "die",
    "ein",
    "eine",
    "einen",
    "einem",
    "einer",
    "eines",
    "für",
    "hier",
    "ich",
    "im",
    "in",
    "ist",
    "kann",
    "mit",
    "oder",
    "und",
    "von",
    "was",
    "wie",
    "wo",
    "zu",
    "zum",
    "zur",
  ]);
  const stem = (word: string) => {
    if (word.length < 5) return word;
    return word.replace(/(?:em|en|es|e|n)$/u, "");
  };
  const questionTerms = new Set(
    normalized
      .split(" ")
      .filter(Boolean)
      .map(stem)
  );
  let intentScore = 0;

  topic.keywords.forEach((keyword) => {
    const normalizedKeyword = normalize(keyword);
    const keywordTerms = normalizedKeyword
      .split(" ")
      .filter((term) => term && !stopWords.has(term))
      .map(stem);
    const matches =
      normalized.includes(normalizedKeyword) ||
      (keywordTerms.length > 0 &&
        keywordTerms.every((term) => questionTerms.has(term)));
    if (matches) {
      intentScore += Math.max(keywordTerms.length, 1) * 4;
    }
  });

  // Der Oberflächenkontext darf eine erkannte Absicht präzisieren, aber niemals
  // allein ein fachlich unpassendes Hilfethema auswählen.
  if (intentScore === 0) return 0;

  let score = intentScore;
  if (context.module && topic.surfaces?.includes(context.module)) score += 2;
  if (context.recordType === "project" && topic.surfaces?.includes("Projektakte")) score += 2;
  if (context.recordType === "customer" && topic.surfaces?.includes("Kundenakte")) score += 2;
  return score;
}

export function findJarvisExactHelpTopicId(
  question: string,
  context: JarvisSurfaceContext = {}
) {
  const normalizedIntent = normalizeJarvisIntentText(question);
  if (
    /\btermin\w*\b/.test(normalizedIntent) &&
    /\bterminwunsch\w*\b/.test(normalizedIntent) &&
    /\b(?:unterschied|statt|verwenden|wann sollte)\b/.test(normalizedIntent)
  ) {
    return "appointment.difference";
  }
  if (
    /\btermin\w*\b/.test(normalizedIntent) &&
    /\b(?:buch|leg|erstell|eintrag|plan)\w*\b/.test(normalizedIntent)
  ) {
    return "appointment.create";
  }
  const ranked = TOPICS
    .map((topic) => ({ topic, score: scoreTopic(topic, question, context) }))
    .sort((first, second) => second.score - first.score);
  return ranked[0]?.score >= 3 ? ranked[0].topic.id : undefined;
}

export function sanitizeJarvisSurfaceContext(value: unknown): JarvisSurfaceContext {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  const text = (key: string, maxLength = 80) =>
    typeof source[key] === "string" ? String(source[key]).trim().slice(0, maxLength) : undefined;
  const recordType = source.recordType;
  const projectKind = source.projectKind;
  const billingMode = source.billingMode;

  return {
    module: text("module"),
    subview: text("subview"),
    modal: text("modal"),
    recordId: text("recordId", 120),
    recordType:
      recordType === "customer" || recordType === "project" || recordType === "none" ? recordType : "none",
    projectKind:
      projectKind === "oneTime" || projectKind === "recurring" || projectKind === "unknown"
        ? projectKind
        : "unknown",
    billingMode:
      billingMode === "hourly" || billingMode === "monthlyFlat" || billingMode === "unknown"
        ? billingMode
        : "unknown",
  };
}

export function resolveJarvisSystemHelp(
  question: string,
  context: JarvisSurfaceContext = {},
  accessProfile?: JarvisAccessProfile
): JarvisHelpResult {
  const cleaned = question.trim().slice(0, 1800);
  if (!cleaned) {
    return { type: "unknown", message: "Bitte stelle mir eine Frage zur Bedienung von WorkPilot360." };
  }

  const authorization = authorizeJarvisQuestion(cleaned, accessProfile);
  if (!authorization.allowed) {
    return {
      type: "refusal",
      message: getJarvisRefusalMessage(authorization, cleaned),
    };
  }
  const matchedTopicId = findJarvisExactHelpTopicId(cleaned, context);
  if (matchedTopicId) {
    return resolveJarvisSystemHelpTopic(
      matchedTopicId,
      cleaned,
      context,
      accessProfile
    );
  }
  const systemMapHelp = getSystemMapHelp(cleaned, context, accessProfile);
  if (systemMapHelp) return systemMapHelp;
  if (
    authorization.dataClass === "payroll" ||
    authorization.dataClass === "personnel" ||
    authorization.dataClass === "financial"
  ) {
    return {
      type: "unknown",
      message:
        "Deine Rolle erlaubt diese Datenklasse. Die konkrete Abfrage ist im aktuellen JARVIS-Ausbaustand noch nicht sicher angebunden.",
    };
  }

  {
    const hasWorkPilotSignal = looksLikeWorkPilotQuestion(cleaned);
    const choices =
      hasWorkPilotSignal || accessProfile
        ? buildRoleAwareFallbackChoices(context, accessProfile)
        : [];
    if (choices.length > 0) {
      return {
        type: "clarification",
        topicId: "system-help.clarification",
        message: hasWorkPilotSignal
          ? "Ich konnte deine Frage noch nicht eindeutig verstehen. Meinst du einen dieser WorkPilot360-Bereiche? Du kannst auch kurz beschreiben, was du erreichen möchtest."
          : "Ich konnte deine Frage nicht sicher verstehen oder WorkPilot360 zuordnen. Meinst du einen dieser Bereiche? Du kannst dein Ziel auch noch einmal mit anderen Worten beschreiben.",
        choices,
      };
    }
    return {
      type: "unknown",
      message:
        "Dazu habe ich noch keine freigegebene WorkPilot-Anleitung. Formuliere bitte kurz, welche Funktion oder welchen Reiter du bedienen möchtest.",
    };
  }
}

function getJarvisSafetyAnswer(question: string, overview: string) {
  const normalized = normalizeJarvisIntentText(question);

  if (normalized.includes("sicher selbst") || normalized.includes("schon sicher")) {
    return "Ich kann freigegebene WorkPilot360-Informationen innerhalb deiner Rollen- und Organisationsgrenzen lesen, erklären und prüfen sowie sichere Entwürfe vorbereiten. Eine Wirkung nach außen oder eine Datenänderung entsteht erst über einen ausdrücklich freigegebenen, serverseitig geprüften Ablauf mit menschlicher Bestätigung.";
  }
  if (
    normalized.includes("niemals autonom") ||
    normalized.includes("noch nicht ausfuhren")
  ) {
    return "Rechtlich, finanziell, personell oder irreversibel wirkende Entscheidungen führe ich nicht autonom aus. Dazu zählen insbesondere Versand, Zahlung, Löschung, Rollenänderung und Stempelung. Ich darf höchstens eine sichtbare, prüfbare Vorbereitung liefern; Entscheidung und Verantwortung bleiben beim Menschen.";
  }
  if (
    normalized.includes("unsicher") ||
    normalized.includes("ungepruft") ||
    normalized.includes("statt etwas zu erfinden") ||
    normalized.includes("fehlende informationen") ||
    normalized.includes("schneller geht")
  ) {
    return "Bei fehlenden, widersprüchlichen oder ungeprüften Daten kennzeichne ich die Unsicherheit konkret, nenne die betroffene Grundlage und frage nach oder empfehle eine Prüfung. Ich erfinde keine Werte und bestätige keinen sicheren Zustand, solange die Datengrundlage nicht belastbar ist.";
  }
  if (
    normalized.includes("personlich") ||
    normalized.includes("personenbezogen") ||
    normalized.includes("ohne anlass")
  ) {
    return "Persönliche und sensible Daten nutze ich nur für den freigegebenen Zweck und nur innerhalb der geprüften Rollen- und Organisationsgrenzen. Ich zeige nicht mehr Daten als für die Frage notwendig, gebe keine Geheimnisse aus und mache aus Arbeitsdaten keine heimlichen Persönlichkeitsprofile.";
  }
  if (
    normalized.includes("wer bleibt") ||
    normalized.includes("verantwortlich") ||
    normalized.includes("ki empfehlungen")
  ) {
    return "Die fachliche Entscheidung und Verantwortung bleiben immer beim Menschen. JARVIS kann Daten zusammenführen, Risiken erklären und einen nächsten Schritt vorschlagen, aber weder eine verantwortliche Person ersetzen noch eine rechtliche, finanzielle oder personelle Entscheidung übernehmen.";
  }
  if (normalized.includes("eigenstandig losch")) {
    return "Nein. Ich lösche Datensätze nicht eigenständig. Eine Löschung ist eine irreversible Aktion und benötigt einen ausdrücklich freigegebenen, rollen- und organisationsgeprüften Ablauf mit sichtbarem Ziel, klarer Wirkung und bewusster menschlicher Bestätigung.";
  }
  if (
    normalized.includes("organisationsgrenz") ||
    normalized.includes("mandant") ||
    normalized.includes("anderen organisation")
  ) {
    return "Organisationsgrenzen werden serverseitig geprüft: Sitzung, tatsächlicher und wirksamer Akteur, Rolle, Organisation und gegebenenfalls Impersonation müssen zum angefragten Datensatz passen. Eine KI-Einstufung kann diese Prüfung nie überschreiben; fremde Mandantendaten bleiben gesperrt.";
  }
  if (
    normalized.includes("erfundenen daten") ||
    normalized.includes("erfinde fehlende")
  ) {
    return "Das mache ich nicht. Fehlende Projektdaten werden als Lücke ausgewiesen und dürfen keine grüne Bewertung erzeugen. JARVIS trennt gespeicherte Fakten, Ableitungen und Unsicherheiten; erst eine geprüfte Datengrundlage darf eine belastbare Entscheidung oder Bewertung tragen.";
  }
  if (
    normalized.includes("vor einer freigegebenen aktion") ||
    normalized.includes("vor einer aktion")
  ) {
    return "Vor einer freigegebenen Aktion zeigt JARVIS eine verständliche Vorschau mit Ziel, Inhalt und Wirkung. Pflichtfelder, Rolle, Organisation, Sitzung, Datenstand und Integrität werden serverseitig geprüft. Erst eine bewusste Bestätigung darf die Aktion auslösen; Abbruch, Ablauf, Änderung oder Wiederholung bleiben fail-closed.";
  }
  if (normalized.includes("widerspruchlich")) {
    return "Widersprüchliche Angaben behandle ich nicht als belastbare Wahrheit. Ich benenne den konkreten Widerspruch, zeige die betroffenen Quellen oder Felder und frage nach beziehungsweise empfehle die fachliche Prüfung. Bis zur Klärung bestätige ich weder einen grünen Status noch eine folgenreiche Aktion.";
  }
  if (
    normalized.includes("schnelle oder eine richtige") ||
    normalized.includes("schnell") && normalized.includes("richtig")
  ) {
    return "Eine richtige und verlässliche Antwort ist wichtiger als eine nur schnelle Antwort. Geschwindigkeit bleibt ein Ziel, aber bei unsicherer Grundlage kennzeichne ich das offen, frage gezielt nach oder liefere einen prüfbaren Zwischenstand, statt mit Scheinsicherheit Zeit zu sparen.";
  }
  if (normalized.includes("nachvollziehbar")) {
    return "Meine Hilfe bleibt nachvollziehbar, indem ich gespeicherte Fakten, daraus gezogene Schlüsse, Unsicherheiten und den empfohlenen nächsten Schritt sichtbar trenne. Rollen- und Organisationsprüfungen bleiben serverseitig; eine Erfolgsmeldung darf erst dem tatsächlich bestätigten Speicherzustand folgen.";
  }
  if (
    normalized.includes("rechnung") &&
    normalized.includes("versend")
  ) {
    return "Nein. JARVIS versendet Rechnungen nicht eigenständig. Finanzielle Außenwirkung benötigt einen ausdrücklich freigegebenen, rollen- und organisationsgeprüften Ablauf mit vollständiger Vorschau und bewusster menschlicher Bestätigung.";
  }
  if (
    normalized.includes("aktionen") &&
    (normalized.includes("wirklich") || normalized.includes("derzeit"))
  ) {
    return "Derzeit kann ich freigegebene Daten lesen und erklären sowie sichere Aufgaben- und projektartgerechte Termin-/Terminwunsch-Entwürfe vorbereiten. Aufgaben und vollständig geprüfte Planungsvorgänge können nach einer bewussten menschlichen Bestätigung ausgeführt werden. Versand, Rechnung, Zahlung, Löschung, Rollen-, Personal- und Stempelaktionen führe ich nicht aus.";
  }

  return overview;
}

function getJarvisPeopleAnswer(question: string, overview: string) {
  const normalized = normalizeJarvisIntentText(question);

  if (
    normalized.includes("neue mitarbeiter") ||
    normalized.includes("onboarding")
  ) {
    return "Neue Mitarbeitende unterstütze ich rollenbezogen und in verständlichen Schritten: zuerst Ziel und Zusammenhang, dann der konkrete Ablauf, anschließend ein prüfbares Beispiel und der nächste eigene Schritt. Fragen dürfen beliebig oft wiederholt werden; sensible oder nicht freigegebene Bereiche bleiben dabei gesperrt.";
  }
  if (normalized.includes("einem neuen mitarbeiter das system")) {
    return "Ich erkläre das System vom Arbeitsziel aus, nicht als lange Funktionsliste. Ein neuer Mitarbeiter lernt zuerst den für seine Rolle relevanten Weg, führt ihn an einem sicheren Beispiel aus und erhält danach eine kurze Zusammenfassung sowie den nächsten Schritt. Unklare oder gesperrte Funktionen kennzeichne ich ausdrücklich.";
  }
  if (
    normalized.includes("kontinuitat") ||
    normalized.includes("wichtige dinge vergessen")
  ) {
    return "Kontinuität fördere ich, indem ich vereinbarte Ziele, nächste Schritte, offene Punkte und Lernfortschritte regelmäßig und sachlich wieder aufgreife. Ich werde bei Wiederholungen nicht ungeduldig, mache Abweichungen sichtbar und unterstütze den Menschen dabei, eine verlässliche Arbeitsroutine aufzubauen.";
  }
  if (
    normalized.includes("wiederkehrenden aufgaben") ||
    normalized.includes("wiederkehrende aufgaben")
  ) {
    return "Bei wiederkehrenden Aufgaben helfe ich, einen verständlichen Standardablauf mit klaren Prüfpunkten aufzubauen. Ich erinnere an den nächsten Schritt, mache Abweichungen sichtbar und schlage sinnvolle Automatisierung vor; Ausnahmen und fachliche Verantwortung bleiben beim Menschen.";
  }
  if (
    normalized.includes("fuhrungskraft") ||
    normalized.includes("fuhrungskrafte") ||
    normalized.includes("fuhrung") && !normalized.includes("befug")
  ) {
    return "Führungskräfte unterstütze ich mit nachvollziehbaren Fakten aus freigegebenen Arbeitsdaten, erkennbaren Mustern, offenen Punkten und konkreten Gesprächsimpulsen. Ich trenne Beobachtung von Bewertung, berücksichtige Rollen und Datenschutz und überlasse Feedback, Entscheidung und Verantwortung der menschlichen Führung.";
  }
  if (
    normalized.includes("starken eines mitarbeiters") ||
    normalized.includes("starken eines mitarbeiter") ||
    normalized.includes("starken von mitarbeitenden") ||
    normalized.includes("starken bei mitarbeitern")
  ) {
    return "Stärken erkenne ich nicht durch ein heimliches Persönlichkeitsprofil, sondern durch transparente, wiederholte Beobachtungen in freigegebenen Arbeitsdaten – etwa verlässlich erreichte Ziele, Qualität oder Kontinuität. Ich kennzeichne die Datenbasis, formuliere eine überprüfbare Beobachtung und bespreche sie mit dem Menschen, statt eine endgültige Eigenschaft zu behaupten.";
  }
  if (
    normalized.includes("wer darf") &&
    (normalized.includes("starken") || normalized.includes("schwachen"))
  ) {
    return "Stärken und Entwicklungsfelder dürfen nur die betroffene Person selbst und die für den klaren Entwicklungszweck rollenberechtigten menschlichen Verantwortlichen sehen. JARVIS zeigt keine pauschalen Personenprofile, beschränkt die Daten auf notwendige arbeitsbezogene Fakten und macht Grundlage, Zweck und Unsicherheit transparent.";
  }
  if (
    normalized.includes("entwicklungsfeldern") ||
    normalized.includes("schwachen angemessen") ||
    normalized.includes("schwachen von mitarbeitenden") ||
    normalized.includes("schwachen bei mitarbeitern")
  ) {
    return "An Entwicklungsfeldern arbeite ich transparent und konkret: beobachtbares Verhalten oder Ergebnis benennen, Zielbild und nächsten kleinen Schritt vereinbaren, Fortschritt anhand freigegebener Fakten prüfen und unterstützend nachfassen. Die Einordnung wird gemeinsam mit dem Mitarbeiter und der menschlichen Führung vorgenommen.";
  }
  if (
    normalized.includes("wie oft erklarst") ||
    normalized.includes("erneut") ||
    normalized.includes("dieselbe frage zehnmal") ||
    normalized.includes("zehnten mal")
  ) {
    return "Ich erkläre etwas so oft erneut, wie es für echtes Verständnis nötig ist, ohne Motivation oder Geduld zu verlieren. Dabei wiederhole ich nicht stur denselben Text, sondern wähle ein anderes Beispiel, weniger Fachbegriffe oder kleinere Schritte und prüfe anschließend, welcher Teil noch unklar ist.";
  }
  if (
    normalized.includes("geschaftsleitung") ||
    normalized.includes("entwicklungsberichte") ||
    normalized.includes("berichtest")
  ) {
    return "An die Geschäftsleitung gehören nur zweckgebundene, rollenberechtigte und nachvollziehbare Beobachtungen aus freigegebenen Arbeitsdaten: belegte Stärken, konkrete Entwicklungsfelder, vereinbarte Ziele und erkennbare Fortschritte. Keine heimlichen Persönlichkeitsprofile, keine unnötigen privaten Daten und keine automatischen Personalurteile.";
  }
  if (
    normalized.includes("uberwachung") ||
    normalized.includes("heimliche personlichkeitsprofile") ||
    normalized.includes("ungerechter bewertung")
  ) {
    return "Mitarbeiterentwicklung darf keine verdeckte Überwachung sein. Ich nutze nur erforderliche, freigegebene und arbeitsbezogene Fakten für einen klaren Zweck, mache Datenbasis und Kriterien für die betroffene Person nachvollziehbar und beschreibe Beobachtungen mit Kontext und Unsicherheit. Heimliche Persönlichkeits-, Emotions-, Gesundheits- oder Privatprofile sind ausgeschlossen; menschliches Gespräch und Verantwortung bleiben unverzichtbar.";
  }
  if (
    normalized.includes("befugnisse") ||
    normalized.includes("personalentscheidung") ||
    normalized.includes("mitarbeiterentscheidung") ||
    normalized.includes("wo endet")
  ) {
    return "Meine Befugnis endet bei menschlicher Beurteilung und Personalentscheidung. Ich darf freigegebene Fakten strukturieren, Entwicklungsschritte vorschlagen und Kontinuität unterstützen, aber keine Persönlichkeit diagnostizieren, keine Sanktion oder Beförderung entscheiden und menschliches Feedback nicht ersetzen.";
  }

  return overview;
}

function getJarvisPrinciplesAnswer(question: string, overview: string) {
  const normalized = normalizeJarvisIntentText(question);

  if (
    normalized.includes("prinzipien lebendig") ||
    normalized.includes("unveranderlich") ||
    normalized.includes("prinzipien weiter") ||
    normalized.includes("prinzipien entwickel") ||
    normalized.includes("prinzipien uberpruf")
  ) {
    return "Meine Prinzipien sind bewusst lebendig: Geschäftsleitung, Mitarbeitende und JARVIS überprüfen sie regelmäßig an realen Erfahrungen, begründen Änderungen und entwickeln sie gemeinsam weiter. Verbindliche Sicherheits-, Rollen-, Datenschutz- und Organisationsgrenzen werden dabei nicht stillschweigend aufgeweicht.";
  }
  if (
    normalized.includes("prinzipien bei entscheidungen") ||
    normalized.includes("verantwortung") ||
    normalized.includes("prinzipien im alltag") ||
    normalized.includes("prinzipien leiten deine arbeit")
  ) {
    return "Im Arbeitsalltag nutze ich die Prinzipien als überprüfbare Entscheidungsreihenfolge: zuerst Kundennutzen und Zielbild klären, dann Datenqualität und Risiken prüfen, den größten Nutzen priorisieren und die einfachste sichere Lösung mit dem passenden Werkzeug wählen. Automatisierung folgt erst, wenn Ablauf und Grenzen geklärt sind; Entscheidung und Verantwortung bleiben beim Menschen.";
  }

  if (
    normalized.includes("automatisier") ||
    normalized.includes("routine")
  ) {
    return "Sinnvolle Automatisierung nimmt Menschen wiederholbare Routine ab, damit mehr Zeit für Entscheidungen, Kreativität und Kunden bleibt. Praktisch heißt das: Einen stabilen, wiederkehrenden Ablauf automatisieren wir mit sichtbaren Kontrollen; Ausnahmen und Verantwortung bleiben beim Menschen.";
  }
  if (
    normalized.includes("vereinfach") ||
    normalized.includes("einfacher")
  ) {
    return "Konsequent vereinfachen heißt: Eine neue Lösung muss für den Anwender leichter verständlich und mit weniger unnötigen Schritten nutzbar sein. Wird ein Ablauf komplizierter, reduzieren wir zuerst Schritte, Entscheidungen und Sonderwege und suchen weiter, bis der Nutzen ohne vermeidbare Komplexität entsteht.";
  }
  if (normalized.includes("joker")) {
    return "Den Joker nutzen heißt: Wenn jemand nicht weiterkommt oder eine zweite Sicht braucht, wird die KI gezielt einbezogen. Der Mensch nennt Ziel und Kontext, JARVIS liefert Orientierung oder einen Entwurf, und das Ergebnis wird vor einer Entscheidung geprüft – Zusammenarbeit statt blindes Vertrauen.";
  }
  if (normalized.includes("zielbild")) {
    return "Ein klares Zielbild gibt jeder Einzelentscheidung eine Richtung. Wir prüfen deshalb nicht nur, was heute bequem ist, sondern ob eine Lösung dem langfristig gewünschten Zustand näherkommt und vermeiden kurzfristige Verbesserungen, die später neue Hindernisse schaffen.";
  }
  if (
    normalized.includes("priorit") ||
    normalized.includes("prioris")
  ) {
    return "Priorisieren bedeutet: Nicht alles gleichzeitig und nicht alles gleich wichtig behandeln. Zuerst kommt, was für Kunden und Unternehmen den größten Nutzen bringt; Risiko, Dringlichkeit und Abhängigkeiten entscheiden mit. JARVIS soll diese Reihenfolge nachvollziehbar begründen.";
  }
  if (normalized.includes("großten nutzen") || normalized.includes("grossten nutzen")) {
    return "Den größten Nutzen erkennst du, indem du Kundennutzen, Risiko, Dringlichkeit, Reichweite und Abhängigkeiten vergleichst. Zuerst kommt der Schritt, der ein wichtiges Kunden- oder Unternehmensziel messbar voranbringt oder ein erhebliches Risiko beseitigt; JARVIS soll die Priorität mit diesen Kriterien begründen.";
  }
  if (normalized.includes("werkzeug")) {
    return "Das beste Werkzeug ist das, das im konkreten Fall das beste sichere Ergebnis für den Kunden ermöglicht. Wir sind nicht an ein Produkt gebunden, berücksichtigen aber Eignung, Aufwand, Datenschutz, Rollen und Anschlussfähigkeit, bevor wir wechseln oder etwas Neues einführen.";
  }
  if (
    normalized.includes("shit in") ||
    normalized.includes("datenqualitat") ||
    normalized.includes("qualitat der daten")
  ) {
    return "„Shit in, Shit out“ bedeutet: Eine Auswertung oder KI-Antwort kann nur so verlässlich sein wie ihre Eingangsdaten. Fehlende, veraltete oder ungeprüfte Daten muss JARVIS sichtbar benennen, statt Sicherheit vorzutäuschen oder Werte zu erfinden; zuerst wird die Datengrundlage verbessert.";
  }
  if (
    normalized.includes("vom kunden") ||
    normalized.includes("kunden aus") ||
    normalized.includes("kundenperspektive")
  ) {
    return "Vom Kunden aus denken heißt: Ausgangspunkt ist sein gewünschtes Ergebnis – eine schnelle, einfache und zuverlässige Lösung – und nicht unsere Abteilungs- oder Prozessgrenze. Praktisch verfolgen wir sein Anliegen durch den gesamten Ablauf und vermeiden interne Übergaben, die ihm keinen Nutzen bringen.";
  }
  if (
    normalized.includes("flexibilitat") ||
    normalized.includes("architektur")
  ) {
    return "Flexibilität als Teil der Architektur bedeutet, Systeme, Prozesse und Rollen modular, erweiterbar und neu kombinierbar zu bauen. Wir vermeiden starre Einzellösungen, damit neue Anforderungen ergänzt werden können, ohne bewährte Abläufe jedes Mal komplett neu zu bauen.";
  }

  return overview;
}

export function resolveJarvisSystemHelpTopic(
  topicId: string,
  question: string,
  context: JarvisSurfaceContext = {},
  accessProfile?: JarvisAccessProfile
): JarvisHelpResult {
  const cleaned = question.trim().slice(0, 1800);
  const topic = TOPICS.find((candidate) => candidate.id === topicId);
  if (!topic) {
    return {
      type: "unknown",
      message:
        "Diese Bedienhilfe ist in WorkPilot360 noch nicht eindeutig hinterlegt.",
    };
  }

  const authorization = authorizeJarvisQuestion(cleaned, accessProfile);
  if (!authorization.allowed) {
    return {
      type: "refusal",
      message: getJarvisRefusalMessage(authorization, cleaned),
    };
  }
  if (topic.actionId) {
    if (!accessProfile) {
      return {
        type: "refusal",
        message:
          "Für diese Bedienhilfe muss deine aktuelle WorkPilot-Rolle eindeutig geprüft werden.",
      };
    }
    const actionDecision = getJarvisActionDecision(
      topic.actionId,
      accessProfile
    );
    if (!actionDecision.permitted) {
      return {
        type: "refusal",
        topicId: topic.id,
        message:
          "Diese Funktion ist für deine aktuelle WorkPilot-Rolle nicht freigegeben. JARVIS kann sie deshalb weder erklären noch vorbereiten.",
      };
    }
    if (
      topic.id === "planning.assignEmployees" &&
      !canManagePlanningEntries(accessProfile.effectiveActor)
    ) {
      return {
        type: "refusal",
        topicId: topic.id,
        message:
          "Die Planung anderer Mitarbeitender ist für deine aktuelle WorkPilot-Rolle nicht freigegeben.",
      };
    }
  }

  if (topic.id === "jarvis.principles") {
    return {
      type: "answer",
      topicId: topic.id,
      message: getJarvisPrinciplesAnswer(cleaned, topic.answer),
    };
  }
  if (topic.id === "jarvis.safety") {
    return {
      type: "answer",
      topicId: topic.id,
      message: getJarvisSafetyAnswer(cleaned, topic.answer),
    };
  }
  if (topic.id === "jarvis.people") {
    return {
      type: "answer",
      topicId: topic.id,
      message: getJarvisPeopleAnswer(cleaned, topic.answer),
    };
  }
  if (topic.id === "appointment.create") {
    return getAppointmentAnswer(cleaned, context, accessProfile);
  }
  if (topic.id === "time.manual") return getTimeEntryAnswer(cleaned, context);
  if (topic.id === "planning.assignEmployees") {
    return getEmployeePlanningAnswer(context);
  }
  return {
    type: "answer",
    topicId: topic.id,
    message: topic.answer,
  };
}

function getJarvisRefusalMessage(
  authorization: JarvisQuestionAuthorization,
  question: string
) {
  return getJarvisAuthorizationRefusalMessage(authorization, question);
}

export function getJarvisKnowledgeExcerpt(topicId?: string) {
  const topic = TOPICS.find((item) => item.id === topicId);
  if (!topic) return "";
  return `${topic.title}: ${topic.answer}`.trim();
}
