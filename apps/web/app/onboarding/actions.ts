"use server";

import { redirect } from "next/navigation";
import { requireIdentity } from "../../lib/auth/identity.server";
import { createFirstMerchant } from "../../lib/auth/onboarding.server";
import { validateMerchantName } from "../../lib/auth/onboarding";

export async function createMerchantAction(formData: FormData) {
  const identity = await requireIdentity();
  const merchantName = validateMerchantName(formData.get("merchantName"));
  const result = await createFirstMerchant(identity.workosUserId, merchantName);
  redirect(`/app/${result.merchantId}`);
}