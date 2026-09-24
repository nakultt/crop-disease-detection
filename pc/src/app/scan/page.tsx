import type { Metadata } from "next";
import { requireSession, toViewer } from "@/server/session";
import { getTranslator } from "../lib/i18n/server";
import ScanClient from "./ScanClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("scan.title") };
}

export default async function ScanPage() {
  const viewer = toViewer(await requireSession("/scan"));
  return (
    <ScanClient
      preferences={{
        autoSave: viewer.autoSaveScans,
        savePhotos: viewer.savePhotos,
      }}
    />
  );
}
