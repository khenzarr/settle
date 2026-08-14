import { notFound } from "next/navigation";
import { requireIdentity } from "../../../lib/auth/identity.server";
import { MerchantAccessDeniedError, requireMerchantMembership } from "../../../lib/auth/merchant-context";
import { createMerchantIdentityStore } from "../../../lib/auth/merchant-store.server";
import { signOutAction } from "../actions";

export default async function MerchantWorkspacePage({ params }: { params: Promise<{ merchantId: string }> }) {
  const identity = await requireIdentity();
  const { merchantId } = await params;
  let context;
  try {
    context = await requireMerchantMembership(createMerchantIdentityStore(), identity.workosUserId, merchantId);
  } catch (error) {
    if (error instanceof MerchantAccessDeniedError) notFound();
    throw error;
  }
  return (
    <div className="content-container page-frame merchant-page">
      <header className="page-header"><p className="eyebrow">Merchant console</p><h1>{context.merchantName}</h1><p className="lede">Protected merchant workspace</p></header>
      <section className="merchant-panel">
        <div className="merchant-summary">
          <div><span>Role</span><strong>{context.role}</strong></div>
          <div><span>Merchant</span><strong>{context.merchantStatus}</strong></div>
          <div><span>Environment</span><strong>Test · active</strong></div>
        </div>
        <p className="merchant-notice">Payment Intent management arrives in the next product phases.</p>
        <form action={signOutAction}><button className="secondary" type="submit">Sign out</button></form>
      </section>
    </div>
  );
}