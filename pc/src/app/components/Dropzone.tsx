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
 *
 * Paste matters more than it looks — screenshotting a leaf photo and hitting
 * Ctrl+V is the fastest path from "I have an image somewhere" to a diagnosis.
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

  // Drag events fire for every child element, so track depth rather than
  // toggling on each enter/leave — otherwise the highlight flickers.
  const depth = useRef(0);

  return (
    <div>
      {/* biome-ignore lint/a11y/useSemanticElements: this region contains its own camera <button>, and nesting a button inside a button is invalid HTML. Enter/Space handling and aria-label are provided explicitly below. */}
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
          display: "grid",
          placeItems: "center",
          gap: 12,
          padding: compact ? "20px 16px" : "40px 24px",
          borderRadius: "var(--radius-xl)",
          border: `1.5px dashed ${dragging ? "var(--accent)" : "var(--border-strong)"}`,
          background: dragging ? "var(--accent-soft)" : "var(--surface)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.55 : 1,
          textAlign: "center",
          transition:
            "background var(--ease-out), border-color var(--ease-out)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            display: "grid",
            placeItems: "center",
            width: compact ? 36 : 46,
            height: compact ? 36 : 46,
            borderRadius: "var(--radius-full)",
            background: "var(--accent-soft)",
            color: "var(--accent)",
          }}
        >
          <svg
            width={compact ? 18 : 22}
            height={compact ? 18 : 22}
            viewBox="0 0 22 22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M11 15V4M11 4 6.5 8.5M11 4l4.5 4.5" />
            <path d="M3 14v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
          </svg>
        </div>

        <div>
          <div style={{ fontWeight: 600, fontSize: compact ? 14 : 16 }}>
            {dragging ? "Drop to analyse" : "Drop a leaf photo"}
          </div>
          <div className="dim" style={{ fontSize: 13, marginTop: 2 }}>
            or click to browse · paste with{" "}
            <kbd
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                padding: "1px 5px",
                borderRadius: 4,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
              }}
            >
              Ctrl+V
            </kbd>
          </div>
        </div>

        {!compact && (
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                cameraRef.current?.click();
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2 5.5h2.2l1-1.6h3.6l1 1.6H14v7H2z" />
                <circle cx="8" cy="9" r="2.4" />
              </svg>
              Use camera
            </button>
          </div>
        )}
      </div>

      <p
        className="dim"
        style={{ fontSize: 12, marginTop: 10, textAlign: "center" }}
      >
        Images are analysed on your device and never uploaded.
      </p>

      {rejected && (
        <p
          role="alert"
          style={{
            fontSize: 13,
            marginTop: 8,
            textAlign: "center",
            color: "var(--critical)",
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
