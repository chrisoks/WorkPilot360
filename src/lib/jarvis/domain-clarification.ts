import { createJarvisDialogChoice } from "@/lib/jarvis/dialog";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import type { JarvisHelpResult } from "@/lib/jarvis/knowledge";

export function resolveJarvisDomainClarification(
  question: string
): JarvisHelpResult | undefined {
  const value = normalizeJarvisIntentText(question).replace(/\s+/g, " ").trim();

  if (/\bwarum\b.*\b(?:dieses|das) projekt\b.*\bkritisch\b/.test(value)) {
    return {
      type: "clarification",
      topicId: "project.health.reference-required",
      message:
        "Welches Projekt soll ich prüfen? Nenne oder wähle bitte die Projektnummer. Danach erkläre ich die konkreten Risikohinweise samt Datenbasis; ohne Projektbezug erfinde ich keine Begründung.",
      choices: [createJarvisDialogChoice("project-search", "Projekt suchen", "Suche ein Projekt")],
    };
  }

  if (/\bwarum\b.*\b(?:diese|die) aufgabe\b.*\beskalier\w*\b/.test(value)) {
    return {
      type: "clarification",
      topicId: "task.escalation.reference-required",
      message:
        "Welche Aufgabe meinst du? Nenne oder wähle bitte die Aufgabe. Dann prüfe ich Fälligkeit, Status, Zuständigkeit, Eskalationsregel und Verlauf und erkläre den belegten Grund.",
      choices: [createJarvisDialogChoice("task-search", "Aufgabe suchen", "Zeige meine offenen Aufgaben")],
    };
  }

  if (/\bwarum\b.*\b(?:diese|die) planung\b.*\buberbuch\w*\b/.test(value)) {
    return {
      type: "clarification",
      topicId: "planning.overbooking.reference-required",
      message:
        "Welchen Termin oder welche Terminserie meinst du? Wähle den Planungseintrag oder nenne Projekt und Datum. Danach prüfe ich je nach Projektart Angebotskontingent, Monatskontingent, Mitarbeiterauslastung und den dokumentierten Überbuchungsgrund.",
      choices: [createJarvisDialogChoice("planning-open", "Planung öffnen", "Öffne das Planungsboard")],
    };
  }

  if (/\bwarum\b.*\b(?:dieses|das) angebot\b.*\bwirtschaftlich\w*\b.*\bauffallig\w*\b/.test(value)) {
    return {
      type: "clarification",
      topicId: "offer.health.reference-required",
      message:
        "Welches Angebot meinst du? Nenne bitte die Angebotsnummer oder wähle das Angebot. Danach prüfe ich Positionen, Preise, kalkulierte Grundlagen und vorhandene Warnungen; ohne eindeutiges Angebot behaupte ich keine wirtschaftliche Auffälligkeit.",
      choices: [createJarvisDialogChoice("offer-search", "Angebot suchen", "Zeige die offenen Angebote")],
    };
  }

  if (/\bvergleich\w*\b.*\braum\w*\b.*\bstreu\w*\b/.test(value)) {
    return {
      type: "clarification",
      topicId: "calculator.winter.variant-comparison",
      message:
        "Gerne. Ich berechne Räumen und Streuen sowie nur Streuen mit derselben Fläche und denselben Preisgrundlagen. Nenne zuerst Kunde oder Projekt, Fläche und die gewünschte Einsatz- beziehungsweise Saisonannahme; danach stelle ich beide Varianten nachvollziehbar gegenüber.",
      choices: [createJarvisDialogChoice("winter-start", "Winterdienst kalkulieren", "Starte eine Winterdienst-Kalkulation")],
    };
  }

  if (/\baktuell\w*\b.*\bkraftstoffpreis\b.*\bfahrt\b|\bkraftstoffpreis\b.*\bfahrtenkalkulation\b/.test(value)) {
    return {
      type: "clarification",
      topicId: "calculator.vehicle-trip.fuel-context",
      message:
        "Für welche Fahrt und welches Fahrzeug soll ich den in WorkPilot hinterlegten aktuellen Kraftstoffpreis verwenden? Nenne Strecke und Fahrzeug oder starte die Fahrtenkalkulation; ich zeige Preisstand und Rechenschritte, bevor etwas gespeichert wird.",
      choices: [createJarvisDialogChoice("trip-start", "Fahrt kalkulieren", "Starte eine Fahrtenkalkulation")],
    };
  }

  if (/\berklar\w*\b.*\brechenschritt\w*\b.*\bkalkulation\b/.test(value)) {
    return {
      type: "clarification",
      topicId: "calculator.explanation.choice",
      message:
        "Welche Kalkulation soll ich erklären: Winterdienst oder Fahrt/Fahrzeugkosten? Wähle den Rechner oder öffne einen vorhandenen Entwurf; dann erkläre ich Eingaben, Formeln, Zwischensummen, Ausschlüsse und Ergebnis Schritt für Schritt.",
      choices: [
        createJarvisDialogChoice("winter-explain", "Winterdienst", "Erkläre die Winterdienstkalkulation"),
        createJarvisDialogChoice("trip-explain", "Fahrtenkalkulation", "Erkläre die Fahrtenkalkulation"),
      ],
    };
  }

  if (/\bwelche anliegenart\b.*\bausgewahlt\b/.test(value)) {
    return {
      type: "clarification",
      topicId: "online-requests.request-type.reference-required",
      message:
        "Welche Online-Anfrage meinst du? Nenne oder öffne bitte die OKI-Referenz. Danach lese ich die ausgewählte Anliegenart direkt aus der Anfrage und erfinde keine Zuordnung.",
      choices: [createJarvisDialogChoice("online-open", "Online-Anfragen öffnen", "Zeige die Online-Anfragen")],
    };
  }

  if (/\bwelches gewerk\b.*\b(?:passt|gehort)\b.*\banfrage\b/.test(value)) {
    return {
      type: "clarification",
      topicId: "online-requests.trade.reference-required",
      message:
        "Welche Online-Anfrage soll ich fachlich einordnen? Nenne oder öffne bitte die OKI-Referenz. Dann vergleiche ich ausgewähltes Gewerk, Freitext und Zusatzinteressen; die Sachbearbeitung entscheidet die Zuordnung vor der Umwandlung.",
      choices: [createJarvisDialogChoice("online-open", "Online-Anfragen öffnen", "Zeige die Online-Anfragen")],
    };
  }

  return undefined;
}
