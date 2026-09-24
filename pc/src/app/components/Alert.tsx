import { AlertCircleIcon, AlertIcon, CheckCircleIcon, InfoIcon } from "./icons";

type Tone = "error" | "success" | "warning" | "info";

const ICONS = {
  error: AlertCircleIcon,
  success: CheckCircleIcon,
  warning: AlertIcon,
  info: InfoIcon,
} as const;

/**
 * Inline status message. Errors are announced immediately (`role="alert"`);
 * everything else politely (`role="status"`).
 */
export default function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
}) {
  const Icon = ICONS[tone];
  return (
    <div
      className={`alert alert-${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon size={18} />
      <div style={{ minWidth: 0 }}>
        {title && <div style={{ fontWeight: 650 }}>{title}</div>}
        {children && (
          <div
            style={{ color: tone === "error" ? undefined : "var(--text-2)" }}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
