/**
 * Initials in a circle. Deliberately no remote profile photos: they would be
 * third-party requests from a cross-origin-isolated page, and a tracking
 * vector besides.
 */
export default function UserAvatar({
  name,
  email,
  size = 36,
}: {
  name: string;
  email: string;
  size?: number;
}) {
  const source = name.trim() || email;
  const initials = source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      aria-hidden="true"
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials || "?"}
    </span>
  );
}
