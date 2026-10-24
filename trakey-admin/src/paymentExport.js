// Payment records export (CSV + PDF) for tax / accounting.
// No external libraries: the PDF is written directly, so `npm install` is not needed for this file.

const IST = "Asia/Kolkata";

export const PLAN_LABEL = { monthly: "Monthly", yearly: "Yearly", lifetime: "Lifetime (one-time)" };

export const tsMs = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : typeof t === "number" ? t : 0);

export const fmtDateTime = (ms) =>
  ms
    ? new Date(ms).toLocaleString("en-IN", {
        timeZone: IST, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
      })
    : "";

export const fmtDate = (ms) =>
  ms ? new Date(ms).toLocaleDateString("en-IN", { timeZone: IST, day: "2-digit", month: "short", year: "numeric" }) : "";

export const fmtAmount = (n) =>
  Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Firestore payment doc -> flat record used by both exports. */
export function toRecord(item) {
  return {
    orderId: item.id || "",
    dateMs: tsMs(item.createdAt),
    reviewedMs: tsMs(item.reviewedAt),
    name: item.name || "",
    email: item.email || "",
    uid: item.uid || "",
    plan: PLAN_LABEL[item.plan] || item.plan || "",
    currency: (item.currency || "INR").toUpperCase(),
    amount: Number(item.amount) || 0,                       // money actually received (what totals add up)
    listAmount: item.listAmount != null ? Number(item.listAmount) || 0 : Number(item.amount) || 0,   // plan price
    gift: !!item.gift,
    adjusted: !!item.amountAdjusted || (item.listAmount != null && Number(item.listAmount) !== Number(item.amount)),
    utr: item.utr || "",
    method: item.method || (item.manual ? "" : "UPI"),
    country: item.country || (item.manual ? "" : "India"),
    status: item.status || "pending",
    source: item.gift ? "Gift (free)" : item.manual ? "Manual entry" : "App (UPI)",
    note: [item.note, item.adjustReason ? "Amount changed: " + item.adjustReason : ""].filter(Boolean).join(" | "),
  };
}

/** Approved / rejected rows (as chosen) inside the date range, oldest first. from/to are "YYYY-MM-DD" in IST or "". */
export function selectRecords(items, { status = "both", from = "", to = "" } = {}) {
  const fromMs = from ? new Date(from + "T00:00:00+05:30").getTime() : -Infinity;
  const toMs = to ? new Date(to + "T23:59:59.999+05:30").getTime() : Infinity;
  return items
    .map(toRecord)
    .filter((r) => (status === "both" ? r.status === "approved" || r.status === "rejected" : r.status === status))
    .filter((r) => r.dateMs >= fromMs && r.dateMs <= toMs)
    .sort((a, b) => a.dateMs - b.dateMs);
}

/** Indian financial year (1 Apr - 31 Mar) as { from, to } date strings. offset 0 = current, 1 = previous. */
export function financialYear(offset = 0) {
  const nowIst = new Date(new Date().toLocaleString("en-US", { timeZone: IST }));
  const startYear = (nowIst.getMonth() >= 3 ? nowIst.getFullYear() : nowIst.getFullYear() - 1) - offset;
  return { from: startYear + "-04-01", to: startYear + 1 + "-03-31", label: "FY " + startYear + "-" + String(startYear + 1).slice(2) };
}

function summarize(rows) {
  const approved = {};
  const rejected = {};
  let approvedCount = 0;
  let giftCount = 0;
  const giftValue = {};
  const adjustedValue = {};
  let rejectedCount = 0;
  rows.forEach((r) => {
    if (r.status === "approved") {
      approvedCount++; approved[r.currency] = (approved[r.currency] || 0) + r.amount;
      if (r.gift) { giftCount++; giftValue[r.currency] = (giftValue[r.currency] || 0) + r.listAmount; }
      else if (r.adjusted && r.listAmount > r.amount) adjustedValue[r.currency] = (adjustedValue[r.currency] || 0) + (r.listAmount - r.amount);
    }
    if (r.status === "rejected") { rejectedCount++; rejected[r.currency] = (rejected[r.currency] || 0) + r.amount; }
  });
  return { approved, rejected, approvedCount, rejectedCount, giftCount, giftValue, adjustedValue };
}

const totalsText = (obj) => {
  const keys = Object.keys(obj);
  return keys.length ? keys.map((k) => k + " " + fmtAmount(obj[k])).join("  |  ") : "-";
};

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ------------------------------- CSV ------------------------------- */

const CSV_HEADERS = [
  "Sr No", "Payment Date (IST)", "Order ID", "Status", "Customer Name", "Customer Email", "Account ID",
  "Subscription Plan", "Currency", "Amount Received", "Plan List Price", "Free Gift / Amount Changed", "UTR / Transaction Ref", "Payment Method", "Country",
  "Reviewed On (IST)", "Reason / Note", "Record Source",
];

export const csvCell = (v) => {
  let s = v === null || v === undefined ? "" : String(v);
  // Long all-digit references (12-digit UTRs) would turn into 1.23E+11 in Excel; force them to stay text.
  if (typeof v === "string" && /^[0-9]{11,}$/.test(s)) return '"=""' + s + '"""';
  // Stop spreadsheet formula injection from user-typed text.
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export function csvFile(headers, matrix) {
  const lines = [headers.map(csvCell).join(",")];
  matrix.forEach((cells) => lines.push(cells.map(csvCell).join(",")));
  // BOM so Excel opens non-English names correctly.
  return new Blob(["\uFEFF" + lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
}

export function buildCsv(rows) {
  return csvFile(
    CSV_HEADERS,
    rows.map((r, i) => [
      i + 1, fmtDateTime(r.dateMs), r.orderId, r.status.toUpperCase(), r.name, r.email, r.uid, r.plan, r.currency,
      r.amount.toFixed(2), r.listAmount.toFixed(2), r.gift ? "Free gift" : r.adjusted ? "Amount changed" : "", r.utr, r.method, r.country, fmtDateTime(r.reviewedMs), r.note, r.source,
    ])
  );
}

/* ------------------------------- PDF ------------------------------- */

const PAGE_W = 842; // A4 landscape, points
const PAGE_H = 595;
const MARGIN = 30;
const ROW_H = 15;

const COLS = [
  { key: "sr", title: "Sr", w: 22 },
  { key: "date", title: "Date (IST)", w: 90 },
  { key: "orderId", title: "Order ID", w: 58 },
  { key: "name", title: "Name", w: 88 },
  { key: "email", title: "Email", w: 116 },
  { key: "plan", title: "Plan", w: 48 },
  { key: "amount", title: "Received", w: 58 },
  { key: "utr", title: "UTR / Ref", w: 86 },
  { key: "status", title: "Status", w: 46 },
  { key: "source", title: "Source", w: 36 },
  { key: "country", title: "Country", w: 44 },
  { key: "note", title: "Note", w: 90 },
];

const ascii = (v) =>
  String(v === null || v === undefined ? "" : v)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "?");

const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

// Helvetica is about 0.52 em wide on average; cut the text so it fits its column.
const fit = (text, width, size) => {
  const s = ascii(text);
  const max = Math.max(1, Math.floor((width - 4) / (size * 0.52)));
  return s.length <= max ? s : s.slice(0, Math.max(1, max - 2)) + "..";
};

/**
 * Generic table PDF (A4 landscape).
 * opts: { title, lines: [{ text, size, color, gap }], cols: [{ key, title, w }], rows: [{ key: text }],
 *         colorFor(row, colKey) -> pdf colour string | undefined, emptyText, footer }
 */
export function buildTablePdf(opts) {
  const { title, lines = [], cols, rows, colorFor, emptyText = "No records.", footer = "Trakey - confidential" } = opts;
  const pages = [];
  let cur = null;
  let y = 0;

  const newPage = () => {
    cur = [];
    pages.push(cur);
    y = MARGIN;
  };
  const text = (x, yTop, str, { bold = false, size = 8, color = "0 g" } = {}) => {
    cur.push(`BT ${color} /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(1)} ${(PAGE_H - yTop).toFixed(1)} Td (${esc(ascii(str))}) Tj ET`);
  };
  const rect = (x, yTop, w, h, fill) => cur.push(`${fill} ${x.toFixed(1)} ${(PAGE_H - yTop - h).toFixed(1)} ${w} ${h} re f`);
  const hline = (yTop) => cur.push(`0.75 G 0.4 w ${MARGIN} ${(PAGE_H - yTop).toFixed(1)} m ${PAGE_W - MARGIN} ${(PAGE_H - yTop).toFixed(1)} l S`);

  const drawHeaderRow = () => {
    rect(MARGIN, y, PAGE_W - 2 * MARGIN, ROW_H, "0.88 g");
    let x = MARGIN;
    cols.forEach((c) => {
      text(x + 2, y + 10.5, c.title, { bold: true, size: 7 });
      x += c.w;
    });
    y += ROW_H;
  };

  newPage();
  text(MARGIN, y + 14, title, { bold: true, size: 16 });
  y += 22;
  lines.forEach((l) => {
    const size = l.size || 8;
    text(MARGIN, y + size, l.text, { size, bold: !!l.bold, color: l.color || "0.3 g" });
    y += l.gap || size + 3;
  });
  y += 6;

  drawHeaderRow();
  if (rows.length === 0) text(MARGIN + 2, y + 11, emptyText, { size: 9 });

  rows.forEach((r) => {
    if (y + ROW_H > PAGE_H - 36) {
      newPage();
      drawHeaderRow();
    }
    let x = MARGIN;
    cols.forEach((c) => {
      text(x + 2, y + 10, fit(r[c.key], c.w, 7), { size: 7, color: (colorFor && colorFor(r, c.key)) || "0 g" });
      x += c.w;
    });
    y += ROW_H;
    hline(y);
  });

  pages.forEach((p, i) => {
    cur = p;
    text(MARGIN, PAGE_H - 18, footer, { size: 7, color: "0.5 g" });
    const label = "Page " + (i + 1) + " of " + pages.length;
    text(PAGE_W - MARGIN - label.length * 3.8, PAGE_H - 18, label, { size: 7, color: "0.5 g" });
  });

  // Assemble the PDF file (all content is plain ASCII, so string length == byte length).
  const objs = [];
  objs.push("<< /Type /Catalog /Pages 2 0 R >>");
  const kids = pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ");
  objs.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  pages.forEach((p, i) => {
    const content = p.join("\n");
    objs.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`
    );
    objs.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });

  let out = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => { out += String(off).padStart(10, "0") + " 00000 n \n"; });
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const bytes = new Uint8Array(out.length);
  for (let k = 0; k < out.length; k++) bytes[k] = out.charCodeAt(k) & 0xff;
  return new Blob([bytes], { type: "application/pdf" });
}

export function buildPdf(rows, meta = {}) {
  const sum = summarize(rows);
  const tableRows = rows.map((r, i) => ({
    sr: String(i + 1),
    date: fmtDateTime(r.dateMs),
    orderId: r.orderId,
    name: r.name || "-",
    email: r.email || "-",
    plan: r.plan.replace(" (one-time)", ""),
    amount: r.currency + " " + fmtAmount(r.amount),
    utr: r.utr || "-",
    status: r.status.toUpperCase(),
    source: r.source.startsWith("Gift") ? "Gift" : r.source.startsWith("Manual") ? "Manual" : "App",
    country: r.country || "-",
    note: r.note || "",
    _approved: r.status === "approved",
  }));
  return buildTablePdf({
    title: "Trakey - Payment Records",
    lines: [
      { text: "Generated: " + fmtDateTime(Date.now()) + " IST", gap: 11 },
      { text: "Period: " + (meta.period || "All dates") + "    Statuses: " + (meta.statusLabel || "Approved and Rejected"), gap: 18 },
      { text: "Summary", size: 10, bold: true, color: "0 g", gap: 15 },
      { text: "Approved payments: " + sum.approvedCount + "     Total received: " + totalsText(sum.approved), size: 9, color: "0.1 0.45 0.2 rg", gap: 13 },
      ...(sum.giftCount ? [{ text: "Free gifts: " + sum.giftCount + "     Plan value given free (NOT income, not in the total above): " + totalsText(sum.giftValue), size: 9, color: "0.45 0.3 0.05 rg", gap: 13 }] : []),
      ...(Object.keys(sum.adjustedValue).length ? [{ text: "Discounts / amounts changed (plan price minus received, NOT income): " + totalsText(sum.adjustedValue), size: 9, color: "0.45 0.3 0.05 rg", gap: 13 }] : []),
      { text: "Rejected payments: " + sum.rejectedCount + "     Amount not received (not income): " + totalsText(sum.rejected), size: 9, color: "0.7 0.1 0.1 rg", gap: 13 },
      { text: "Only Approved payments count, and only the amount actually received (Received column). Rejected rows are listed for record only. Source 'Manual' = added by admin. Full names, notes and Account IDs are in the CSV.", size: 7, color: "0.4 g", gap: 12 },
    ],
    cols: COLS,
    rows: tableRows,
    colorFor: (r, key) => (key === "status" ? (r._approved ? "0.1 0.45 0.2 rg" : "0.7 0.1 0.1 rg") : undefined),
    emptyText: "No payment records in this selection.",
    footer: "Trakey payment records - confidential",
  });
}
