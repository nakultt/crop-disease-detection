import Link from "next/link";
import { LeafIcon } from "./icons";

/** Logo mark plus wordmark. */
export default function Brand({
  href = "/",
  size = "md",
}: {
  href?: string;
  size?: "sm" | "md";
}) {
  const mark = size === "sm" ? 30 : 36;
  return (
    <Link href={href} className="brand" aria-label="PlantGuard home">
      <span
        className="brand-mark"
        style={{ width: mark, height: mark }}
        aria-hidden="true"
      >
        <LeafIcon size={size === "sm" ? 17 : 20} active />
      </span>
      <span
        className="brand-name"
        style={{ fontSize: size === "sm" ? 17 : 20 }}
      >
        PlantGuard
      </span>
    </Link>
  );
}
