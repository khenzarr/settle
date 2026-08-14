export interface AuthenticatedIdentity {
  readonly workosUserId: string;
}

export function extractAuthenticatedIdentity(user: { readonly id?: unknown } | null): AuthenticatedIdentity {
  if (!user || typeof user.id !== "string" || !user.id) throw new Error("Authenticated WorkOS session has no user ID");
  return { workosUserId: user.id };
}