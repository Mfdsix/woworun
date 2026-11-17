import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Pwa } from "./pwa";
import "./globals.css";

export const metadata: Metadata = {
  title: "Walk Log",
  description: "A simple walking dashboard with manual paste and optional Strava sync.",
  applicationName: "Walk Log",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Walk Log",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0B0B0B",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Pwa />
      </body>
    </html>
  );
}
