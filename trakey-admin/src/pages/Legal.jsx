import { Button, Card, Icon, PageHead, useBusy } from "../lib/ui";

const DOCS = [
  { k: "terms", t: "Terms and Conditions", n: "Same text as maniaxe.in/trakey/terms.html", f: "Trakey-Terms-and-Conditions.pdf" },
  { k: "privacy", t: "Privacy Policy", n: "Same text as maniaxe.in/trakey/privacy-policy.html", f: "Trakey-Privacy-Policy.pdf" },
];

export default function Legal() {
  const [busy, run] = useBusy();
  const download = (d) => run(d.k, async () => {
    const r = await fetch(import.meta.env.BASE_URL + "legal/" + d.f);
    if (!r.ok) throw new Error("The file could not be loaded (" + r.status + ").");
    const href = URL.createObjectURL(new Blob([await r.blob()], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = href; a.download = d.f; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 2000);
  });
  return (
    <>
      <PageHead title="Legal documents" subtitle="Download the Terms and the Privacy Policy as clean PDFs." />
      <div className="cols-2">
        {DOCS.map((d) => (
          <Card key={d.k}>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <span className="tl-ic accent" style={{ width: 44, height: 44, borderRadius: 14 }}><Icon name="file" size={20} /></span>
              <div className="grow"><h3 style={{ fontSize: 16 }}>{d.t}</h3><p className="small muted">{d.n}</p></div>
              <Button variant="primary" icon="download" disabled={busy === d.k} onClick={() => download(d)}>{busy === d.k ? "Preparing…" : "PDF"}</Button>
            </div>
          </Card>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 18 }}>These are saved copies. If the Terms or Privacy Policy change on the website, replace the two PDFs in <span className="mono">public/legal</span> and deploy again.</p>
    </>
  );
}
