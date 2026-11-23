// Tiny hash router: #/users/UID. Works on GitHub Pages with no server setup and keeps the browser Back button working.
import { useEffect, useState } from "react";

const read = () => {
  const raw = window.location.hash.replace(/^#\/?/, "");
  return raw.split("/").filter(Boolean).map(decodeURIComponent);
};

export const href = (...parts) => "#/" + parts.map((p) => encodeURIComponent(p)).join("/");
export const go = (...parts) => { window.location.hash = href(...parts); };

export function useRoute() {
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const on = () => setParts(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return parts;
}
