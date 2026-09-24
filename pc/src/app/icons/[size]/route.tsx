import { ImageResponse } from "next/og";
import { AppIcon } from "../../lib/brand-image";

const SIZES = [192, 512] as const;

/** PNG app icons for the web app manifest: /icons/192 and /icons/512. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const size = Number((await params).size);
  if (!SIZES.includes(size as (typeof SIZES)[number])) {
    return new Response("Not found", { status: 404 });
  }
  return new ImageResponse(<AppIcon size={size} />, {
    width: size,
    height: size,
    headers: { "Cache-Control": "public, max-age=604800" },
  });
}

export function generateStaticParams() {
  return SIZES.map((size) => ({ size: String(size) }));
}
