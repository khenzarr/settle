# M1.B1 Merchant identity and secure sessions

## Scope and authority boundaries

M1.B1 uses WorkOS AuthKit in the Settle staging application for human
authentication and secure browser sessions. WorkOS is the identity/session
authority only. Settle PostgreSQL remains authoritative for merchants,
merchant membership, roles, membership status, merchant status, environments,
settings, and operational authorization. WorkOS Organizations are deliberately
deferred; they are not the Settle tenant model.

The stable WorkOS `user.id` is stored in the existing membership identity
columns (`provider = workos`, `subject = user.id`). Email and display metadata
are never authorization keys. Access tokens, refresh tokens, cookies, API keys,
authorization codes, and cookie passwords are never persisted or exposed.

## Session and route architecture

The web app uses `@workos-inc/authkit-nextjs` and `@workos-inc/node` with the
existing Next.js 16 App Router. `apps/web/proxy.ts` uses the official AuthKit
proxy helper and matches only `/app/:path*`, `/onboarding/:path*`, `/sign-in`,
and `/auth/callback`. Static assets, public pages, public API routes, and the
buyer checkout are not intercepted.

Authentication routes are:

- `GET /sign-in`: obtains the hosted AuthKit URL with `getSignInUrl()` and
  redirects there; Settle never collects a password.
- `GET /auth/callback`: delegates to `handleAuth({ returnPathname: "/app" })`.
- Sign out: the protected app server action delegates to WorkOS `signOut()`;
  it does not merely clear local UI state.

Server-only AuthKit/database helpers live behind `server-only` imports. The
pure WorkOS user-ID extractor is kept separate so offline unit tests do not
load Next server internals. No global AuthKit provider is used.

## Local authorization and merchant entry

`requireIdentity()` obtains the signed-in WorkOS user and fails closed if no
stable ID exists. Local membership queries require the WorkOS provider and
subject, active membership, active merchant, and active test environment.
`/app/[merchantId]` re-checks this relationship on every request; a URL
merchant ID is only an identifier. Unauthorized, inactive, and unknown
merchants resolve as not-found without revealing tenant existence.

`/app` resolves active local memberships as follows:

- zero memberships: redirect to `/onboarding`;
- one membership: redirect to its explicit `/app/[merchantId]` workspace;
- multiple memberships: render a minimal explicit selector.

## First merchant onboarding

Onboarding is available only to an authenticated WorkOS identity and accepts
only a trimmed display name. Server validation requires a non-empty value of
at most 160 characters and rejects control characters. The client cannot
provide a role, status, merchant ID, provider, or external subject.

The onboarding server action uses the existing `@settle/db` transaction
primitive. One transaction creates an active merchant, an active `owner`
membership for the authenticated WorkOS subject, an active `test` environment,
the required merchant settings row, and a safe `merchant.onboarded` audit
event. No live environment is created. A PostgreSQL transaction advisory lock
keyed by the WorkOS subject serializes concurrent first-onboarding requests;
the second request returns the existing merchant rather than creating a
second owner merchant. Any failed write rolls back the complete set.

## Development and testing

Runtime uses the existing pooled `DATABASE_URL` through `@settle/db`.
`DATABASE_MIGRATION_URL` is not used by web runtime. Integration tests load
the local environment and use synthetic identities only; they must target the
Neon `development` branch, never production. No WorkOS management mutations,
fake user creation, blockchain writes, or Circle mutations are used by the
automated tests.

Focused tests cover configuration classification/redaction, identity
extraction, provider/subject mapping, membership routing and isolation,
input validation, atomic creation, rollback, concurrent onboarding, and
server-selected owner/test state. Existing public `/`, `/demo`, `/docs`, and
`/pay/[orderId]` behavior remains unauthenticated; buyer checkout does not
require merchant login.

## Manual staging E2E checkpoint

1. Start the app with `pnpm --filter @settle/web dev`.
2. Visit `http://localhost:3000/app` while signed out.
3. Confirm redirect to hosted WorkOS AuthKit and authenticate manually.
4. Confirm callback returns to `/app`, then `/onboarding` for a new local user.
5. Submit a merchant display name and confirm the test merchant workspace.
6. Confirm the workspace shows the merchant, `owner` role, active merchant,
   and active test environment.
7. Confirm changing the URL to an unauthorized merchant returns not-found.
8. Use Sign out and confirm revisiting `/app` requires authentication.

This browser checkpoint must be confirmed by a human; automated tests do not
claim that staging login passed.

## Deferred work and production considerations

WorkOS Organizations remain a future product decision. The M1.B2 merchant
API-key persistence and service core is now implemented separately; its public
management UI and Payment Intent route integration remain later work. Payment
Intent APIs, webhooks, reconciliation, and the full dashboard are outside
M1.B1. Before production migration, verify the
production database target separately, review session/cookie configuration,
rotate credentials through approved operational procedures, and perform a
human production-readiness security review. No production database mutation is
part of this phase.
