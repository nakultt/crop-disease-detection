"use client";

import Link from "next/link";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { conditionLabel, cropLabel } from "../lib/labels";
import type { ScanSummary } from "../lib/scan-contract";
import { severityColor, severityLabel } from "../lib/severity";
import { ImageIcon } from "./icons";
import LocalTime from "./LocalTime";

/** One saved scan in a grid: thumbnail, diagnosis, confidence, severity, date. */
export default function ScanCard({ scan }: { scan: ScanSummary }) {
  const { t } = useLanguage();

  return (
    <Link href={`/history/${scan.id}`} className="scan-card">
      <div className="scan-card-thumb">
        {scan.hasImage ? (
          // biome-ignore lint/performance/noImgElement: private, per-user images served by an authenticated route; next/image would proxy them through the public optimiser.
          <img
            src={`/api/scans/${scan.id}/image?variant=thumb`}
            alt=""
            loading="lazy"
            decoding="async"
            width={320}
            height={320}
          />
        ) : (
          <span className="scan-card-placeholder" aria-hidden="true">
            <ImageIcon size={28} />
          </span>
        )}
        <span className="scan-card-confidence tnum">
          {(scan.confidence * 100).toFixed(0)}%
        </span>
      </div>

      <div className="scan-card-body">
        <div className="scan-card-crop truncate">
          {cropLabel(scan.className, t)}
        </div>
        <div className="scan-card-title">
          {conditionLabel(scan.className, t)}
        </div>
        {scan.label && (
          <div className="truncate dim" style={{ fontSize: 13, marginTop: 2 }}>
            {scan.label}
          </div>
        )}

        <div className="scan-card-meta">
          {scan.healthy ? (
            <span className="badge badge-healthy">{t("history.healthy")}</span>
          ) : scan.severity ? (
            <span className="badge">
              <span
                className="dot"
                aria-hidden="true"
                style={{ color: severityColor(scan.severity.level) }}
              />
              {severityLabel(scan.severity.level, t)}
            </span>
          ) : (
            <span />
          )}
          <span className="scan-card-date">
            <LocalTime iso={scan.createdAt} />
          </span>
        </div>
      </div>
    </Link>
  );
}
