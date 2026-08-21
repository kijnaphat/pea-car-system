import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PEA Smart Car",
    short_name: "PEA Smart Car",
    description: "ระบบจัดการยานพาหนะ PEA",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8f3fa",
    theme_color: "#702082",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
