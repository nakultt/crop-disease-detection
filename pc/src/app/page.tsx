"use client";

import { useCallback, useState } from "react";
import ImageUploader from "./components/ImageUploader";
import ResultCard from "./components/ResultCard";
import HeatmapViewer from "./components/HeatmapViewer";
import SeverityGauge from "./components/SeverityGauge";
import RecommendationPanel from "./components/RecommendationPanel";
import { predict, isModelAvailable } from "./lib/inference";
import type { PredictionResult } from "./lib/inference";
import { getRecommendations } from "./lib/recommendations";
import type { Recommendation } from "./lib/recommendations";

export default function Home() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState<boolean | null>(null);

  const handleImageSelected = useCallback(async (file: File, url: string) => {
    setPreviewUrl(url);
    setResult(null);
    setRecommendations([]);
    setError(null);
    setIsAnalyzing(true);

    try {
      // Check model availability
      const available = await isModelAvailable();
      setModelReady(available);

      if (!available) {
        setError(
          "Model not found. Train the model first and export to ONNX, then copy to pc/public/models/model.onnx"
        );
        setIsAnalyzing(false);
        return;
      }

      // Load image element
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = url;
      });

      // Run inference
      const prediction = await predict(img);
      setResult(prediction);

      // Get recommendations
      const recs = getRecommendations(prediction.disease.className, prediction.severity.level);
      setRecommendations(recs);
    } catch (err) {
      console.error("Prediction failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Prediction failed. Make sure the model is exported and placed in public/models/"
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setResult(null);
    setRecommendations([]);
    setError(null);
  }, [previewUrl]);

  return (
    <>
      {/* Animated Background */}
      <div className="bg-animated" />
      <div className="bg-grid" />

      {/* Main Content */}
      <div style={{
        position: "relative",
        zIndex: 1,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Header */}
        <header style={{
          padding: "24px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--border-subtle)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span className="leaf-float" style={{ fontSize: "1.6rem" }}>🌱</span>
            <div>
              <h1 style={{
                fontSize: "1.2rem",
                fontWeight: 800,
                color: "var(--text-primary)",
                margin: 0,
                letterSpacing: "-0.02em",
              }}>
                PlantGuard AI
              </h1>
              <p style={{
                fontSize: "0.7rem",
                color: "var(--text-muted)",
                margin: 0,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}>
                Powered by MobileNetV5
              </p>
            </div>
          </div>

          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "0.75rem",
            color: "var(--text-muted)",
          }}>
            <div className="pulse-dot" style={{
              backgroundColor: modelReady === false ? "var(--severity-critical)" : "var(--severity-mild)",
            }} />
            {modelReady === null ? "Checking model..." : modelReady ? "Model Ready" : "Model Not Loaded"}
          </div>
        </header>

        {/* Main Area */}
        <main style={{
          flex: 1,
          maxWidth: "1200px",
          width: "100%",
          margin: "0 auto",
          padding: "32px 24px",
        }}>
          {/* Hero Section (shown when no image) */}
          {!previewUrl && (
            <div style={{
              textAlign: "center",
              marginBottom: "40px",
            }}>
              <h2 style={{
                fontSize: "2.2rem",
                fontWeight: 800,
                color: "var(--text-primary)",
                lineHeight: 1.2,
                marginBottom: "12px",
                letterSpacing: "-0.03em",
              }}>
                Detect Plant Diseases
                <br />
                <span style={{ color: "var(--emerald-400)" }}>with Explainable AI</span>
              </h2>
              <p style={{
                fontSize: "1rem",
                color: "var(--text-secondary)",
                maxWidth: "520px",
                margin: "0 auto 32px",
                lineHeight: 1.6,
              }}>
                Upload a leaf image to identify diseases, estimate severity,
                and see which regions influenced the AI&apos;s decision.
              </p>
            </div>
          )}

          {/* Upload / Preview Row */}
          {!previewUrl ? (
            <div style={{ maxWidth: "560px", margin: "0 auto" }}>
              <ImageUploader
                onImageSelected={handleImageSelected}
                disabled={isAnalyzing}
              />
            </div>
          ) : (
            <div>
              {/* Preview Header */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "24px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Uploaded leaf"
                    style={{
                      width: "48px",
                      height: "48px",
                      objectFit: "cover",
                      borderRadius: "12px",
                      border: "2px solid var(--border-accent)",
                    }}
                  />
                  <div>
                    <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                      {isAnalyzing ? "Analyzing..." : result ? "Analysis Complete" : "Processing..."}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
                      {isAnalyzing ? "Running MobileNetV5 inference" : result ? "Disease & severity detected" : ""}
                    </p>
                  </div>
                </div>

                <button className="btn-ghost" onClick={handleReset} id="new-analysis-button">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                  New Analysis
                </button>
              </div>

              {/* Loading State */}
              {isAnalyzing && (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "64px 0",
                  gap: "16px",
                }}>
                  <div className="spinner" />
                  <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                    Running inference on your leaf image...
                  </p>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="glass-card" style={{
                  padding: "24px",
                  borderColor: "rgba(239, 68, 68, 0.3)",
                  background: "rgba(239, 68, 68, 0.05)",
                }}>
                  <p style={{ fontSize: "0.9rem", color: "var(--severity-critical)", margin: 0 }}>
                    ⚠️ {error}
                  </p>
                </div>
              )}

              {/* Results Grid */}
              {result && (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "20px",
                }}>
                  {/* Left Column */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <ResultCard result={result} />
                    <SeverityGauge
                      level={result.severity.level}
                      confidence={result.severity.confidence}
                      distribution={result.severity.distribution}
                    />
                  </div>

                  {/* Right Column */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <HeatmapViewer imageUrl={previewUrl} />
                    <RecommendationPanel recommendations={recommendations} />
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer style={{
          padding: "16px 32px",
          borderTop: "1px solid var(--border-subtle)",
          textAlign: "center",
          fontSize: "0.75rem",
          color: "var(--text-muted)",
        }}>
          Explainable Multi-Task Plant Disease Detection · MobileNetV5 + Grad-CAM · B.Tech Project
        </footer>
      </div>
    </>
  );
}
