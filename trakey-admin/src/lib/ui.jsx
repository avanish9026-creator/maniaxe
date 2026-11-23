// Shared building blocks: icons, buttons, badges, modal, toasts, confirm dialogs.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { initialOf } from "./format";

/* ---------- Icons (24px, stroke) ---------- */
const P = {
  home: "M3 10.5 12 3l9 7.5M5 9.5V20h14V9.5M10 20v-6h4v6",
  users: "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 5.2a3.5 3.5 0 0 1 0 6.6",
  user: "M19 20v-1.5a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4V20M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  card: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7ZM3 10h18M7 15h3",
  mail: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm1 .5 8 5.5 8-5.5",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16ZM10 21h4",
  megaphone: "M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1ZM16 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11",
  inbox: "M3 13l3-8h12l3 8M3 13v5a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-5M3 13h5l1 2h6l1-2h5",
  send: "M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  copy: "M9 9V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3M5 9h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z",
  check: "m5 12.5 4.5 4.5L19 7.5",
  x: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  download: "M12 4v11m0 0-4-4m4 4 4-4M5 19h14",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3",
  shield: "M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z",
  logout: "M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z",
  right: "m9 6 6 6-6 6",
  left: "m15 6-6 6 6 6",
  back: "M19 12H5m0 0 6-6m-6 6 6 6",
  star: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z",
  gift: "M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9ZM3 7h18v4H3V7ZM12 7v14M12 7c-1-3-5-4-5-1.5C7 7 9 7 12 7Zm0 0c1-3 5-4 5-1.5C17 7 15 7 12 7Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5ZM14 3v5h5M9 13h6M9 17h6",
  database: "M12 10c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3ZM4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  rocket: "M5 15c-1.5 1.3-2 5-2 5s3.7-.5 5-2M14 4c3-1 6-1 7-1 0 1 0 4-1 7l-6 6-5-5 5-7ZM9 15l-3-1 2-4 4-1M15 9.5h.01",
  refresh: "M20 11a8 8 0 0 0-14.5-3.5M4 5v4h4M4 13a8 8 0 0 0 14.5 3.5M20 19v-4h-4",
  filter: "M4 5h16l-6 7v6l-4 2v-8L4 5Z",
  menu: "M4 6h16M4 12h16M4 18h16",
  alert: "M12 4 2.5 20h19L12 4ZM12 10v4M12 17h.01",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01",
  image: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM3 16l5-5 4 4 3-3 6 6M9 9.5h.01",
  dot: "M12 12h.01",
  edit: "M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4",
  chat: "M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  bolt: "M13 3 5 13h6l-1 8 8-10h-6l1-8Z",
  crown: "M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8Z",
  lock: "M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1ZM8 11V8a4 4 0 0 1 8 0v3",
  command: "M9 9V6.5A2.5 2.5 0 1 0 6.5 9H9Zm0 0h6m-6 0v6m6-6V6.5A2.5 2.5 0 1 1 17.5 9H15Zm0 0v6m0 0h2.5a2.5 2.5 0 1 1-2.5 2.5V15Zm0 0H9m0 0H6.5A2.5 2.5 0 1 0 9 17.5V15Z",
};

export function Icon({ name, size = 18, className = "", stroke = 1.9 }) {
  return (
    <svg className={"ic " + className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] || P.dot} />
    </svg>
  );
}

/* ---------- Basics ---------- */
export function Button({ variant = "default", size = "md", icon, children, className = "", ...rest }) {
  return (
    <button type="button" className={`btn btn-${variant} btn-${size} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 15 : 17} />}
      {children && <span>{children}</span>}
    </button>
  );
}

export function IconButton({ icon, label, className = "", size = 18, ...rest }) {
  return (
    <button type="button" className={"icon-btn " + className} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={size} />
    </button>
  );
}

export function Badge({ tone = "neutral", children, dot = false, icon }) {
  return (
    <span className={"badge tone-" + tone}>
      {dot && <i className="dot" />}
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

export const PRO_TONE = { lifetime: "gold", pro: "accent", trial: "ok", reward: "ok", expired: "warn", ended: "muted", free: "muted" };

export function ProBadge({ pro }) {
  return <Badge tone={PRO_TONE[pro.key] || "muted"} icon={pro.hasPaid ? "crown" : undefined}>{pro.label}</Badge>;
}

export function Avatar({ name, email, size = 40, online = false }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      {initialOf(name, email)}
      {online && <i className="avatar-online" />}
    </span>
  );
}

export function Card({ title, subtitle, action, children, className = "", pad = true }) {
  return (
    <section className={"card " + (pad ? "" : "card-flush ") + className}>
      {(title || action) && (
        <header className="card-head">
          <div>{title && <h3>{title}</h3>}{subtitle && <p>{subtitle}</p>}</div>
          {action && <div className="card-action">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHead({ title, subtitle, children, back }) {
  return (
    <div className="page-head">
      <div className="page-head-text">
        {back}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

export function Empty({ icon = "inbox", title, children }) {
  return (
    <div className="empty">
      <span className="empty-ic"><Icon name={icon} size={22} /></span>
      <b>{title}</b>
      {children && <p>{children}</p>}
    </div>
  );
}

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={"field " + className}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Segmented({ value, onChange, options, className = "" }) {
  return (
    <div className={"segmented " + className} role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value}
          className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.icon && <Icon name={o.icon} size={15} />}
          {o.label}
          {o.count != null && <em>{o.count}</em>}
        </button>
      ))}
    </div>
  );
}

export function Tabs({ value, onChange, tabs }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" aria-selected={value === t.value}
          className={value === t.value ? "on" : ""} onClick={() => onChange(t.value)}>
          {t.icon && <Icon name={t.icon} size={16} />}
          {t.label}
          {t.count > 0 && <em>{t.count}</em>}
        </button>
      ))}
    </div>
  );
}

export function Notice({ tone = "info", children }) {
  return (
    <div className={"notice notice-" + tone}>
      <Icon name={tone === "bad" ? "alert" : tone === "ok" ? "check" : tone === "warn" ? "alert" : "info"} size={17} />
      <div>{children}</div>
    </div>
  );
}

export function Spinner() { return <span className="spinner" aria-label="Loading" />; }

export function Loading({ text = "Loading…" }) {
  return <div className="loading"><Spinner /> {text}</div>;
}

export function KeyValue({ rows }) {
  return (
    <dl className="kv">
      {rows.filter(Boolean).map(([k, v, mono]) => (
        <div key={k}><dt>{k}</dt><dd className={mono ? "mono" : ""}>{v === "" || v == null ? "—" : v}</dd></div>
      ))}
    </dl>
  );
}

/* ---------- Modal ---------- */
export function Modal({ title, subtitle, onClose, children, footer, width = 520 }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

/* ---------- Toasts + confirm / prompt dialogs ---------- */
const UICtx = createContext(null);
export const useUI = () => useContext(UICtx);

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const idRef = useRef(0);

  const toast = useCallback((message, tone = "ok") => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "bad" ? 7000 : 3800);
  }, []);

  const confirm = useCallback((opts) => new Promise((resolve) => setDialog({ kind: "confirm", ...opts, resolve })), []);
  const prompt = useCallback((opts) => new Promise((resolve) => setDialog({ kind: "prompt", ...opts, resolve })), []);

  const close = (value) => { dialog?.resolve(value); setDialog(null); };

  return (
    <UICtx.Provider value={{ toast, confirm, prompt }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={"toast toast-" + t.tone}>
            <Icon name={t.tone === "bad" ? "alert" : "check"} size={17} />
            <span>{t.message}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}><Icon name="x" size={14} /></button>
          </div>
        ))}
      </div>
      {dialog && <DialogView dialog={dialog} close={close} />}
    </UICtx.Provider>
  );
}

function DialogView({ dialog, close }) {
  const [text, setText] = useState(dialog.defaultValue || "");
  const isPrompt = dialog.kind === "prompt";
  return (
    <Modal title={dialog.title} subtitle={dialog.body} width={460} onClose={() => close(isPrompt ? null : false)}
      footer={
        <>
          <Button variant="quiet" onClick={() => close(isPrompt ? null : false)}>Cancel</Button>
          <Button variant={dialog.danger ? "danger" : "primary"} onClick={() => close(isPrompt ? text : true)}>
            {dialog.confirmLabel || "Confirm"}
          </Button>
        </>
      }>
      {isPrompt && (
        <Field label={dialog.label}>
          <textarea autoFocus rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
      )}
    </Modal>
  );
}

/* ---------- Copy an email address (or any text) with one tap ---------- */
export function CopyEmail({ email, label = "Copy email", compact = false }) {
  const copy = useCopy();
  if (!email) return null;
  const doCopy = (e) => { e.preventDefault(); e.stopPropagation(); copy(email, "Email copied: " + email); };
  return compact
    ? <IconButton icon="copy" label={label} size={15} onClick={doCopy} />
    : <button type="button" className="btn btn-quiet btn-sm" onClick={doCopy}><Icon name="copy" size={14} /><span>{label}</span></button>;
}

/* ---------- Small hooks ---------- */
export function useCopy() {
  const { toast } = useUI();
  return useCallback(async (text, what = "Copied") => {
    try { await navigator.clipboard.writeText(text); toast(what); } catch { toast("Copy failed. Select the text and copy it by hand.", "bad"); }
  }, [toast]);
}

export function useBusy() {
  const [busy, setBusy] = useState("");
  const { toast } = useUI();
  // run("key", async () => {...}, "Success message") -> shows the error as a toast, always clears busy.
  const run = useCallback(async (key, fn, success) => {
    setBusy(key);
    try {
      const out = await fn();
      if (success) toast(typeof success === "function" ? success(out) : success);
      return out;
    } catch (err) {
      toast(err?.message || "Something went wrong.", "bad");
      return undefined;
    } finally { setBusy(""); }
  }, [toast]);
  return [busy, run];
}
