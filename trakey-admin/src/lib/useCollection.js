import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./store";
import { tsMs } from "./format";

/** Live list of one Firestore collection, newest first. */
export function useCollection(name, timeFields = ["publishedAt", "createdAt"]) {
  const [items, setItems] = useState([]);
  const [state, setState] = useState({ loading: true, error: "" });
  useEffect(() => onSnapshot(collection(db, name), (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const at = (r) => { for (const f of timeFields) { const v = tsMs(r[f]); if (v) return v; } return 0; };
    rows.sort((a, b) => at(b) - at(a));
    setItems(rows);
    setState({ loading: false, error: "" });
  }, (err) => setState({ loading: false, error: err?.message || "Unable to load " + name + "." })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [name]);
  return { items, ...state };
}
