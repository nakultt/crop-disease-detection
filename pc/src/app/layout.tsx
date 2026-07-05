import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PlantGuard AI — Disease Detection & Severity Analysis",
  description:
    "Explainable multi-task plant disease detection and severity estimation powered by MobileNetV5. Upload a leaf image to identify diseases, assess severity, and visualize AI explanations with Grad-CAM.",
  keywords: [
    "plant disease detection",
    "crop disease",
    "severity estimation",
    "Grad-CAM",
    "MobileNetV5",
    "explainable AI",
    "agriculture AI",
  ],
  openGraph: {
    title: "PlantGuard AI — Disease Detection & Severity Analysis",
    description:
      "AI-powered plant disease detection with severity estimation and visual explanations.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {children}
      </body>
    </html>
  );
}
