const REDACTED = "[REDACTED]" as const;
const SENSITIVE_KEY_PATTERN = /^(?:authorization|proxy-authorization|circle_api_key|circle_entity_secret|deployer_private_key|entitysecret|entity_secret|entitysecretciphertext|entity_secret_ciphertext)$/i;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const NAMED_SECRET_PATTERN = /\b(CIRCLE_API_KEY|CIRCLE_ENTITY_SECRET|DEPLOYER_PRIVATE_KEY|entitySecretCiphertext|entity_secret_ciphertext)\b(\s*[:=]\s*)([^\s,;}"]+|"[^"]*")/gi;
const AUTHORIZATION_PATTERN = /\b(Authorization)(\s*[:=]\s*)(Bearer\s+)?([^\s,;}"]+|"[^"]*")/gi;

export function redactString(value: string): string {
  return value
    .replace(BEARER_PATTERN, `Bearer ${REDACTED}`)
    .replace(NAMED_SECRET_PATTERN, (_match, name: string, separator: string) => `${name}${separator}${REDACTED}`)
    .replace(AUTHORIZATION_PATTERN, (_match, name: string, separator: string) => `${name}${separator}${REDACTED}`);
}

export function redactSecrets(value: unknown): unknown {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value === null || typeof value !== "object") return value;

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    output[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redactSecrets(child);
  }
  return output;
}

export { REDACTED };