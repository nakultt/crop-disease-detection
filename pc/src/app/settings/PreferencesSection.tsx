"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "../lib/auth-client";
import { useLanguage } from "../lib/i18n/LanguageContext";
import type { TranslationKey } from "../lib/i18n/types";
import type { Viewer } from "../lib/viewer";

type Preference = "autoSaveScans" | "savePhotos";

const ROWS: { key: Preference; title: TranslationKey; desc: TranslationKey }[] =
  [
    {
      key: "autoSaveScans",
      title: "settings.autoSave",
      desc: "settings.autoSaveDesc",
    },
    {
      key: "savePhotos",
      title: "settings.savePhotos",
      desc: "settings.savePhotosDesc",
    },
  ];

export default function PreferencesSection({ viewer }: { viewer: Viewer }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [values, setValues] = useState({
    autoSaveScans: viewer.autoSaveScans,
    savePhotos: viewer.savePhotos,
  });
  const [pending, setPending] = useState<Preference | null>(null);
  const [failed, setFailed] = useState(false);

  async function toggle(key: Preference, next: boolean) {
    setFailed(false);
    setPending(key);
    setValues((v) => ({ ...v, [key]: next }));
    const { error } = await authClient.updateUser({ [key]: next });
    setPending(null);
    if (error) {
      setValues((v) => ({ ...v, [key]: !next }));
      setFailed(true);
      return;
    }
    router.refresh();
  }

  return (
    <section
      id="preferences"
      className="card card-pad settings-section"
      aria-labelledby="preferences-heading"
    >
      <div>
        <h2 id="preferences-heading" className="section-title">
          {t("settings.scanPrefs")}
        </h2>
        <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
          {t("settings.scanPrefsDesc")}
        </p>
      </div>

      {ROWS.map((row) => (
        <div
          key={row.key}
          className="settings-row"
          style={{ alignItems: "center" }}
        >
          <div style={{ flex: "1 1 260px" }}>
            <div className="field-label" id={`${row.key}-label`}>
              {t(row.title)}
            </div>
            <p
              className="field-help"
              id={`${row.key}-desc`}
              style={{ marginTop: 2 }}
            >
              {t(row.desc)}
            </p>
          </div>
          <span className="switch">
            <input
              type="checkbox"
              role="switch"
              aria-checked={values[row.key]}
              aria-labelledby={`${row.key}-label`}
              aria-describedby={`${row.key}-desc`}
              checked={values[row.key]}
              disabled={pending !== null}
              onChange={(event) => void toggle(row.key, event.target.checked)}
            />
            <span aria-hidden="true" />
          </span>
        </div>
      ))}

      {failed && <p className="field-error">{t("authError.generic")}</p>}
    </section>
  );
}
