export const ROOT = new URL("../../", import.meta.url);
export const ARTIFACTS = new URL("../../artifacts/grant-demo/", import.meta.url);
export const VIEWPORT = { width: 1920, height: 1080 };
export const ORDER_ID = "0xf3b093dc8b2eb3fa595f8d30cf18871fb03eb408e4be5168586c50c788dbcfed";
export const RELEASE_TX = "0x168edb8bdcf44c1df583648d96d684764a923907ae4f1d7c90516864179463ef";
export const CONTRACT = "0x3e438ae878a8dc02c83f5545047cbde33a4f795f";
export const PROD = "https://settle-web-coral.vercel.app";
export const urls = {
  home: PROD,
  demo: `${PROD}/demo`,
  docs: `${PROD}/docs`,
  checkout: `${PROD}/pay/${ORDER_ID}`,
  release: `https://testnet.arcscan.app/tx/${RELEASE_TX}`,
  contract: `https://testnet.arcscan.app/address/${CONTRACT}`,
};
export const planRequest = {
  externalOrderId: "marketplace-demo-001",
  buyer: "0x1111111111111111111111111111111111111111",
  amountUsdc: "0.05",
  fundingDeadline: "2000000000",
  settlementDeadline: "2000003600",
  settlement: [
    { recipient: "0x2222222222222222222222222222222222222222", shareBps: 9000 },
    { recipient: "0x3333333333333333333333333333333333333333", shareBps: 1000 },
  ],
};
