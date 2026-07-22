function normalizeHttpOrigin(value: string | null | undefined) {
  const candidate = value?.trim();
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (url.username || url.password) return "";
    return url.origin;
  } catch {
    return "";
  }
}

export function resolvePublicAppOrigin(input: {
  configuredOrigin?: string | null;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
  host?: string | null;
  requestUrl?: string | null;
}) {
  const configuredOrigin = normalizeHttpOrigin(input.configuredOrigin);
  if (configuredOrigin) return configuredOrigin;

  const forwardedHost = input.forwardedHost?.split(",")[0]?.trim();
  const forwardedProto = input.forwardedProto?.split(",")[0]?.trim().toLowerCase();
  const proxyOrigin = normalizeHttpOrigin(
    forwardedHost ? `${forwardedProto === "http" ? "http" : "https"}://${forwardedHost}` : ""
  );
  if (proxyOrigin) return proxyOrigin;

  const requestProtocol = normalizeHttpOrigin(input.requestUrl)?.startsWith("http://") ? "http" : "https";
  const hostOrigin = normalizeHttpOrigin(input.host ? `${requestProtocol}://${input.host.trim()}` : "");
  if (hostOrigin) return hostOrigin;

  return normalizeHttpOrigin(input.requestUrl) || "http://localhost:3001";
}

export function getPublicAppOrigin(req: Request) {
  return resolvePublicAppOrigin({
    configuredOrigin: process.env.WORKPILOT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL,
    forwardedHost: req.headers.get("x-forwarded-host"),
    forwardedProto: req.headers.get("x-forwarded-proto"),
    host: req.headers.get("host"),
    requestUrl: req.url,
  });
}
