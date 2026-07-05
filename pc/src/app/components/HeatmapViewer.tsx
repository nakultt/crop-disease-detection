"use client";

import { useEffect, useRef, useState } from "react";
import { renderHeatmapOverlay } from "../lib/gradcam";

interface HeatmapViewerProps {
  imageUrl: string;
}

export default function HeatmapViewer({ imageUrl }: HeatmapViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [opacity, setOpacity] = useState(0.5);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (!imageLoaded || !canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = 256;
    canvas.height = 256;

    renderHeatmapOverlay(canvas, imageRef.current, opacity);
  }, [imageLoaded, opacity]);

  return (
    <div className="glass-card animate-fade-in animate-delay-2" style={{ padding: "24px" }} id="heatmap-viewer">
      <p className="section-heading">Grad-CAM Heatmap</p>
      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "16px" }}>
        Highlighted regions indicate areas influencing the prediction
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "12px",
        marginBottom: "16px",
      }}>
        {/* Original Image */}
        <div>
          <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "6px", textAlign: "center" }}>
            Original
          </p>
          <div className="heatmap-container" style={{ aspectRatio: "1", overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Original leaf"
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "12px" }}
            />
          </div>
        </div>

        {/* Heatmap Overlay */}
        <div>
          <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "6px", textAlign: "center" }}>
            Heatmap Overlay
          </p>
          <div className="heatmap-container" style={{ aspectRatio: "1", overflow: "hidden" }}>
            <canvas
              ref={canvasRef}
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "12px" }}
            />
          </div>
        </div>
      </div>

      {/* Opacity Slider */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          Opacity
        </span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={opacity}
          onChange={(e) => setOpacity(Number.parseFloat(e.target.value))}
          className="heatmap-slider"
          style={{ flex: 1 }}
          id="heatmap-opacity-slider"
        />
        <span style={{ fontSize: "0.75rem", color: "var(--text-accent)", fontWeight: 600, minWidth: "36px" }}>
          {Math.round(opacity * 100)}%
        </span>
      </div>

      {/* Legend */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "4px",
        marginTop: "12px",
        fontSize: "0.7rem",
        color: "var(--text-muted)",
      }}>
        <span>Low</span>
        <div style={{
          width: "120px",
          height: "8px",
          borderRadius: "4px",
          background: "linear-gradient(90deg, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000)",
        }} />
        <span>High</span>
      </div>
    </div>
  );
}
