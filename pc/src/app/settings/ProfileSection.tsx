"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Alert from "../components/Alert";
import UserAvatar from "../components/UserAvatar";
import { authClient, authErrorKey } from "../lib/auth-client";
import { useLanguage } from "../lib/i18n/LanguageContext";
import type { TranslationKey } from "../lib/i18n/types";
import type { Viewer } from "../lib/viewer";

export default function ProfileSection({ viewer }: { viewer: Viewer }) {
  const { t } = useLanguage();
  const router = useRouter();

  const [name, setName] = useState(viewer.name);
  const [nameStatus, setNameStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPending, setEmailPending] = useState(false);
  const [emailResult, setEmailResult] = useState<{
    tone: "success" | "error";
    key: TranslationKey;
  } | null>(null);

  async function saveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNameStatus("saving");
    const { error } = await authClient.updateUser({ name: name.trim() });
    if (error) {
      setNameStatus("error");
      return;
    }
    setNameStatus("saved");
    router.refresh();
  }

  async function changeEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailPending(true);
    setEmailResult(null);
    const { error } = await authClient.changeEmail({
      newEmail: newEmail.trim(),
      callbackURL: "/settings?emailChanged=1",
    });
    setEmailPending(false);
    if (error) {
      setEmailResult({ tone: "error", key: authErrorKey(error) });
      return;
    }
    setEmailResult({ tone: "success", key: "settings.emailChangeSent" });
    setEditingEmail(false);
    setNewEmail("");
  }

  return (
    <section
      className="card card-pad settings-section"
      aria-labelledby="profile-heading"
    >
      <div className="settings-section-head">
        <UserAvatar name={viewer.name} email={viewer.email} size={52} />
        <div>
          <h2 id="profile-heading" className="section-title">
            {t("settings.profile")}
          </h2>
          <p className="muted" style={{ fontSize: 14 }}>
            {t("settings.profileDesc")}
          </p>
        </div>
      </div>

      <form onSubmit={saveName} className="settings-row">
        <div className="field" style={{ flex: "1 1 260px" }}>
          <label htmlFor="profile-name" className="field-label">
            {t("auth.name")}
          </label>
          <input
            id="profile-name"
            className="input"
            autoComplete="name"
            required
            maxLength={100}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setNameStatus("idle");
            }}
          />
        </div>
        <div className="settings-row-actions">
          <button
            type="submit"
            className="btn btn-secondary btn-sm"
            disabled={
              nameStatus === "saving" ||
              !name.trim() ||
              name.trim() === viewer.name
            }
          >
            {t("settings.save")}
          </button>
          {nameStatus === "saved" && (
            <span className="ok-text">{t("detail.saved")}</span>
          )}
          {nameStatus === "error" && (
            <span className="field-error">{t("authError.generic")}</span>
          )}
        </div>
      </form>

      <div className="settings-row" style={{ alignItems: "center" }}>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <div className="field-label">{t("auth.email")}</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 4,
            }}
          >
            <span className="truncate">{viewer.email}</span>
            <span
              className={viewer.emailVerified ? "badge badge-healthy" : "badge"}
            >
              {viewer.emailVerified
                ? t("settings.verified")
                : t("settings.unverified")}
            </span>
          </div>
        </div>
        {!editingEmail && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setEditingEmail(true)}
          >
            {t("settings.changeEmail")}
          </button>
        )}
      </div>

      {editingEmail && (
        <form onSubmit={changeEmail} className="settings-row">
          <div className="field" style={{ flex: "1 1 260px" }}>
            <label htmlFor="new-email" className="field-label">
              {t("settings.newEmail")}
            </label>
            <input
              id="new-email"
              type="email"
              className="input"
              autoComplete="email"
              required
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
            />
            <span className="field-help">{t("settings.changeEmailHelp")}</span>
          </div>
          <div className="settings-row-actions">
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={emailPending || !newEmail.trim()}
            >
              {t("settings.sendConfirmation")}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setEditingEmail(false)}
            >
              {t("detail.cancel")}
            </button>
          </div>
        </form>
      )}

      {emailResult && (
        <Alert tone={emailResult.tone}>
          {t(emailResult.key, viewer.email)}
        </Alert>
      )}
    </section>
  );
}
