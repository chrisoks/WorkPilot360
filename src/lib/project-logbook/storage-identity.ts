export function buildProjectLogbookAttachmentSourceEntityId(input: {
  entryId: string;
  attachmentIndex: number;
  uploadBatchId: string;
}) {
  return `${input.entryId}:${input.attachmentIndex}:${input.uploadBatchId}`;
}
