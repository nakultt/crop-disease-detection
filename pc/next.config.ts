import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},

  async headers() {
    return [
      {
        // Cross-origin isolation is what makes `SharedArrayBuffer` — and so
        // multi-threaded WASM — available to ONNX Runtime. It has to cover the
        // whole document, not just /models, because the flag is a property of
        // the page. `inference.ts` reads `crossOriginIsolated` at runtime and
        // falls back to a single thread wherever this does not take effect.
        //
        // Safe here only because every asset is same-origin: fonts are
        // self-hosted by next/font and the model is served from /public.
        // Adding any third-party script, image or font will need a
        // `crossorigin` attribute and CORP headers on the remote host.
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
      {
        // The model is immutable per export; a fresh export changes
        // `modelVersion` in the manifest, and the manifest itself is
        // revalidated on every load.
        source: "/models/model.onnx",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/models/model.json",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default nextConfig;
