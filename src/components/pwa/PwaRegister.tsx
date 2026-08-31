"use client";

import * as React from "react";
import { Download, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = React.useState(false);

  React.useEffect(() => {
    // Register Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("PWA Service Worker registered:", reg.scope);
          })
          .catch((err) => {
            console.warn("PWA Service Worker registration error:", err);
          });
      });
    }

    // Capture Install Prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Check if user hasn't dismissed before
      const dismissed = localStorage.getItem("notepadhub_pwa_dismissed");
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    localStorage.setItem("notepadhub_pwa_dismissed", "true");
  };

  if (!showInstallBanner) return null;

  return (
    <aside
      aria-label="PWA install banner"
      className="fixed bottom-4 left-4 z-50 max-w-sm bg-[#111827] text-white p-4 rounded-xl border-2 border-gray-700 flex items-center justify-between gap-3 shadow-none transition-all duration-200"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#3B82F6] text-white flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-amber-300" />
        </div>
        <div>
          <h2 className="text-xs font-extrabold tracking-tight">Install NotepadHub App</h2>
          <p className="text-[11px] text-gray-400 font-medium leading-tight mt-0.5">
            Use offline, faster access, and distraction-free native window.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          variant="primary"
          size="sm"
          onClick={handleInstall}
          className="text-xs h-8 px-2.5 gap-1"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install</span>
        </Button>

        <button
          onClick={handleDismiss}
          className="p-1 text-gray-400 hover:text-white rounded"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
