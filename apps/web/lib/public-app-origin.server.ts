import "server-only";

export const SETTLE_PUBLIC_APP_ORIGIN_ENV = "SETTLE_PUBLIC_APP_ORIGIN" as const;

export type PublicAppOriginEnvironment = Readonly<Record<string, string | undefined>>;

export class PublicAppOriginError extends Error {
  readonly code = "PUBLIC_ORIGIN_UNAVAILABLE" as const;

  constructor() {
    super("External payment handoff is not configured.");
    this.name = "PublicAppOriginError";
  }
}

export function parsePublicAppOrigin(
  values: PublicAppOriginEnvironment,
  options: { readonly allowInsecureLocalhost?: boolean } = {},
): string {
  const configured = values[SETTLE_PUBLIC_APP_ORIGIN_ENV]?.trim();
  if (!configured) throw new PublicAppOriginError();

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new PublicAppOriginError();
  }

  const localhost = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  const validProtocol = url.protocol === "https:" || (url.protocol === "http:" && localhost && options.allowInsecureLocalhost === true);
  if (
    !validProtocol ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== "" ||
    url.hostname.includes("*")
  ) {
    throw new PublicAppOriginError();
  }

  return url.origin;
}

export function loadPublicAppOrigin(values: PublicAppOriginEnvironment = process.env): string {
  return parsePublicAppOrigin(values, { allowInsecureLocalhost: process.env.NODE_ENV !== "production" });
}