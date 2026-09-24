"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import ConfirmDialog, {
  type ConfirmDialogHandle,
} from "../components/ConfirmDialog";
import LocalTime from "../components/LocalTime";
import UserAvatar from "../components/UserAvatar";
import { authClient } from "../lib/auth-client";
import { useLanguage } from "../lib/i18n/LanguageContext";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string;
  banned: boolean;
  banReason: string | null;
  createdAt: string;
  scans: number;
}

type Pending = { kind: "ban" | "delete"; user: AdminUser } | null;

/**
 * The user table. Every action is a Better Auth admin endpoint, which checks
 * the caller's role on the server — the buttons are convenience, not the gate.
 */
export default function AdminUsers({
  users,
  currentUserId,
}: {
  users: AdminUser[];
  currentUserId: string;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const banDialog = useRef<ConfirmDialogHandle>(null);
  const deleteDialog = useRef<ConfirmDialogHandle>(null);

  async function run(
    userId: string,
    action: () => Promise<{ error: unknown }>,
  ): Promise<boolean> {
    setBusy(userId);
    setError(null);
    const { error: failure } = await action();
    setBusy(null);
    if (failure) {
      const message = (failure as { message?: string }).message;
      setError(message || t("authError.generic"));
      return false;
    }
    router.refresh();
    return true;
  }

  if (users.length === 0) {
    return (
      <div className="empty-state">
        <p className="muted">{t("admin.noUsers")}</p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <p
          role="alert"
          className="alert alert-error"
          style={{ marginBottom: 12 }}
        >
          {error}
        </p>
      )}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">{t("admin.user")}</th>
              <th scope="col">{t("history.status")}</th>
              <th scope="col" style={{ textAlign: "right" }}>
                {t("admin.scans")}
              </th>
              <th scope="col">{t("admin.joined")}</th>
              <th scope="col">
                <span className="sr-only">{t("admin.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const self = user.id === currentUserId;
              const isAdmin = user.role === "admin";
              return (
                <tr
                  key={user.id}
                  style={{ opacity: busy === user.id ? 0.55 : 1 }}
                >
                  <td>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        minWidth: 220,
                      }}
                    >
                      <UserAvatar
                        name={user.name}
                        email={user.email}
                        size={34}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div className="truncate" style={{ fontWeight: 600 }}>
                          {user.name || "—"}
                          {self && (
                            <span className="dim"> ({t("admin.you")})</span>
                          )}
                        </div>
                        <div className="truncate dim" style={{ fontSize: 13 }}>
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {isAdmin && (
                        <span className="badge badge-primary">
                          {t("admin.adminBadge")}
                        </span>
                      )}
                      {user.banned ? (
                        <span
                          className="badge badge-danger"
                          title={user.banReason ?? undefined}
                        >
                          {t("admin.banned")}
                        </span>
                      ) : (
                        <span
                          className={
                            user.emailVerified ? "badge badge-healthy" : "badge"
                          }
                        >
                          {user.emailVerified
                            ? t("settings.verified")
                            : t("settings.unverified")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="tnum" style={{ textAlign: "right" }}>
                    {user.scans}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <LocalTime iso={user.createdAt} />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {!self && (
                      <details className="row-menu">
                        <summary className="btn btn-ghost btn-sm">
                          {t("admin.actions")}
                        </summary>
                        <div className="row-menu-panel">
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() =>
                              run(user.id, () =>
                                authClient.admin.setRole({
                                  userId: user.id,
                                  role: isAdmin ? "user" : "admin",
                                }),
                              )
                            }
                          >
                            {isAdmin
                              ? t("admin.removeAdmin")
                              : t("admin.makeAdmin")}
                          </button>
                          {user.banned ? (
                            <button
                              type="button"
                              disabled={busy !== null}
                              onClick={() =>
                                run(user.id, () =>
                                  authClient.admin.unbanUser({
                                    userId: user.id,
                                  }),
                                )
                              }
                            >
                              {t("admin.unban")}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busy !== null}
                              onClick={() => {
                                setPending({ kind: "ban", user });
                                setReason("");
                                banDialog.current?.open();
                              }}
                            >
                              {t("admin.ban")}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() =>
                              run(user.id, () =>
                                authClient.admin.revokeUserSessions({
                                  userId: user.id,
                                }),
                              )
                            }
                          >
                            {t("admin.signOutUser")}
                          </button>
                          <button
                            type="button"
                            className="danger-text"
                            disabled={busy !== null}
                            onClick={() => {
                              setPending({ kind: "delete", user });
                              deleteDialog.current?.open();
                            }}
                          >
                            {t("admin.deleteUser")}
                          </button>
                        </div>
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        ref={banDialog}
        title={t("admin.banTitle", pending?.user.email ?? "")}
        description={t("admin.banDesc")}
        confirmLabel={t("admin.ban")}
        onConfirm={async () => {
          if (!pending) return true;
          return run(pending.user.id, () =>
            authClient.admin.banUser({
              userId: pending.user.id,
              banReason: reason.trim() || undefined,
            }),
          );
        }}
      >
        <div className="field">
          <label htmlFor="ban-reason" className="field-label">
            {t("admin.banReason")}
          </label>
          <input
            id="ban-reason"
            className="input"
            maxLength={200}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        ref={deleteDialog}
        title={t("admin.deleteTitle", pending?.user.email ?? "")}
        description={t("admin.deleteDesc")}
        confirmLabel={t("admin.deleteUser")}
        onConfirm={async () => {
          if (!pending) return true;
          return run(pending.user.id, () =>
            authClient.admin.removeUser({ userId: pending.user.id }),
          );
        }}
      />
    </>
  );
}
