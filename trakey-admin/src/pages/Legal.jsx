import { Button, Card, Icon, PageHead, useBusy } from "../lib/ui";

const LIVE_BASE = "https://maniaxe.in/trakey/";
const DOCS = [
  { k: "terms", t: "Terms and Conditions", live: LIVE_BASE + "terms.html", f: "Trakey-Terms-and-Conditions.pdf" },
  { k: "privacy", t: "Privacy Policy", live: LIVE_BASE + "privacy-policy.html", f: "Trakey-Privacy-Policy.pdf" },
];

const pdfPath = (d) => import.meta.env.BASE_URL + "legal/" + d.f;

export default function Legal() {
  const [busy, run] = useBusy();
  const download = (d) => run(d.k, async () => {
    const r = await fetch(pdfPath(d));
    if (!r.ok) throw new Error("The file could not be loaded (" + r.status + ").");
    const href = URL.createObjectURL(new Blob([await r.blob()], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = href; a.download = d.f; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 2000);
  });
  return (
    <>
      <PageHead title="Legal documents" subtitle="View the live pages, or view and download the saved PDF copies." />
      <div className="cols-2">
        {DOCS.map((d) => (
          <Card key={d.k}>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <span className="tl-ic accent" style={{ width: 44, height: 44, borderRadius: 14 }}><Icon name="file" size={20} /></span>
              <div className="grow"><h3 style={{ fontSize: 16 }}>{d.t}</h3><p className="small muted" style={{ overflowWrap: "anywhere" }}>Live page: {d.live.replace("https://", "")}</p></div>
            </div>
            <div className="row" style={{ marginTop: 14 }}>
              <a className="btn btn-soft btn-md" href={d.live} target="_blank" rel="noopener noreferrer"><Icon name="link" size={17} /><span>Live</span></a>
              <a className="btn btn-default btn-md" href={pdfPath(d)} target="_blank" rel="noopener noreferrer"><Icon name="file" size={17} /><span>View PDF</span></a>
              <Button variant="primary" icon="download" disabled={busy === d.k} onClick={() => download(d)}>{busy === d.k ? "Preparing…" : "Download PDF"}</Button>
            </div>
          </Card>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 18 }}><b>Live</b> opens the page people see on the website, so it is always the latest text. <b>View PDF</b> and <b>Download PDF</b> use the saved copies. If the Terms or Privacy Policy change on the website, replace the two PDFs in <span className="mono">public/legal</span> and deploy again.</p>
    </>
  );
}
