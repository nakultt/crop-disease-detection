"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface DropzoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  compact?: boolean;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 20 * 1024 * 1024;

function usable(file: File): boolean {
  return ACCEPTED.includes(file.type) && file.size <= MAX_BYTES;
}

/**
 * Image intake: drag-and-drop, file picker, camera capture, and clipboard paste.
 * Redesigned for the new premium agricultural AI aesthetic.
 */
export default function Dropzone({
  onFiles,
  disabled,
  compact,
}: DropzoneProps) {
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
        setRejected(
          tooBig
            ? "That image is over 20 MB. Try a smaller one."
            : "Unsupported format. Use JPEG, PNG, WebP or AVIF.",
        );
        return;
      }

      setRejected(
        good.length < all.length
          ? `Skipped ${all.length - good.length} unsupported file(s).`
          : null,
      );
      if (good.length > 0) onFiles(good);
    },
    [onFiles],
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

  const depth = useRef(0);

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label="Add a leaf photograph. Drop a file, paste from the clipboard, or activate to browse."
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
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: compact ? "24px" : "64px 32px",
          borderRadius: "var(--radius-xl)",
          border: `2px dashed ${dragging ? "var(--primary)" : "var(--border-strong)"}`,
          background: dragging ? "var(--primary-soft)" : "var(--surface)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          textAlign: "center",
          transition: "all var(--ease-out)",
          boxShadow: dragging ? "var(--shadow-2)" : "var(--shadow-1)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            display: "grid",
            placeItems: "center",
            width: compact ? 48 : 72,
            height: compact ? 48 : 72,
            borderRadius: "var(--radius-full)",
            background: "var(--primary-soft)",
            color: "var(--primary)",
            transition: "transform var(--ease-out)",
            transform: dragging ? "scale(1.1)" : "scale(1)",
          }}
        >
          <svg
            width={compact ? 24 : 32}
            height={compact ? 24 : 32}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        <div>
          <div style={{ fontWeight: 600, fontSize: compact ? 16 : 22, color: "var(--text)", letterSpacing: "-0.01em" }}>
            {dragging ? "Drop to analyse" : "Upload Leaf Image"}
          </div>
          <div className="dim" style={{ fontSize: compact ? 13 : 15, marginTop: 4 }}>
            Drag & drop, click to browse, or paste image
          </div>
        </div>

        {!compact && (
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              justifyContent: "center",
              marginTop: 8,
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              disabled={disabled}
              onClick={async (event) => {
                event.stopPropagation();
                try {
                  const items = await navigator.clipboard.read();
                  for (const item of items) {
                    const imageTypes = item.types.filter((type) =>
                      type.startsWith("image/"),
                    );
                    if (imageTypes.length > 0) {
                      const blob = await item.getType(imageTypes[0]);
                      const file = new File([blob], "pasted-image.png", {
                        type: imageTypes[0],
                      });
                      accept([file]);
                      return;
                    }
                  }
                  setRejected("No image found in clipboard.");
                } catch (err) {
                  setRejected("Could not access clipboard. Try Ctrl+V instead.");
                }
              }}
              style={{
                borderRadius: "var(--radius-full)",
                padding: "10px 24px",
                fontSize: 14,
                fontWeight: 560,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ marginRight: 6 }}
              >
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
              Paste Image
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                cameraRef.current?.click();
              }}
              style={{
                borderRadius: "var(--radius-full)",
                padding: "10px 24px",
                fontSize: 14,
                fontWeight: 560,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ marginRight: 6 }}
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Take Photo
            </button>
          </div>
        )}
      </div>

      {!compact && (
        <p
          className="dim"
          style={{ fontSize: 13, marginTop: 16, textAlign: "center" }}
        >
          Images are analysed on your device and never uploaded.
        </p>
      )}

      {rejected && (
        <p
          role="alert"
          style={{
            fontSize: 14,
            marginTop: 12,
            textAlign: "center",
            color: "var(--critical)",
            fontWeight: 500,
          }}
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
