import type { MetadataRoute } from "next";

/** Installable on phones: "Add to home screen" opens straight into the scanner. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PlantGuard — crop disease detection",
    short_name: "PlantGuard",
    description:
      "Photograph a leaf to identify crop diseases, estimate severity and get treatment advice.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fdfdf9",
    theme_color: "#1b4d3e",
    categories: ["productivity", "utilities", "education"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [{ name: "Scan a leaf", url: "/scan" }],
  };
}
