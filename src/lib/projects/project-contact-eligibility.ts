type ProjectMainContact = {
  category: string;
  deletionMarkedAt: Date | string | null;
};

export function getProjectMainContactEligibilityError(contact: ProjectMainContact | null | undefined) {
  if (!contact) return null;
  if (contact.deletionMarkedAt) {
    return "Der ausgewählte Hauptkontakt ist löschmarkiert und kann keinem Projekt zugeordnet werden.";
  }
  if (contact.category === "Interessent") {
    return "Der Interessent muss vor der Projekt- oder Angebotsanlage als Gewerbe- oder Privatkunde übernommen werden.";
  }
  return null;
}
