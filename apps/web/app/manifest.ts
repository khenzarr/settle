import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Settle",
    short_name: "Settle",
    description: "Programmable USDC settlement infrastructure for marketplaces and commerce.",
    start_url: "/",
    display: "standalone",
    background_color: "#24231F",
    theme_color: "#24231F",
    icons: [
      { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}