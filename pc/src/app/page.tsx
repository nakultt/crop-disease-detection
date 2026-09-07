import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div style={{ display: "flex", minHeight: "100dvh", width: "100%" }}>
      {/* Left side: Image */}
      <div
        style={{
          flex: "1 1 50%",
          position: "relative",
          display: "none",
        }}
        className="login-image-panel"
      >
        <Image
          src="/login-bg-indian.png"
          alt="Lush Indian agricultural fields at sunset"
          fill
          priority
          style={{ objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(17,26,13,0.85) 0%, rgba(17,26,13,0) 100%)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: "64px",
            color: "white",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <span
              aria-hidden="true"
              style={{
                display: "grid",
                placeItems: "center",
                width: 44,
                height: 44,
                borderRadius: "var(--radius-sm)",
                background: "var(--primary)",
                color: "var(--primary-on)",
                boxShadow: "var(--shadow-1)",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 16c0-6 4-10 12-11 0 8-4 12-9 12a5 5 0 0 1-3-1Z" />
                <path d="M4 16c2-4 5-6.5 9-8" />
              </svg>
            </span>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>PlantGuard</span>
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em", maxWidth: "16ch" }}>
            Protect your harvest with intelligent AI.
          </h1>
          <p style={{ fontSize: 18, marginTop: 16, maxWidth: "40ch", opacity: 0.9, lineHeight: 1.6 }}>
            Join thousands of farmers using PlantGuard to detect, diagnose, and treat crop diseases early.
          </p>
        </div>
      </div>

      {/* Right side: Form */}
      <div
        style={{
          flex: "1 1 50%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "32px",
          background: "var(--surface)",
        }}
      >
        <div style={{ width: "100%", maxWidth: 440, margin: "0 auto" }}>
          {/* Mobile Header Logo */}
          <div className="mobile-only-logo" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40 }}>
            <span
              aria-hidden="true"
              style={{
                display: "grid",
                placeItems: "center",
                width: 36,
                height: 36,
                borderRadius: "var(--radius-sm)",
                background: "var(--primary)",
                color: "var(--primary-on)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 16c0-6 4-10 12-11 0 8-4 12-9 12a5 5 0 0 1-3-1Z" /><path d="M4 16c2-4 5-6.5 9-8" />
              </svg>
            </span>
            <span style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>PlantGuard</span>
          </div>

          <h2 style={{ fontSize: 32, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>
            Welcome back
          </h2>
          <p className="muted" style={{ fontSize: 15, marginTop: 8 }}>
            Enter your details below to access your account.
          </p>

          <form style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 32 }}>
            <div>
              <label htmlFor="contact" style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
                Email or Phone Number
              </label>
              <input
                id="contact"
                type="text"
                placeholder="you@example.com or +1 234 567 8900"
                style={{
                  width: "100%",
                  height: 48,
                  padding: "0 16px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  fontSize: 15,
                  transition: "border-color var(--ease-out), box-shadow var(--ease-out)",
                  color: "var(--text)"
                }}
              />
            </div>

            <div>
              <label htmlFor="location" style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
                Location
              </label>
              <div style={{ position: "relative" }}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-3)"
                  }}
                >
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <input
                  id="location"
                  type="text"
                  placeholder="City, Region, or Country"
                  style={{
                    width: "100%",
                    height: 48,
                    padding: "0 16px 0 42px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    fontSize: 15,
                    transition: "border-color var(--ease-out), box-shadow var(--ease-out)",
                    color: "var(--text)"
                  }}
                />
              </div>
            </div>

            <Link
              href="/dashboard"
              className="btn btn-primary"
              style={{
                width: "100%",
                marginTop: 8,
                borderRadius: "var(--radius-md)",
                height: 52,
                fontSize: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none"
              }}
            >
              Continue
            </Link>
          </form>

          <p style={{ textAlign: "center", fontSize: 14, color: "var(--text-2)", marginTop: 32 }}>
            Don't have an account? <Link href="#" style={{ fontWeight: 600 }}>Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
