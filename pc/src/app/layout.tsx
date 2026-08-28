import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { THEME_BOOT_SCRIPT } from "./components/ThemeToggle";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-stack",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PlantGuard — plant disease detection in your browser",
  description:
    "Identify plant diseases, estimate infection severity, and see exactly where the model looked. Runs entirely on your device; photographs are never uploaded.",
  keywords: [
    "plant disease detection",
    "crop disease",
    "severity estimation",
    "class activation map",
    "explainable AI",
    "on-device inference",
    "agriculture",
  ],
  openGraph: {
    title: "PlantGuard — plant disease detection in your browser",
    description:
      "Identify plant diseases and see exactly where the model looked. Runs entirely on-device.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f0d" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/* Applies the stored theme before first paint, so there is no flash of
            the wrong palette on load. */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: build-time constant with no user input, and it must execute before hydration to avoid a flash of the wrong theme.
          dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
