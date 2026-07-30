import { z } from "zod";

export const ONLINE_REQUEST_TYPE_VALUES = [
  "offer",
  "callback",
  "execution",
  "issue",
  "general",
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

export const publicOnlineRequestSchema = z
  .object({
    sessionToken: z.string().min(20).max(2_048),
    proof: z.string().regex(/^[0-9]{1,12}$/),
    turnstileToken: optionalText(4_096),
    website: z.string().max(0),
    clientSubmissionId: z.string().uuid(),
    requestType: z.enum(ONLINE_REQUEST_TYPE_VALUES),
    tradeId: z.string().trim().min(1).max(100),
    recommendationTradeIds: z
      .array(z.string().trim().min(1).max(100))
      .max(3)
      .default([]),
    desiredDate: optionalText(10),
    desiredTimeWindow: z
      .enum(["flexible", "morning", "afternoon"])
      .optional(),
    callbackTimeWindow: z
      .enum(["flexible", "morning", "afternoon"])
      .optional(),
    urgency: z.enum(["normal", "soon", "urgent"]).optional(),
    street: z.string().trim().min(3).max(160),
    postalCode: z.string().trim().min(3).max(20),
    city: z.string().trim().min(2).max(120),
    objectHint: optionalText(240),
    description: z.string().trim().min(10).max(3_000),
    customerKind: z.enum(["private", "business"]),
    company: optionalText(180),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: optionalText(254),
    phone: optionalText(80),
    preferredContact: z.enum(["email", "phone", "either"]),
    consent: z.literal(true),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.email && !value.phone) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "E-Mail-Adresse oder Telefonnummer ist erforderlich.",
      });
    }
    if (value.email && !z.string().email().safeParse(value.email).success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "E-Mail-Adresse ist ungültig.",
      });
    }
    if (value.customerKind === "business" && !value.company) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["company"],
        message: "Firma ist für Geschäftskunden erforderlich.",
      });
    }
    if (new Set(value.recommendationTradeIds).size !== value.recommendationTradeIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recommendationTradeIds"],
        message: "Zusatzleistungen dürfen nicht doppelt gewählt werden.",
      });
    }
    if (value.recommendationTradeIds.includes(value.tradeId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recommendationTradeIds"],
        message: "Die Hauptleistung darf nicht zugleich Zusatzleistung sein.",
      });
    }
    if (value.desiredDate && !/^\d{4}-\d{2}-\d{2}$/.test(value.desiredDate)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["desiredDate"],
        message: "Wunschdatum ist ungültig.",
      });
    }
    if (value.desiredDate) {
      const parsedDate = new Date(`${value.desiredDate}T00:00:00.000Z`);
      if (
        !Number.isFinite(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== value.desiredDate
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["desiredDate"],
          message: "Wunschdatum ist ungültig.",
        });
      }
    }
    if (
      value.requestType !== "execution" &&
      (value.desiredDate || value.desiredTimeWindow)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["desiredDate"],
        message: "Ein Wunschdatum gehört nur zu einer Durchführungsanfrage.",
      });
    }
    if (value.requestType !== "callback" && value.callbackTimeWindow) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["callbackTimeWindow"],
        message: "Ein Rückrufzeitraum gehört nur zu einer Rückrufanfrage.",
      });
    }
    if (value.requestType !== "issue" && value.urgency) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["urgency"],
        message: "Eine Dringlichkeit gehört nur zu einer Mangelmeldung.",
      });
    }
  });

export type PublicOnlineRequestInput = z.infer<typeof publicOnlineRequestSchema>;

export function parsePublicOnlineRequestInput(value: unknown) {
  return publicOnlineRequestSchema.safeParse(value);
}
