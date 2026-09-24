"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import PasswordInput from "../components/auth/PasswordInput";
import ConfirmDialog, {
  type ConfirmDialogHandle,
} from "../components/ConfirmDialog";
import { DownloadIcon, ShieldIcon, TrashIcon } from "../components/icons";
import { authClient, authErrorKey } from "../lib/auth-client";
import { useLanguage } from "../lib/i18n/LanguageContext";
import type { TranslationKey } from "../lib/i18n/types";

export default function DataSection({ hasPassword }: { hasPassword: boolean }) {
  const { t } = useLanguage();
  const router = useRouter();
  const clearDialog = useRef<ConfirmDialogHandle>(null);
  const deleteDialog = useRef<ConfirmDialogHandle>(null);

  const [clearError, setClearError] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState<TranslationKey | null>(null);

  return (
    <>
      <section
        className="card card-pad settings-section"
        aria-labelledby="data-heading"
      >
        <div>
          <h2 id="data-heading" className="section-title">
            {t("settings.privacy")}
          </h2>
        </div>

        <div className="privacy-note">
          <ShieldIcon size={20} />
          <p>{t("settings.privacyDesc")}</p>
        </div>

        <div className="settings-row" style={{ alignItems: "center" }}>
          <div style={{ flex: "1 1 260px" }}>
            <div className="field-label">{t("settings.exportTitle")}</div>
            <p className="field-help" style={{ marginTop: 2 }}>
              {t("settings.exportDesc")}
            </p>
          </div>
          <a
            href="/api/account/export"
            className="btn btn-secondary btn-sm"
            download
          >
            <DownloadIcon size={16} />
            {t("settings.exportButton")}
          </a>
        </div>

        <div className="settings-row" style={{ alignItems: "center" }}>
          <div style={{ flex: "1 1 260px" }}>
            <div className="field-label">{t("settings.clearTitle")}</div>
            <p className="field-help" style={{ marginTop: 2 }}>
              {cleared ? t("settings.clearDone") : t("settings.clearDesc")}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm danger-text"
            onClick={() => clearDialog.current?.open()}
          >
            <TrashIcon size={16} />
            {t("settings.clearButton")}
          </button>
        </div>
      </section>

      <section
        className="card card-pad settings-section danger-zone"
        aria-labelledby="danger-heading"
      >
        <div>
          <h2
            id="danger-heading"
            className="section-title"
            style={{ color: "var(--critical)" }}
          >
            {t("settings.dangerZone")}
          </h2>
        </div>
        <div className="settings-row" style={{ alignItems: "center" }}>
          <div style={{ flex: "1 1 260px" }}>
            <div className="field-label">{t("settings.deleteAccount")}</div>
            <p className="field-help" style={{ marginTop: 2 }}>
              {t("settings.deleteAccountDesc")}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => deleteDialog.current?.open()}
          >
            {t("settings.deleteAccount")}
          </button>
        </div>
      </section>

      <ConfirmDialog
        ref={clearDialog}
        title={t("settings.clearConfirmTitle")}
        description={t("settings.clearConfirmDesc")}
        confirmLabel={t("settings.clearButton")}
        pendingLabel={t("detail.deleting")}
        errorMessage={clearError}
        onConfirm={async () => {
          setClearError(null);
          const response = await fetch("/api/account/scans", {
            method: "DELETE",
          }).catch(() => null);
          if (!response?.ok) {
            setClearError(t("authError.generic"));
            return false;
          }
          setCleared(true);
          router.refresh();
          return true;
        }}
      />

      <ConfirmDialog
        ref={deleteDialog}
        title={t("settings.deleteConfirmTitle")}
        description={t("settings.deleteConfirmDesc")}
        confirmLabel={t("settings.deleteAccount")}
        pendingLabel={t("detail.deleting")}
        errorMessage={deleteError ? t(deleteError) : null}
        confirmDisabled={hasPassword && password.length === 0}
        onConfirm={async () => {
          setDeleteError(null);
          const { error } = await authClient.deleteUser(
            hasPassword ? { password } : {},
          );
          if (error) {
            setDeleteError(authErrorKey(error));
            return false;
          }
          window.location.assign("/sign-in?deleted=1");
          return true;
        }}
      >
        {hasPassword && (
          <div className="field">
            <label htmlFor="delete-password" className="field-label">
              {t("settings.confirmWithPassword")}
            </label>
            <PasswordInput
              id="delete-password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}
