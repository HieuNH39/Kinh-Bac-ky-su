// Sơ đồ tham quan kiểu bản đồ du lịch: vẽ SVG từ `plan` trong data/sites/<id>.json
// (tools/so_do.py biên dịch từ content/sodo/<id>.yaml). Có chú giải, sao đánh số theo
// thứ tự nghe, lộ trình gợi ý, la bàn, thước tỉ lệ, chấm "Bạn đang ở đây" khi sơ đồ đã
// khớp GPS, tải ảnh PNG và phần khảo sát để học sinh ghi tọa độ thật của từng điểm dừng.
import { esc, t, L, icon, toast, download } from "./ui.js";
import { Geo, store, settings } from "./core.js";

const KY = 110574;
const R2 = (n) => Math.round(n * 100) / 100;
const pts = (a) => a.map(([x, y]) => `${R2(x)},${R2(y)}`).join(" ");
const U = (plan) => Math.max(plan.vb[2], plan.vb[3]) / 100;     // đơn vị ký hiệu: 1% cạnh lớn
const nm = (n) => (n ? L(n) : "");

// Bảng màu lấy từ tranh Đông Hồ, dịu đi cho nền bản đồ
const C = {
  giay: "#f4ecdb", vien: "#d9c8a6", muc: "#3d342b", mucNhat: "#6e655b",
  ngoi: "#b4553b", ngoiDam: "#6e2a1b", ngoiSang: "#cf7a5c", moi: "#8d98a3", moiDam: "#56606a",
  dan: "#e3d3b8", danVien: "#c4ad88", nuoc: "#c3dae2", nuocVien: "#86aebf", nuocChu: "#3f6f84",
  co: "#dfe9cc", rung: "#cbdcae", ruong: "#e7eecd", doi: "#d6dfb6", doiVien: "#a7b884", san: "#efe3c7", sanVien: "#d7c49d",
  lang: "#ece0c9", dat: "#e3cfa6", cay: "#86ad72", cayDam: "#5d8a4c", son: "#b93a26", cham: "#2e6e52", chamXanh: "#2d4c7a", hoe: "#e0a52a",
};

// ---------- hình học ----------
function obb(p) {   // trục chính của đa giác (PCA) để vẽ đường nóc mái
  const n = p.length, cx = p.reduce((s, q) => s + q[0], 0) / n, cy = p.reduce((s, q) => s + q[1], 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  p.forEach(([x, y]) => { sxx += (x - cx) ** 2; syy += (y - cy) ** 2; sxy += (x - cx) * (y - cy); });
  const a = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(a), uy = Math.sin(a);
  let lo = Infinity, hi = -Infinity, lo2 = Infinity, hi2 = -Infinity;
  p.forEach(([x, y]) => { const s = (x - cx) * ux + (y - cy) * uy, s2 = -(x - cx) * uy + (y - cy) * ux; lo = Math.min(lo, s); hi = Math.max(hi, s); lo2 = Math.min(lo2, s2); hi2 = Math.max(hi2, s2); });
  const mid = (lo + hi) / 2, mid2 = (lo2 + hi2) / 2;
  return { cx: cx + mid * ux - mid2 * uy, cy: cy + mid * uy + mid2 * ux, L: hi - lo, W: hi2 - lo2, ux, uy };
}
const centroid = (p) => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
const shrink = (p, k) => { const [cx, cy] = centroid(p); return p.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]); };
function smooth(p) {   // đường cong mềm đi qua các điểm (Catmull-Rom -> Bézier)
  if (p.length < 3) return `M${pts(p).replace(" ", " L")}`;
  let d = `M${R2(p[0][0])},${R2(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || c;
    d += ` C${R2(b[0] + (c[0] - a[0]) / 6)},${R2(b[1] + (c[1] - a[1]) / 6)} ${R2(c[0] - (e[0] - b[0]) / 6)},${R2(c[1] - (e[1] - b[1]) / 6)} ${R2(c[0])},${R2(c[1])}`;
  }
  return d;
}

// ---------- tham chiếu GPS ----------
export function geoToPlan(plan, lat, lng) {
  const g = plan.georef; if (!g) return null;
  const kx = 111320 * Math.cos((g.lat0 * Math.PI) / 180);
  let u = (lng - g.lng0) * kx, v = -(lat - g.lat0) * KY;
  const [a, b, tx, ty] = g.m, d = a * a + b * b; u -= tx; v -= ty;
  return [(a * u + b * v) / d, (-b * u + a * v) / d];
}
const metersPerUnit = (plan) => (plan.georef ? Math.hypot(plan.georef.m[0], plan.georef.m[1]) : null);

// ---------- các lớp ----------
function defs(id, u) {
  return `<defs>
    <pattern id="${id}-song" width="${R2(u * 6)}" height="${R2(u * 3)}" patternUnits="userSpaceOnUse"><path d="M0,${R2(u * 1.6)} q${R2(u * 1.5)},-${R2(u * 1)} ${R2(u * 3)},0 t${R2(u * 3)},0" fill="none" stroke="${C.nuocVien}" stroke-width="${R2(u * 0.18)}" opacity=".55"/></pattern>
    <pattern id="${id}-ruong" width="${R2(u * 2.2)}" height="${R2(u * 2.2)}" patternUnits="userSpaceOnUse"><path d="M0,${R2(u * 1.1)} h${R2(u * 2.2)}" stroke="#b9c98f" stroke-width="${R2(u * 0.16)}"/></pattern>
    <pattern id="${id}-rung" width="${R2(u * 4)}" height="${R2(u * 4)}" patternUnits="userSpaceOnUse"><circle cx="${R2(u)}" cy="${R2(u)}" r="${R2(u * 0.75)}" fill="${C.cay}" opacity=".55"/><circle cx="${R2(u * 3)}" cy="${R2(u * 3)}" r="${R2(u * 0.75)}" fill="${C.cay}" opacity=".55"/></pattern>
    <pattern id="${id}-san" width="${R2(u * 1.6)}" height="${R2(u * 1.6)}" patternUnits="userSpaceOnUse"><path d="M${R2(u * 1.6)},0 V${R2(u * 1.6)} H0" fill="none" stroke="${C.sanVien}" stroke-width="${R2(u * 0.08)}" opacity=".7"/></pattern>
    <pattern id="${id}-dat" width="${R2(u * 1.6)}" height="${R2(u * 1.6)}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0,0 V${R2(u * 1.6)}" stroke="#c4a777" stroke-width="${R2(u * 0.16)}"/></pattern>
    <marker id="${id}-mui" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="${R2(u * 1.5)}" markerHeight="${R2(u * 1.5)}" markerUnits="userSpaceOnUse" orient="auto"><path d="M1,1 L9,5 L1,9 L3.5,5 Z" fill="${C.son}"/></marker>
  </defs>`;
}

function area(e, id, u) {
  const P = pts(e.p);
  switch (e.k) {
    case "nuoc": return `<polygon points="${P}" fill="${C.nuoc}" stroke="${C.nuocVien}" stroke-width="${R2(u * 0.25)}"/><polygon points="${P}" fill="url(#${id}-song)"/>`;
    case "co": return `<polygon points="${P}" fill="${C.co}"/>`;
    case "rung": return `<polygon points="${P}" fill="${C.rung}"/><polygon points="${P}" fill="url(#${id}-rung)"/>`;
    case "ruong": return `<polygon points="${P}" fill="${C.ruong}"/><polygon points="${P}" fill="url(#${id}-ruong)"/>`;
    case "san": return `<polygon points="${P}" fill="${C.san}" stroke="${C.sanVien}" stroke-width="${R2(u * 0.2)}"/><polygon points="${P}" fill="url(#${id}-san)"/>`;
    case "lang": return `<polygon points="${P}" fill="${C.lang}" stroke="${C.danVien}" stroke-width="${R2(u * 0.15)}" stroke-dasharray="${R2(u * 0.8)} ${R2(u * 0.6)}"/>`;
    case "dat": return `<polygon points="${P}" fill="${C.dat}"/><polygon points="${P}" fill="url(#${id}-dat)" opacity=".6"/>`;
    case "doi": return `<polygon points="${P}" fill="${C.doi}" stroke="${C.doiVien}" stroke-width="${R2(u * 0.2)}"/>`
      + [0.68, 0.38].map((k) => `<polygon points="${pts(shrink(e.p, k))}" fill="none" stroke="${C.doiVien}" stroke-width="${R2(u * 0.18)}" opacity=".8"/>`).join("");
    default: return `<polygon points="${P}" fill="${C.co}"/>`;
  }
}

function line(e, u) {
  const P = pts(e.p), w = e.w ?? { duong: 1.6, loi: 0.5, de: 2.2, song: 5, tuong: 0.55, thanh: 2.4, bac: 1.8 }[e.k] * u;
  const cap = `fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  switch (e.k) {
    case "song": return `<polyline points="${P}" ${cap} stroke="${C.nuocVien}" stroke-width="${R2(w + u * 0.5)}"/><polyline points="${P}" ${cap} stroke="${C.nuoc}" stroke-width="${R2(w)}"/>`;
    case "duong": return `<polyline points="${P}" ${cap} stroke="#cdbd9c" stroke-width="${R2(w + u * 0.45)}"/><polyline points="${P}" ${cap} stroke="#fffaf0" stroke-width="${R2(w)}"/>`;
    case "de": return `<polyline points="${P}" ${cap} stroke="#b59e74" stroke-width="${R2(w + u * 0.7)}"/><polyline points="${P}" ${cap} stroke="#f5ecd6" stroke-width="${R2(w)}"/>`;
    case "loi": return `<polyline points="${P}" ${cap} stroke="#a88e68" stroke-width="${R2(w)}" stroke-dasharray="${R2(u * 1.1)} ${R2(u * 0.8)}"/>`;
    case "tuong": return `<polyline points="${P}" ${cap} stroke="#8e7a5f" stroke-width="${R2(w)}"/>`;
    case "thanh": return `<polyline points="${P}" ${cap} stroke="#9c7f55" stroke-width="${R2(w + u * 0.5)}"/><polyline points="${P}" ${cap} stroke="#d8bf8c" stroke-width="${R2(w)}"/>`;
    case "bac": return `<polyline points="${P}" fill="none" stroke="#9b8a70" stroke-width="${R2(w)}" stroke-dasharray="${R2(u * 0.22)} ${R2(u * 0.32)}"/>`;
    default: return `<polyline points="${P}" ${cap} stroke="#cdbd9c" stroke-width="${R2(w)}"/>`;
  }
}

const ROOF = { dinh: 1, den: 1, chua: 1, nha: 1, cong: 1, gac: 1, bia: 1, moi: 2, lo: 3 };
function bld(e, u) {
  const sh = R2(u * 0.4);
  if (e.p) {   // đa giác (thường từ OSM)
    const P = pts(e.p);
    if (!e.hl || e.k === "dan") return `<polygon points="${P}" fill="${C.dan}" stroke="${C.danVien}" stroke-width="${R2(u * 0.12)}"/>`;
    const o = obb(e.p), r = Math.max(0, (o.L - o.W) / 2);
    const col = e.k === "moi" ? [C.moi, C.moiDam] : [C.ngoi, C.ngoiDam];
    return `<g><polygon points="${P}" transform="translate(${sh},${sh})" fill="#3b2a1a" opacity=".22"/><polygon points="${P}" fill="${col[0]}" stroke="${col[1]}" stroke-width="${R2(u * 0.18)}"/>
      ${r > 0 ? `<path d="M${R2(o.cx - o.ux * r)},${R2(o.cy - o.uy * r)} L${R2(o.cx + o.ux * r)},${R2(o.cy + o.uy * r)}" stroke="${col[1]}" stroke-width="${R2(u * 0.3)}" stroke-linecap="round"/>` : ""}</g>`;
  }
  const [cx, cy, w, h, rot] = e.r, hw = w / 2, hh = h / 2;
  const g = (inner) => `<g transform="translate(${R2(cx)},${R2(cy)}) rotate(${rot || 0})">${inner}</g>`;
  const shadow = `<rect x="${R2(-hw + u * 0.4)}" y="${R2(-hh + u * 0.5)}" width="${R2(w)}" height="${R2(h)}" fill="#3b2a1a" opacity=".22" rx="${R2(u * 0.2)}"/>`;
  if (e.k === "dan") return g(`<rect x="${R2(-hw)}" y="${R2(-hh)}" width="${R2(w)}" height="${R2(h)}" fill="${C.dan}" stroke="${C.danVien}" stroke-width="${R2(u * 0.12)}"/>`);
  if (e.k === "thap") {   // tháp: các tầng thu nhỏ dần nhìn từ trên xuống
    return g(shadow + [1, 0.72, 0.46, 0.22].map((k, i) => `<rect x="${R2(-hw * k)}" y="${R2(-hh * k)}" width="${R2(w * k)}" height="${R2(h * k)}" fill="${i % 2 ? "#cf8c56" : "#b56b3a"}" stroke="#6e3a1c" stroke-width="${R2(u * 0.14)}"/>`).join(""));
  }
  if (e.k === "lang" || e.k === "mo") {
    const r = Math.min(hw, hh);
    return g(`<ellipse cx="${R2(u * 0.35)}" cy="${R2(u * 0.45)}" rx="${R2(hw)}" ry="${R2(hh)}" fill="#3b2a1a" opacity=".2"/><ellipse rx="${R2(hw)}" ry="${R2(hh)}" fill="#c9c0ad" stroke="#7d7464" stroke-width="${R2(u * 0.2)}"/><ellipse rx="${R2(hw * 0.6)}" ry="${R2(hh * 0.6)}" fill="#b3a993" stroke="#7d7464" stroke-width="${R2(u * 0.12)}"/>${r > u * 2 ? `<rect x="${R2(-u * 0.5)}" y="${R2(-hh * 0.6 - u * 1.2)}" width="${R2(u)}" height="${R2(u * 1.3)}" fill="#7d7464"/>` : ""}`);
  }
  const col = ROOF[e.k] === 2 ? [C.moi, C.moiDam, "#a9b2bb"] : ROOF[e.k] === 3 ? ["#b9703f", "#6e3a1c", "#d08c5a"] : [C.ngoi, C.ngoiDam, C.ngoiSang];
  const ridgeH = w >= h;   // nóc mái chạy theo cạnh dài
  const r = Math.abs(hw - hh);
  const ridge = ridgeH ? [[-r, 0], [r, 0]] : [[0, -r], [0, r]];
  const hips = ridgeH ? `M${R2(-hw)},${R2(-hh)} L${R2(-r)},0 L${R2(-hw)},${R2(hh)} M${R2(hw)},${R2(-hh)} L${R2(r)},0 L${R2(hw)},${R2(hh)}`
    : `M${R2(-hw)},${R2(-hh)} L0,${R2(-r)} L${R2(hw)},${R2(-hh)} M${R2(-hw)},${R2(hh)} L0,${R2(r)} L${R2(hw)},${R2(hh)}`;
  // nửa mái phía trước sáng hơn cho có khối
  const front = ridgeH ? `M${R2(-hw)},${R2(hh)} L${R2(-r)},0 L${R2(r)},0 L${R2(hw)},${R2(hh)} Z` : `M${R2(hw)},${R2(-hh)} L0,${R2(-r)} L0,${R2(r)} L${R2(hw)},${R2(hh)} Z`;
  const curl = e.k === "dinh" || e.k === "den" || e.k === "chua" || e.k === "gac"   // đầu đao
    ? [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => `<circle cx="${R2(sx * (hw + u * 0.2))}" cy="${R2(sy * (hh + u * 0.2))}" r="${R2(u * 0.38)}" fill="none" stroke="${col[1]}" stroke-width="${R2(u * 0.16)}"/>`).join("") : "";
  const extra = e.k === "gac" ? `<path d="M${R2(-hw * 0.5)},${R2(-hh * 0.5)} L${R2(hw * 0.5)},${R2(hh * 0.5)} M${R2(hw * 0.5)},${R2(-hh * 0.5)} L${R2(-hw * 0.5)},${R2(hh * 0.5)}" stroke="${col[1]}" stroke-width="${R2(u * 0.14)}"/>`
    : e.k === "cong" ? `<rect x="${R2(-u * 0.9)}" y="${R2(hh - u * 0.2)}" width="${R2(u * 1.8)}" height="${R2(u * 0.5)}" fill="${C.muc}"/>`
      : e.k === "bia" ? `<rect x="${R2(-u * 0.35)}" y="${R2(-u * 0.6)}" width="${R2(u * 0.7)}" height="${R2(u * 1.2)}" fill="#5c5a55"/>`
        : e.k === "lo" ? `<circle r="${R2(Math.min(hw, hh) * 0.35)}" fill="#3b2a1a" opacity=".7"/>` : "";
  return g(shadow + `<rect x="${R2(-hw)}" y="${R2(-hh)}" width="${R2(w)}" height="${R2(h)}" fill="${col[0]}" stroke="${col[1]}" stroke-width="${R2(u * 0.2)}" rx="${R2(u * 0.15)}"/>
    <path d="${front}" fill="${col[2]}" opacity=".35"/><path d="${hips}" fill="none" stroke="${col[1]}" stroke-width="${R2(u * 0.14)}" opacity=".8"/>
    <path d="M${R2(ridge[0][0])},${R2(ridge[0][1])} L${R2(ridge[1][0])},${R2(ridge[1][1])}" stroke="${col[1]}" stroke-width="${R2(u * 0.36)}" stroke-linecap="round"/>${curl}${extra}`);
}

function sym(e, u) {
  const s = (e.s || 1) * u;
  return e.p.map(([x, y]) => {
    const g = (inner) => `<g transform="translate(${R2(x)},${R2(y)})">${inner}</g>`;
    switch (e.k) {
      case "cay": return g(`<circle cx="${R2(s * 0.3)}" cy="${R2(s * 0.4)}" r="${R2(s * 1.3)}" fill="#3b2a1a" opacity=".15"/><circle r="${R2(s * 1.25)}" fill="${C.cay}" stroke="${C.cayDam}" stroke-width="${R2(s * 0.14)}"/><circle cx="${R2(-s * 0.35)}" cy="${R2(-s * 0.35)}" r="${R2(s * 0.5)}" fill="#a6c48f"/>`);
      case "cay-lon": return g(`<circle cx="${R2(s * 0.5)}" cy="${R2(s * 0.6)}" r="${R2(s * 2.8)}" fill="#3b2a1a" opacity=".15"/>` + [[0, 0, 2.6], [-1.2, -0.9, 1.4], [1.2, -0.6, 1.3], [0.2, 1.1, 1.3]].map(([dx, dy, r], i) => `<circle cx="${R2(dx * s)}" cy="${R2(dy * s)}" r="${R2(r * s)}" fill="${i ? "#7aa565" : C.cay}" stroke="${C.cayDam}" stroke-width="${R2(s * 0.14)}"/>`).join(""));
      case "tuong": return g(`<rect x="${R2(-s * 0.9)}" y="${R2(-s * 0.9)}" width="${R2(s * 1.8)}" height="${R2(s * 1.8)}" fill="#d9d1c0" stroke="#7d7464" stroke-width="${R2(s * 0.15)}"/><circle r="${R2(s * 0.55)}" fill="#5c5a55"/>`);
      case "gieng": return g(`<circle r="${R2(s * 1.1)}" fill="${C.nuoc}" stroke="#7d7464" stroke-width="${R2(s * 0.35)}"/>`);
      case "bia": return g(`<rect x="${R2(-s * 0.5)}" y="${R2(-s * 0.9)}" width="${R2(s)}" height="${R2(s * 1.6)}" rx="${R2(s * 0.4)}" fill="#8a857c" stroke="#4d4a44" stroke-width="${R2(s * 0.12)}"/>`);
      case "cot": return g(`<circle r="${R2(s * 0.8)}" fill="#9a958b" stroke="#4d4a44" stroke-width="${R2(s * 0.15)}"/><circle r="${R2(s * 0.3)}" fill="#4d4a44"/>`);
      case "thap": return g(`<rect x="${R2(-s * 0.7)}" y="${R2(-s * 0.7)}" width="${R2(s * 1.4)}" height="${R2(s * 1.4)}" fill="#b56b3a" stroke="#6e3a1c" stroke-width="${R2(s * 0.12)}"/><rect x="${R2(-s * 0.32)}" y="${R2(-s * 0.32)}" width="${R2(s * 0.64)}" height="${R2(s * 0.64)}" fill="#cf8c56"/>`);
      case "mo": return g(`<ellipse rx="${R2(s * 0.9)}" ry="${R2(s * 0.65)}" fill="#c9c0ad" stroke="#7d7464" stroke-width="${R2(s * 0.12)}"/>`);
      case "lo": return g(`<path d="M${R2(-s)},${R2(s * 0.6)} Q${R2(-s)},${R2(-s * 0.9)} 0,${R2(-s * 0.9)} Q${R2(s)},${R2(-s * 0.9)} ${R2(s)},${R2(s * 0.6)} Z" fill="#b9703f" stroke="#6e3a1c" stroke-width="${R2(s * 0.14)}"/><rect x="${R2(s * 0.35)}" y="${R2(-s * 1.6)}" width="${R2(s * 0.4)}" height="${R2(s * 0.9)}" fill="#6e3a1c"/>`);
      case "xe": case "wc": return g(`<rect x="${R2(-s * 1.1)}" y="${R2(-s * 1.1)}" width="${R2(s * 2.2)}" height="${R2(s * 2.2)}" rx="${R2(s * 0.4)}" fill="${C.chamXanh}"/><text y="${R2(s * 0.55)}" text-anchor="middle" font-size="${R2(s * (e.k === "xe" ? 1.6 : 1))}" font-weight="700" fill="#fff" font-family="Be Vietnam Pro, Arial, sans-serif">${e.k === "xe" ? "P" : "WC"}</text>`);
      case "thuyen": return g(`<path d="M${R2(-s * 1.6)},0 Q0,${R2(s * 1.2)} ${R2(s * 1.6)},0 Z" fill="#7a4b2a"/>`);
      default: return g(`<circle r="${R2(s * 0.6)}" fill="${C.muc}"/>`);
    }
  }).join("");
}

function txt(x, y, s, u, { size = 2.2, weight = 600, fill = C.muc, italic = false, serif = false, anchor = "middle", rot = 0, halo = true } = {}) {
  if (!s) return "";
  const fs = R2(size * u);
  return `<text x="${R2(x)}" y="${R2(y)}" font-size="${fs}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${italic ? ' font-style="italic"' : ""}
    font-family="${serif ? "Cormorant Garamond, Georgia, serif" : "Be Vietnam Pro, Arial, sans-serif"}"${rot ? ` transform="rotate(${rot} ${R2(x)} ${R2(y)})"` : ""}
    ${halo ? `stroke="#fffaf0" stroke-width="${R2(fs * 0.28)}" stroke-linejoin="round" paint-order="stroke"` : ""}>${esc(s)}</text>`;
}


// Đặt nhãn tránh chồng lên sao và lên nhau: thử lần lượt vài vị trí quanh vật thể.
const LBL = {
  song: { size: 2.7, italic: true, serif: true, fill: C.nuocChu, weight: 700 }, nho: { size: 1.9, weight: 500, fill: C.mucNhat },
  nha: { size: 2.4, weight: 600 }, vung: { size: 2.9, italic: true, serif: true, weight: 700, fill: C.mucNhat }, ky: { size: 2, weight: 500, fill: C.mucNhat },
};
function bldBox(e) {   // khung bao (theo trục) của một công trình
  if (e.r) {
    const [cx, cy, w, h, rot] = e.r, a = ((rot || 0) * Math.PI) / 180;
    const hw = (Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a))) / 2, hh = (Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a))) / 2;
    return [cx - hw, cy - hh, cx + hw, cy + hh];
  }
  const xs = e.p.map((q) => q[0]), ys = e.p.map((q) => q[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function placeLabels(plan, u, starXY) {
  const items = [];
  const solids = plan.els.filter((e) => e.t === "bld" && e.k !== "dan" && (e.r || e.hl)).map((e) => ({ e, b: bldBox(e) }));
  plan.els.forEach((e) => {
    const text = nm(e.n); if (!text) return;
    if (e.t === "label") {
      const st = LBL[e.k] || LBL.vung, half = (text.length * st.size * u * 0.56) / 2 + u * 2.2, [x, y] = e.p;
      items.push({ text, st, rot: e.rot, cands: [[x, y], [x, y + u * 3], [x, y - u * 3], [x + half, y], [x - half, y], [x, y + u * 5.5], [x, y - u * 5.5]], fixed: !!e.rot });
    }
    else if (e.t === "bld") {
      const bb = bldBox(e), cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2, hw = (bb[2] - bb[0]) / 2, hh = (bb[3] - bb[1]) / 2;
      const fs = LBL.nha.size * u, tw = text.length * fs * 0.56, g = u * 1.2;
      const c = [[cx, cy + hh + g + fs * 0.8], [cx + hw + g + tw / 2, cy + fs * 0.35], [cx - hw - g - tw / 2, cy + fs * 0.35], [cx, cy - hh - g], [cx, cy + fs * 0.35]];
      if (e.r && e.lo) c.unshift([e.r[0] + e.lo[0], e.r[1] + e.lo[1]]);
      items.push({ text, st: LBL.nha, cands: c, own: e });
    } else if (e.t === "sym") {
      const [x, y] = e.p[0], d = u * 3.6 * (e.k === "cay-lon" ? 1.3 : 1) * (e.s || 1);
      items.push({ text, st: LBL.ky, cands: [[x, y + d], [x, y - d * 0.8], [x + d * 2.2, y + u * 0.6], [x - d * 2.2, y + u * 0.6]] });
    }
  });
  const R = u * 3.5, boxes = [], [x0, y0, w, h] = plan.vb;
  const pad = u * 0.6;
  const box = (x, y, it) => { const fs = it.st.size * u, tw = it.text.length * fs * 0.56; return [x - tw / 2 - pad, y - fs * 0.9 - pad, x + tw / 2 + pad, y + fs * 0.3 + pad]; };
  const over = (o, b) => !(o[2] < b[0] || o[0] > b[2] || o[3] < b[1] || o[1] > b[3]);
  // điểm phạt: ra ngoài khung nặng nhất, rồi đè sao, đè nhãn khác, đè công trình khác
  const cost = (b, own) => (b[0] < x0 + u || b[2] > x0 + w - u || b[1] < y0 + u || b[3] > y0 + h - u ? 100 : 0)
    + 10 * starXY.filter(([sx, sy]) => sx > b[0] - R && sx < b[2] + R && sy > b[1] - R && sy < b[3] + R).length
    + 6 * boxes.filter((o) => over(o, b)).length + 2 * solids.filter((q) => q.e !== own && over(q.b, b)).length;
  return items.map((it) => {
    let pick = it.cands[0];
    if (!it.fixed) {
      let best = Infinity;
      for (const c of it.cands) { const k = cost(box(c[0], c[1], it), it.own); if (k < best) { best = k; pick = c; } if (k === 0) break; }
    }
    if (!it.fixed) boxes.push(box(pick[0], pick[1], it));
    return txt(pick[0], pick[1], it.text, u, { ...it.st, rot: it.rot });
  }).join("");
}

function star(x, y, label, u, measured) {
  const R = u * 3.1, r = R * 0.48;
  const p = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R; return [x + rr * Math.cos(a), y + rr * Math.sin(a)]; });
  return `${measured ? `<circle cx="${R2(x)}" cy="${R2(y)}" r="${R2(R * 1.25)}" fill="none" stroke="${C.cham}" stroke-width="${R2(u * 0.5)}"/>` : ""}
    <polygon points="${pts(p.map(([a, b]) => [a + u * 0.35, b + u * 0.45]))}" fill="#3b2a1a" opacity=".3"/>
    <polygon points="${pts(p)}" fill="${C.son}" stroke="#fff" stroke-width="${R2(u * 0.45)}" stroke-linejoin="round"/>
    <text x="${R2(x)}" y="${R2(y + u * 1)}" font-size="${R2(u * 2.7)}" font-weight="800" fill="#fff" text-anchor="middle" font-family="Be Vietnam Pro, Arial, sans-serif">${label}</text>`;
}

function compass(plan, u) {
  if (plan.north == null) return "";
  const [x0, y0, w] = plan.vb, x = x0 + w - u * 6, y = y0 + u * 6.5, r = u * 4.2;
  return `<g transform="translate(${R2(x)},${R2(y)})"><circle r="${R2(r)}" fill="#fffaf0" opacity=".9" stroke="${C.vien}" stroke-width="${R2(u * 0.2)}"/>
    <g transform="rotate(${plan.north})"><path d="M0,${R2(-r * 0.78)} L${R2(r * 0.3)},0 L0,${R2(r * 0.12)} Z" fill="${C.son}"/><path d="M0,${R2(-r * 0.78)} L${R2(-r * 0.3)},0 L0,${R2(r * 0.12)} Z" fill="#d9705c"/>
    <path d="M0,${R2(r * 0.7)} L${R2(r * 0.3)},0 L${R2(-r * 0.3)},0 Z" fill="${C.mucNhat}" opacity=".7"/>
    <text y="${R2(-r * 0.86)}" dy="${R2(-u * 0.5)}" font-size="${R2(u * 2.1)}" font-weight="800" text-anchor="middle" fill="${C.son}" font-family="Be Vietnam Pro, Arial, sans-serif" stroke="#fffaf0" stroke-width="${R2(u * 0.5)}" paint-order="stroke">${t("north1")}</text></g></g>`;
}

function scaleBar(plan, u) {
  const mpu = metersPerUnit(plan); if (!mpu) return "";
  const target = (plan.vb[2] * mpu) / 5, nice = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000].reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
  const len = nice / mpu, x = plan.vb[0] + u * 3, y = plan.vb[1] + plan.vb[3] - u * 3.2;
  return `<g><rect x="${R2(x - u)}" y="${R2(y - u * 3.6)}" width="${R2(len + u * 2)}" height="${R2(u * 5)}" rx="${R2(u * 0.6)}" fill="#fffaf0" opacity=".85"/>
    <path d="M${R2(x)},${R2(y - u * 0.8)} V${R2(y)} H${R2(x + len)} V${R2(y - u * 0.8)}" fill="none" stroke="${C.muc}" stroke-width="${R2(u * 0.3)}"/>
    <rect x="${R2(x)}" y="${R2(y - u * 0.5)}" width="${R2(len / 2)}" height="${R2(u * 0.5)}" fill="${C.muc}"/>
    ${txt(x + len / 2, y - u * 1.4, `${nice >= 1000 ? `${nice / 1000} km` : `${nice} m`}`, u, { size: 1.9, halo: false })}</g>`;
}

function entrance(e, u) {
  const [x, y, a = 0] = e;
  return `<g transform="translate(${R2(x)},${R2(y)}) rotate(${a})"><path d="M0,${R2(-u * 2.4)} L${R2(u * 1.6)},${R2(u * 0.4)} L${R2(u * 0.55)},${R2(u * 0.4)} L${R2(u * 0.55)},${R2(u * 2.2)} L${R2(-u * 0.55)},${R2(u * 2.2)} L${R2(-u * 0.55)},${R2(u * 0.4)} L${R2(-u * 1.6)},${R2(u * 0.4)} Z" fill="${C.cham}" stroke="#fff" stroke-width="${R2(u * 0.3)}"/></g>`;
}

// ---------- SVG hoàn chỉnh ----------
export function planSvg(site, plan, { id = "sd", link = true } = {}) {
  const u = U(plan), [x0, y0, w, h] = plan.vb;
  const stops = site.stops.map((st, i) => ({ st, i, xy: plan.stops[st.id] })).filter((q) => q.xy);
  const measured = new Set(plan.measured || []);
  const order = plan.route || stops.map((q) => q.xy);
  const routePts = [];   // chèn điểm giữa để đặt mũi tên chỉ hướng
  order.forEach((p, i) => { if (i) routePts.push([(order[i - 1][0] + p[0]) / 2, (order[i - 1][1] + p[1]) / 2]); routePts.push(p); });
  const blds = plan.els.filter((e) => e.t === "bld");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${w} ${h}" class="sodo-svg" role="img" aria-label="${esc(t("planTitle"))}: ${esc(L(site.name))}">
    ${defs(id, u)}
    <rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="${C.giay}"/>
    ${plan.els.filter((e) => e.t === "area").map((e) => area(e, id, u)).join("")}
    ${plan.els.filter((e) => e.t === "line" && e.k === "song").map((e) => line(e, u)).join("")}
    ${plan.els.filter((e) => e.t === "line" && e.k !== "song").map((e) => line(e, u)).join("")}
    ${plan.boundary ? `<polygon points="${pts(plan.boundary)}" fill="${C.son}" fill-opacity=".05" stroke="#fffaf0" stroke-width="${R2(u * 1.2)}" stroke-linejoin="round"/>
      <polygon points="${pts(plan.boundary)}" fill="none" stroke="${C.son}" stroke-width="${R2(u * 0.45)}" stroke-dasharray="${R2(u * 1.8)} ${R2(u * 1)}" stroke-linejoin="round"/>` : ""}
    ${blds.filter((e) => e.k === "dan").map((e) => bld(e, u)).join("")}
    ${blds.filter((e) => e.k !== "dan").map((e) => bld(e, u)).join("")}
    ${plan.els.filter((e) => e.t === "sym").map((e) => sym(e, u)).join("")}
    ${routePts.length > 1 ? `<polyline points="${pts(routePts)}" fill="none" stroke="#fffaf0" stroke-width="${R2(u * 1.1)}" stroke-linejoin="round" opacity=".8"/>
      <polyline points="${pts(routePts)}" fill="none" stroke="${C.son}" stroke-width="${R2(u * 0.5)}" stroke-dasharray="${R2(u * 1.3)} ${R2(u * 0.9)}" stroke-linejoin="round" marker-mid="url(#${id}-mui)"/>` : ""}
    ${placeLabels(plan, u, stops.map((q) => q.xy))}
    ${plan.entrance.map((e) => entrance(e, u)).join("")}
    <g class="sodo-here" style="display:none"></g>
    ${stops.map(({ st, i, xy }) => {
      const s = star(xy[0], xy[1], i, u, measured.has(st.id));
      return link ? `<a href="#/stop/${esc(st.id)}" aria-label="${i}. ${esc(L(st.title))}">${s}</a>` : s;
    }).join("")}
    ${compass(plan, u)}${scaleBar(plan, u)}
  </svg>`;
}

// ---------- chú giải (HTML) ----------
const sw = (inner, vb = "0 0 24 16") => `<svg viewBox="${vb}" width="30" height="20" aria-hidden="true">${inner}</svg>`;
function legend(site, plan) {
  const has = (f) => plan.els.some(f);
  const items = [
    [sw(`<polygon points="12,1 14.6,6.4 20.5,6.9 16,10.8 17.4,16 12,13.1 6.6,16 8,10.8 3.5,6.9 9.4,6.4" fill="${C.son}" stroke="#fff"/>`), t("lgStop")],
    [sw(`<path d="M2,8 H22" stroke="${C.son}" stroke-width="2" stroke-dasharray="4 3"/><path d="M13,5 L17,8 L13,11" fill="none" stroke="${C.son}" stroke-width="1.6"/>`), t("lgRoute")],
    plan.boundary && [sw(`<rect x="2" y="2" width="20" height="12" fill="${C.son}" fill-opacity=".06" stroke="${C.son}" stroke-width="1.4" stroke-dasharray="3 2"/>`), t("lgBoundary")],
    has((e) => e.t === "bld" && e.k !== "dan" && e.k !== "moi") && [sw(`<rect x="3" y="3" width="18" height="10" fill="${C.ngoi}" stroke="${C.ngoiDam}"/><path d="M8,8 H16" stroke="${C.ngoiDam}" stroke-width="1.6"/>`), t("lgMain")],
    has((e) => e.t === "bld" && e.k === "moi") && [sw(`<rect x="3" y="3" width="18" height="10" fill="${C.moi}" stroke="${C.moiDam}"/><path d="M8,8 H16" stroke="${C.moiDam}" stroke-width="1.6"/>`), t("lgNew")],
    has((e) => e.t === "bld" && e.k === "dan") && [sw(`<rect x="4" y="4" width="16" height="9" fill="${C.dan}" stroke="${C.danVien}"/>`), t("lgOther")],
    has((e) => (e.t === "bld" && e.k === "thap") || (e.t === "sym" && e.k === "thap")) && [sw(`<rect x="7" y="3" width="10" height="10" fill="#b56b3a" stroke="#6e3a1c"/><rect x="10" y="6" width="4" height="4" fill="#cf8c56"/>`), t("lgTower")],
    has((e) => (e.t === "bld" && (e.k === "lang" || e.k === "mo")) || (e.t === "sym" && e.k === "mo")) && [sw(`<ellipse cx="12" cy="8" rx="8" ry="5.5" fill="#c9c0ad" stroke="#7d7464"/>`), t("lgTomb")],
    has((e) => (e.t === "area" && e.k === "nuoc") || (e.t === "line" && e.k === "song")) && [sw(`<rect x="2" y="2" width="20" height="12" rx="3" fill="${C.nuoc}" stroke="${C.nuocVien}"/>`), t("lgWater")],
    has((e) => (e.t === "area" && ["co", "rung"].includes(e.k)) || (e.t === "sym" && e.k.startsWith("cay"))) && [sw(`<circle cx="8" cy="8" r="5" fill="${C.cay}" stroke="${C.cayDam}"/><circle cx="16" cy="9" r="4" fill="#7aa565" stroke="${C.cayDam}"/>`), t("lgGreen")],
    has((e) => e.t === "area" && e.k === "doi") && [sw(`<ellipse cx="12" cy="8" rx="10" ry="6.5" fill="${C.doi}" stroke="${C.doiVien}"/><ellipse cx="12" cy="8" rx="5" ry="3" fill="none" stroke="${C.doiVien}"/>`), t("lgHill")],
    has((e) => e.t === "line" && ["duong", "de"].includes(e.k)) && [sw(`<path d="M2,8 H22" stroke="#cdbd9c" stroke-width="6"/><path d="M2,8 H22" stroke="#fffaf0" stroke-width="4"/>`), t("lgRoad")],
    has((e) => e.t === "line" && e.k === "loi") && [sw(`<path d="M2,8 H22" stroke="#a88e68" stroke-width="1.6" stroke-dasharray="3 2"/>`), t("lgPath")],
    has((e) => e.t === "sym" && ["tuong", "bia", "cot", "gieng"].includes(e.k)) && [sw(`<rect x="8" y="3" width="8" height="8" fill="#d9d1c0" stroke="#7d7464"/><circle cx="12" cy="7" r="2.4" fill="#5c5a55"/>`), t("lgObject")],
    plan.entrance.length && [sw(`<path d="M12,1 L17,7 L14,7 L14,15 L10,15 L10,7 L7,7 Z" fill="${C.cham}"/>`), t("lgEntrance")],
    plan.measured?.length && [sw(`<circle cx="12" cy="8" r="6.5" fill="none" stroke="${C.cham}" stroke-width="1.6"/><circle cx="12" cy="8" r="3.5" fill="${C.son}"/>`), t("lgMeasured")],
    plan.georef && [sw(`<circle cx="12" cy="8" r="6" fill="${C.chamXanh}" opacity=".2"/><circle cx="12" cy="8" r="3.4" fill="${C.chamXanh}" stroke="#fff" stroke-width="1.4"/>`), t("lgHere")],
  ].filter(Boolean);
  return `<ul class="sodo-legend">${items.map(([s, l]) => `<li>${s}<span>${esc(l)}</span></li>`).join("")}</ul>`;
}

export function planSection(site) {
  const plan = site.plan;
  if (!plan) return `<p class="muted">${t("planNone")}</p>`;
  const total = site.stops.length, n = plan.measured?.length || 0;
  const note = plan.mode === "met" ? t("planNoteMet") : t("planNoteMinhHoa");
  return `<div class="sodo">
    <div class="sodo-bar"><h2>${t("planTitle")}</h2>
      <div class="row"><button class="icon-btn" type="button" data-zoom="-1" aria-label="${t("zoomOut")}">${icon("minus")}</button>
      <button class="icon-btn" type="button" data-zoom="1" aria-label="${t("zoomIn")}">${icon("plus")}</button>
      <button class="btn small" type="button" data-plan-png>${icon("download")}${t("downloadPlan")}</button></div></div>
    <div class="sodo-grid"><div class="sodo-map">
    <div class="sodo-khung" tabindex="0" aria-label="${esc(t("planTitle"))}"><div class="sodo-zoom">${planSvg(site, plan)}</div></div>
    <div class="sodo-here-msg small muted" hidden></div></div>
    <div><h3 class="sodo-h">${t("legend")}</h3>
    ${legend(site, plan)}
    <ol class="sodo-stops" start="0">${site.stops.map((st, i) => `<li><a href="#/stop/${esc(st.id)}"><b>${i}</b><span>${esc(L(st.title))}<small>${esc(L(st.where) || "")}</small></span>${(plan.measured || []).includes(st.id) ? `<em>${t("measuredShort")}</em>` : ""}</a></li>`).join("")}</ol>
    <p class="sodo-note small">${esc(note)}${n ? ` ${esc(t("planMeasured", n, total, plan.rms))}` : ""}
      ${plan.source ? `<br>${t("planSource")}: ${esc(L(plan.source))}` : ""}${plan.osm ? `<br>${t("planOsm")}` : ""}</p>
    ${surveyBlock(site)}
  </div></div></div>`;
}

// ---------- tương tác ----------
export function wirePlan(root, site) {
  const plan = site.plan; if (!plan) return () => {};
  const zoomBox = root.querySelector(".sodo-zoom"), khung = root.querySelector(".sodo-khung");
  let z = 1;
  root.querySelectorAll("[data-zoom]").forEach((b) => b.addEventListener("click", () => {
    const k = Number(b.dataset.zoom), cx = (khung.scrollLeft + khung.clientWidth / 2) / zoomBox.offsetWidth, cy = (khung.scrollTop + khung.clientHeight / 2) / zoomBox.offsetHeight;
    z = Math.min(4, Math.max(1, z * (k > 0 ? 1.5 : 1 / 1.5)));
    khung.classList.toggle("zoomed", z > 1);
    zoomBox.style.width = `${z * 100}%`;
    khung.scrollLeft = cx * zoomBox.offsetWidth - khung.clientWidth / 2; khung.scrollTop = cy * zoomBox.offsetHeight - khung.clientHeight / 2;
  }));
  root.querySelector("[data-plan-png]")?.addEventListener("click", () => exportPng(site));
  wireSurvey(root, site);
  // chấm "Bạn đang ở đây"
  const here = root.querySelector(".sodo-here"), msg = root.querySelector(".sodo-here-msg");
  const draw = () => {
    const show = (v) => { here.style.display = v ? "" : "none"; };
    if (!plan.georef || !Geo.position) { show(false); if (msg) msg.hidden = true; return; }
    const xy = geoToPlan(plan, Geo.position.lat, Geo.position.lng), u = U(plan), [x0, y0, w, h] = plan.vb;
    const inside = xy && xy[0] > x0 && xy[0] < x0 + w && xy[1] > y0 && xy[1] < y0 + h;
    if (!inside) { show(false); if (msg) { msg.hidden = false; msg.textContent = t("hereOutside"); } return; }
    const acc = (Geo.accuracy || 0) / (metersPerUnit(plan) || 1);
    here.innerHTML = `<circle cx="${R2(xy[0])}" cy="${R2(xy[1])}" r="${R2(Math.max(acc, u * 2))}" fill="${C.chamXanh}" opacity=".15"/>
      <circle class="sodo-pulse" cx="${R2(xy[0])}" cy="${R2(xy[1])}" r="${R2(u * 1.5)}" fill="${C.chamXanh}" stroke="#fff" stroke-width="${R2(u * 0.5)}"/>
      ${txt(xy[0], xy[1] - u * 2.6, t("lgHere"), u, { size: 2, fill: C.chamXanh, weight: 700 })}`;
    show(true); if (msg) msg.hidden = true;
  };
  draw();
  return Geo.on(draw);
}

async function exportPng(site) {
  const plan = site.plan, [, , w, h] = plan.vb, W = 2000, Hm = Math.round((W * h) / w), pad = 60, head = 150;
  const cols = 2, rowH = 46, listH = Math.ceil(site.stops.length / cols) * rowH + 40;
  const H = head + Hm + listH + pad * 2;
  const svg = planSvg(site, plan, { id: "png", link: false }).replace("<svg ", `<svg width="${W}" height="${Hm}" `);
  const img = new Image();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  try { await img.decode(); } catch { toast(t("planPngFail")); return; }
  const cv = document.createElement("canvas"); cv.width = W + pad * 2; cv.height = H;
  const g = cv.getContext("2d");
  g.fillStyle = "#f7f2e9"; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = "#1e1b18"; g.font = "700 56px 'Be Vietnam Pro', Arial, sans-serif"; g.fillText(L(site.name), pad, 90);
  g.fillStyle = "#b93a26"; g.font = "600 30px 'Be Vietnam Pro', Arial, sans-serif"; g.fillText(`${t("planTitle")} · Kinh Bắc Ký Sự`, pad, 132);
  g.drawImage(img, pad, head, W, Hm);
  g.strokeStyle = "#1e1b18"; g.lineWidth = 3; g.strokeRect(pad, head, W, Hm);
  g.font = "500 28px 'Be Vietnam Pro', Arial, sans-serif";
  site.stops.forEach((st, i) => {
    const x = pad + (i % cols) * (W / cols), y = head + Hm + 56 + Math.floor(i / cols) * rowH;
    g.fillStyle = "#b93a26"; g.beginPath(); g.arc(x + 16, y - 10, 17, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fff"; g.font = "800 22px 'Be Vietnam Pro', Arial, sans-serif"; g.textAlign = "center"; g.fillText(String(i), x + 16, y - 2);
    g.textAlign = "left"; g.fillStyle = "#1e1b18"; g.font = "500 28px 'Be Vietnam Pro', Arial, sans-serif";
    g.fillText(`${L(st.title)}`.slice(0, 52), x + 46, y);
  });
  g.fillStyle = "#6e655b"; g.font = "400 22px 'Be Vietnam Pro', Arial, sans-serif";
  g.fillText((plan.mode === "met" ? t("planNoteMet") : t("planNoteMinhHoa")) + (plan.osm ? "  " + t("planOsm") : ""), pad, H - 26);
  cv.toBlob((b) => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `so-do-${site.id}.png`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, "image/png");
}

// ---------- khảo sát thực địa ----------
const SURVEY = "khaosat";
const surveyData = () => store.get(SURVEY, {});
function surveyBlock(site) {
  const d = surveyData();
  return `<details class="card sodo-survey"><summary>${icon("pin")}<span>${t("survey")}<small>${t("surveyText")}</small></span></summary>
    <div class="card-body">
      <ol class="survey-list" start="0">${site.stops.map((st, i) => { const r = d[st.id]; return `<li data-stop="${esc(st.id)}"><span><b>${i}.</b> ${esc(L(st.title))}<small>${esc(L(st.where) || "")}</small>
        <em class="small">${r ? t("surveyDone", Math.round(r.acc)) : ""}</em></span><button class="btn small" type="button" data-survey="${esc(st.id)}">${icon("pin")}${r ? t("surveyAgain") : t("surveyRecord")}</button></li>`; }).join("")}</ol>
      <div class="row"><button class="btn primary small" type="button" data-survey-export>${icon("share")}${t("surveyExport")}</button>
      <span class="small muted" data-survey-count>${t("surveyCount", Object.keys(d).length)}</span></div>
    </div></details>`;
}
function wireSurvey(root, site) {
  root.querySelectorAll("[data-survey]").forEach((b) => b.addEventListener("click", () => recordStop(b, site)));
  root.querySelector("[data-survey-export]")?.addEventListener("click", exportSurvey);
}
function recordStop(btn, site) {
  if (!("geolocation" in navigator)) { toast(t("gpsNo")); return; }
  const id = btn.dataset.survey, li = btn.closest("li"), em = li.querySelector("em");
  btn.disabled = true; em.textContent = t("surveyGetting");
  let best = null, watch = null;
  const finish = () => {
    navigator.geolocation.clearWatch(watch); clearTimeout(timer); btn.disabled = false;
    if (!best) { em.textContent = t("surveyFail"); return; }
    const d = surveyData(); d[id] = { ...best, site: site.id, ngay: new Date().toISOString() }; store.set(SURVEY, d);
    em.textContent = t("surveyDone", Math.round(best.acc)); btn.lastChild.textContent = t("surveyAgain");
    const cnt = btn.closest(".sodo-survey")?.querySelector("[data-survey-count]");
    if (cnt) cnt.textContent = t("surveyCount", Object.keys(d).length);
  };
  const timer = setTimeout(finish, 20000);   // đợi tối đa 20 giây, lấy lần đo chính xác nhất
  watch = navigator.geolocation.watchPosition((p) => {
    const c = p.coords;
    if (!best || c.accuracy < best.acc) best = { lat: +c.latitude.toFixed(7), lng: +c.longitude.toFixed(7), acc: +c.accuracy.toFixed(1) };
    em.textContent = t("surveyAcc", Math.round(c.accuracy));
    if (c.accuracy <= 5) finish();
  }, () => { finish(); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
}
async function exportSurvey() {
  const d = surveyData();
  if (!Object.keys(d).length) { toast(t("surveyEmpty")); return; }
  const body = JSON.stringify({ app: "kinh-bac-ky-su", loai: "khao-sat-diem-dung", xuat: new Date().toISOString(), lang: settings.lang, diem: d }, null, 1);
  const name = `khao-sat-${new Date().toISOString().slice(0, 10)}.json`;
  try {
    const file = new File([body], name, { type: "application/json" });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: t("survey") }); return; }
  } catch (e) { if (e?.name === "AbortError") return; }
  download(name, body);
  toast(t("surveySaved"));
}
