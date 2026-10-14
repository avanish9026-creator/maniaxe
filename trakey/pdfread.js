// Trakey Web: reads PDFs in the browser (pdf.js from a CDN, loaded only when a PDF is used).
// Used by the question importer (qimport.js) and Scan with AI (scan.js).

const VER = "3.11.174";
const BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${VER}/`;
let lib = null;

export async function loadPdfJs() {
  if (lib) return lib;
  if (!window.pdfjsLib) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = BASE + "pdf.min.js";
      s.onload = res;
      s.onerror = () => rej(new Error("The PDF reader could not be loaded. Check your connection and try again."));
      document.head.appendChild(s);
    });
  }
  const pdfjs = window.pdfjsLib;
  // A worker from another origin cannot be started directly, so it is fetched and started from a blob.
  try {
    const r = await fetch(BASE + "pdf.worker.min.js");
    if (!r.ok) throw new Error("worker");
    const blob = new Blob([await r.text()], { type: "text/javascript" });
    pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
  } catch {
    pdfjs.GlobalWorkerOptions.workerSrc = BASE + "pdf.worker.min.js";
  }
  lib = pdfjs;
  return lib;
}

export async function openPdf(file) {
  const pdfjs = await loadPdfJs();
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

/** Text of one page rebuilt line by line (items on the same baseline are joined left to right). */
export async function pageLines(page) {
  const tc = await page.getTextContent();
  const rows = [];
  for (const it of tc.items) {
    if (!it.str || !it.str.trim()) continue;
    const x = it.transform[4], y = it.transform[5];
    let row = rows.find((r) => Math.abs(r.y - y) <= 2.5);
    if (!row) { row = { y, items: [] }; rows.push(row); }
    row.items.push({ x, w: it.width || 0, s: it.str });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => {
    r.items.sort((a, b) => a.x - b.x);
    let out = "", end = null;
    for (const it of r.items) {
      if (end !== null && it.x - end > 1.5 && !out.endsWith(" ") && !it.s.startsWith(" ")) out += " ";
      out += it.s;
      end = it.x + it.w;
    }
    return out.replace(/\s+/g, " ").trim();
  }).filter(Boolean);
}

/** One page drawn to a white JPEG, longest side = maxEdge. Returns base64 (no prefix). */
export async function renderPageJpeg(page, maxEdge = 1800) {
  const v0 = page.getViewport({ scale: 1 });
  const scale = maxEdge / Math.max(v0.width, v0.height);
  const vp = page.getViewport({ scale });
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.floor(vp.width));
  c.height = Math.max(1, Math.floor(vp.height));
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return c.toDataURL("image/jpeg", 0.85).split(",")[1];
}
