"use client";

import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import { usePathname } from "next/navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // If we are on the scan page, we might want to hide mobile nav to give more space for the camera
  // For now we'll keep it, but it's easy to adjust
  const isScanPage = pathname === "/scan";

  return (
    <div className="app-layout" style={{ display: "flex", minHeight: "100dvh", width: "100%" }}>
      <Sidebar />
      <div 
        className="main-content" 
        style={{ 
          flex: 1, 
          display: "flex", 
          flexDirection: "column",
          // On mobile, padding bottom for the nav. On desktop, margin left for sidebar.
          // We handle this via CSS in globals.css or inline styles here.
        }}
      >
        <style dangerouslySetInnerHTML={{__html: `
          .main-content {
            padding-bottom: 72px; /* Mobile Nav */
          }
          @media (min-width: 768px) {
            .main-content {
              margin-left: var(--sidebar-w);
              padding-bottom: 0;
            }
          }
        `}} />
        <div style={{ flex: 1, position: "relative" }}>
          {children}
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
