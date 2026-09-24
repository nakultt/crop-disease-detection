import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Noto_Sans } from "next/font/google";
import { headers } from "next/headers";
import { getViewerSafe } from "@/server/session";
import AppShell from "./components/AppShell";
import { LanguageProvider } from "./lib/i18n/LanguageContext";
import { getDictionary, getLanguage } from "./lib/i18n/server";
import { siteUrl } from "./lib/site";
import { THEME_BOOT_SCRIPT } from "./lib/theme";
import "./globals.css";

const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-stack",
  subsets: ["latin"],
  display: "swap",
});

const description =
  "Identify 38 crop diseases across 14 crops from a leaf photo, estimate severity, and see exactly which parts of the leaf drove the diagnosis. Analysis runs on your device.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "PlantGuard — crop disease detection that shows its work",
    template: "%s · PlantGuard",
  },
  description,
  applicationName: "PlantGuard",
  keywords: [
    "plant disease detection",
    "crop disease",
    "leaf disease",
    "severity estimation",
    "explainable AI",
    "agriculture",
    "farmers",
  ],
  openGraph: {
    type: "website",
    siteName: "PlantGuard",
    title: "PlantGuard — crop disease detection that shows its work",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "PlantGuard",
    description,
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfdf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0d120f" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [language, dictionary, requestHeaders, viewer] = await Promise.all([
    getLanguage(),
    getDictionary(),
    headers(),
    getViewerSafe(),
  ]);
  const nonce = requestHeaders.get("x-nonce") ?? undefined;

  return (
    <html
      lang={language}
      className={`${notoSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the stored theme before first paint, so there is no flash of
            the wrong palette on load. */}
        <script
          nonce={nonce}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: build-time constant with no user input, and it must execute before hydration to avoid a flash of the wrong theme.
          dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
        />
      </head>
      <body>
        <LanguageProvider
          initialLanguage={language}
          initialDictionary={dictionary}
        >
          <AppShell viewer={viewer}>{children}</AppShell>
        </LanguageProvider>
      </body>
    </html>
  );
}
