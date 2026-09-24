"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useLanguage } from "../lib/i18n/LanguageContext";
import Alert from "./Alert";
import { AlertIcon } from "./icons";

export interface ConfirmDialogHandle {
  open: () => void;
  close: () => void;
}

/**
 * A modal confirmation built on the native <dialog>: focus is trapped,
 * Escape closes it, and the page behind is inert — without a library.
 */
const ConfirmDialog = forwardRef<
  ConfirmDialogHandle,
  {
    title: string;
    description: string;
    confirmLabel: string;
    pendingLabel?: string;
    errorMessage?: string | null;
    /** Extra content, e.g. a password field. */
    children?: React.ReactNode;
    /** Return true to close the dialog; false keeps it open. */
    onConfirm: () => Promise<boolean>;
    confirmDisabled?: boolean;
  }
>(function ConfirmDialog(
  {
    title,
    description,
    confirmLabel,
    pendingLabel,
    errorMessage,
    children,
    onConfirm,
    confirmDisabled,
  },
  ref,
) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);

  useImperativeHandle(ref, () => ({
    open: () => dialog.current?.showModal(),
    close: () => dialog.current?.close(),
  }));

  return (
    <dialog ref={dialog} className="dialog" aria-label={title}>
      <form
        className="dialog-body"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          const done = await onConfirm().catch(() => false);
          setPending(false);
          if (done) dialog.current?.close();
        }}
      >
        <span
          className="empty-state-icon"
          style={{
            background: "var(--critical-soft)",
            color: "var(--critical)",
            margin: 0,
          }}
          aria-hidden="true"
        >
          <AlertIcon size={26} />
        </span>
        <h2 style={{ fontSize: 19, fontWeight: 700 }}>{title}</h2>
        <p className="muted">{description}</p>
        {children}
        {errorMessage && <Alert tone="error">{errorMessage}</Alert>}
        <div className="dialog-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => dialog.current?.close()}
            disabled={pending}
          >
            {t("detail.cancel")}
          </button>
          <button
            type="submit"
            className="btn btn-danger btn-sm"
            disabled={pending || confirmDisabled}
          >
            {pending && (
              <span
                className="spinner"
                aria-hidden="true"
                style={{ width: 16, height: 16 }}
              />
            )}
            {pending && pendingLabel ? pendingLabel : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
});

export default ConfirmDialog;
