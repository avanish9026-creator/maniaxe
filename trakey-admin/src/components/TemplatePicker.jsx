// Ready-made messages (69 in total). Pick a group, pick a message, fill the blanks, press the button, then edit if you like.
import { useMemo, useState } from "react";
import { Button, Field, Segmented } from "../lib/ui";
import { APP_VERSION, BLANKS, SITE, TEMPLATES, blanksIn, fillTemplate } from "../lib/templates";

// kind: "push" | "announce" | "update" | "reply". onUse receives the filled-in template.
export default function TemplatePicker({ kind, onUse, defaults = {}, button = "Use this message" }) {
  const groups = TEMPLATES[kind];
  const [cat, setCat] = useState(groups[0].name);
  const [idx, setIdx] = useState(0);
  const [vars, setVars] = useState({ version: APP_VERSION, link: SITE, days: "30", ...defaults });
  const items = (groups.find((g) => g.name === cat) || groups[0]).items;
  const tpl = items[idx] || items[0];
  const blanks = useMemo(() => blanksIn(tpl).filter((k) => !(k in defaults)), [tpl, defaults]);
  const pickCat = (name) => { setCat(name); setIdx(0); };
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="tpl">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <b>Ready-made messages</b><span className="small muted">{total} to choose from</span>
      </div>
      <Segmented value={cat} onChange={pickCat} options={groups.map((g) => ({ value: g.name, label: g.name }))} />
      <Field label="Message">
        <select value={idx} onChange={(e) => setIdx(Number(e.target.value))}>
          {items.map((x, i) => <option key={i} value={i}>{x.t.replace(/\{(\w+)\}/g, (_, k) => "[" + k + "]")}</option>)}
        </select>
      </Field>
      {blanks.length > 0 && (
        <div className="form-grid">
          {blanks.map((k) => (
            <Field key={k} label={BLANKS[k].label}>
              <input type={BLANKS[k].type || "text"} placeholder={BLANKS[k].placeholder} value={vars[k] || ""} onChange={(e) => setVars((p) => ({ ...p, [k]: e.target.value }))} />
            </Field>
          ))}
        </div>
      )}
      <div className="row">
        <Button variant="soft" icon="check" onClick={() => onUse(fillTemplate(tpl, { ...vars, ...defaults }))}>{button}</Button>
        <span className="small muted">It fills the boxes below. You can still edit it.</span>
      </div>
    </div>
  );
}
