// Các mẩu giao diện dùng lại: chữ, biểu tượng, ảnh, dấu son, liên kết Google Maps.
import { UI } from "./i18n.js";
import { settings, progress, Geo } from "./core.js";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const t = (k, ...a) => { const v = UI[settings.lang]?.[k] ?? UI.vi[k] ?? k; return typeof v === "function" ? v(...a) : v; };
/** Lấy chữ theo ngôn ngữ đang chọn; tiếng Hàn chưa có thì dùng tiếng Anh. */
export const L = (o) => (o && typeof o === "object" && !Array.isArray(o) ? o[settings.lang] ?? (settings.lang === "ko" ? o.en : null) ?? o.vi : o);

const P = {
  home: "M12 3 2 11h3v9h5v-6h4v6h5v-9h3z",
  map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zm0 2.2 6 2v11.6l-6-2z",
  route: "M6 3h2v18H6zM9 4h10l-2 4 2 4H9z",
  passport: "M6 2h11a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm6 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM8 18h8v1.5H8z",
  more: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  play: "M8 5v14l11-7z", pause: "M6 5h4v14H6zm8 0h4v14h-4z",
  back: "M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z", next: "M4 11h12.2l-5.6-5.6L12 4l8 8-8 8-1.4-1.4 5.6-5.6H4z",
  dir: "M12 2 4.5 20.3l.7.7L12 18l6.8 3 .7-.7z",
  food: "M5 2h1.5v7H8V2h1.5v7H11V2h1.5v8a3 3 0 0 1-2.5 2.95V22H8v-9.05A3 3 0 0 1 5.5 10zM17 2c1.7 0 3 2.5 3 6s-1.3 5-3 5.4V22h-2V2z",
  bed: "M3 6h2v7h14a2 2 0 0 1 2 2v5h-2v-2H5v2H3zM8.5 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM12 9h6a2 2 0 0 1 2 2v1h-8z",
  cafe: "M3 8h14v6a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5zM17 9h1a3 3 0 0 1 0 6h-1v-2h1a1 1 0 0 0 0-2h-1zM2 20h16v2H2zM8 2h1.5v4H8zm3 1h1.5v3H11z",
  gps: "M11 2h2v3.1A7 7 0 0 1 18.9 11H22v2h-3.1A7 7 0 0 1 13 18.9V22h-2v-3.1A7 7 0 0 1 5.1 13H2v-2h3.1A7 7 0 0 1 11 5.1zm1 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z",
  download: "M11 3h2v9.2l3.6-3.6L18 10l-6 6-6-6 1.4-1.4 3.6 3.6zM4 18h16v2H4z",
  check: "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z",
  quiz: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2zm2.1-7.8-.9.9C13.5 10.9 13 11.5 13 13h-2v-.5c0-1.1.4-2.1 1.2-2.8l1.2-1.3A2 2 0 0 0 12 6a2 2 0 0 0-2 2H8a4 4 0 1 1 7.1 1.2z",
  calendar: "M7 2h2v2h6V2h2v2h3v18H4V4h3zM6 9v11h12V9zm2 2h3v3H8z",
  clock: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm1 3v5.4l4 2.4-.8 1.3L11 13V7z",
  timeline: "M4 4h2v16H4zM9 5h11v4H9zM9 11h8v4H9zM9 17h10v3H9z",
  qr: "M3 3h8v8H3zm2 2v4h4V5zm8-2h8v8h-8zm2 2v4h4V5zM3 13h8v8H3zm2 2v4h4v-4zm8-2h2v2h-2zm4 0h4v2h-4zm-4 4h4v4h-2v-2h-2zm6 2h2v2h-2z",
  class: "M2 4h20v13H2zm2 2v9h16V6zM8 19h8v2H8zm2-11 6 3.5-6 3.5z",
  settings: "M4 6h9v2H4zm13 0h3v2h-3zm-2-2h2v6h-2zM4 16h3v2H4zm7 0h9v2h-9zm-2-2h2v6H9zM4 11h4v2H4zm8 0h8v2h-8zm-2-2h2v6h-2z",
  info: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2zm0-8h-2V7h2z",
  pen: "M3 17.3V21h3.8L17.8 9.9 14 6.2zM20.7 7c.4-.4.4-1 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8L19 8.8z",
  close: "M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6z",
  star: "M12 2l2.9 6.9L22 9.3l-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.3l7.1-.4z",
  video: "M3 5h13v14H3zm15 4 4-3v12l-4-3z",
  pin: "M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z",
  book: "M4 3h6a3 3 0 0 1 3 3v15a2 2 0 0 0-2-2H4zm16 0h-5a3 3 0 0 0-1 .2V21a2 2 0 0 1 2-2h4z",
  gift: "M3 8h18v4H3zm1 5h7v8H4zm9 0h7v8h-7zM12 8C10 4 7 4 7 6s3 2 5 2zm0 0c2-4 5-4 5-2s-3 2-5 2z",
  lantern: "M11 2h2v2.1A6 6 0 0 1 18 10v3a6 6 0 0 1-12 0v-3a6 6 0 0 1 5-5.9zM10 20h4v2h-4z",
  skipNext: "M6 6l8.5 6L6 18zM16 6h2v12h-2z", skipPrev: "M18 6l-8.5 6L18 18zM6 6h2v12H6z",
  share: "M18 16a3 3 0 0 0-2.4 1.2l-6.7-3.4a3 3 0 0 0 0-1.6l6.7-3.4A3 3 0 1 0 15 7l-6.7 3.4a3 3 0 1 0 0 3.2L15 17a3 3 0 1 0 3-1z",
  globe: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-3a15.7 15.7 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8zM12 4c.8 1.2 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.8 1.9-4zM4.3 14a8.2 8.2 0 0 1 0-4h3.4a16.5 16.5 0 0 0 0 4zm.8 2h3a15.7 15.7 0 0 0 1.4 3.6A8 8 0 0 1 5.1 16zm3-8h-3a8 8 0 0 1 4.4-3.6C8.8 5.5 8.3 6.7 8.1 8zM12 20c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.8-1.9 4zm2.3-6H9.7a14.7 14.7 0 0 1 0-4h4.6a14.7 14.7 0 0 1 0 4zm.3 5.6c.6-1.1 1.1-2.3 1.4-3.6h3a8 8 0 0 1-4.4 3.6zm1.7-5.6a16.5 16.5 0 0 0 0-4h3.4a8.2 8.2 0 0 1 0 4z",
};
export const icon = (n, cls = "") => `<svg viewBox="0 0 24 24" aria-hidden="true"${cls ? ` class="${cls}"` : ""}><path d="${P[n] || ""}"/></svg>`;

// ---------- Google Maps (không cần khóa API) ----------
export const gm = {
  dir: (g) => `https://www.google.com/maps/dir/?api=1&destination=${g.lat},${g.lng}&travelmode=driving`,
  place: (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
  near: (term, g, z = 15) => `https://www.google.com/maps/search/${encodeURIComponent(term)}/@${g.lat},${g.lng},${z}z`,
  route: (pts) => {
    if (pts.length < 2) return gm.dir(pts[0]);
    const s = (p) => `${p.lat},${p.lng}`;
    const mid = pts.slice(1, -1).map(s).join("|");
    return `https://www.google.com/maps/dir/?api=1&origin=${s(pts[0])}&destination=${s(pts.at(-1))}${mid ? `&waypoints=${encodeURIComponent(mid)}` : ""}&travelmode=driving`;
  },
};
export const gmTerms = {
  food: { vi: "quán ăn", en: "restaurants", ko: "restaurants" },
  cafe: { vi: "quán cà phê", en: "cafe", ko: "cafe" },
  hotel: { vi: "khách sạn", en: "hotels", ko: "hotels" },
  stay: { vi: "nhà nghỉ homestay", en: "guest house homestay", ko: "guest house" },
};

export function distLabel(site) {
  if (!Geo.position) return "";
  return t("awayKm", Geo.fmt(Geo.distance(Geo.position, site.gps)));
}

// ---------- Dấu son của từng di tích ----------
export function stampSvg(site, state = "none", size = 96) {
  // state: none | half | done
  const name = (site.short || L(site.name)).toUpperCase().replace(/^(CHÙA|ĐỀN|ĐÌNH|LÀNG|THÀNH|KHU|LĂNG|QUẦN THỂ)\s+/u, "");
  const words = name.split(/\s+/);
  const lines = words.length > 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : words.length === 2 ? words : [name];
  const red = state === "done" ? "var(--son-600)" : "none";
  const ink = state === "done" ? "#fbf7ef" : state === "half" ? "var(--son-600)" : "var(--giay-300)";
  const dash = state === "half" ? ' stroke-dasharray="6 4"' : "";
  const fs = lines.some((l) => l.length > 9) ? 13 : 16;
  const rot = ((site.id.charCodeAt(0) + site.id.length) % 7) - 3;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${esc(L(site.name))}">
    <g transform="rotate(${state === "done" ? rot : 0} 50 50)">
    <rect x="6" y="6" width="88" height="88" rx="8" fill="${red}" stroke="${state === "done" ? "var(--son-600)" : ink}" stroke-width="3"${dash}/>
    <rect x="12" y="12" width="76" height="76" rx="4" fill="none" stroke="${ink}" stroke-width="1.5" opacity=".8"/>
    ${lines.map((l, i) => `<text x="50" y="${(lines.length === 1 ? 52 : 44 + i * 18)}" text-anchor="middle" font-family="Alegreya, serif" font-weight="800" font-size="${fs}" fill="${ink}">${esc(l)}</text>`).join("")}
    <text x="50" y="80" text-anchor="middle" font-family="Alegreya, serif" font-weight="700" font-size="11" fill="${ink}" opacity=".9">${esc(site.era?.year ?? "")}</text>
    </g></svg>`;
}
export const stampState = (id) => (progress.stamped[id] ? "done" : progress.arrived[id] || progress.quiz[id] ? "half" : "none");

// ---------- Ảnh ----------
export function photoCredit(p) {
  if (!p || p.todo) return "";
  const who = [p.credit, p.license].filter(Boolean).join(" · ");
  const cap = L(p.caption) || "";
  const link = p.url ? ` <a href="${esc(p.url)}" target="_blank" rel="noopener">${t("photoBy")}: ${esc(who)}</a>` : who ? ` ${t("photoBy")}: ${esc(who)}` : "";
  return `${esc(cap)}${cap && link ? " —" : ""}${link}`;
}
export function gallery(photos, id = "g") {
  const list = (photos || []).filter(Boolean);
  if (!list.length) return `<div class="gallery"><div class="ph-todo"><p>${t("photoTodo")}</p></div></div>`;
  return `<div class="gallery" data-gallery="${id}">
    <div class="track">${list.map((p, i) => p.todo
      ? `<figure><div class="ph-todo"><p><b>${esc(L(p.caption) || "")}</b><br>${t("photoTodo")}</p></div></figure>`
      : `<figure><img src="${esc(p.src)}" alt="${esc(L(p.alt) || L(p.caption) || "")}" ${i ? 'loading="lazy"' : ""} data-full="${esc(p.src)}" data-i="${i}"></figure>`).join("")}</div>
    ${list.length > 1 ? `<button class="nav-btn prev" type="button" aria-label="‹">${icon("back")}</button><button class="nav-btn next" type="button" aria-label="›">${icon("next")}</button>` : ""}
    <div class="gallery-cap" style="padding:8px 16px 0;font-size:.82rem;color:var(--muc-600)">${photoCredit(list[0])}</div>
    ${list.length > 1 ? `<div class="dots">${list.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>` : ""}
  </div>`;
}
export function wireGallery(root, photos) {
  root.querySelectorAll("[data-gallery]").forEach((g) => {
    const track = g.querySelector(".track");
    const dots = [...g.querySelectorAll(".dots i")];
    const cap = g.querySelector(".gallery-cap");
    const list = (photos || []).filter(Boolean);
    let cur = 0;
    const update = () => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      if (i === cur) return;
      cur = i; dots.forEach((d, k) => d.classList.toggle("on", k === i));
      if (cap) cap.innerHTML = photoCredit(list[i]);
    };
    track.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
    g.querySelector(".prev")?.addEventListener("click", () => track.scrollBy({ left: -track.clientWidth, behavior: "smooth" }));
    g.querySelector(".next")?.addEventListener("click", () => track.scrollBy({ left: track.clientWidth, behavior: "smooth" }));
    track.addEventListener("click", (e) => {
      const img = e.target.closest("img[data-full]");
      if (!img) return;
      const p = list[+img.dataset.i];
      const box = document.createElement("div");
      box.className = "lightbox";
      box.innerHTML = `<div><img src="${esc(img.dataset.full)}" alt="${esc(img.alt)}"><p>${photoCredit(p)}</p></div><button class="icon-btn" type="button" aria-label="Đóng">${icon("close")}</button>`;
      box.addEventListener("click", (ev) => { if (!ev.target.closest("a")) box.remove(); });
      document.body.append(box);
    });
  });
}

export function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast"; el.setAttribute("role", "status"); el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}
export function download(name, text, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export const rankLabel = (r) => ({ "dac-biet": t("rankDB"), "quoc-gia": t("rankQG"), unesco: t("rankUnesco"), pvt: t("rankPVT") }[r] || "");
export const fmtDate = (d) => d.toLocaleDateString(settings.lang === "vi" ? "vi-VN" : settings.lang === "ko" ? "ko-KR" : "en-GB", { weekday: "short", day: "numeric", month: "numeric", year: "numeric" });
