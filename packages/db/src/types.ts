export interface TenantContext { readonly merchantId: string; readonly environmentId: string }
export interface RecipientInput { readonly recipientAddress: string; readonly shareBps: number }

export function validateRecipients(recipients: readonly RecipientInput[]): void {
  if (recipients.length < 1 || recipients.length > 8) throw new RangeError("Payment Intent requires 1 to 8 recipients");
  const normalized = recipients.map((recipient) => recipient.recipientAddress.toLowerCase());
  if (new Set(normalized).size !== normalized.length) throw new Error("Recipient addresses must be unique");
  if (recipients.some((recipient) => !Number.isInteger(recipient.shareBps) || recipient.shareBps < 1 || recipient.shareBps > 10_000)) throw new RangeError("Recipient shares must be integer basis points");
  if (recipients.reduce((total, recipient) => total + recipient.shareBps, 0) !== 10_000) throw new Error("Recipient shares must total 10000 basis points");
}