export type CompositeDispatchRecord = {
  organizationId: string;
  documentKind: string;
  documentId: string;
  senderUserId: string;
  status: string;
};

export type CompositeDispatchIdentity = Omit<
  CompositeDispatchRecord,
  "status"
>;

export type CompositeDispatchPlan =
  | { action: "claim-primary" }
  | { action: "resume-activity" }
  | { action: "replay-complete" }
  | { action: "conflict"; target: "primary" | "activity" }
  | {
      action: "blocked";
      target: "primary" | "activity";
      status: string;
    };

function matchesIdentity(
  dispatch: CompositeDispatchRecord,
  expected: CompositeDispatchIdentity
) {
  return (
    dispatch.organizationId === expected.organizationId &&
    dispatch.documentKind === expected.documentKind &&
    dispatch.documentId === expected.documentId &&
    dispatch.senderUserId === expected.senderUserId
  );
}

export function planCompositeDocumentDispatch(input: {
  primary: CompositeDispatchRecord | null;
  activity: CompositeDispatchRecord | null;
  expectsActivity: boolean;
  expectedPrimary: CompositeDispatchIdentity;
  expectedActivity: CompositeDispatchIdentity;
}): CompositeDispatchPlan {
  if (!input.primary) return { action: "claim-primary" };
  if (!matchesIdentity(input.primary, input.expectedPrimary)) {
    return { action: "conflict", target: "primary" };
  }
  if (input.primary.status !== "sent") {
    return {
      action: "blocked",
      target: "primary",
      status: input.primary.status,
    };
  }
  if (!input.expectsActivity) return { action: "replay-complete" };
  if (!input.activity) return { action: "resume-activity" };
  if (!matchesIdentity(input.activity, input.expectedActivity)) {
    return { action: "conflict", target: "activity" };
  }
  if (input.activity.status === "sent") {
    return { action: "replay-complete" };
  }
  return {
    action: "blocked",
    target: "activity",
    status: input.activity.status,
  };
}
