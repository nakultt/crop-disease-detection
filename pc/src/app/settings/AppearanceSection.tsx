"use client";

import LanguageSelector from "../components/LanguageSelector";
import { ThemeSelect } from "../components/ThemeToggle";
import { useLanguage } from "../lib/i18n/LanguageContext";

export default function AppearanceSection() {
  const { t } = useLanguage();

  return (
    <section
      className="card card-pad settings-section"
      aria-labelledby="appearance-heading"
    >
      <h2 id="appearance-heading" className="section-title">
        {t("settings.appearance")}
      </h2>

      <div className="settings-row" style={{ alignItems: "center" }}>
        <div style={{ flex: "1 1 240px" }}>
          <div className="field-label">{t("settings.theme")}</div>
          <p className="field-help" style={{ marginTop: 2 }}>
            {t("settings.themeDesc")}
          </p>
        </div>
        <ThemeSelect />
      </div>

      <div className="settings-row" style={{ alignItems: "center" }}>
        <div style={{ flex: "1 1 240px" }}>
          <div className="field-label">{t("settings.displayLanguage")}</div>
          <p className="field-help" style={{ marginTop: 2 }}>
            {t("settings.displayLanguageDesc")}
          </p>
        </div>
        <div style={{ flex: "0 1 280px", width: "100%" }}>
          <LanguageSelector />
        </div>
      </div>
    </section>
  );
}
