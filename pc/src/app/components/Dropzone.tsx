"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../lib/i18n/LanguageContext";
import type { TranslationKey } from "../lib/i18n/types";
import { CameraIcon, ClipboardIcon, UploadIcon } from "./icons";

interface DropzoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  compact?: boolean;
  /** What happens to the photo, stated under the drop area. */
  privacyNote?: TranslationKey;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 20 * 1024 * 1024;

function usable(file: File): boolean {
  return ACCEPTED.includes(file.type) && file.size <= MAX_BYTES;
}

/**
 * Image intake: drag-and-drop, file picker, camera capture, and clipboard
 * paste. Paste matters more than it looks — screenshotting a leaf photo and
 * pressing Ctrl+V is the fastest path from "I have an image" to a diagnosis.
 */
export default function Dropzone({
  onFiles,
  disabled,
  compact,
  privacyNote = "dropzone.privacy",
}: DropzoneProps) {
  const { t } = useLanguage();
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const accept = useCallback(
    (list: FileList | File[] | null) => {
      if (!list) return;
      const all = Array.from(list);
      const good = all.filter(usable);

      if (good.length === 0 && all.length > 0) {
        const tooBig = all.some((f) => f.size > MAX_BYTES);
        setRejected(t(tooBig ? "dropzone.tooBig" : "dropzone.unsupported"));
        return;
      }

      setRejected(
        good.length < all.length
          ? t("dropzone.skipped", all.length - good.length)
          : null,
      );
      if (good.length > 0) onFiles(good);
    },
    [onFiles, t],
  );

  useEffect(() => {
    if (disabled) return;
    function onPaste(event: ClipboardEvent) {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length > 0) {
        event.preventDefault();
        accept(files);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [accept, disabled]);

  // Drag events fire for every child element, so track depth rather than
  // toggling on each enter/leave — otherwise the highlight flickers.
  const depth = useRef(0);

  async function pasteFromClipboard() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          accept([new File([blob], "pasted-image", { type: imageType })]);
          return;
        }
      }
      setRejected(t("dropzone.noClipboardImage"));
    } catch {
      setRejected(t("dropzone.clipboardDenied"));
    }
  }

  return (
    <div>
      {/* biome-ignore lint/a11y/useSemanticElements: this region contains its own buttons, and nesting a button inside a button is invalid HTML. Enter/Space handling and aria-label are provided explicitly below. */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={t("dropzone.aria")}
        className="dropzone"
        data-dragging={dragging || undefined}
        data-compact={compact || undefined}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          depth.current += 1;
          if (!disabled) setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          depth.current -= 1;
          if (depth.current <= 0) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          depth.current = 0;
          setDragging(false);
          if (!disabled) accept(event.dataTransfer.files);
        }}
      >
        <div aria-hidden="true" className="dropzone-icon">
          <UploadIcon size={compact ? 24 : 32} />
        </div>

        <div>
          <div className="dropzone-title">
            {dragging ? t("dropzone.drop") : t("dropzone.upload")}
          </div>
          <div
            className="dim"
            style={{ fontSize: compact ? 13 : 15, marginTop: 4 }}
          >
            {t("dropzone.desc")}
          </div>
        </div>

        {!compact && (
          <div className="dropzone-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                void pasteFromClipboard();
              }}
            >
              <ClipboardIcon size={16} />
              {t("dropzone.paste")}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                cameraRef.current?.click();
              }}
            >
              <CameraIcon size={16} />
              {t("dropzone.camera")}
            </button>
          </div>
        )}
      </div>

      {!compact && (
        <p
          className="dim"
          style={{ fontSize: 13, marginTop: 16, textAlign: "center" }}
        >
          {t(privacyNote)}
        </p>
      )}

      {rejected && (
        <p
          role="alert"
          className="field-error"
          style={{ marginTop: 12, textAlign: "center" }}
        >
          {rejected}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          accept(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          accept(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
