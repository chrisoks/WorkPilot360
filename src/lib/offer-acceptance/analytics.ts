export type OfferAcceptanceAnalyticsItem = {
  id: string;
  offerId: string;
  status: string;
  createdAt?: string;
  sentAt?: string;
  expiresAt?: string;
  firstViewedAt?: string;
  acceptedAt?: string;
  withdrawnAt?: string;
};

const acceptanceTime = (item: OfferAcceptanceAnalyticsItem) => {
  const value = item.createdAt || item.sentAt || "";
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

export function getLatestOfferAcceptances<T extends OfferAcceptanceAnalyticsItem>(items: T[]) {
  const latestByOffer = new Map<string, T>();
  [...items]
    .sort((first, second) => acceptanceTime(second) - acceptanceTime(first))
    .forEach((item) => {
      if (!latestByOffer.has(item.offerId)) latestByOffer.set(item.offerId, item);
    });
  return Array.from(latestByOffer.values());
}

export function getOfferAcceptanceFunnel<T extends OfferAcceptanceAnalyticsItem>(
  items: T[],
  options: { isInPeriod: (value: string) => boolean; now?: Date }
) {
  const now = options.now ?? new Date();
  const latest = getLatestOfferAcceptances(items);
  const sent = latest.filter((item) => Boolean(item.sentAt && options.isInPeriod(item.sentAt)));
  const viewed = sent.filter((item) => Boolean(item.firstViewedAt));
  const accepted = sent.filter(
    (item) => item.status === "accepted" && Boolean(item.acceptedAt) && !item.withdrawnAt
  );
  const viewedOpen = latest.filter((item) => {
    if (!item.firstViewedAt || item.acceptedAt || item.withdrawnAt) return false;
    if (["accepted", "withdrawn", "revoked", "expired"].includes(item.status)) return false;
    const expiresAt = item.expiresAt ? new Date(item.expiresAt).getTime() : Number.POSITIVE_INFINITY;
    return !Number.isFinite(expiresAt) || expiresAt >= now.getTime();
  });

  return {
    latest,
    sent,
    viewed,
    accepted,
    viewedOpen,
    openingRate: sent.length > 0 ? (viewed.length / sent.length) * 100 : 0,
    acceptanceRate: sent.length > 0 ? (accepted.length / sent.length) * 100 : 0,
  };
}
