export const MERCHANT_NAME_MAX_LENGTH = 160;

export function validateMerchantName(value: unknown): string {
  if (typeof value !== "string") throw new Error("Merchant name is required");
  const name = value.trim();
  if (!name) throw new Error("Merchant name is required");
  if (name.length > MERCHANT_NAME_MAX_LENGTH) throw new Error(`Merchant name must be ${MERCHANT_NAME_MAX_LENGTH} characters or fewer`);
  if (/\p{Cc}/u.test(name)) throw new Error("Merchant name cannot contain control characters");
  return name;
}