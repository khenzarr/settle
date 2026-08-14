import { redirect } from "next/navigation";
import { requireIdentity } from "../../lib/auth/identity.server";
import { listAccessibleMerchants } from "../../lib/auth/merchant-context";
import { createMerchantIdentityStore } from "../../lib/auth/merchant-store.server";
import { createMerchantAction } from "./actions";

export default async function OnboardingPage() {
  const identity = await requireIdentity();
  const memberships = await listAccessibleMerchants(createMerchantIdentityStore(), identity.workosUserId);
  if (memberships[0]) redirect(`/app/${memberships[0].merchantId}`);
  return (
    <div className="content-container page-frame merchant-page">
      <header className="page-header">
        <p className="eyebrow">Merchant onboarding</p>
        <h1>Create your test merchant</h1>
        <p className="lede">Set up the local merchant workspace associated with your signed-in identity.</p>
      </header>
      <section className="merchant-panel">
        <form action={createMerchantAction}>
          <label htmlFor="merchantName">Merchant name</label>
          <input id="merchantName" name="merchantName" required maxLength={160} autoComplete="organization" />
          <button type="submit">Create merchant</button>
        </form>
      </section>
    </div>
  );
}