// Small SVG charts for the dashboard overview.
// Colours come from CSS variables (--series-1…4) so light and dark themes each use
// their own validated steps. All text is set with textContent, never parsed as HTML.

const NS = "http://www.w3.org/2000/svg";
const svg = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  return el;
};
const div = (cls, text) => {
  const el = document.createElement("div");
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
};

// Compact numbers for axes: 0 / 950 / 1.2K / 34K / 1.5M
export function compact(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "K";
  return String(Math.round(n));
}

// One shared tooltip for every chart
let tip;
function tooltip() {
  if (!tip) {
    tip = div("chart-tip");
    tip.setAttribute("role", "status");
    document.body.append(tip);
  }
  return tip;
}
function showTip(x, y, rows) {
  const t = tooltip();
  t.replaceChildren(...rows.map(([value, label, color]) => {
    const row = div("chart-tip-row");
    if (color) {
      const key = div("chart-tip-key");
      key.style.background = color;
      row.append(key);
    }
    const v = document.createElement("strong");
    v.textContent = value;
    row.append(v);
    if (label) row.append(div("chart-tip-label", label));
    return row;
  }));
  t.classList.add("show");
  const w = t.offsetWidth, hgt = t.offsetHeight;
  t.style.left = Math.min(innerWidth - w - 8, Math.max(8, x - w / 2)) + "px";
  t.style.top = Math.max(8, y - hgt - 14) + "px";
}
function hideTip() {
  tip?.classList.remove("show");
}
// Hover and keyboard focus show the same details
function hoverable(el, rows) {
  el.setAttribute("tabindex", "0");
  el.addEventListener("pointermove", (e) => showTip(e.clientX, e.clientY, rows()));
  el.addEventListener("pointerleave", hideTip);
  el.addEventListener("focus", () => {
    const r = el.getBoundingClientRect();
    showTip(r.left + r.width / 2, r.top, rows());
  });
  el.addEventListener("blur", hideTip);
}

// ── Sparkline for stat cards: one series, last point marked ──
export function sparkline(values, color = "var(--series-1)") {
  const w = 120, h = 36, pad = 4;
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const x = (i) => pad + (i * (w - pad * 2)) / Math.max(values.length - 1, 1);
  const y = (v) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const s = svg("svg", { viewBox: `0 0 ${w} ${h}`, class: "sparkline", "aria-hidden": "true", preserveAspectRatio: "none" });
  s.append(
    svg("path", { d: `M${pts[0]} L${pts.join(" L")} L${x(values.length - 1)},${h} L${x(0)},${h} Z`, fill: color, opacity: "0.12" }),
    svg("polyline", { points: pts.join(" "), fill: "none", stroke: color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round", "vector-effect": "non-scaling-stroke" }),
    svg("circle", { cx: x(values.length - 1), cy: y(values[values.length - 1]), r: 3.5, fill: color, stroke: "var(--card)", "stroke-width": 2 })
  );
  return s;
}

// ── Donut: parts of a whole, with a legend that doubles as the table view ──
export function donut(parts, { centerLabel = "Total" } = {}) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const size = 168, stroke = 22, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const wrap = div("donut-wrap");
  const s = svg("svg", { viewBox: `0 0 ${size} ${size}`, class: "donut", role: "img", "aria-label": `${centerLabel}: ${total}` });
  s.append(svg("circle", { cx: size / 2, cy: size / 2, r, fill: "none", stroke: "var(--track)", "stroke-width": stroke }));
  const gap = total && parts.filter((p) => p.value).length > 1 ? 3 : 0; // surface gap between segments
  let offset = 0;
  for (const p of parts) {
    if (!p.value) continue;
    const len = (p.value / total) * c;
    const seg = svg("circle", {
      cx: size / 2, cy: size / 2, r, fill: "none", stroke: p.color, "stroke-width": stroke,
      "stroke-dasharray": `${Math.max(len - gap, 0.5)} ${c}`, "stroke-dashoffset": -offset,
      transform: `rotate(-90 ${size / 2} ${size / 2})`, class: "donut-seg",
    });
    hoverable(seg, () => [[`${p.value}`, `${p.label} · ${Math.round((p.value / total) * 100)}%`, p.color]]);
    s.append(seg);
    offset += len;
  }
  const centre = div("donut-centre");
  centre.append(div("donut-total", String(total)), div("donut-caption", centerLabel));
  const chart = div("donut-chart");
  chart.append(s, centre);

  const legend = document.createElement("ul");
  legend.className = "legend legend-table";
  for (const p of parts) {
    const li = document.createElement("li");
    const sw = div("legend-swatch");
    sw.style.background = p.color;
    li.append(sw, div("legend-label", p.label), div("legend-value", String(p.value)), div("legend-pct", total ? Math.round((p.value / total) * 100) + "%" : "0%"));
    legend.append(li);
  }
  wrap.append(chart, legend);
  return wrap;
}

// ── Columns: one measure across categories, one colour, value on each cap ──
export function columns(items, { color = "var(--series-1)" } = {}) {
  const w = 360, h = 190, top = 22, bottom = 30, barW = 24;
  const max = Math.max(...items.map((i) => i.value), 1);
  const band = w / items.length;
  const s = svg("svg", { viewBox: `0 0 ${w} ${h}`, class: "columns", role: "img", "aria-label": items.map((i) => `${i.label} ${i.value}`).join(", ") });
  const base = h - bottom;
  s.append(svg("line", { x1: 0, x2: w, y1: base + 0.5, y2: base + 0.5, class: "axis-line" }));
  items.forEach((it, i) => {
    const cx = band * i + band / 2;
    const bh = it.value ? Math.max(((base - top) * it.value) / max, 4) : 0;
    const x = cx - barW / 2, y = base - bh, rr = Math.min(4, bh);
    // Rounded data-end, square at the baseline
    const d = bh ? `M${x},${base} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + barW - rr} Q${x + barW},${y} ${x + barW},${y + rr} V${base} Z` : "";
    const hit = svg("rect", { x: cx - band / 2 + 4, y: top - 18, width: band - 8, height: base - top + 18, fill: "transparent", class: "col-hit" });
    const bar = svg("path", { d, fill: color, class: "col-bar" });
    const val = svg("text", { x: cx, y: y - 7, "text-anchor": "middle", class: "col-value" });
    val.textContent = it.value;
    const lab = svg("text", { x: cx, y: base + 19, "text-anchor": "middle", class: "col-label" });
    lab.textContent = it.short || it.label;
    const g = svg("g", { class: "col" });
    g.append(bar, val, lab, hit);
    hoverable(hit, () => [[String(it.value), it.label]]);
    hit.addEventListener("pointerenter", () => g.classList.add("hover"));
    hit.addEventListener("pointerleave", () => g.classList.remove("hover"));
    s.append(g);
  });
  return s;
}

// ── Line over time: one series, crosshair tooltip, end value labelled ──
export function lineChart(points, { color = "var(--series-1)", format = String } = {}) {
  const w = 420, h = 200, left = 40, right = 14, top = 16, bottom = 28;
  const max = Math.max(...points.map((p) => p.value), 1);
  const step = niceStep(max / 3);
  const yMax = step * Math.ceil(max / step);
  const x = (i) => left + (i * (w - left - right)) / Math.max(points.length - 1, 1);
  const y = (v) => top + (1 - v / yMax) * (h - top - bottom);
  const s = svg("svg", { viewBox: `0 0 ${w} ${h}`, class: "line-chart", role: "img", "aria-label": points.map((p) => `${p.label} ${format(p.value)}`).join(", ") });
  for (let v = 0; v <= yMax + 1e-9; v += step) {
    s.append(svg("line", { x1: left, x2: w - right, y1: y(v), y2: y(v), class: v === 0 ? "axis-line" : "grid-line" }));
    const t = svg("text", { x: left - 8, y: y(v) + 4, "text-anchor": "end", class: "tick" });
    t.textContent = compact(v);
    s.append(t);
  }
  points.forEach((p, i) => {
    const t = svg("text", { x: x(i), y: h - 8, "text-anchor": "middle", class: "tick" });
    t.textContent = p.label;
    s.append(t);
  });
  const pts = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`);
  s.append(
    svg("path", { d: `M${pts[0]} L${pts.join(" L")} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`, fill: color, opacity: "0.1" }),
    svg("polyline", { points: pts.join(" "), fill: "none", stroke: color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" })
  );
  const last = points.length - 1;
  s.append(svg("circle", { cx: x(last), cy: y(points[last].value), r: 4.5, fill: color, stroke: "var(--card)", "stroke-width": 2 }));
  const endLabel = svg("text", { x: x(last) - 8, y: y(points[last].value) - 10, "text-anchor": "end", class: "end-label" });
  endLabel.textContent = format(points[last].value);
  s.append(endLabel);

  // Crosshair: snaps to the nearest month
  const cross = svg("line", { y1: top, y2: y(0), class: "crosshair", visibility: "hidden" });
  const dot = svg("circle", { r: 4.5, fill: color, stroke: "var(--card)", "stroke-width": 2, visibility: "hidden" });
  const hit = svg("rect", { x: left, y: top, width: w - left - right, height: y(0) - top, fill: "transparent", tabindex: 0, class: "line-hit" });
  let focusIndex = last;
  const show = (i, cx, cy) => {
    const px = x(i);
    cross.setAttribute("x1", px); cross.setAttribute("x2", px); cross.setAttribute("visibility", "visible");
    dot.setAttribute("cx", px); dot.setAttribute("cy", y(points[i].value)); dot.setAttribute("visibility", "visible");
    showTip(cx, cy, [[format(points[i].value), points[i].label, color]]);
  };
  const hide = () => { cross.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); hideTip(); };
  hit.addEventListener("pointermove", (e) => {
    const r = s.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * w;
    const i = Math.max(0, Math.min(last, Math.round(((sx - left) / (w - left - right)) * last)));
    show(i, e.clientX, r.top + (y(points[i].value) / h) * r.height);
  });
  hit.addEventListener("pointerleave", hide);
  const focusShow = () => {
    const r = s.getBoundingClientRect();
    show(focusIndex, r.left + (x(focusIndex) / w) * r.width, r.top + (y(points[focusIndex].value) / h) * r.height);
  };
  hit.addEventListener("focus", focusShow);
  hit.addEventListener("blur", hide);
  hit.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { focusIndex = Math.max(0, focusIndex - 1); focusShow(); }
    if (e.key === "ArrowRight") { focusIndex = Math.min(last, focusIndex + 1); focusShow(); }
  });
  s.append(cross, dot, hit);
  return s;
}

function niceStep(raw) {
  if (raw <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

// A plain table of the same numbers, for reading without the chart
export function dataTable(rows, headers) {
  const t = document.createElement("table");
  t.className = "chart-table";
  const thead = document.createElement("thead");
  if (headers.some(Boolean)) {
    const hr = document.createElement("tr");
    headers.forEach((hd) => { const th = document.createElement("th"); th.textContent = hd; hr.append(th); });
    thead.append(hr);
  }
  const tbody = document.createElement("tbody");
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    r.forEach((c) => { const td = document.createElement("td"); td.textContent = c; tr.append(td); });
    tbody.append(tr);
  });
  t.append(thead, tbody);
  return t;
}
