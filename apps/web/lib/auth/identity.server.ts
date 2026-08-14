import "server-only";

import { withAuth } from "@workos-inc/authkit-nextjs";
import { extractAuthenticatedIdentity, type AuthenticatedIdentity } from "./identity.ts";

export type { AuthenticatedIdentity } from "./identity.ts";
export { extractAuthenticatedIdentity } from "./identity.ts";

export async function requireIdentity(): Promise<AuthenticatedIdentity> {
  const { user } = await withAuth({ ensureSignedIn: true });
  return extractAuthenticatedIdentity(user);
}