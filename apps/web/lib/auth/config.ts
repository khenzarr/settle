export interface WorkOSConfigEnvironment {
  readonly WORKOS_CLIENT_ID?: string;
  readonly WORKOS_API_KEY?: string;
  readonly WORKOS_COOKIE_PASSWORD?: string;
  readonly NEXT_PUBLIC_WORKOS_REDIRECT_URI?: string;
}

export interface WorkOSConfig {
  readonly clientId: string;
  readonly apiKey: string;
  readonly cookiePassword: string;
  readonly redirectUri: string;
}

export interface WorkOSConfigSummary {
  readonly WORKOS_CLIENT_ID: "present";
  readonly WORKOS_API_KEY: "present";
  readonly WORKOS_COOKIE_PASSWORD: "present / sufficient-length";
  readonly NEXT_PUBLIC_WORKOS_REDIRECT_URI: "present / localhost callback" | "present / valid callback";
}

function requireValue(name: keyof WorkOSConfigEnvironment, value: string | undefined): string {
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value;
}

export function parseWorkOSConfig(values: WorkOSConfigEnvironment): WorkOSConfig {
  const clientId = requireValue("WORKOS_CLIENT_ID", values.WORKOS_CLIENT_ID);
  const apiKey = requireValue("WORKOS_API_KEY", values.WORKOS_API_KEY);
  const cookiePassword = requireValue("WORKOS_COOKIE_PASSWORD", values.WORKOS_COOKIE_PASSWORD);
  const redirectUri = requireValue("NEXT_PUBLIC_WORKOS_REDIRECT_URI", values.NEXT_PUBLIC_WORKOS_REDIRECT_URI);
  if (cookiePassword.length < 32) throw new Error("WORKOS_COOKIE_PASSWORD must be at least 32 characters");

  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    throw new Error("NEXT_PUBLIC_WORKOS_REDIRECT_URI must be a valid URL");
  }
  if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== "/auth/callback") {
    throw new Error("NEXT_PUBLIC_WORKOS_REDIRECT_URI must be an HTTP(S) /auth/callback URL");
  }
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    throw new Error("NEXT_PUBLIC_WORKOS_REDIRECT_URI must use HTTPS outside localhost");
  }
  return { clientId, apiKey, cookiePassword, redirectUri };
}

export function summarizeWorkOSConfig(values: WorkOSConfigEnvironment): WorkOSConfigSummary {
  const config = parseWorkOSConfig(values);
  const hostname = new URL(config.redirectUri).hostname;
  return {
    WORKOS_CLIENT_ID: "present",
    WORKOS_API_KEY: "present",
    WORKOS_COOKIE_PASSWORD: "present / sufficient-length",
    NEXT_PUBLIC_WORKOS_REDIRECT_URI: hostname === "localhost" || hostname === "127.0.0.1" ? "present / localhost callback" : "present / valid callback",
  };
}