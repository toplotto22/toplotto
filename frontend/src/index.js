import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { AppProvider } from "@/lib/context";
import { Toaster } from "@/components/ui/sonner";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AppProvider>
      <App />
      <Toaster theme="dark" position="top-right" />
    </AppProvider>
  </React.StrictMode>
);

// Register Service Worker with auto-update notification (production builds only)
if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      // Auto-check for updates every 5 minutes while app is open
      setInterval(() => reg.update().catch(() => {}), 5 * 60 * 1000);
      // When a new worker is found, activate immediately and reload
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            // A new version is ready; ask it to take over and reload tab
            nw.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
    }).catch(() => {});
    // Reload once when the controller changes (new SW activated)
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });
}
