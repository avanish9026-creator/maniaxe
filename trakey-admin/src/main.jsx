import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App.jsx";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/trakey-admin/sw.js", { scope: "/trakey-admin/" }).catch((e) => console.error("Service worker failed:", e));
  });
}

createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);
