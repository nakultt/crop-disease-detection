"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { LANGUAGES } from "../lib/i18n/translations";

export default function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const selectedLang = LANGUAGES.find((l) => l.code === language);

  return (
    <div className="relative" ref={containerRef} onKeyDown={handleKeyDown} style={{ position: "relative" }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          color: "var(--text)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          fontWeight: 500,
          textAlign: "left",
        }}
      >
        <span>{selectedLang?.name} — {selectedLang?.nativeName}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            maxHeight: "300px",
            overflowY: "auto",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-2)",
            zIndex: 100,
            margin: 0,
            padding: "8px 0",
            listStyle: "none",
          }}
        >
          {LANGUAGES.map((lang) => {
            const isSelected = lang.code === language;
            return (
              <li
                key={lang.code}
                role="option"
                aria-selected={isSelected}
              >
                <button
                  type="button"
                  onClick={() => {
                    setLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    background: isSelected ? "var(--primary-soft)" : "transparent",
                    color: isSelected ? "var(--primary)" : "var(--text)",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    fontWeight: isSelected ? 600 : 500,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "var(--surface-2)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span style={{ width: "20px", display: "inline-flex", justifyContent: "center" }}>
                    {isSelected && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  <span>{lang.name} — <span style={{ color: "var(--text-3)" }}>{lang.nativeName}</span></span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
