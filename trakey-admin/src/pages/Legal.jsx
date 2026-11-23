const DOCS = [
  ["Terms and Conditions", "Effective November 15, 2026", "legal/Trakey-Terms-and-Conditions.pdf", "Trakey-Terms-and-Conditions.pdf"],
  ["Privacy Policy", "Effective November 15, 2026", "legal/Trakey-Privacy-Policy.pdf", "Trakey-Privacy-Policy.pdf"],
];
const base = import.meta.env.BASE_URL;
export default function Legal() {
  return (
    <div className="grid cols-2">
      {DOCS.map(([title, hint, path, file]) => (
        <section key={title} className="card stack">
          <div><h2>{title}</h2><span className="muted small">{hint}</span></div>
          <div className="row">
            <a href={base + path} download={file}><button className="primary">Download PDF</button></a>
            <a href={base + path} target="_blank" rel="noreferrer"><button>Open</button></a>
          </div>
        </section>
      ))}
      <p className="muted small">To update a document, replace the PDF in <span className="mono">public/legal/</span> and deploy again.</p>
    </div>
  );
}
