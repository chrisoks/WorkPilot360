import type { JarvisHelpResult } from "@/lib/jarvis/knowledge";
import { getJarvisActionDecision } from "@/lib/jarvis/actions";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import type { JarvisAccessProfile } from "@/lib/jarvis/security";

function canUse(actionId: string, accessProfile?: JarvisAccessProfile) {
  return Boolean(accessProfile && getJarvisActionDecision(actionId, accessProfile).permitted);
}

function roleRefusal(topicId: string): JarvisHelpResult {
  return {
    type: "refusal",
    topicId,
    message:
      "Diese Fachinformation betrifft einen rollenbegrenzten WorkPilot-Bereich. Ich darf sie erst erklären, wenn deine aktuelle Sitzung und wirksame Rolle den Bereich serverseitig sehen dürfen.",
  };
}

/**
 * Fachverträge für produktive WorkPilot-Änderungen nach dem letzten großen
 * JARVIS-Ausbau. Die Antworten erklären ausschließlich bereits vorhandene
 * Systemlogik. Sie lesen und verändern keine Fachdaten.
 */
export function resolveJarvisCurrentProductGuidance(
  question: string,
  accessProfile?: JarvisAccessProfile
): JarvisHelpResult | undefined {
  const value = normalizeJarvisIntentText(question);

  const asksAboutProspect = /\binteressent(?:en|in)?\b|\bprospect\w*\b/.test(value);
  const asksAboutSalesJournal = /\bsales[- ]journal\b|\bvertriebs(?:tagebuch|journal|aktivitat)\w*\b/.test(value);

  if (asksAboutProspect) {
    if (!canUse("contact.read", accessProfile)) {
      return roleRefusal("contacts.prospect.role-required");
    }
    if (/\b(?:projekt|angebot)\w*\b/.test(value)) {
      return {
        type: "answer",
        topicId: "contacts.prospect.project-eligibility",
        message:
          "Ein aktiver Interessent ist in WorkPilot zunächst ein Vertriebskontakt ohne Kundennummer. Deshalb darf für ihn noch kein Projekt und kein Angebot angelegt werden. Übernimm ihn zuerst bewusst als Gewerbe- oder Privatkunde. WorkPilot vergibt dabei transaktionsgeschützt die nächste Kundennummer und dokumentiert den Umwandlungszeitpunkt; erst danach wird die Projekt- und Angebotsanlage freigegeben. Eine Rückumwandlung eines bestehenden Kunden zum Interessenten ist nicht zulässig.",
      };
    }
    return {
      type: "answer",
      topicId: "contacts.prospect.lifecycle",
      message:
        "Ein Interessent wird im bestehenden Kontaktbereich und Sales-Journal geführt, besitzt zunächst keine Kundennummer und bleibt von Projekt- und Angebotsanlage ausgeschlossen. Vertriebsaktivitäten werden im Kundenlogbuch nachvollziehbar dokumentiert. Bei der bewussten Übernahme als Gewerbe- oder Privatkunde vergibt WorkPilot genau einmal die nächste Kundennummer und hält Beginn sowie Umwandlung des Interessentenstatus fest.",
    };
  }

  if (asksAboutSalesJournal) {
    if (!canUse("contact.read", accessProfile)) {
      return roleRefusal("sales-journal.role-required");
    }
    return {
      type: "answer",
      topicId: "sales-journal.workflow",
      message:
        "Das Sales-Journal dokumentiert tatsächlich ausgeführte Vertriebsaktivitäten. Manuell werden nur Kunde oder Interessent, Aktivitätsart und eine kurze Notiz erfasst; Mitarbeiter und Zeitpunkt kommen sicher aus der aktiven Sitzung. Eine Wiedervorlage bleibt eine Aufgabe und eine Arbeitszeit bleibt eine Zeitbuchung – das Journal ersetzt beides nicht. Außer der Geschäftsführung sieht jede Rolle serverseitig nur die eigenen persönlichen Aktivitäten. JARVIS kann den Bereich erklären und öffnen, aber derzeit keinen Journaleintrag selbst speichern.",
      navigation: { label: "Sales-Journal öffnen", tab: "salesJournal" },
    };
  }

  if (
    /\b(?:kundenhinweis|projekthinweis|hinweis)\w*\b/.test(value) &&
    /\b(?:projektanlage|projekt anlegen|projekt erstellen|bestatig|vor projekt)\w*\b/.test(value)
  ) {
    if (!canUse("project.manage", accessProfile)) {
      return roleRefusal("projects.create-confirmation.role-required");
    }
    return {
      type: "answer",
      topicId: "projects.create-confirmation",
      message:
        "Ein dafür markierter Kunden- oder Projekthinweis wird bei einer neuen Projektanlage nach vollständiger Eingabe, aber noch vor der ersten Speicherung angezeigt. Zurück lässt die ausgefüllte Projektmaske unverändert offen. Erst eine sichtbare Bestätigung erlaubt die Anlage; anschließend wird die Bestätigung mit der neuen Projekt-ID protokolliert. Das Bearbeiten eines bereits bestehenden Projekts löst diese Projektanlage-Bestätigung nicht aus.",
    };
  }

  const hourlyRecurringSignal =
    /\b(?:stunden[- ]dauerlaufer|dauerlaufer mit stundenabrechnung|stundenabrechnung|stundenentwurf)\w*\b/.test(value);

  if (
    hourlyRecurringSignal &&
    /\b(?:forecast|prognose|erwarteter umsatz|planumsatz)\w*\b/.test(value)
  ) {
    if (!canUse("invoice.read", accessProfile)) {
      return roleRefusal("recurring.hourly.forecast.role-required");
    }
    return {
      type: "answer",
      topicId: "recurring.hourly.forecast",
      message:
        "Der sichere Monatsforecast eines Stunden-Dauerläufers setzt sich aus dem vollständigen Netto-Wert des offenen automatischen Stundenentwurfs und noch nicht ausgeführten bestätigten Planterminen desselben Leistungsmonats zusammen. Bereits über eine Planung im Entwurf enthaltene Zeit wird nicht doppelt gezählt. Terminwünsche, gelöschte Termine und Termine ohne belastbare Abrechnungsleistung zählen nicht. Material wird erst berücksichtigt, wenn es wirklich im Entwurf steht. Eine echte Monatsrechnung ersetzt Entwurf und Planung als führende Grundlage.",
    };
  }

  if (
    hourlyRecurringSignal &&
    /\b(?:kundentext|tagesnachweis|leistungstag|rechnungstext|stempelkommentar|mitarbeitername)\w*\b/.test(value)
  ) {
    if (!canUse("invoice.read", accessProfile)) {
      return roleRefusal("recurring.hourly.customer-text.role-required");
    }
    return {
      type: "answer",
      topicId: "recurring.hourly.customer-text",
      message:
        "Beim Stunden-Dauerläufer bleibt jede ausgewählte Stempelung intern mit Mitarbeiter, Zeiten, Kommentar und Terminbeschreibung nachvollziehbar. Kundenwirksam fasst WorkPilot die zugehörigen Stunden je Leistungsposition und Kalendertag zusammen. Auf Rechnung und E-Rechnung erscheinen nur Leistungsdatum, fakturierte Stunden und der editierbare Kundentext dieses Tages. Fehlt für einen vorhandenen Tagesnachweis der Kundentext, blockiert die Fakturierung fail-closed. Der Text wird entwurfs- und revisionsgebunden gespeichert und darf bei einem Konflikt keinen fremden Stand überschreiben.",
    };
  }

  if (
    hourlyRecurringSignal &&
    /\b(?:manuell|nachtraglich|zeiteintrag|stempelung|rechnungsentwurf)\w*\b/.test(value)
  ) {
    if (!canUse("invoice.read", accessProfile)) {
      return roleRefusal("recurring.hourly.invoice-draft.role-required");
    }
    return {
      type: "answer",
      topicId: "recurring.hourly.invoice-draft",
      message:
        "Live-Stempelungen und neu angelegte manuelle Projektzeiten verwenden beim Stunden-Dauerläufer denselben geschützten Monatsentwurfs-Service. Die erste passende Zeit erzeugt genau einen Entwurf für den Leistungsmonat, weitere Zeiten ergänzen positionsbezogen die passende Abrechnungsleistung. Ein Fehler der Abrechnungsautomatik löscht niemals die bereits gespeicherte Arbeitszeit, sondern meldet den Entwurf sichtbar zur Prüfung. Monatspauschalen und Einmalprojekte verwenden diesen Stundenentwurfsweg nicht.",
    };
  }

  if (
    /\b(?:pause|pausenzeit|nettoarbeitszeit|nettozeit|arbeitszeit)\w*\b/.test(value) &&
    /\b(?:abzieh|doppelt|dauer|duration|netto|zeitstatus|soll ist|stempel)\w*\b/.test(value)
  ) {
    if (!accessProfile) return roleRefusal("time.net-duration.role-required");
    return {
      type: "answer",
      topicId: "time.net-duration-and-breaks",
      message:
        "Die gespeicherte Dauer eines Zeiteintrags ist in WorkPilot immer die kanonische Nettoarbeitszeit. Die dokumentierte Pause ist ein zusätzlicher Nachweis und darf nicht noch einmal von dieser Dauer abgezogen werden. Bei manueller Zeit oder beim Beenden einer Stempelung weist WorkPilot auf eine fehlende geplante Pause hin und verlangt gegebenenfalls eine Bestätigung, verändert die tatsächlich erfasste Nettozeit aber nicht still. Der Zeitstatus vergleicht Soll-Nettozeit mit Ist-Nettozeit und bewertet keine Pünktlichkeit.",
    };
  }

  if (
    /\b(?:projektlaufzeit|vertragslaufzeit|vertragsmonat|leistungsmonat)\w*\b/.test(value) &&
    /\b(?:plan|termin|kontingent|ausserhalb|außerhalb|monat)\w*\b/.test(value)
  ) {
    if (!accessProfile) return roleRefusal("projects.contract-months.role-required");
    return {
      type: "answer",
      topicId: "projects.contract-month-boundaries",
      message:
        "Bei einem Dauerläufer müssen Planung, monatlicher Prüfstatus und Kontingente innerhalb der hinterlegten Projektlaufzeit bleiben. Monate vor dem geplanten Start oder nach dem Laufzeitende dürfen nicht als reguläre Leistungsmonate behandelt werden. Der Stunden-Dauerläufer wird dabei je Leistungsmonat geprüft; ein anderer Monat darf den aktuellen Monatsstatus nicht fälschlich auf vollständig setzen.",
    };
  }

  if (/\bhalbjahrlich\b|\bhalbjahres(?:abrechnung|intervall)\w*\b/.test(value)) {
    if (!canUse("project.read", accessProfile)) {
      return roleRefusal("projects.billing-interval.semiannual.role-required");
    }
    return {
      type: "answer",
      topicId: "projects.billing-interval.semiannual",
      message:
        "„Halbjährlich“ ist derzeit ein speicherbarer Projektstammwert für Dauerläufer. Er stellt Stapelabrechnung, automatische Stundenentwürfe und Forecast noch nicht automatisch auf einen Sechsmonatsrhythmus um. Für eine echte halbjährliche Intervalllogik müssen Startmonat, Betragsbasis und der Umgang mit Stundenabrechnung zuerst fachlich festgelegt und separat freigegeben werden. JARVIS darf aus diesem Feld deshalb noch keine automatische Fälligkeit oder Rechnung ableiten.",
    };
  }

  return undefined;
}
