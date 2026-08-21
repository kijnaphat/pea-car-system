import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KPN SMART CAR",
    short_name: "KPN SMART CAR",
    description: "ระบบจัดการยานพาหนะ PEA",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#702082",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/pwa-icon-192.png?v=6",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon-512.png?v=6",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
