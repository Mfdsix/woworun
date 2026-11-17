import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Walk Log",
    short_name: "Walk Log",
    description: "A calm dashboard for your Strava walks.",
    start_url: "/",
    display: "fullscreen",
    orientation: "any",
    background_color: "#0B0B0B",
    theme_color: "#0B0B0B",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
