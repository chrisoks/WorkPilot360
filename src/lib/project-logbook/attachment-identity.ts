export type ProjectAttachmentIdentity = {
  storageFileId?: string;
  name: string;
};

export function findProjectAttachmentIndex(input: {
  attachments: ProjectAttachmentIdentity[];
  requestedStorageFileId?: string;
  requestedIndex?: number;
  requestedName?: string;
}) {
  const storageFileId = input.requestedStorageFileId?.trim() || "";
  if (storageFileId) {
    const matches = input.attachments
      .map((attachment, index) => ({ attachment, index }))
      .filter(({ attachment }) => attachment.storageFileId === storageFileId);
    return matches.length === 1 ? matches[0].index : -1;
  }

  const name = input.requestedName?.trim() || "";
  const index = Number(input.requestedIndex);
  if (
    Number.isInteger(index) &&
    index >= 0 &&
    index < input.attachments.length &&
    (!name || input.attachments[index]?.name === name)
  ) {
    return index;
  }

  if (!name) return -1;
  const nameMatches = input.attachments
    .map((attachment, attachmentIndex) => ({ attachment, attachmentIndex }))
    .filter(({ attachment }) => attachment.name === name);
  return nameMatches.length === 1 ? nameMatches[0].attachmentIndex : -1;
}
