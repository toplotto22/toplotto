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

// Register Service Worker (production builds only)
if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
