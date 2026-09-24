/**
 * The brand mark as plain JSX for `next/og` image generation (icons and the
 * social card). Satori renders a subset of CSS, so everything here is flexbox
 * and inline styles.
 */

export const BRAND_GREEN = "#1b4d3e";
export const BRAND_GREEN_DEEP = "#0e2c22";
export const BRAND_GOLD = "#ebc34a";

export function LeafMark({
  size,
  stroke = "#ffffff",
}: {
  size: number;
  stroke?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 52c0-19 12.5-31.5 37.5-35 0 25-12.5 37.5-28 37.5a16 16 0 0 1-9.5-2.5Z"
        stroke={stroke}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 52c7-12.5 16-20.5 28.5-25"
        stroke={stroke}
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * A square app icon. Full-bleed, because iOS and Android apply their own
 * mask; the leaf sits well inside the 80% safe zone maskable icons require.
 */
export function AppIcon({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(135deg, #1f5a47 0%, ${BRAND_GREEN_DEEP} 100%)`,
        position: "relative",
      }}
    >
      <LeafMark size={Math.round(size * 0.56)} />
      <div
        style={{
          position: "absolute",
          top: size * 0.22,
          right: size * 0.22,
          width: size * 0.12,
          height: size * 0.12,
          borderRadius: size,
          background: BRAND_GOLD,
        }}
      />
    </div>
  );
}
