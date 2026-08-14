import Link from "next/link";
import { redirect } from "next/navigation";
import { requireIdentity } from "../../lib/auth/identity.server";
import { listAccessibleMerchants } from "../../lib/auth/merchant-context";
import { createMerchantIdentityStore } from "../../lib/auth/merchant-store.server";
import { resolveMerchantEntry } from "../../lib/auth/routing";
import { signOutAction } from "./actions";

export default async function MerchantResolverPage() {
  const identity = await requireIdentity();
  const memberships = await listAccessibleMerchants(createMerchantIdentityStore(), identity.workosUserId);
  const entry = resolveMerchantEntry(memberships);
  if (entry.kind === "onboarding") redirect("/onboarding");
  if (entry.kind === "workspace") redirect(`/app/${entry.merchantId}`);
  return (
    <div className="content-container page-frame merchant-page">
      <header className="page-header"><p className="eyebrow">Merchant console</p><h1>Select a merchant</h1></header>
      <section className="merchant-panel">
        <ul className="merchant-list">
          {memberships.map((membership) => <li key={membership.merchantId}><Link href={`/app/${membership.merchantId}`}>{membership.merchantName}</Link><span>{membership.role} · test</span></li>)}
        </ul>
        <form action={signOutAction}><button className="secondary" type="submit">Sign out</button></form>
      </section>
    </div>
  );
}