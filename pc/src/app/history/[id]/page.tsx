import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerManifest } from "@/server/model-manifest";
import { getScan } from "@/server/scans";
import { requireSession, toViewer } from "@/server/session";
import { getTranslator } from "../../lib/i18n/server";
import { classLabel } from "../../lib/labels";
import ScanDetailClient from "./ScanDetailClient";

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const session = await requireSession(`/history/${id}`);
  const scan = await getScan(session.user.id, id);
  const t = await getTranslator();
  return { title: scan ? classLabel(scan.className, t) : t("history.title") };
}

export default async function ScanDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const viewer = toViewer(await requireSession(`/history/${id}`));
  const [scan, manifest] = await Promise.all([
    getScan(viewer.id, id),
    getServerManifest(),
  ]);
  if (!scan) notFound();

  return <ScanDetailClient scan={scan} exact={manifest?.cam.exact ?? true} />;
}
