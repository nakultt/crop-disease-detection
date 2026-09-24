"use client";

import "./globals.css";

/**
 * Last-resort screen for errors in the root layout itself. It replaces the
 * whole document, so it cannot rely on the language provider or app shell —
 * hence plain English.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="shell page status-page">
          <h1 className="page-title">Something went wrong</h1>
          <p className="page-desc" style={{ textAlign: "center" }}>
            PlantGuard hit an unexpected problem. Please try again in a moment.
          </p>
          {error.digest && (
            <p className="dim mono" style={{ fontSize: 12.5 }}>
              Reference: {error.digest}
            </p>
          )}
          <button type="button" className="btn btn-primary" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
