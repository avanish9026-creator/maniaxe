// One person's data as a readable PDF (A4 portrait). Dependency-free, same approach as paymentExport.js.
// Text is plain Latin (Helvetica); other scripts are shown as "?" just like the other PDF exports.
import { fmtDateTime } from "./paymentExport";

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 40;
const BODY_W = PAGE_W - 2 * MARGIN;

const ascii = (v) =>
  String(v === null || v === undefined ? "" : v)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\r\t]/g, " ")
    .replace(/[^\x20-\x7e\n]/g, "?");
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

// Helvetica averages about 0.5 em per character; 0.53 keeps a little safety margin.
const wrap = (text, width, size) => {
  const max = Math.max(8, Math.floor(width / (size * 0.53)));
  const out = [];
  ascii(text).split("\n").forEach((para) => {
    let line = "";
    para.split(" ").forEach((word) => {
      let w = word;
      while (w.length > max) { // very long words (ids, links) are cut
        if (line) { out.push(line); line = ""; }
        out.push(w.slice(0, max)); w = w.slice(max);
      }
      if (!line) line = w;
      else if ((line + " " + w).length <= max) line += " " + w;
      else { out.push(line); line = w; }
    });
    out.push(line);
  });
  return out;
};

/**
 * sections: [{ heading, kv: [[label, value]], items: [{ head, meta, body }], note }]
 */
export function buildPersonPdf({ title, subtitle, sections }) {
  const pages = [];
  let cur = null;
  let y = 0;
  const newPage = () => { cur = []; pages.push(cur); y = MARGIN; };
  const text = (x, yTop, str, { bold = false, size = 9, color = "0 g" } = {}) =>
    cur.push(`BT ${color} /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(1)} ${(PAGE_H - yTop).toFixed(1)} Td (${esc(ascii(str))}) Tj ET`);
  const rect = (x, yTop, w, h, fill) => cur.push(`${fill} ${x.toFixed(1)} ${(PAGE_H - yTop - h).toFixed(1)} ${w} ${h} re f`);
  const hline = (yTop) => cur.push(`0.82 G 0.4 w ${MARGIN} ${(PAGE_H - yTop).toFixed(1)} m ${PAGE_W - MARGIN} ${(PAGE_H - yTop).toFixed(1)} l S`);
  const room = (h) => { if (y + h > PAGE_H - 44) newPage(); };

  newPage();
  text(MARGIN, y + 18, title, { bold: true, size: 20 });
  y += 28;
  wrap(subtitle, BODY_W, 9).forEach((l) => { text(MARGIN, y + 9, l, { size: 9, color: "0.35 g" }); y += 12; });
  y += 8;

  sections.forEach((s) => {
    room(60);
    rect(MARGIN, y, BODY_W, 20, "0.92 g");
    text(MARGIN + 8, y + 14, s.heading, { bold: true, size: 11 });
    y += 28;

    (s.kv || []).forEach(([k, v]) => {
      const lines = wrap(v === "" || v === null || v === undefined ? "-" : v, BODY_W - 150, 9);
      room(lines.length * 12 + 4);
      text(MARGIN + 8, y + 9, k, { size: 9, color: "0.4 g" });
      lines.forEach((l) => { text(MARGIN + 150, y + 9, l, { size: 9 }); y += 12; });
      y += 3;
    });

    (s.items || []).forEach((it) => {
      const body = it.body ? wrap(it.body, BODY_W - 16, 9) : [];
      room(16 + body.length * 12 + 10);
      text(MARGIN + 8, y + 10, it.head, { bold: true, size: 9.5 });
      if (it.meta) {
        const m = ascii(it.meta);
        text(PAGE_W - MARGIN - 8 - m.length * 4.7, y + 10, m, { size: 8.5, color: "0.4 g" });
      }
      y += 15;
      body.forEach((l) => {
        if (y + 12 > PAGE_H - 44) newPage();
        text(MARGIN + 8, y + 9, l, { size: 9, color: "0.15 g" });
        y += 12;
      });
      y += 4;
      hline(y);
      y += 6;
    });

    if (s.note) { room(16); text(MARGIN + 8, y + 9, s.note, { size: 9, color: "0.5 g" }); y += 16; }
    y += 8;
  });

  const stamp = "Generated " + fmtDateTime(Date.now()) + " IST";
  pages.forEach((p, i) => {
    cur = p;
    text(MARGIN, PAGE_H - 22, "Trakey user data - confidential. " + stamp, { size: 7.5, color: "0.5 g" });
    const label = "Page " + (i + 1) + " of " + pages.length;
    text(PAGE_W - MARGIN - label.length * 4, PAGE_H - 22, label, { size: 7.5, color: "0.5 g" });
  });

  // Assemble the PDF (content is plain ASCII, so string length equals byte length).
  const objs = [];
  objs.push("<< /Type /Catalog /Pages 2 0 R >>");
  objs.push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  pages.forEach((p, i) => {
    const content = p.join("\n");
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`);
    objs.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  let out = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => { out += String(off).padStart(10, "0") + " 00000 n \n"; });
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(out.length);
  for (let k = 0; k < out.length; k++) bytes[k] = out.charCodeAt(k) & 0xff;
  return new Blob([bytes], { type: "application/pdf" });
}
