import { useCallback, useState } from "react";

// Dark is the default (like the Trakey app). The choice is remembered in this browser.
export function useTheme() {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("trakey-admin-theme") || "dark"; } catch { return "dark"; } });
  const dark = theme !== "light";
  const toggle = useCallback(() => {
    const next = dark ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("trakey-admin-theme", next); } catch { /* private mode */ }
  }, [dark]);
  return [dark, toggle];
}
